

declare var process: any;
"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type, GenerateContentResponse, Chat } from "@google/genai";
import "./index.css";

import {
    apiClient,
    advancedTechniqueOptions,
    // Types
    Profile,
    Routine,
    DietPlan,
    Exercise,
    ClientData,
    ClientListItem,
    ProgressLog,
    BodyWeightEntry,
    ExerciseLibrary,
    ProgressLogEntry,
    ExerciseDefinition,
    Gym,
    Phase,
    DayPlan,
    Request as TrainerRequest, // Renamed to avoid conflict
    PlanType,
    RoutineTemplate,
    AccountingAccount,
    FixedExpense,
    ExpenseCategoryGroup,
    AccountingTransaction,
} from './apiClient';

// Initialize the GoogleGenAI client.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });


// --- Utility Functions ---

/**
 * A utility function to pause execution for a given number of milliseconds.
 * @param ms The number of milliseconds to sleep.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wraps an async function with an exponential backoff retry mechanism.
 * @param fn The async function to execute.
 * @param maxRetries The maximum number of retries.
 * @param baseDelay The initial delay in milliseconds.
 * @returns The result of the wrapped function.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
        try {
            return await fn();
        } catch (err: any) {
            const errorMessage = err.toString().toLowerCase();
            const isRetryable = errorMessage.includes('503') || errorMessage.includes('overloaded');

            if (isRetryable && attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.warn(`API call failed with retryable error. Retrying in ${delay}ms... (Attempt ${attempt + 1}/${maxRetries})`);
                await sleep(delay);
                attempt++;
            } else {
                // Not a retryable error or max retries reached, re-throw.
                throw err;
            }
        }
    }
    // This part is technically unreachable due to the throw in the catch block,
    // but it's good practice for type safety and clarity.
    throw new Error('Function failed after maximum retries.');
}

// Define the missing generateRoutineForClient function.
async function generateRoutineForClient(clientData: ClientData, gymId: string, adminInstructions: string): Promise<Routine> {
    const { profile } = clientData;

    const library = await apiClient.getExerciseLibrary(gymId);
    
    // Filter library to only include enabled exercises to reduce prompt size
    const enabledExercises: ExerciseLibrary = {};
    for (const group in library) {
        enabledExercises[group] = library[group].filter(ex => ex.isEnabled).map(ex => ({ name: ex.name, videoUrl: ex.videoUrl, isEnabled: ex.isEnabled }));
    }

    const prompt = `
        **System Instructions:**
        You are an expert personal trainer AI. Your task is to create a highly personalized and effective workout routine.
        
        **Client Profile:**
        - Name: ${profile.name}
        - Age: ${profile.age} years
        - Gender: ${profile.gender}
        - Weight: ${profile.weight} kg
        - Height: ${profile.height} cm
        - Experience Level: ${profile.level}
        - Main Goal: ${profile.goal}
        - Training Days per week: ${profile.trainingDays}
        - Activity Level (outside gym): ${profile.activityFactor}
        - Desired Training Intensity: ${profile.trainingIntensity}
        - Use Advanced Techniques: ${profile.useAdvancedTechniques} (e.g., Drop Sets, Rest-Pause)
        - Body Focus: ${profile.bodyFocusArea}
        - Specific Muscle Focus: ${profile.muscleFocus}
        - Include Adaptation Phase (1 week): ${profile.includeAdaptationPhase}
        - Include Deload Phase (1 week): ${profile.includeDeloadPhase}
        
        **Trainer's Additional Instructions:**
        ${adminInstructions || "No specific instructions from the trainer."}

        **Available Exercises (MUST use ONLY these exercises):**
        ${JSON.stringify(enabledExercises, null, 2)}
        
        **Task:**
        Based on all the provided information, generate a complete JSON object for a structured workout routine.
        The JSON MUST strictly follow the provided schema. Do not add any extra text or markdown formatting around the JSON object.
        - The routine should be divided into logical phases (e.g., Adaptation, Hypertrophy, Deload).
        - If 'includeAdaptationPhase' is "Sí", the first phase MUST be an "Adaptation" phase of 1 week.
        - If 'includeDeloadPhase' is "Sí", the last phase MUST be a "Deload" phase of 1 week, with reduced volume (fewer sets/reps) and intensity.
        - Distribute the training days logically across the week.
        - For each exercise, provide a reasonable number of series, repetitions, and rest time. Repetitions can be a range (e.g., "8-12").
        - If 'useAdvancedTechniques' is "Sí", apply ONE suitable advanced technique to ONLY ONE exercise per workout day, preferably the last exercise for a muscle group. Choose from: ${advancedTechniqueOptions.map(o => o.label).join(', ')}.
        - Ensure the 'grupoMuscular' for each day accurately reflects the exercises for that day. It must be one of the keys from the provided exercise library.
        - The total duration of the plan ('totalDurationWeeks') should be the sum of all phase durations.
        - The 'planName' should be a creative and motivating name for the routine.
    `;

    const exerciseSchema = {
        type: Type.OBJECT,
        properties: {
            nombre: { type: Type.STRING, description: "Name of the exercise from the provided list." },
            series: { type: Type.STRING, description: "Number of sets, e.g., '3' or '4'." },
            repeticiones: { type: Type.STRING, description: "Number of reps, e.g., '10' or '8-12'." },
            descanso: { type: Type.STRING, description: "Rest time in seconds, e.g., '60s'." },
            tecnicaAvanzada: { type: Type.STRING, description: "Optional advanced technique, e.g., 'Drop Set'." }
        },
        required: ["nombre", "series", "repeticiones", "descanso"]
    };

    const dayPlanSchema = {
        type: Type.OBJECT,
        properties: {
            dia: { type: Type.STRING, description: "The day of the week, e.g., 'Lunes'." },
            grupoMuscular: { type: Type.STRING, description: "Main muscle group for the day from the library keys." },
            ejercicios: { type: Type.ARRAY, items: exerciseSchema },
            cardio: { type: Type.STRING, description: "Cardio recommendation, e.g., '20 min HIIT' or 'No aplica'." }
        },
        required: ["dia", "grupoMuscular", "ejercicios", "cardio"]
    };

    const phaseSchema = {
        type: Type.OBJECT,
        properties: {
            phaseName: { type: Type.STRING, description: "Name of the phase, e.g., 'Fase de Adaptación'." },
            durationWeeks: { type: Type.NUMBER, description: "Duration of the phase in weeks." },
            routine: {
                type: Type.OBJECT,
                properties: {
                    dias: { type: Type.ARRAY, items: dayPlanSchema }
                },
                required: ["dias"]
            }
        },
        required: ["phaseName", "durationWeeks", "routine"]
    };

    const routineSchema = {
        type: Type.OBJECT,
        properties: {
            planName: { type: Type.STRING, description: "Creative name for the workout plan." },
            totalDurationWeeks: { type: Type.NUMBER, description: "Total duration of the plan in weeks." },
            phases: { type: Type.ARRAY, items: phaseSchema }
        },
        required: ["planName", "totalDurationWeeks", "phases"]
    };

    const result: GenerateContentResponse = await withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: routineSchema,
                temperature: 0.5,
            },
        });
        return response;
    });

    const jsonText = extractJson(result.text);
    if (!jsonText) {
        console.error("Failed to extract JSON from AI response:", result.text);
        throw new Error("La IA no generó una respuesta válida. Por favor, intenta de nuevo.");
    }

    try {
        const generatedRoutine: Routine = JSON.parse(jsonText);
        const correctedRoutine = validateAndCorrectRoutine(generatedRoutine, library);
        return correctedRoutine;
    } catch (e) {
        console.error("Error parsing or validating routine JSON:", e);
        throw new Error("Hubo un problema al procesar la rutina generada. Por favor, intenta de nuevo.");
    }
}

async function generateDietPlanForClient(clientData: ClientData): Promise<DietPlan> {
    const { profile } = clientData;

    const prompt = `
        **System Instructions:**
        You are an expert nutritionist AI. Your task is to create a realistic and healthy diet plan based on the client's profile.
        
        **Client Profile:**
        - Name: ${profile.name}
        - Age: ${profile.age} years
        - Gender: ${profile.gender}
        - Weight: ${profile.weight} kg
        - Height: ${profile.height} cm
        - Experience Level: ${profile.level}
        - Main Goal: ${profile.goal}
        - Training Days per week: ${profile.trainingDays}
        - Activity Level (outside gym): ${profile.activityFactor}

        **Task:**
        Generate a complete JSON object for a diet plan. The JSON MUST strictly follow the provided schema. Do not add any extra text or markdown formatting.
        - The 'planTitle' should be motivating and related to the goal.
        - Calculate the 'totalCalories' based on the Mifflin-St Jeor equation and the activity factor (Sedentario: 1.2, Ligero: 1.375, Activo: 1.55, Muy Activo: 1.725). Adjust calories based on the goal (Pérdida de grasa: -500kcal, Hipertrofia: +300kcal, Mantenimiento: no change).
        - Calculate macronutrients: Protein at 1.8g per kg of body weight, Fat at 25% of total calories, and the rest for Carbs.
        - Create 4-5 meals (e.g., Desayuno, Almuerzo, Merienda, Cena).
        - Provide realistic food items and amounts (in grams, ml, or units) for each meal. Use common foods.
        - Include 2-3 general recommendations.
    `;

    const foodItemSchema = {
        type: Type.OBJECT,
        properties: {
            food: { type: Type.STRING, description: "Name of the food item." },
            amount: { type: Type.STRING, description: "Quantity of the food, e.g., '150g' or '1 taza'." },
        },
        required: ["food", "amount"],
    };

    const mealSchema = {
        type: Type.OBJECT,
        properties: {
            mealName: { type: Type.STRING, description: "Name of the meal, e.g., 'Desayuno'." },
            foodItems: { type: Type.ARRAY, items: foodItemSchema },
        },
        required: ["mealName", "foodItems"],
    };

    const dietPlanSchema = {
        type: Type.OBJECT,
        properties: {
            planTitle: { type: Type.STRING, description: "Motivating title for the diet plan." },
            summary: {
                type: Type.OBJECT,
                properties: {
                    totalCalories: { type: Type.NUMBER },
                    macronutrients: {
                        type: Type.OBJECT,
                        properties: {
                            proteinGrams: { type: Type.NUMBER },
                            carbsGrams: { type: Type.NUMBER },
                            fatGrams: { type: Type.NUMBER },
                        },
                        required: ["proteinGrams", "carbsGrams", "fatGrams"],
                    },
                },
                required: ["totalCalories", "macronutrients"],
            },
            meals: { type: Type.ARRAY, items: mealSchema },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["planTitle", "summary", "meals", "recommendations"],
    };

    const result: GenerateContentResponse = await withRetry(async () => {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: dietPlanSchema,
                temperature: 0.6,
            },
        });
        return response;
    });

    const jsonText = extractJson(result.text);
    if (!jsonText) {
        throw new Error("La IA no generó una respuesta de plan de nutrición válida.");
    }
    
    try {
        return JSON.parse(jsonText);
    } catch (e) {
        throw new Error("Hubo un problema al procesar el plan de nutrición generado.");
    }
}


/**
 * Extracts a JSON object or array from a string that might contain extraneous text.
 * @param text The string to search within.
 * @returns The extracted JSON string, or null if not found.
 */
const extractJson = (text: string): string | null => {
    if (!text) return null;

    // Find the first occurrence of '{' or '['
    const firstBracket = text.indexOf('{');
    const firstSquare = text.indexOf('[');
    let startIndex = -1;

    // Determine the start index, preferring the first one found
    if (firstBracket !== -1 && firstSquare !== -1) {
        startIndex = Math.min(firstBracket, firstSquare);
    } else if (firstBracket !== -1) {
        startIndex = firstBracket;
    } else {
        startIndex = firstSquare;
    }

    if (startIndex === -1) {
        return null; // No JSON object or array found
    }

    const startChar = text[startIndex];
    const endChar = startChar === '{' ? '}' : ']';
    
    // Find the last occurrence of the corresponding closing bracket/brace
    const lastBracket = text.lastIndexOf(endChar);

    if (lastBracket === -1 || lastBracket < startIndex) {
        return null; // No valid JSON structure found
    }
    
    const jsonStr = text.substring(startIndex, lastBracket + 1);

    try {
        JSON.parse(jsonStr);
        return jsonStr;
    } catch (e) {
        // Fallback for potentially incomplete JSON at the end of streams
        // This is a simplified approach. A more robust solution might involve bracket counting.
        if (text.endsWith('```')) {
            const strippedText = text.substring(0, text.length - 3);
            const lastBracketFallback = strippedText.lastIndexOf(endChar);
             if (lastBracketFallback !== -1 && lastBracketFallback > startIndex) {
                const fixedJsonStr = strippedText.substring(startIndex, lastBracketFallback + 1);
                 try {
                    JSON.parse(fixedJsonStr);
                    return fixedJsonStr;
                } catch (e2) {
                     return null;
                }
             }
        }
        return null;
    }
};


/**
 * Calculates BMI and its category.
 * @param weight Weight in kg.
 * @param height Height in cm.
 * @returns An object with the BMI value and category class.
 */
const calculateBMI = (weight: number, height: number): { value: number; categoryClass: string } => {
    if (!weight || !height) return { value: 0, categoryClass: 'unknown' };
    const heightInMeters = height / 100;
    const bmi = weight / (heightInMeters * heightInMeters);
    const roundedBmi = Math.round(bmi * 10) / 10;
    let categoryClass = 'normal';
    if (roundedBmi < 18.5) categoryClass = 'underweight';
    else if (roundedBmi >= 25 && roundedBmi < 30) categoryClass = 'overweight';
    else if (roundedBmi >= 30) categoryClass = 'obesity';
    return { value: roundedBmi, categoryClass: categoryClass };
};

/**
 * Calculates a healthy weight range based on height.
 * @param height Height in cm.
 * @returns A string representing the healthy weight range.
 */
const calculateTargetWeight = (height: number): string => {
    if (!height) return 'N/A';
    const heightInMeters = height / 100;
    const lowerBound = 18.5 * (heightInMeters * heightInMeters);
    const upperBound = 24.9 * (heightInMeters * heightInMeters);
    return `${lowerBound.toFixed(1)}kg - ${upperBound.toFixed(1)}kg`;
};

/**
 * Calculates the estimated final weight based on the client's goal and plan duration.
 * @param clientData The client's data.
 * @returns A string representing the estimated final weight, or 'N/A'.
 */
const calculateEstimatedFinalWeight = (clientData: ClientData): string => {
    const { profile, routine } = clientData;
    const initialWeight = parseFloat(profile.weight);
    const durationWeeks = routine?.totalDurationWeeks;

    if (!initialWeight || !durationWeeks) {
        return 'N/A';
    }

    let weeklyChange = 0;
    switch (profile.goal) {
        case 'Pérdida de grasa':
            weeklyChange = -0.5; // Estimated 0.5kg loss per week
            break;
        case 'Hipertrofia':
            weeklyChange = 0.25; // Estimated 0.25kg gain per week
            break;
        case 'Mantenimiento':
        case 'Resistencia':
        default:
            weeklyChange = 0;
            break;
    }

    const finalWeight = initialWeight + (weeklyChange * durationWeeks);
    return `${finalWeight.toFixed(1)} kg`;
};


/**
 * Calculates the Levenshtein distance between two strings.
 * This is used to find the "closest" string match for correcting AI hallucinations.
 * @param a The first string.
 * @param b The second string.
 * @returns The number of edits to change a to b.
 */
const calculateLevenshteinDistance = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) {
        matrix[0][i] = i;
    }

    for (let j = 0; j <= b.length; j++) {
        matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const substitutionCost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,                         // Deletion
                matrix[j - 1][i] + 1,                         // Insertion
                matrix[j - 1][i - 1] + substitutionCost       // Substitution
            );
        }
    }

    return matrix[b.length][a.length];
};

/**
 * Validates a routine from the AI, correcting any "hallucinated" exercises.
 * It replaces exercises not found in the library with the closest match from the correct muscle group.
 * @param routine The routine object generated by the AI.
 * @param library The gym's official exercise library.
 * @returns A new routine object with corrected exercise names.
 */
const validateAndCorrectRoutine = (routine: Routine, library: ExerciseLibrary): Routine => {
    const correctedRoutine = JSON.parse(JSON.stringify(routine)); // Deep copy to avoid mutation
    const allValidExercises = new Set<string>();
    Object.values(library).forEach(group => {
        (group as ExerciseDefinition[]).forEach(ex => {
            if (ex.isEnabled) {
                allValidExercises.add(ex.name);
            }
        });
    });
    
    const libraryGroups = Object.keys(library);

    for (const phase of correctedRoutine.phases) {
        for (const day of phase.routine.dias) {
            // Find the closest matching muscle group key in the library to handle minor AI naming variations
            let closestGroupKey = day.grupoMuscular;
            if (!library[closestGroupKey]) {
                let minDistance = Infinity;
                for (const libGroup of libraryGroups) {
                    const distance = calculateLevenshteinDistance(day.grupoMuscular, libGroup);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestGroupKey = libGroup;
                    }
                }
            }
            
            const validExercisesForGroup = library[closestGroupKey]?.filter(ex => ex.isEnabled).map(ex => ex.name) || [];
            if (validExercisesForGroup.length === 0) {
                console.warn(`No enabled exercises found for muscle group "${closestGroupKey}". Cannot correct AI hallucinations for this day.`);
                continue; // Skip if there's nothing to correct with
            }

            for (const exercise of day.ejercicios) {
                if (!allValidExercises.has(exercise.nombre)) {
                    const originalName = exercise.nombre;
                    let bestMatch = validExercisesForGroup[0]; // Default to first exercise in group
                    let minDistance = Infinity;

                    for (const validExName of validExercisesForGroup) {
                        const distance = calculateLevenshteinDistance(originalName, validExName);
                        if (distance < minDistance) {
                            minDistance = distance;
                            bestMatch = validExName;
                        }
                    }
                    
                    console.warn(`Corrected AI hallucinated exercise: "${originalName}" was replaced with the closest match "${bestMatch}" in group "${closestGroupKey}".`);
                    exercise.nombre = bestMatch;
                }
            }
        }
    }
    return correctedRoutine;
};


// --- React Components ---

const SvgImage: React.FC<{ svgString: string | null | undefined, altText: string }> = ({ svgString, altText }) => {
    if (!svgString) {
        return null;
    }
    // Handles potential UTF-8 characters in SVG string for btoa
    const toB64 = (str: string) => btoa(unescape(encodeURIComponent(str)));
    const dataUri = `data:image/svg+xml;base64,${toB64(svgString)}`;
    return <img src={dataUri} alt={altText} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
};

const VideoPlayerModal: React.FC<{ videoUrl: string; onClose: () => void }> = ({ videoUrl, onClose }) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    return (
        <div className="video-modal-overlay" onClick={onClose}>
            <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="video-modal-close-btn" onClick={onClose} aria-label="Cerrar video">&times;</button>
                <video src={videoUrl} controls autoPlay playsInline>
                    Tu navegador no soporta la etiqueta de video.
                </video>
            </div>
        </div>
    );
};

// --- Landing, Login & Registration Views ---

const LandingPage: React.FC<{ onIngresar: () => void }> = ({ onIngresar }) => {
    return (
        <div className="login-container landing-view">
            <header>
                <img src="/logo.svg" alt="Scorpion AI Logo" className="app-logo" />
                <h1>Scorpion AI</h1>
                <p className="landing-subtitle">bienvenido a tu plataforma inteligente</p>
            </header>
            <div className="landing-actions">
                <button className="cta-button" onClick={onIngresar}>Ingresar</button>
            </div>
        </div>
    );
};

const LoginPage: React.FC<{ 
    onLogin: (type: 'client' | 'gym', id: string, code?: string) => Promise<void>; 
    error: string; 
    message: string;
    onBack: () => void;
    onGoToRegister: () => void;
}> = ({ onLogin, error, message, onBack, onGoToRegister }) => {
    const [loginType, setLoginType] = useState<'client' | 'gym'>('client');
    const [id, setId] = useState('');
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await onLogin(loginType, id, code);
        } finally {
            // This will only be reached if the login fails and the component doesn't unmount.
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
             <header>
                <img src="/logo.svg" alt="Scorpion AI Logo" className="app-logo" width="80" height="80"/>
            </header>
            <div className="login-box">
                <div className="view-toggle" style={{justifyContent: 'center', marginBottom: '2rem'}}>
                    <button className={`view-toggle-button ${loginType === 'client' ? 'active' : ''}`} onClick={() => setLoginType('client')}>Cliente</button>
                    <button className={`view-toggle-button ${loginType === 'gym' ? 'active' : ''}`} onClick={() => setLoginType('gym')}>Entrenador</button>
                </div>

                <h2>{loginType === 'client' ? 'Acceso Cliente' : 'Acceso Entrenador'}</h2>
                <p>{loginType === 'client' ? 'Ingresa tu DNI y código o contraseña.' : 'Ingresa tu usuario y contraseña.'}</p>
                 {message && <p className="success-text" style={{marginBottom: '1rem'}}>{message}</p>}
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder={loginType === 'client' ? 'DNI' : 'Usuario'}
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        required
                        disabled={isLoading}
                    />
                    <input
                        type='password'
                        placeholder={loginType === 'client' ? 'Código o Contraseña' : 'Contraseña'}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                        disabled={isLoading}
                    />
                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button" disabled={isLoading}>
                        {isLoading ? <><span className="spinner small"></span> Ingresando...</> : 'Ingresar'}
                    </button>
                </form>
                 <button onClick={onGoToRegister} className="back-button simple" style={{ marginTop: '1rem' }}>
                    Crear cuenta de cliente
                </button>
            </div>
             <button onClick={onBack} className="back-button simple" style={{ marginTop: '2rem' }}>Volver</button>
        </div>
    );
};


const ClientRegistrationPage: React.FC<{
    onRegister: (dni: string) => void;
    onBack: () => void;
}> = ({ onRegister, onBack }) => {
    const [dni, setDni] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [selectedGymId, setSelectedGymId] = useState('');
    const [gyms, setGyms] = useState<Gym[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchGyms = async () => {
            const fetchedGyms = await apiClient.getGyms();
            setGyms(fetchedGyms);
            if (fetchedGyms.length > 0) {
                setSelectedGymId(fetchedGyms[0]._id);
            }
            setIsLoading(false);
        };
        fetchGyms();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        if (!/^\d{7,8}$/.test(dni)) {
            setError('Por favor, ingresa un DNI válido (7 u 8 dígitos).');
            return;
        }
        if (!selectedGymId) {
            setError('Por favor, selecciona un gimnasio.');
            return;
        }

        setIsLoading(true);
        const result = await apiClient.registerClient(dni, name, password, selectedGymId);
        if (result.success) {
            onRegister(dni);
        } else {
            setError(result.message || 'Ocurrió un error durante el registro.');
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <header>
                <img src="/logo.svg" alt="Scorpion AI Logo" className="app-logo" width="80" height="80"/>
            </header>
            <div className="login-box">
                <h2>Crear Cuenta de Cliente</h2>
                <p>Completa tus datos para registrarte.</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder="DNI"
                        value={dni}
                        onChange={(e) => setDni(e.target.value)}
                        required
                    />
                    <input
                        type="text"
                        placeholder="Nombre Completo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Contraseña"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Confirmar Contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                    <select
                        value={selectedGymId}
                        onChange={(e) => setSelectedGymId(e.target.value)}
                        required
                        disabled={isLoading || gyms.length === 0}
                    >
                        {isLoading ? (
                            <option>Cargando gimnasios...</option>
                        ) : gyms.length === 0 ? (
                            <option>No se encontraron gimnasios</option>
                        ) : (
                            gyms.map(gym => <option key={gym._id} value={gym._id}>{gym.name}</option>)
                        )}
                    </select>

                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button" disabled={isLoading}>
                        {isLoading ? 'Creando...' : 'Crear Cuenta'}
                    </button>
                </form>
            </div>
            <button onClick={onBack} className="back-button simple" style={{ marginTop: '2rem' }}>Volver al inicio de sesión</button>
        </div>
    );
};

const NewPasswordResetPage: React.FC<{
    dni: string;
    onPasswordSet: () => void;
    onBackToLogin: () => void;
}> = ({ dni, onPasswordSet, onBackToLogin }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!password || !confirmPassword) {
            setError('Ambos campos de contraseña son obligatorios.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        if (password.length < 4) {
            setError('La contraseña debe tener al menos 4 caracteres.');
            return;
        }
        
        setIsLoading(true);
        const result = await apiClient.setNewPassword(dni, password);
        if (result) {
            setSuccess(true);
            setTimeout(() => {
                onPasswordSet();
            }, 2000);
        } else {
            setError('No se pudo actualizar la contraseña. Por favor, inténtalo de nuevo.');
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <header>
                <img src="/logo.svg" alt="Scorpion AI Logo" className="app-logo" width="80" height="80"/>
            </header>
            <div className="login-box">
                <h2>Crear Nueva Contraseña</h2>
                <p>Ingresa tu nueva contraseña para el DNI: {dni}</p>
                {success ? (
                     <p className="success-text">¡Contraseña actualizada con éxito! Redirigiendo al inicio de sesión...</p>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <input
                            type="password"
                            placeholder="Nueva Contraseña"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Confirmar Nueva Contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                        {error && <p className="error-text">{error}</p>}
                        <button type="submit" className="cta-button" disabled={isLoading}>
                            {isLoading ? 'Guardando...' : 'Guardar Contraseña'}
                        </button>
                    </form>
                )}
            </div>
            <button onClick={onBackToLogin} className="back-button simple" style={{ marginTop: '2rem' }}>Volver al inicio de sesión</button>
        </div>
    );
};

const PlanSelectionPage: React.FC<{
    dni: string;
    onSelectCustom: () => void;
    onPlanApplied: () => void;
}> = ({ dni, onSelectCustom, onPlanApplied }) => {
    const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'planChoice' | 'genderChoice' | 'templateList'>('planChoice');
    const [selectedGender, setSelectedGender] = useState<'Male' | 'Female' | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const data = await apiClient.getClientData(dni);
            if (data) {
                setClientData(data);
                const fetchedTemplates = await apiClient.getRoutineTemplates(data.gymId);
                setTemplates(fetchedTemplates);
            }
            setIsLoading(false);
        };
        fetchData();
    }, [dni]);

    const handleApplyTemplate = async (template: RoutineTemplate) => {
        if (!clientData) return;
        setIsLoading(true);
        const updatedData = {
            routine: template.routine,
            routineGeneratedDate: new Date().toISOString(),
            planStatus: 'active' as const,
        };
        const success = await apiClient.saveClientData(dni, updatedData);
        if (success) {
            onPlanApplied();
        } else {
            alert('No se pudo aplicar la plantilla. Inténtalo de nuevo.');
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div></div>;
    }

    if (!clientData) {
        return <div className="error-container">No se pudieron cargar los datos del cliente.</div>;
    }
    
    const planType = clientData.planType || 'full';
    
    const filteredTemplates = templates.filter(t => t.gender === selectedGender || t.gender === 'Unisex' || !t.gender);

    const renderContent = () => {
        switch (view) {
            case 'genderChoice':
                return (
                    <div className="animated-fade-in">
                        <header className="onboarding-header" style={{marginBottom: '2rem'}}>
                            <h2>Selecciona una opción</h2>
                        </header>
                         <div className="plan-selection-grid">
                            <div className="choice-card" onClick={() => { setSelectedGender('Male'); setView('templateList'); }}>
                                <div className="choice-icon">👨</div>
                                <h3>Hombre</h3>
                            </div>
                             <div className="choice-card" onClick={() => { setSelectedGender('Female'); setView('templateList'); }}>
                                <div className="choice-icon">👩</div>
                                <h3>Mujer</h3>
                            </div>
                        </div>
                         <button onClick={() => setView('planChoice')} className="back-button simple">Volver</button>
                    </div>
                );
            case 'templateList':
                return (
                    <div className="animated-fade-in">
                         <header className="onboarding-header" style={{marginBottom: '2rem'}}>
                             <h2>Rutinas Predeterminadas</h2>
                             <p>Estas son las rutinas sugeridas para vos.</p>
                        </header>
                         <div className="plan-selection-grid">
                            {filteredTemplates.map(template => (
                                <div key={template._id} className="plan-option-card">
                                    <div className="plan-option-icon">📋</div>
                                    <h3>{template.templateName}</h3>
                                    <p>{template.description || 'Una plantilla de rutina predefinida por tu entrenador.'}</p>
                                    <button className="cta-button secondary" onClick={() => handleApplyTemplate(template)}>
                                        Empezar con esta Rutina
                                    </button>
                                </div>
                            ))}
                        </div>
                        {filteredTemplates.length === 0 && <p style={{textAlign: 'center', marginTop: '2rem'}}>No hay rutinas predeterminadas para esta categoría.</p>}
                         <button onClick={() => setView('genderChoice')} className="back-button simple">Volver</button>
                    </div>
                );
            case 'planChoice':
            default:
                 return (
                    <div className="animated-fade-in">
                        <div className="plan-selection-grid">
                            {(planType === 'full' || planType === 'routine') && (
                                <div className="choice-card" onClick={onSelectCustom}>
                                    <div className="choice-icon">🤖</div>
                                    <h3>Plan Personalizado con IA</h3>
                                    <p>Crea un plan único para vos respondiendo unas preguntas.</p>
                                </div>
                            )}
                            {templates.length > 0 && (planType === 'full' || planType === 'routine') && (
                                <div className="choice-card" onClick={() => setView('genderChoice')}>
                                    <div className="choice-icon">📋</div>
                                    <h3>Rutinas Predeterminadas</h3>
                                    <p>Elige una rutina ya armada por tu entrenador.</p>
                                </div>
                            )}
                        </div>
                         {templates.length === 0 && (planType !== 'full' && planType !== 'routine') && (
                             <div className="placeholder" style={{gridColumn: '1 / -1', textAlign: 'center'}}>
                                <p>Tu plan solo incluye nutrición. Continúa para generar tu plan de nutrición con IA.</p>
                                 <button className="cta-button" style={{marginTop: '1rem'}} onClick={onSelectCustom}>Generar Plan de Nutrición</button>
                            </div>
                        )}
                    </div>
                );
        }
    }


    return (
        <div className="onboarding-container">
            <header className="onboarding-header">
                <h1>Selecciona tu Plan</h1>
                <p>Elige cómo quieres empezar tu entrenamiento.</p>
            </header>
            {renderContent()}
        </div>
    );
};

// --- Super Admin View ---

const ConfirmationModal: React.FC<{
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmClass?: string;
}> = ({ message, onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar', confirmClass = '' }) => {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content confirmation-modal" onClick={(e) => e.stopPropagation()}>
                <p>{message}</p>
                <div className="modal-actions">
                    <button onClick={onCancel} className="cta-button secondary">{cancelText}</button>
                    <button onClick={onConfirm} className={`cta-button ${confirmClass}`}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

const PasswordManagement: React.FC<{ gymId: string }> = ({ gymId }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        if (password.length < 4) {
            setError('La contraseña debe tener al menos 4 caracteres.');
            return;
        }

        setIsSaving(true);
        const success = await apiClient.updateGym(gymId, { password });
        if (success) {
            setSuccessMessage('¡Contraseña actualizada con éxito!');
            setPassword('');
            setConfirmPassword('');
            setTimeout(() => setSuccessMessage(''), 3000);
        } else {
            setError('No se pudo actualizar la contraseña.');
        }
        setIsSaving(false);
    };

    return (
        <div className="password-management">
            <h2>Gestionar Contraseña de Superadmin</h2>
            <form onSubmit={handleSave}>
                <div className="form-group">
                    <label>Nueva Contraseña</label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                </div>
                <div className="form-group">
                    <label>Confirmar Nueva Contraseña</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit" className="cta-button" disabled={isSaving}>
                    {isSaving ? 'Guardando...' : 'Guardar Contraseña'}
                </button>
            </form>
            {error && <p className="error-text" style={{ marginTop: '1rem' }}>{error}</p>}
            {successMessage && <p className="success-text" style={{ marginTop: '1rem' }}>{successMessage}</p>}
        </div>
    );
};

const SuperAdminDashboard: React.FC<{ gym: Gym; onLogout: () => void; onSelectGym: (gym: Gym) => void; }> = ({ gym, onLogout, onSelectGym }) => {
    const [gyms, setGyms] = useState<Gym[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingGym, setEditingGym] = useState<Gym | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<Gym | null>(null);

    const fetchGyms = async () => {
        setIsLoading(true);
        const fetchedGyms = await apiClient.getGyms();
        setGyms(fetchedGyms);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchGyms();
    }, []);

    const handleGymCreated = () => {
        fetchGyms();
    };
    
    const handleGymUpdated = () => {
        setEditingGym(null);
        fetchGyms();
    };

    const handleGymDeleted = async () => {
        if (!showDeleteConfirm) return;
        const success = await apiClient.deleteGym(showDeleteConfirm._id);
        if (success) {
            setShowDeleteConfirm(null);
            fetchGyms();
        } else {
            alert("Error al eliminar el gimnasio.");
        }
    };

    return (
        <div className="admin-dashboard">
            <div className="main-header">
                <div className="header-title-wrapper">
                    <h1>Panel de Super Administrador</h1>
                </div>
                <button onClick={onLogout} className="logout-button admin-logout">Cerrar Sesión</button>
            </div>
            
            <PasswordManagement gymId={gym._id} />

            <AddGymForm onGymCreated={handleGymCreated} />

            {editingGym && (
                <EditGymModal 
                    gym={editingGym} 
                    onClose={() => setEditingGym(null)} 
                    onGymUpdated={handleGymUpdated} 
                />
            )}
            
            {showDeleteConfirm && (
                <ConfirmationModal
                    message={`¿Estás seguro de que quieres eliminar el gimnasio "${showDeleteConfirm.name}"? Esta acción es irreversible y eliminará a todos sus clientes y datos asociados.`}
                    onConfirm={handleGymDeleted}
                    onCancel={() => setShowDeleteConfirm(null)}
                    confirmText="Eliminar"
                    confirmClass="delete"
                />
            )}

            {isLoading ? (
                <div className="loading-container"><div className="spinner"></div>Cargando gimnasios...</div>
            ) : (
                <div className="gym-list">
                    {gyms.filter(g => g.username !== 'superadmin').map(gym => (
                        <div key={gym._id} className="gym-card" onClick={() => onSelectGym(gym)}>
                           <div className="gym-card-header">
                                {gym.logoSvg && (
                                    <div className="gym-card-logo">
                                        <SvgImage svgString={gym.logoSvg} altText={`${gym.name} logo`} />
                                    </div>
                                )}
                                <div className="gym-card-info">
                                    <h3>{gym.name}</h3>
                                    <p>Usuario: {gym.username} | Límite IA: {gym.dailyQuestionLimit || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="gym-card-actions">
                                <button className="action-btn edit" onClick={(e) => { e.stopPropagation(); setEditingGym(gym); }}>Editar</button>
                                <button className="action-btn delete" onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(gym); }}>Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const AddGymForm: React.FC<{ onGymCreated: () => void }> = ({ onGymCreated }) => {
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [dailyQuestionLimit, setDailyQuestionLimit] = useState(10);
    const [logoSvg, setLogoSvg] = useState<string | null>(null);
    const [planType, setPlanType] = useState<PlanType>('full');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === "image/svg+xml") {
            const reader = new FileReader();
            reader.onload = (e) => {
                setLogoSvg(e.target?.result as string);
            };
            reader.readAsText(file);
        } else {
            alert("Por favor, selecciona un archivo SVG.");
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');
        const success = await apiClient.createGym(name, username, password, dailyQuestionLimit, logoSvg, planType);
        if (success) {
            setName('');
            setUsername('');
            setPassword('');
            setDailyQuestionLimit(10);
            setLogoSvg(null);
            setPlanType('full');
            onGymCreated();
        } else {
            setError('No se pudo crear el gimnasio. El nombre de usuario puede que ya exista.');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="add-gym-container">
            <h3>Añadir Nuevo Gimnasio</h3>
            <form onSubmit={handleSubmit} className="add-gym-form">
                <div className="form-group">
                    <label>Nombre del Gimnasio</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label>Usuario</label>
                    <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label>Contraseña</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                 <div className="form-group">
                    <label>Límite Preguntas IA / día</label>
                    <input type="number" value={dailyQuestionLimit} onChange={(e) => setDailyQuestionLimit(Number(e.target.value))} required min="0" />
                </div>
                <div className="form-group">
                    <label>Tipo de Plan</label>
                    <select value={planType} onChange={(e) => setPlanType(e.target.value as PlanType)} required>
                        <option value="full">Plan Completo (Rutina y Nutrición)</option>
                        <option value="routine">Solo Plan de Rutina</option>
                        <option value="nutrition">Solo Plan de Nutrición</option>
                    </select>
                </div>
                 <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label>Logo (SVG)</label>
                    <div className="file-input-wrapper">
                        <label htmlFor="svg-upload" className="file-input-label">Seleccionar Archivo</label>
                        <input id="svg-upload" type="file" accept=".svg" onChange={handleFileChange} />
                        <div className="file-input-preview">
                            {logoSvg ? <SvgImage svgString={logoSvg} altText="Logo preview" /> : 'SVG'}
                        </div>
                    </div>
                </div>
                <div className="add-gym-actions">
                    <button type="submit" className="cta-button" disabled={isSubmitting}>
                        {isSubmitting ? 'Creando...' : 'Crear Gimnasio'}
                    </button>
                </div>
            </form>
            {error && <p className="error-text" style={{marginTop: '1rem'}}>{error}</p>}
        </div>
    );
};


const EditGymModal: React.FC<{ gym: Gym; onClose: () => void; onGymUpdated: () => void; }> = ({ gym, onClose, onGymUpdated }) => {
    const [name, setName] = useState(gym.name);
    const [password, setPassword] = useState('');
    const [dailyQuestionLimit, setDailyQuestionLimit] = useState(gym.dailyQuestionLimit || 10);
    const [logoSvg, setLogoSvg] = useState<string | null>(gym.logoSvg || null);
    const [planType, setPlanType] = useState<PlanType>(gym.planType || 'full');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const dataToUpdate: { name?: string; password?: string; dailyQuestionLimit?: number; logoSvg?: string | null; planType?: PlanType; } = {
            name: name,
            dailyQuestionLimit: dailyQuestionLimit,
            logoSvg: logoSvg,
            planType: planType,
        };
        if (password) {
            dataToUpdate.password = password;
        }
        
        const success = await apiClient.updateGym(gym._id, dataToUpdate);
        if (success) {
            onGymUpdated();
        } else {
            alert("Error al actualizar el gimnasio.");
        }
        setIsSubmitting(false);
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === "image/svg+xml") {
            const reader = new FileReader();
            reader.onload = (e) => {
                setLogoSvg(e.target?.result as string);
            };
            reader.readAsText(file);
        } else {
            alert("Por favor, selecciona un archivo SVG.");
        }
    };
    
    const handleRemoveLogo = () => {
        setLogoSvg(null);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content edit-modal">
                <button className="close-button" onClick={onClose}>&times;</button>
                <h3>Editando: {gym.name}</h3>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nombre del Gimnasio</label>
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Nueva Contraseña (dejar en blanco para no cambiar)</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Límite Preguntas IA / día</label>
                        <input type="number" value={dailyQuestionLimit} onChange={(e) => setDailyQuestionLimit(Number(e.target.value))} required min="0" />
                    </div>
                    <div className="form-group">
                        <label>Tipo de Plan</label>
                        <select value={planType} onChange={(e) => setPlanType(e.target.value as PlanType)} required>
                            <option value="full">Plan Completo (Rutina y Nutrición)</option>
                            <option value="routine">Solo Plan de Rutina</option>
                            <option value="nutrition">Solo Plan de Nutrición</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Logo (SVG)</label>
                        <div className="file-input-wrapper">
                             <label htmlFor="svg-upload-edit" className="file-input-label">Cambiar SVG</label>
                             <input id="svg-upload-edit" type="file" accept=".svg" onChange={handleFileChange} />
                             {logoSvg && <button type="button" className="action-btn delete" onClick={handleRemoveLogo}>Quitar</button>}
                             <div className="file-input-preview">
                                {logoSvg ? <SvgImage svgString={logoSvg} altText="Logo preview" /> : 'SVG'}
                            </div>
                        </div>
                    </div>
                    <div className="modal-actions" style={{marginTop: '2rem'}}>
                        <button type="button" className="cta-button secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="cta-button" disabled={isSubmitting}>
                            {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};



// --- Admin/Coach Views ---
const QrCodeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const appUrl = window.location.origin;
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(appUrl)}`;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>&times;</button>
                <h3>Comparte la App con tus Clientes</h3>
                <p>Los clientes pueden escanear este código QR para acceder a la aplicación en sus teléfonos.</p>
                <div className="qr-code-container">
                    <img src={qrCodeUrl} alt="QR Code para la aplicación" />
                </div>
                <p className="app-url-display">O comparte este enlace: <a href={appUrl} target="_blank" rel="noopener noreferrer">{appUrl}</a></p>
                <button onClick={onClose} className="cta-button secondary" style={{ marginTop: '1.5rem' }}>Cerrar</button>
            </div>
        </div>
    );
};

const RequestSection: React.FC<{
    title: string;
    requests: TrainerRequest[];
    onUpdateStatus: (id: string, status: 'read' | 'resolved') => void;
    onDelete: (id: string) => void;
}> = ({ title, requests, onUpdateStatus, onDelete }) => {
    const typedRequests = requests as TrainerRequest[];
    if (typedRequests.length === 0) {
        return <div className="placeholder" style={{ marginTop: '2rem' }}>No hay solicitudes en esta categoría.</div>;
    }
    
    return (
        <div className="request-section">
            <h3>{title} ({typedRequests.length})</h3>
            <div className="request-list">
                {typedRequests.map(req => (
                    <div key={req._id} className={`request-card status-${req.status}`}>
                        <div className="request-card-header">
                            <h4>{req.subject}</h4>
                            <span className="request-date">{new Date(req.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="request-client"><strong>Cliente:</strong> {req.clientName} ({req.clientId})</p>
                        <p className="request-message">{req.message}</p>
                        <div className="request-card-actions">
                            {req.status === 'new' && <button className="action-btn" onClick={() => onUpdateStatus(req._id, 'read')}>Marcar como Leído</button>}
                            {req.status === 'read' && <button className="action-btn" onClick={() => onUpdateStatus(req._id, 'resolved')}>Marcar como Resuelto</button>}
                            <button className="action-btn delete" onClick={() => onDelete(req._id)}>Eliminar</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const RequestsView: React.FC<{ requests: TrainerRequest[], onUpdateRequest: () => void }> = ({ requests, onUpdateRequest }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'new' | 'read' | 'resolved'>('new');

    const handleUpdateStatus = async (id: string, status: 'read' | 'resolved') => {
        setIsLoading(true);
        await apiClient.updateRequestStatus(id, status);
        onUpdateRequest();
        setIsLoading(false);
    };
    
    const handleDelete = async (id: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar esta solicitud?")) {
            setIsLoading(true);
            await apiClient.deleteRequest(id);
            onUpdateRequest();
            setIsLoading(false);
        }
    };
    
    const { newRequests, readRequests, resolvedRequests } = useMemo(() => {
        const sorted = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return {
            newRequests: sorted.filter(r => r.status === 'new'),
            readRequests: sorted.filter(r => r.status === 'read'),
            resolvedRequests: sorted.filter(r => r.status === 'resolved'),
        };
    }, [requests]);

    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div></div>;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'new':
                return <RequestSection title="Nuevas Solicitudes" requests={newRequests} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />;
            case 'read':
                return <RequestSection title="Solicitudes Leídas" requests={readRequests} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />;
            case 'resolved':
                return <RequestSection title="Solicitudes Resueltas" requests={resolvedRequests} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />;
            default:
                return null;
        }
    };
    
    return (
        <div className="requests-view animated-fade-in">
             <h2>Bandeja de Entrada de Solicitudes</h2>

             <nav className="progress-tabs-nav" style={{ marginTop: '0', marginBottom: 0 }}>
                <button 
                    className={`progress-tab-button ${activeTab === 'new' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('new')}>
                    Nuevos
                    {newRequests.length > 0 && <span className="notification-badge" style={{ position: 'static', display: 'inline-flex', marginLeft: '8px', transform: 'translateY(-2px)' }}>{newRequests.length}</span>}
                </button>
                <button 
                    className={`progress-tab-button ${activeTab === 'read' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('read')}>
                    Leídos
                </button>
                <button 
                    className={`progress-tab-button ${activeTab === 'resolved' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('resolved')}>
                    Resueltos
                </button>
            </nav>

             {requests.length === 0 ? (
                <div className="placeholder" style={{marginTop: '2rem'}}>No hay solicitudes pendientes.</div>
             ) : (
                <div style={{ marginTop: '2rem' }}>
                    {renderContent()}
                </div>
             )}
        </div>
    );
};

const ExerciseLibraryManager: React.FC<{ gymId: string; onBack: () => void }> = ({ gymId, onBack }) => {
    const [library, setLibrary] = useState<ExerciseLibrary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // UI State
    const [activeGroup, setActiveGroup] = useState<string | null>(null);
    const [editingExercise, setEditingExercise] = useState<{ group: string; index: number; data: ExerciseDefinition } | null>(null);
    
    // Add Form State
    const [newExerciseName, setNewExerciseName] = useState('');
    const [newExerciseVideoUrl, setNewExerciseVideoUrl] = useState('');
    const [newExerciseGroup, setNewExerciseGroup] = useState('');

    const fetchLibrary = async () => {
        setIsLoading(true);
        const fetchedLibrary = await apiClient.getExerciseLibrary(gymId);
        setLibrary(fetchedLibrary);
        if (fetchedLibrary && Object.keys(fetchedLibrary).length > 0) {
            const firstGroup = Object.keys(fetchedLibrary)[0];
            setNewExerciseGroup(firstGroup);
            setActiveGroup(firstGroup);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchLibrary();
    }, [gymId]);

    const handleUpdateAndSaveLibrary = async (newLibrary: ExerciseLibrary) => {
        setIsSaving(true);
        const success = await apiClient.saveExerciseLibrary(newLibrary, gymId);
        if (success) {
            setLibrary(newLibrary); // Update local state on successful save
        } else {
            alert('Error: No se pudieron guardar los cambios.');
            fetchLibrary(); // Re-fetch to revert to last saved state
        }
        setIsSaving(false);
    };
    
    const handleToggleGroup = (group: string) => {
        setActiveGroup(prev => (prev === group ? null : group));
    };
    
    const handleAddExercise = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newExerciseName.trim() || !newExerciseGroup || !library || isSaving) return;
        
        const newExercise: ExerciseDefinition = {
            name: newExerciseName.trim(),
            videoUrl: newExerciseVideoUrl.trim(),
            isEnabled: true,
        };
        
        const newLibrary = { ...library };
        newLibrary[newExerciseGroup] = [...newLibrary[newExerciseGroup], newExercise].sort((a,b) => a.name.localeCompare(b.name));
        
        await handleUpdateAndSaveLibrary(newLibrary);
        
        setNewExerciseName('');
        setNewExerciseVideoUrl('');
    };
    
    const handleDeleteExercise = async (group: string, index: number) => {
        if (!library || isSaving) return;
        if (window.confirm(`¿Seguro que quieres eliminar "${library[group][index].name}"?`)) {
            const newLibrary = { ...library };
            newLibrary[group].splice(index, 1);
            await handleUpdateAndSaveLibrary(newLibrary);
        }
    };
    
    const handleStartEdit = (group: string, index: number) => {
        if (!library || isSaving) return;
        setEditingExercise({ group, index, data: { ...library[group][index] } });
    };
    
    const handleCancelEdit = () => setEditingExercise(null);

    const handleUpdateEditingExercise = (field: 'name' | 'videoUrl', value: string) => {
        if (!editingExercise) return;
        setEditingExercise({ ...editingExercise, data: { ...editingExercise.data, [field]: value }});
    };

    const handleSaveEdit = async () => {
        if (!editingExercise || !library || isSaving) return;
        const { group, index, data } = editingExercise;
        const newLibrary = { ...library };
        newLibrary[group][index] = data;
        await handleUpdateAndSaveLibrary(newLibrary);
        setEditingExercise(null);
    };

    const handleToggleEnabled = async (group: string, index: number, isEnabled: boolean) => {
        if (!library || isSaving) return;
        const newLibrary = { ...library };
        newLibrary[group][index].isEnabled = isEnabled;
        await handleUpdateAndSaveLibrary(newLibrary);
    };

    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div>Cargando biblioteca...</div>;
    }
    if (!library) {
        return <div className="error-container">No se pudo cargar la biblioteca de ejercicios.</div>
    }

    return (
        <div className="library-container animated-fade-in">
            <div className="main-header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Biblioteca de Ejercicios</h2>
                 <button onClick={onBack} className="back-button" style={{marginRight: '1rem'}}>Volver</button>
            </div>
            <div className="library-instructions">
                <p>Gestiona los ejercicios disponibles para la generación de rutinas. Los cambios se guardan automáticamente.</p>
            </div>

            <div className="add-exercise-container">
                <div className="add-exercise-form-wrapper">
                    <h3>Añadir Nuevo Ejercicio</h3>
                    <form className="add-exercise-form" onSubmit={handleAddExercise}>
                        <input 
                            type="text" 
                            placeholder="Nombre del Ejercicio" 
                            value={newExerciseName}
                            onChange={e => setNewExerciseName(e.target.value)}
                            required 
                            disabled={isSaving}
                        />
                        <input 
                            type="url" 
                            placeholder="URL del Video (Opcional)"
                            value={newExerciseVideoUrl}
                            onChange={e => setNewExerciseVideoUrl(e.target.value)}
                            disabled={isSaving}
                        />
                         <select value={newExerciseGroup} onChange={e => setNewExerciseGroup(e.target.value)} disabled={isSaving}>
                            {Object.keys(library).map(group => <option key={group} value={group}>{group}</option>)}
                        </select>
                        <button type="submit" disabled={isSaving || !newExerciseName.trim()}>
                            {isSaving ? '...' : 'Añadir'}
                        </button>
                    </form>
                </div>
            </div>

            <div className="library-accordion">
                {Object.entries(library).map(([group, exercises]) => (
                    <div key={group} className="library-accordion-item">
                        <button 
                            className={`library-accordion-header ${activeGroup === group ? 'active' : ''}`}
                            onClick={() => handleToggleGroup(group)}
                            aria-expanded={activeGroup === group}
                            aria-controls={`content-${group}`}
                        >
                            {group} ({(exercises as ExerciseDefinition[]).length})
                            <span className="icon">+</span>
                        </button>
                        <div id={`content-${group}`} className={`library-accordion-content ${activeGroup === group ? 'open' : ''}`} role="region">
                            <div className="exercise-entry-list">
                                <div className="exercise-entry-header">
                                    <span>Habilitado</span>
                                    <span>Nombre</span>
                                    <span>URL del Video</span>
                                    <span>Acciones</span>
                                </div>
                                {(exercises as ExerciseDefinition[]).map((ex, index) => {
                                    const isEditing = editingExercise?.group === group && editingExercise.index === index;
                                    return (
                                        <div key={`${group}-${index}`} className="exercise-entry-row">
                                            {isEditing ? (
                                                <>
                                                    <label className="switch">
                                                        <input type="checkbox" checked={editingExercise.data.isEnabled} disabled />
                                                        <span className="slider round"></span>
                                                    </label>
                                                    <input 
                                                        type="text"
                                                        className="editing-input"
                                                        value={editingExercise.data.name}
                                                        onChange={e => handleUpdateEditingExercise('name', e.target.value)} 
                                                    />
                                                    <input
                                                        type="url"
                                                        className="editing-input"
                                                        value={editingExercise.data.videoUrl}
                                                        onChange={e => handleUpdateEditingExercise('videoUrl', e.target.value)}
                                                    />
                                                    <div className="exercise-row-actions">
                                                        <button className="action-btn save" onClick={handleSaveEdit} disabled={isSaving}>Guardar</button>
                                                        <button className="action-btn cancel" onClick={handleCancelEdit} disabled={isSaving}>Cancelar</button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <label className="switch">
                                                        <input type="checkbox" checked={ex.isEnabled} onChange={e => handleToggleEnabled(group, index, e.target.checked)} disabled={isSaving} />
                                                        <span className="slider round"></span>
                                                    </label>
                                                    <span className="exercise-name-lib">{ex.name}</span>
                                                    {ex.videoUrl ? (
                                                        <a href={ex.videoUrl} target="_blank" rel="noopener noreferrer" className="video-url-display">{ex.videoUrl.substring(0, 30)}...</a>
                                                    ) : (
                                                        <span className="video-url-display disabled">Sin video</span>
                                                    )}
                                                    <div className="exercise-row-actions">
                                                        <button className="action-btn edit" onClick={() => handleStartEdit(group, index)} disabled={isSaving}>Editar</button>
                                                        <button className="action-btn delete" onClick={() => handleDeleteExercise(group, index)} disabled={isSaving}>Eliminar</button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const RoutinePlan: React.FC<{
    routine: Routine;
    isEditing?: boolean;
    onRoutineChange?: (newRoutine: Routine) => void;
    exerciseLibrary?: ExerciseLibrary;
}> = ({ routine, isEditing = false, onRoutineChange, exerciseLibrary }) => {
    const [activePhaseIndex, setActivePhaseIndex] = useState(0);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [exerciseVideos, setExerciseVideos] = useState<Record<string, string>>({});

    useEffect(() => {
        if (exerciseLibrary) {
            const videoMap: Record<string, string> = {};
            Object.values(exerciseLibrary).forEach(group => {
                (group as ExerciseDefinition[]).forEach(ex => {
                    if (ex.videoUrl) {
                        videoMap[ex.name] = ex.videoUrl;
                    }
                });
            });
            setExerciseVideos(videoMap);
        }
    }, [exerciseLibrary]);

    const handleExerciseChange = (phaseIndex: number, dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string) => {
        if (!onRoutineChange) return;

        const newRoutine = JSON.parse(JSON.stringify(routine)); // Deep copy
        const exercise = newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios[exerciseIndex];
        
        (exercise as any)[field] = value;
        
        if (field === 'nombre' && exerciseVideos[value]) {
            exercise.videoUrl = exerciseVideos[value];
        }

        onRoutineChange(newRoutine);
    };

    const allExercises = useMemo(() => {
        if (!exerciseLibrary) return [];
        return Object.values(exerciseLibrary).flat().filter(ex => ex.isEnabled).map(ex => ex.name).sort();
    }, [exerciseLibrary]);

    if (!routine) return <div className="placeholder">No routine available.</div>;

    const activePhase = routine.phases[activePhaseIndex];

    return (
        <div className="plan-container animated-fade-in">
            {videoUrl && <VideoPlayerModal videoUrl={videoUrl} onClose={() => setVideoUrl(null)} />}
            <div className="plan-header">
                <h2>{routine.planName}</h2>
                <p>Duración Total: {routine.totalDurationWeeks} semanas</p>
            </div>
            
            {routine.phases.length > 1 && (
                <nav className="phases-nav">
                    {routine.phases.map((phase, index) => (
                        <button 
                            key={index} 
                            className={`phase-button ${index === activePhaseIndex ? 'active' : ''}`}
                            onClick={() => setActivePhaseIndex(index)}
                        >
                            {phase.phaseName} ({phase.durationWeeks} sem)
                        </button>
                    ))}
                </nav>
            )}

            <div className="phase-content">
                <h3>{activePhase.phaseName}</h3>
                <div className="days-grid">
                    {activePhase.routine.dias.map((day, dayIndex) => (
                        <div key={dayIndex} className="day-card">
                            <div className="day-header">
                                <h4>{day.dia}</h4>
                                <span>{day.grupoMuscular}</span>
                            </div>
                            <ul className="exercise-list">
                                {day.ejercicios.map((ex, exIndex) => (
                                    <li key={exIndex} className="exercise-item">
                                        <div className="exercise-details">
                                            {isEditing ? (
                                                <select 
                                                    value={ex.nombre} 
                                                    onChange={e => handleExerciseChange(activePhaseIndex, dayIndex, exIndex, 'nombre', e.target.value)}
                                                    className="exercise-select"
                                                >
                                                    {allExercises.map(exName => <option key={exName} value={exName}>{exName}</option>)}
                                                </select>
                                            ) : (
                                                <span className="exercise-name">{ex.nombre}</span>
                                            )}
                                            {ex.tecnicaAvanzada && <span className="advanced-technique-badge">{ex.tecnicaAvanzada}</span>}
                                        </div>
                                        <div className="exercise-sets">
                                            {isEditing ? (
                                                <>
                                                    <input type="text" value={ex.series} onChange={e => handleExerciseChange(activePhaseIndex, dayIndex, exIndex, 'series', e.target.value)} /> x
                                                    <input type="text" value={ex.repeticiones} onChange={e => handleExerciseChange(activePhaseIndex, dayIndex, exIndex, 'repeticiones', e.target.value)} />
                                                    <span>-</span>
                                                    <input type="text" value={ex.descanso} onChange={e => handleExerciseChange(activePhaseIndex, dayIndex, exIndex, 'descanso', e.target.value)} />
                                                </>
                                            ) : (
                                                <span>{ex.series} x {ex.repeticiones} - {ex.descanso}</span>
                                            )}
                                        </div>
                                        {exerciseVideos[ex.nombre] && (
                                            <button className="video-btn" onClick={() => setVideoUrl(exerciseVideos[ex.nombre])} aria-label={`Ver video de ${ex.nombre}`}>
                                                ▶
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            {day.cardio && day.cardio.toLowerCase() !== 'no aplica' && (
                                <div className="cardio-section">
                                    <strong>Cardio:</strong> {day.cardio}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const DietPlanDisplay: React.FC<{ dietPlan: DietPlan }> = ({ dietPlan }) => {
    if (!dietPlan) return null;

    return (
        <div className="diet-plan-container animated-fade-in">
            <div className="plan-header">
                <h2>{dietPlan.planTitle}</h2>
            </div>
            <div className="diet-summary">
                <div className="summary-item">
                    <h4>Calorías</h4>
                    <p>{dietPlan.summary.totalCalories} kcal</p>
                </div>
                <div className="summary-item">
                    <h4>Proteínas</h4>
                    <p>{dietPlan.summary.macronutrients.proteinGrams} g</p>
                </div>
                <div className="summary-item">
                    <h4>Carbohidratos</h4>
                    <p>{dietPlan.summary.macronutrients.carbsGrams} g</p>
                </div>
                <div className="summary-item">
                    <h4>Grasas</h4>
                    <p>{dietPlan.summary.macronutrients.fatGrams} g</p>
                </div>
            </div>
            <div className="meals-grid">
                {dietPlan.meals.map((meal, index) => (
                    <div key={index} className="meal-card">
                        <div className="meal-header">
                            <h4>{meal.mealName}</h4>
                        </div>
                        <ul className="food-list">
                            {meal.foodItems.map((item, itemIndex) => (
                                <li key={itemIndex}>
                                    <span className="food-name">{item.food}</span>
                                    <span className="food-amount">{item.amount}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
             {dietPlan.recommendations && dietPlan.recommendations.length > 0 && (
                <div className="recommendations-section">
                    <h3>Recomendaciones</h3>
                    <ul>
                        {dietPlan.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
};

const TemplateEditor: React.FC<{
    gym: Gym;
    template?: RoutineTemplate;
    onBack: () => void;
    onSave: () => void;
}> = ({ gym, template, onBack, onSave }) => {
    const [templateName, setTemplateName] = useState(template?.templateName || '');
    const [description, setDescription] = useState(template?.description || '');
    const [gender, setGender] = useState<'Male' | 'Female' | 'Unisex'>(template?.gender || 'Unisex');
    const [routine, setRoutine] = useState<Routine | null>(template?.routine || null);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState('');
    const [adminInstructions, setAdminInstructions] = useState('');
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({});
    
    const [generationParams, setGenerationParams] = useState({
        gender: 'Masculino',
        trainingDays: '4',
        level: 'Intermedio',
        goal: 'Hipertrofia',
        trainingIntensity: 'Moderada',
        bodyFocusArea: 'Cuerpo Completo',
    });

    useEffect(() => {
        const fetchLibrary = async () => {
            const library = await apiClient.getExerciseLibrary(gym._id);
            setExerciseLibrary(library);
        };
        fetchLibrary();
    }, [gym._id]);
    
    const handleParamChange = (field: keyof typeof generationParams, value: string) => {
        setGenerationParams(prev => ({ ...prev, [field]: value }));
    };


    const handleGenerateRoutine = async () => {
        setIsGenerating(true);
        setGenerationError('');
        try {
            // We create a dummy client profile to generate a generic template
            const dummyProfile: Profile = {
                name: "Cliente Plantilla",
                age: "30",
                weight: "75",
                height: "175",
                gender: generationParams.gender as Profile['gender'],
                level: generationParams.level as Profile['level'],
                goal: generationParams.goal as Profile['goal'],
                trainingDays: generationParams.trainingDays,
                activityFactor: "Activo",
                useAdvancedTechniques: "No",
                bodyFocusArea: generationParams.bodyFocusArea as Profile['bodyFocusArea'],
                muscleFocus: "General",
                includeAdaptationPhase: "Sí",
                includeDeloadPhase: "Sí",
                trainingIntensity: generationParams.trainingIntensity as Profile['trainingIntensity']
            };
            
            // Cast to a partial ClientData that satisfies generateRoutineForClient
            const dummyClientData = {
                profile: dummyProfile,
                gymId: gym._id,
            } as ClientData;
            
            const generatedRoutine = await generateRoutineForClient(dummyClientData, gym._id, adminInstructions);
            setRoutine(generatedRoutine);

        } catch (error) {
            setGenerationError(error instanceof Error ? error.message : "Error al generar la rutina.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSaveTemplate = async () => {
        if (!templateName || !routine) {
            alert("El nombre de la plantilla y la rutina son obligatorios.");
            return;
        }
        setIsSaving(true);
        
        const templateData: Omit<RoutineTemplate, '_id'> = {
            gymId: gym._id,
            templateName,
            description,
            gender,
            routine,
        };

        let success;
        if (template) {
            success = await apiClient.updateRoutineTemplate(template._id, templateData);
        } else {
            const result = await apiClient.createRoutineTemplate(templateData);
            success = !!result;
        }

        if (success) {
            onSave();
        } else {
            alert("Error al guardar la plantilla.");
        }
        setIsSaving(false);
    };

    return (
        <div className="template-editor animated-fade-in">
            <div className="main-header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>{template ? `Editando: ${template.templateName}` : "Crear Nueva Plantilla"}</h2>
                <div>
                    <button onClick={handleSaveTemplate} className="cta-button" disabled={isSaving || !routine}>
                        {isSaving ? 'Guardando...' : 'Guardar Plantilla'}
                    </button>
                    <button onClick={onBack} className="back-button" style={{marginLeft: '1rem'}}>Cancelar</button>
                </div>
            </div>

            <div className="template-form">
                <div className="form-group">
                    <label>Nombre de la Plantilla</label>
                    <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label>Descripción (Opcional)</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Género de la Plantilla</label>
                    <select value={gender} onChange={e => setGender(e.target.value as any)}>
                        <option value="Unisex">Unisex</option>
                        <option value="Male">Hombre</option>
                        <option value="Female">Mujer</option>
                    </select>
                </div>
            </div>

            {isGenerating ? (
                <div className="placeholder-action generation-container" style={{marginTop: '2rem'}}>
                    <div className="loading-container" style={{minHeight: 'auto', padding: '2rem'}}>
                        <div className="spinner"></div>
                        <p>Generando rutina base con IA, por favor espera...</p>
                    </div>
                </div>
            ) : routine ? (
                <div className="plan-container" style={{marginTop: '2rem'}}>
                    <RoutinePlan 
                        routine={routine} 
                        isEditing={true} 
                        onRoutineChange={setRoutine} 
                        exerciseLibrary={exerciseLibrary}
                    />
                </div>
            ) : (
                <div className="placeholder-action generation-container" style={{marginTop: '2rem'}}>
                    <p>Define los parámetros para generar una rutina base con IA. Podrás editarla antes de guardarla.</p>
                     <div className="generation-config-panel">
                        <h3>Parámetros de Generación</h3>
                        <div className="generation-params-grid">
                             <div className="form-group">
                                <label>Género</label>
                                <select value={generationParams.gender} onChange={e => handleParamChange('gender', e.target.value)}>
                                    <option value="Masculino">Masculino</option>
                                    <option value="Femenino">Femenino</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Días de Entrenamiento</label>
                                <select value={generationParams.trainingDays} onChange={e => handleParamChange('trainingDays', e.target.value)}>
                                    {[...Array(7)].map((_, i) => <option key={i+1} value={i+1}>{i+1} día{i > 0 ? 's' : ''}</option>)}
                                </select>
                            </div>
                             <div className="form-group">
                                <label>Nivel de Experiencia</label>
                                <select value={generationParams.level} onChange={e => handleParamChange('level', e.target.value)}>
                                    <option value="Principiante">Principiante</option>
                                    <option value="Intermedio">Intermedio</option>
                                    <option value="Avanzado">Avanzado</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Objetivo Principal</label>
                                <select value={generationParams.goal} onChange={e => handleParamChange('goal', e.target.value)}>
                                    <option value="Hipertrofia">Hipertrofia</option>
                                    <option value="Pérdida de grasa">Pérdida de grasa</option>
                                    <option value="Mantenimiento">Mantenimiento</option>
                                    <option value="Resistencia">Resistencia</option>
                                </select>
                            </div>
                             <div className="form-group">
                                <label>Intensidad</label>
                                 <select value={generationParams.trainingIntensity} onChange={e => handleParamChange('trainingIntensity', e.target.value)}>
                                    <option value="Baja">Baja</option>
                                    <option value="Moderada">Moderada</option>
                                    <option value="Alta">Alta</option>
                                    <option value="Extrema">Extrema</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Enfoque Corporal</label>
                                 <select value={generationParams.bodyFocusArea} onChange={e => handleParamChange('bodyFocusArea', e.target.value)}>
                                    <option value="Cuerpo Completo">Cuerpo Completo (Dividida)</option>
                                    <option value="Full Body">Full Body (Cuerpo Entero)</option>
                                    <option value="Tren Superior">Tren Superior</option>
                                    <option value="Tren Inferior">Tren Inferior</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group" style={{gridColumn: '1 / -1'}}>
                            <label htmlFor="template-instructions-gen">Instrucciones Adicionales (Opcional)</label>
                            <textarea
                                id="template-instructions-gen"
                                rows={2}
                                value={adminInstructions}
                                onChange={(e) => setAdminInstructions(e.target.value)}
                                placeholder="Ej: Enfocar en fuerza, evitar ejercicios de alto impacto."
                            ></textarea>
                        </div>
                    </div>
                    <button className="cta-button" onClick={handleGenerateRoutine} disabled={isGenerating}>
                        Generar Rutina Base
                    </button>
                    {generationError && <p className="error-text" style={{marginTop: '1rem'}}>{generationError}</p>}
                </div>
            )}
        </div>
    );
};

const RoutineTemplateManager: React.FC<{ gym: Gym; onBack: () => void; }> = ({ gym, onBack }) => {
    const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState<RoutineTemplate | null>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const fetchTemplates = async () => {
        setIsLoading(true);
        const fetchedTemplates = await apiClient.getRoutineTemplates(gym._id);
        setTemplates(fetchedTemplates);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchTemplates();
    }, [gym._id]);

    const handleCreate = () => {
        fetchTemplates();
        setShowCreateForm(false);
    };
    
    const handleUpdate = () => {
        fetchTemplates();
        setIsEditing(null);
    };

    const handleDelete = async (templateId: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar esta plantilla?")) {
            const success = await apiClient.deleteRoutineTemplate(templateId);
            if (success) {
                fetchTemplates();
            } else {
                alert("Error al eliminar la plantilla.");
            }
        }
    };
    
    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div>Cargando plantillas...</div>;
    }

    if (isEditing) {
        return <TemplateEditor 
            gym={gym} 
            template={isEditing} 
            onBack={() => setIsEditing(null)} 
            onSave={handleUpdate} 
        />
    }
    
    if (showCreateForm) {
        return <TemplateEditor 
            gym={gym} 
            onBack={() => setShowCreateForm(false)} 
            onSave={handleCreate}
        />
    }

    return (
        <div className="library-container animated-fade-in">
             <div className="main-header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Plantillas de Rutina</h2>
                 <div>
                    <button onClick={() => setShowCreateForm(true)} className="cta-button" style={{marginRight: '1rem'}}>Crear Nueva Plantilla</button>
                    <button onClick={onBack} className="back-button">Volver</button>
                 </div>
            </div>

            {templates.length === 0 ? (
                <div className="placeholder">No has creado ninguna plantilla de rutina todavía.</div>
            ) : (
                <div className="template-list">
                    {templates.map(template => (
                        <div key={template._id} className="template-card">
                            <div className="template-card-header">
                                <h3>{template.templateName}</h3>
                                {template.gender && <span className={`gender-badge ${template.gender.toLowerCase()}`}>{template.gender === 'Male' ? 'Hombre' : template.gender === 'Female' ? 'Mujer' : 'Unisex'}</span>}
                            </div>
                            <p>{template.description || 'Sin descripción'}</p>
                            <div className="template-card-actions">
                                <button className="action-btn edit" onClick={() => setIsEditing(template)}>Editar</button>
                                <button className="action-btn delete" onClick={() => handleDelete(template._id)}>Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Accounting Module ---

const AccountingDashboard: React.FC<{ gym: Gym }> = ({ gym }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'balance' | 'accounts' | 'fixedExpenses' | 'categories'>('balance');
    
    // Data states
    const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
    const [transactions, setTransactions] = useState<AccountingTransaction[]>([]);
    const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
    const [categoryGroups, setCategoryGroups] = useState<ExpenseCategoryGroup[]>([]);
    
    const fetchData = async () => {
        setIsLoading(true);
        const [accs, trans, fExpenses, catGroups] = await Promise.all([
            apiClient.getAccountingData<AccountingAccount>(gym._id, 'accounts'),
            apiClient.getAccountingData<AccountingTransaction>(gym._id, 'transactions'),
            apiClient.getAccountingData<FixedExpense>(gym._id, 'fixed_expenses'),
            apiClient.getAccountingData<ExpenseCategoryGroup>(gym._id, 'expense_category_groups')
        ]);
        setAccounts(accs);
        setTransactions(trans.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setFixedExpenses(fExpenses);
        setCategoryGroups(catGroups);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [gym._id]);

    const renderContent = () => {
        if (isLoading) {
            return <div className="loading-container"><div className="spinner"></div></div>;
        }

        switch(activeTab) {
            case 'accounts':
                return <AccountsView accounts={accounts} onDataUpdate={fetchData} gymId={gym._id} />;
            case 'fixedExpenses':
                return <FixedExpensesView fixedExpenses={fixedExpenses} accounts={accounts} onDataUpdate={fetchData} gymId={gym._id} />;
            case 'categories':
                return <CategoriesView categoryGroups={categoryGroups} onDataUpdate={fetchData} gymId={gym._id} />;
            case 'balance':
            default:
                return <BalanceView transactions={transactions} accounts={accounts} categoryGroups={categoryGroups} onDataUpdate={fetchData} gymId={gym._id} />;
        }
    };
    
    return (
        <div className="accounting-container animated-fade-in">
            <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>Panel de Contabilidad</h2>
            <nav className="main-tabs-nav">
                <button className={`main-tab-button ${activeTab === 'balance' ? 'active' : ''}`} onClick={() => setActiveTab('balance')}>Balance</button>
                <button className={`main-tab-button ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')}>Cuentas</button>
                <button className={`main-tab-button ${activeTab === 'fixedExpenses' ? 'active' : ''}`} onClick={() => setActiveTab('fixedExpenses')}>Gastos Fijos</button>
                <button className={`main-tab-button ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>Gastos/Categorías</button>
            </nav>
            <div className="accounting-content">
                {renderContent()}
            </div>
        </div>
    );
};

const BalanceView: React.FC<{
    transactions: AccountingTransaction[],
    accounts: AccountingAccount[],
    categoryGroups: ExpenseCategoryGroup[],
    onDataUpdate: () => void,
    gymId: string
}> = ({ transactions, accounts, categoryGroups, onDataUpdate, gymId }) => {
    
    const [showTransactionModal, setShowTransactionModal] = useState(false);

    const { totalIncome, totalExpenses, totalBalance } = useMemo(() => {
        const income = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const balance = accounts.reduce((sum, a) => sum + a.balance, 0);
        return { totalIncome: income, totalExpenses: expenses, totalBalance: balance };
    }, [transactions, accounts]);

    return (
        <div>
            {showTransactionModal && (
                <AddTransactionModal
                    accounts={accounts}
                    categoryGroups={categoryGroups}
                    gymId={gymId}
                    onClose={() => setShowTransactionModal(false)}
                    onSave={onDataUpdate}
                />
            )}
            <div className="actions-bar">
                <h3>Resumen General</h3>
                <button className="cta-button" onClick={() => setShowTransactionModal(true)}>+ Nueva Transacción</button>
            </div>
            <div className="summary-cards">
                <div className="summary-card">
                    <h4>Ingresos Totales</h4>
                    <p className="amount income">${totalIncome.toLocaleString('es-AR')}</p>
                </div>
                <div className="summary-card">
                    <h4>Gastos Totales</h4>
                    <p className="amount expense">${totalExpenses.toLocaleString('es-AR')}</p>
                </div>
                 <div className="summary-card">
                    <h4>Balance Total</h4>
                    <p className="amount balance">${totalBalance.toLocaleString('es-AR')}</p>
                </div>
            </div>
            <div className="accounting-card" style={{marginTop: '2rem'}}>
                <h3>Últimas Transacciones</h3>
                {transactions.length > 0 ? (
                    <ul className="transaction-list">
                        {transactions.slice(0, 10).map(t => (
                             <li key={t._id} className={`transaction-item ${t.type}`}>
                                <div className="transaction-details">
                                    <span className="description">{t.description}</span>
                                    <span className="meta">{new Date(t.date).toLocaleDateString()} - {t.accountName} {t.category ? `(${t.category.group}/${t.category.name})` : ''}</span>
                                </div>
                                <span className={`transaction-amount ${t.type}`}>{t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString('es-AR')}</span>
                             </li>
                        ))}
                    </ul>
                ) : (
                    <p>No hay transacciones todavía.</p>
                )}
            </div>
        </div>
    );
}

const AccountsView: React.FC<{
    accounts: AccountingAccount[],
    onDataUpdate: () => void,
    gymId: string
}> = ({ accounts, onDataUpdate, gymId }) => {
    const [newAccountName, setNewAccountName] = useState('');
    const [updatingBalances, setUpdatingBalances] = useState<Record<string, string>>({});

    const handleCreateAccount = async () => {
        if (!newAccountName) return;
        await apiClient.createAccountingData(gymId, 'accounts', { name: newAccountName, balance: 0 });
        setNewAccountName('');
        onDataUpdate();
    };

    const handleBalanceChange = (accountId: string, value: string) => {
        setUpdatingBalances(prev => ({...prev, [accountId]: value}));
    };

    const handleUpdateBalance = async (account: AccountingAccount) => {
        const newBalanceStr = updatingBalances[account._id];
        if (!newBalanceStr) return;
        const newBalance = parseFloat(newBalanceStr);
        if (isNaN(newBalance)) return;

        const difference = newBalance - account.balance;
        if (difference !== 0) {
            // Create a transaction for the difference
            await apiClient.createAccountingData(gymId, 'transactions', {
                date: new Date().toISOString(),
                type: difference > 0 ? 'income' : 'expense',
                amount: Math.abs(difference),
                description: `Ajuste de saldo de cuenta: ${account.name}`,
                accountId: account._id,
                accountName: account.name,
            });
        }

        // Update the account's total balance
        await apiClient.updateAccountingData('accounts', account._id, { balance: newBalance });
        
        setUpdatingBalances(prev => {
            const newState = {...prev};
            delete newState[account._id];
            return newState;
        });
        onDataUpdate();
    };


    return (
        <div className="accounting-grid">
            <div className="accounting-card">
                <h3>Crear Nueva Cuenta</h3>
                <div className="form-group">
                    <label>Nombre de la cuenta (Ej: Efectivo, Banco)</label>
                    <input type="text" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} />
                </div>
                <button className="cta-button" onClick={handleCreateAccount} disabled={!newAccountName}>Crear</button>
            </div>
            <div className="accounting-card" style={{ gridColumn: '1 / -1' }}>
                 <h3>Cuentas Actuales</h3>
                 <div className="account-list">
                    {accounts.map(account => (
                        <div key={account._id} className="accounting-card account-card">
                            <h4>{account.name}</h4>
                            <p className="balance">${account.balance.toLocaleString('es-AR')}</p>
                            <div className="form-group">
                                <label>Actualizar saldo total</label>
                                <form className="update-balance-form" onSubmit={(e) => { e.preventDefault(); handleUpdateBalance(account); }}>
                                    <input 
                                        type="number" 
                                        step="any"
                                        placeholder="Nuevo Saldo Total"
                                        value={updatingBalances[account._id] || ''}
                                        onChange={e => handleBalanceChange(account._id, e.target.value)}
                                    />
                                    <button type="submit" className="cta-button secondary" disabled={!updatingBalances[account._id]}>✓</button>
                                </form>
                                <small>El sistema calculará la diferencia como ingreso/gasto.</small>
                            </div>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    );
};

const FixedExpensesView: React.FC<{
    fixedExpenses: FixedExpense[],
    accounts: AccountingAccount[],
    onDataUpdate: () => void,
    gymId: string
}> = ({ fixedExpenses, accounts, onDataUpdate, gymId }) => {
    
    const [showModal, setShowModal] = useState(false);
    
    const handleMarkAsPaid = async (expense: FixedExpense) => {
        if (accounts.length === 0) {
            alert("Debes crear una cuenta primero para poder pagar gastos.");
            return;
        }

        const accountId = accounts[0]._id; // Default to first account
        const accountName = accounts[0].name;

        await apiClient.createAccountingData(gymId, 'transactions', {
            date: new Date().toISOString(),
            type: 'expense',
            amount: expense.amount,
            description: `Pago de gasto fijo: ${expense.name}`,
            accountId: accountId,
            accountName: accountName,
        });

        const newBalance = (accounts.find(a => a._id === accountId)?.balance || 0) - expense.amount;
        await apiClient.updateAccountingData('accounts', accountId, { balance: newBalance });

        await apiClient.updateAccountingData('fixed_expenses', expense._id, { lastPaid: new Date().toISOString() });
        onDataUpdate();
    };

    const isPaidThisMonth = (lastPaid: string | null) => {
        if (!lastPaid) return false;
        const lastPaidDate = new Date(lastPaid);
        const now = new Date();
        return lastPaidDate.getMonth() === now.getMonth() && lastPaidDate.getFullYear() === now.getFullYear();
    };

    return (
        <div>
            {showModal && (
                <AddFixedExpenseModal
                    gymId={gymId}
                    onClose={() => setShowModal(false)}
                    onSave={onDataUpdate}
                />
            )}
             <div className="actions-bar">
                <h3>Listado de Gastos Fijos</h3>
                <button className="cta-button" onClick={() => setShowModal(true)}>+ Nuevo Gasto Fijo</button>
            </div>
             <div className="accounting-card">
                 <ul className="fixed-expense-list">
                    {fixedExpenses.map(expense => (
                        <li key={expense._id} className={`fixed-expense-item ${isPaidThisMonth(expense.lastPaid) ? 'paid' : ''}`}>
                            <span className="name">{expense.name}</span>
                            <span className="amount">${expense.amount.toLocaleString('es-AR')}</span>
                            <button 
                                className="cta-button pay-button"
                                onClick={() => handleMarkAsPaid(expense)}
                                disabled={isPaidThisMonth(expense.lastPaid)}
                            >
                                {isPaidThisMonth(expense.lastPaid) ? 'Pagado' : 'Marcar como Pagado'}
                            </button>
                        </li>
                    ))}
                 </ul>
             </div>
        </div>
    );
};

const CategoriesView: React.FC<{
    categoryGroups: ExpenseCategoryGroup[],
    onDataUpdate: () => void,
    gymId: string
}> = ({ categoryGroups, onDataUpdate, gymId }) => {
    
    const [newGroupName, setNewGroupName] = useState('');
    const [newCategory, setNewCategory] = useState<Record<string, string>>({});

    const handleCreateGroup = async () => {
        if (!newGroupName) return;
        await apiClient.createAccountingData(gymId, 'expense_category_groups', { name: newGroupName, categories: [] });
        setNewGroupName('');
        onDataUpdate();
    };

    const handleAddCategory = async (group: ExpenseCategoryGroup) => {
        const categoryName = newCategory[group._id];
        if (!categoryName) return;
        const updatedCategories = [...group.categories, categoryName];
        await apiClient.updateAccountingData('expense_category_groups', group._id, { categories: updatedCategories });
        setNewCategory(prev => ({...prev, [group._id]: ''}));
        onDataUpdate();
    };

    return (
        <div className="accounting-grid">
            <div className="accounting-card">
                <h3>Crear Nuevo Grupo de Gastos</h3>
                 <div className="form-group">
                    <label>Nombre del Grupo (Ej: Gastos Personales, Gimnasio)</label>
                    <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                </div>
                <button className="cta-button" onClick={handleCreateGroup}>Crear Grupo</button>
            </div>
             <div className="accounting-card" style={{gridColumn: '1 / -1'}}>
                 <h3>Categorías Actuales</h3>
                 {categoryGroups.map(group => (
                    <div key={group._id} className="category-group">
                        <div className="category-group-header">
                            <h4>{group.name}</h4>
                        </div>
                        <ul className="category-list">
                            {group.categories.map(cat => <li key={cat} className="category-item"><span>{cat}</span></li>)}
                        </ul>
                         <div className="form-group" style={{marginTop: '1rem'}}>
                             <form className="update-balance-form" onSubmit={(e) => { e.preventDefault(); handleAddCategory(group); }}>
                                <input 
                                    type="text" 
                                    placeholder="Nueva categoría..."
                                    value={newCategory[group._id] || ''}
                                    onChange={e => setNewCategory(prev => ({...prev, [group._id]: e.target.value}))}
                                />
                                <button type="submit" className="cta-button secondary" disabled={!newCategory[group._id]}>+</button>
                            </form>
                        </div>
                    </div>
                 ))}
             </div>
        </div>
    );
};


const AddTransactionModal: React.FC<{
    accounts: AccountingAccount[],
    categoryGroups: ExpenseCategoryGroup[],
    gymId: string,
    onClose: () => void,
    onSave: () => void
}> = ({ accounts, categoryGroups, gymId, onClose, onSave }) => {

    const [type, setType] = useState<'income' | 'expense'>('expense');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [accountId, setAccountId] = useState(accounts[0]?._id || '');
    const [category, setCategory] = useState(''); // "group|category"

    const handleSave = async () => {
        if (!description || !amount || !accountId) {
            alert("Completa todos los campos.");
            return;
        }
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) {
            alert("Ingresa un monto válido.");
            return;
        }

        const account = accounts.find(a => a._id === accountId);
        if (!account) return;

        const transactionData: Partial<AccountingTransaction> = {
            date: new Date().toISOString(),
            type,
            amount: amountNum,
            description,
            accountId,
            accountName: account.name,
        };

        if (type === 'expense' && category) {
            const [group, name] = category.split('|');
            transactionData.category = { group, name };
        }

        await apiClient.createAccountingData(gymId, 'transactions', transactionData);

        const newBalance = type === 'income' ? account.balance + amountNum : account.balance - amountNum;
        await apiClient.updateAccountingData('accounts', accountId, { balance: newBalance });

        onSave();
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content edit-modal large">
                <button className="close-button" onClick={onClose}>&times;</button>
                <h3>Nueva Transacción</h3>
                <div className="form-group">
                    <label>Tipo</label>
                    <select value={type} onChange={e => setType(e.target.value as any)}>
                        <option value="expense">Gasto</option>
                        <option value="income">Ingreso</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Descripción</label>
                    <input type="text" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Monto</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Cuenta</label>
                    <select value={accountId} onChange={e => setAccountId(e.target.value)}>
                        {accounts.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                    </select>
                </div>
                {type === 'expense' && (
                    <div className="form-group">
                        <label>Categoría (Opcional)</label>
                        <select value={category} onChange={e => setCategory(e.target.value)}>
                            <option value="">Ninguna</option>
                            {categoryGroups.map(group => (
                                <optgroup key={group._id} label={group.name}>
                                    {group.categories.map(cat => <option key={cat} value={`${group.name}|${cat}`}>{cat}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                )}
                 <div className="modal-actions" style={{marginTop: '2rem'}}>
                    <button type="button" className="cta-button secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="cta-button" onClick={handleSave}>Guardar</button>
                </div>
            </div>
        </div>
    );
};

const AddFixedExpenseModal: React.FC<{ gymId: string, onClose: () => void, onSave: () => void }> = ({ gymId, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');

    const handleSave = async () => {
        if (!name || !amount) return;
        const amountNum = parseFloat(amount);
        if (isNaN(amountNum) || amountNum <= 0) return;
        
        await apiClient.createAccountingData(gymId, 'fixed_expenses', { name, amount: amountNum, lastPaid: null });
        onSave();
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content edit-modal">
                 <button className="close-button" onClick={onClose}>&times;</button>
                 <h3>Nuevo Gasto Fijo</h3>
                  <div className="form-group">
                    <label>Nombre</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Monto Mensual</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
                </div>
                 <div className="modal-actions" style={{marginTop: '2rem'}}>
                    <button type="button" className="cta-button secondary" onClick={onClose}>Cancelar</button>
                    <button type="button" className="cta-button" onClick={handleSave}>Guardar</button>
                </div>
            </div>
        </div>
    )
};


const AdminDashboard: React.FC<{ 
    onSelectClient: (dni: string) => void; 
    onLogout: () => void; 
    gym: Gym; 
    loggedInGym: Gym;
    onBackToSuperAdmin: () => void;
}> = ({ onSelectClient, onLogout, gym, loggedInGym, onBackToSuperAdmin }) => {
    const [clients, setClients] = useState<ClientListItem[]>([]);
    const [requests, setRequests] = useState<TrainerRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [adminView, setAdminView] = useState<'clients' | 'library' | 'requests' | 'templates' | 'accounting'>('clients');
    const [showQrModal, setShowQrModal] = useState(false);

    const fetchAllData = async () => {
        setIsLoading(true);
        const [fetchedClients, fetchedRequests] = await Promise.all([
            apiClient.getClients(gym._id),
            apiClient.getRequests(gym._id)
        ]);
        setClients(fetchedClients);
        setRequests(fetchedRequests);
        setIsLoading(false);
    };
    
    const fetchRequests = async () => {
        const fetchedRequests = await apiClient.getRequests(gym._id);
        setRequests(fetchedRequests);
    };

    useEffect(() => {
        fetchAllData();
    }, [gym._id]);
    
    const handleClientCreated = () => {
        fetchAllData();
    };

    const newRequestCount = useMemo(() => {
        return requests.filter(r => r.status === 'new').length;
    }, [requests]);

    const filteredClients = useMemo(() => {
        return clients
            .filter(c => c.status === viewMode)
            .filter(c =>
                (c.profile?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                c.dni.includes(searchTerm)
            );
    }, [clients, viewMode, searchTerm]);
    
    const toggleSelectionMode = () => {
        setSelectionMode(!selectionMode);
        setSelectedClients(new Set());
    };
    
    const handleCardClick = (client: ClientListItem) => {
        if (selectionMode) {
            const newSelection = new Set(selectedClients);
            if (newSelection.has(client.dni)) {
                newSelection.delete(client.dni);
            } else {
                newSelection.add(client.dni);
            }
            setSelectedClients(newSelection);
        } else {
            onSelectClient(client.dni);
        }
    };
    
    const handleUpdateStatus = async (newStatus: 'active' | 'archived') => {
        await apiClient.updateClientStatus(selectedClients, newStatus);
        setSelectedClients(new Set());
        setSelectionMode(false);
        fetchAllData();
    };
    
    const handleDeleteSelected = async () => {
        await apiClient.deleteClients(selectedClients);
        setShowDeleteConfirm(false);
        setSelectedClients(new Set());
        setSelectionMode(false);
        fetchAllData();
    };

    const renderCurrentView = () => {
        switch(adminView) {
            case 'library':
                return <ExerciseLibraryManager gymId={gym._id} onBack={() => setAdminView('clients')} />;
            case 'requests':
                return <RequestsView requests={requests} onUpdateRequest={fetchRequests} />;
             case 'templates':
                return <RoutineTemplateManager gym={gym} onBack={() => setAdminView('clients')} />;
             case 'accounting':
                return <AccountingDashboard gym={gym} />;
            case 'clients':
            default:
                return (
                    <>
                        <div className="client-management-bar">
                             <AddClientForm onClientCreated={handleClientCreated} gymId={gym._id} />
                             <div className="search-client-form">
                                 <input
                                    type="text"
                                    placeholder="Buscar por nombre o DNI..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                             </div>
                        </div>
                        <div className="view-controls">
                            <div className="view-toggle">
                                <button onClick={() => setViewMode('active')} className={`view-toggle-button ${viewMode === 'active' ? 'active' : ''}`}>Activos</button>
                                <button onClick={() => setViewMode('archived')} className={`view-toggle-button ${viewMode === 'archived' ? 'active' : ''}`}>Archivados</button>
                            </div>
                            <div className="selection-controls">
                                 <button onClick={toggleSelectionMode} className="selection-toggle-button">
                                    {selectionMode ? 'Cancelar Selección' : 'Seleccionar Varios'}
                                </button>
                                {selectionMode && (
                                    <>
                                       {viewMode === 'active' ? (
                                           <button onClick={() => handleUpdateStatus('archived')} className="archive-selected-button" disabled={selectedClients.size === 0}>Archivar</button>
                                       ) : (
                                           <button onClick={() => handleUpdateStatus('active')} className="restore-selected-button" disabled={selectedClients.size === 0}>Restaurar</button>
                                       )}
                                       <button onClick={() => setShowDeleteConfirm(true)} className="delete-selected-button" disabled={selectedClients.size === 0}>Eliminar</button>
                                    </>
                                )}
                            </div>
                        </div>
                        {isLoading ? (
                             <div className="loading-container"><div className="spinner"></div>Cargando clientes...</div>
                        ) : (
                            <div className="client-list">
                                {filteredClients.map(client => (
                                    <div 
                                       key={client.dni} 
                                       className={`client-card ${selectionMode ? 'selection-mode' : ''} ${selectedClients.has(client.dni) ? 'selected' : ''}`}
                                       onClick={() => handleCardClick(client)}
                                    >
                                        {selectionMode && (
                                           <input 
                                              type="checkbox" 
                                              className="client-selection-checkbox"
                                              checked={selectedClients.has(client.dni)}
                                              readOnly
                                           />
                                        )}
                                        <div className="client-card-header">
                                            <h3>{client.profile?.name || 'Nuevo Cliente'}</h3>
                                            {client.planStatus === 'pending' && <span className="client-status-badge pending">Pendiente</span>}
                                        </div>
                                        <p>DNI: {client.dni}</p>
                                        {client.accessCode && 
                                            <p className="client-card-access-code">Acceso: <strong>{client.accessCode}</strong></p>
                                        }
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                );
        }
    }

    const isImpersonating = loggedInGym.username === 'superadmin' && gym.username !== 'superadmin';

    return (
        <div className="admin-dashboard">
            <div className="main-header">
                <div className="header-title-wrapper">
                    {gym.logoSvg && <div className="app-logo"><SvgImage svgString={gym.logoSvg} altText={`${gym.name} logo`} /></div>}
                    <div>
                        <h1>{gym.name}</h1>
                        <p>{isImpersonating ? `Gestionando como Superadmin` : 'Panel de Entrenador'}</p>
                    </div>
                </div>
                <div className="admin-header-nav">
                     <button className="header-nav-button" onClick={() => setAdminView('clients')}>Clientes</button>
                     <button className="header-nav-button" onClick={() => setAdminView('accounting')}>Contabilidad</button>
                     <button className="header-nav-button" onClick={() => setAdminView('templates')}>Plantillas</button>
                     <button className="header-nav-button" onClick={() => setAdminView('requests')}>
                        Bandeja de Entrada
                        {newRequestCount > 0 && <span className="notification-badge">{newRequestCount}</span>}
                    </button>
                    <button className="header-nav-button" onClick={() => setAdminView('library')}>Biblioteca</button>
                    <button className="header-nav-button share-app-button" onClick={() => setShowQrModal(true)}>Compartir App</button>
                    {isImpersonating ? (
                        <button onClick={onBackToSuperAdmin} className="back-button">Volver</button>
                    ) : (
                        <button onClick={onLogout} className="logout-button admin-logout">Cerrar Sesión</button>
                    )}
                </div>
            </div>

            {renderCurrentView()}
            
            {showDeleteConfirm && (
                <ConfirmationModal
                    message={`¿Estás seguro de que quieres eliminar a ${selectedClients.size} cliente(s) permanentemente? Esta acción es irreversible.`}
                    onConfirm={handleDeleteSelected}
                    onCancel={() => setShowDeleteConfirm(false)}
                    confirmText="Eliminar"
                    confirmClass="delete"
                />
            )}

            {showQrModal && <QrCodeModal onClose={() => setShowQrModal(false)} />}
        </div>
    );
};

const AddClientForm: React.FC<{ onClientCreated: () => void, gymId: string }> = ({ onClientCreated, gymId }) => {
    const [dni, setDni] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!/^\d{7,8}$/.test(dni)) {
            setError('Por favor, ingresa un DNI válido (7 u 8 dígitos).');
            return;
        }
        setIsSubmitting(true);
        setError('');
        const result = await apiClient.createClient(dni, gymId);
        if (result.success) {
            setDni('');
            onClientCreated();
        } else {
            setError(result.message || 'Error al crear el cliente.');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="add-client-form">
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="DNI del nuevo cliente"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    required
                />
                <button type="submit" className="cta-button" disabled={isSubmitting}>
                    {isSubmitting ? 'Añadiendo...' : 'Añadir Cliente'}
                </button>
            </form>
            {error && <p className="error-text" style={{marginTop: '0.5rem'}}>{error}</p>}
        </div>
    );
};

const ProgressView: React.FC<{ clientData: ClientData; onDataUpdate: () => void; }> = ({ clientData, onDataUpdate }) => {
    const [activeTab, setActiveTab] = useState<'weight' | 'exercises'>('weight');
    const [newWeight, setNewWeight] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleAddWeight = async (e: React.FormEvent) => {
        e.preventDefault();
        const weightValue = parseFloat(newWeight);
        if (!weightValue || weightValue <= 0) {
            alert("Por favor, ingresa un peso válido.");
            return;
        }

        setIsSaving(true);
        const newEntry: BodyWeightEntry = {
            date: new Date().toISOString(),
            weight: weightValue,
        };

        const updatedLog = [...(clientData.bodyWeightLog || []), newEntry];
        const success = await apiClient.saveClientData(clientData.dni, { bodyWeightLog: updatedLog });
        if (success) {
            setNewWeight('');
            onDataUpdate();
        } else {
            alert("No se pudo guardar el registro de peso.");
        }
        setIsSaving(false);
    };

    const sortedWeightLog = useMemo(() => {
        return [...(clientData.bodyWeightLog || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [clientData.bodyWeightLog]);

    const renderWeightView = () => (
        <div className="progress-content animated-fade-in">
            <h3>Registro de Peso Corporal</h3>
            <form onSubmit={handleAddWeight} className="add-progress-form">
                <input 
                    type="number" 
                    step="0.1" 
                    placeholder="Nuevo peso (kg)"
                    value={newWeight}
                    onChange={e => setNewWeight(e.target.value)}
                    required 
                />
                <button type="submit" className="cta-button" disabled={isSaving}>
                    {isSaving ? 'Guardando...' : 'Añadir Registro'}
                </button>
            </form>

            <div className="progress-log-list">
                <h4>Historial de Peso</h4>
                {sortedWeightLog.length > 0 ? (
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Peso (kg)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedWeightLog.map((entry, index) => (
                                <tr key={index}>
                                    <td>{new Date(entry.date).toLocaleDateString()}</td>
                                    <td>{entry.weight.toFixed(1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="placeholder">No hay registros de peso todavía.</p>
                )}
            </div>
        </div>
    );
    
    const renderExerciseView = () => (
         <div className="progress-content animated-fade-in">
            <h3>Progreso en Ejercicios</h3>
             <div className="progress-log-list">
                {Object.keys(clientData.progressLog).length > 0 ? (
                    Object.entries(clientData.progressLog).map(([exerciseName, entries]) => (
                        <div key={exerciseName} className="exercise-progress-block">
                            <h4>{exerciseName}</h4>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Peso (kg)</th>
                                        <th>Reps</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry, index) => (
                                        <tr key={index}>
                                            <td>{new Date(entry.date).toLocaleDateString()}</td>
                                            <td>{entry.weight}</td>
                                            <td>{entry.repetitions}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))
                ) : (
                    <p className="placeholder">El cliente no ha registrado progreso en ningún ejercicio.</p>
                )}
            </div>
        </div>
    );

    return (
        <div className="progress-view-container">
            <nav className="progress-tabs-nav">
                <button 
                    className={`progress-tab-button ${activeTab === 'weight' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('weight')}>
                    Peso Corporal
                </button>
                <button 
                    className={`progress-tab-button ${activeTab === 'exercises' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('exercises')}>
                    Ejercicios
                </button>
            </nav>
            {activeTab === 'weight' ? renderWeightView() : renderExerciseView()}
        </div>
    );
};

const RoutineGenerator: React.FC<{
    clientData: ClientData;
    setClientData: React.Dispatch<React.SetStateAction<ClientData | null>>;
    gymId: string;
}> = ({ clientData, setClientData, gymId }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [adminInstructions, setAdminInstructions] = useState('');
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary | null>(null);

    useEffect(() => {
        const fetchLibrary = async () => {
            const library = await apiClient.getExerciseLibrary(gymId);
            setExerciseLibrary(library);
        };
        fetchLibrary();
    }, [gymId]);

    const handleGenerateRoutine = async () => {
        if (!clientData.profile.goal) {
            setError("Por favor, completa el perfil del cliente (especialmente el objetivo) antes de generar una rutina.");
            return;
        }
        setIsGenerating(true);
        setError('');
        try {
            const generatedRoutine = await generateRoutineForClient(clientData, gymId, adminInstructions);
            const updatedData = {
                ...clientData,
                routine: generatedRoutine,
                routineGeneratedDate: new Date().toISOString(),
            };
            const success = await apiClient.saveClientData(clientData.dni, {
                routine: generatedRoutine,
                routineGeneratedDate: new Date().toISOString(),
            });
            if (success) {
                setClientData(updatedData);
            } else {
                setError("No se pudo guardar la rutina generada.");
            }
        } catch (e: any) {
            setError(e.message || "Ocurrió un error al generar la rutina.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRoutineChange = (newRoutine: Routine) => {
        setClientData(prev => prev ? ({ ...prev, routine: newRoutine }) : null);
    };
    
    const handleSaveRoutine = async () => {
        if (!clientData.routine) return;
        setIsGenerating(true);
        const success = await apiClient.saveClientData(clientData.dni, { routine: clientData.routine });
        if (!success) {
            alert("Error guardando la rutina.");
        }
        setIsGenerating(false);
    };

    if (isGenerating) {
        return (
            <div className="generation-container placeholder-action">
                <div className="loading-container" style={{ minHeight: 'auto', padding: '2rem' }}>
                    <div className="spinner"></div>
                    <p>Generando rutina con IA... Esto puede tardar unos segundos.</p>
                </div>
            </div>
        );
    }
    
    if (clientData.routine) {
        return (
            <div className="routine-generator-container">
                <div className="actions-bar">
                    <button className="cta-button" onClick={handleSaveRoutine}>Guardar Cambios</button>
                    <button className="cta-button secondary" onClick={handleGenerateRoutine}>Volver a Generar</button>
                </div>
                <RoutinePlan routine={clientData.routine} isEditing={true} onRoutineChange={handleRoutineChange} exerciseLibrary={exerciseLibrary || {}} />
            </div>
        );
    }

    return (
        <div className="routine-generator-container placeholder-action">
            <h3>Generador de Rutina con IA</h3>
            <p>La IA usará el perfil del cliente y la biblioteca de ejercicios de tu gimnasio para crear un plan personalizado.</p>
            <div className="form-group" style={{ width: '100%', maxWidth: '600px', margin: '1.5rem auto' }}>
                <label htmlFor="admin-instructions">Instrucciones Adicionales (Opcional)</label>
                <textarea
                    id="admin-instructions"
                    rows={3}
                    value={adminInstructions}
                    onChange={(e) => setAdminInstructions(e.target.value)}
                    placeholder="Ej: Evitar ejercicios de alto impacto, enfocar en hipertrofia de piernas."
                ></textarea>
            </div>
            {error && <p className="error-text">{error}</p>}
            <button className="cta-button" onClick={handleGenerateRoutine} disabled={isGenerating}>
                Generar Rutina
            </button>
        </div>
    );
};

const DietPlanGenerator: React.FC<{
    clientData: ClientData;
    setClientData: React.Dispatch<React.SetStateAction<ClientData | null>>;
}> = ({ clientData, setClientData }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [activePlan, setActivePlan] = useState<0 | 1>(0);

    const handleGenerateDietPlan = async (planIndex: 0 | 1) => {
        if (!clientData.profile.goal) {
            setError("Por favor, completa el perfil del cliente antes de generar un plan.");
            return;
        }
        setIsGenerating(true);
        setError('');
        try {
            const generatedPlan = await generateDietPlanForClient(clientData);
            
            const newDietPlans = [...(clientData.dietPlans || [null, null])];
            newDietPlans[planIndex] = generatedPlan;
            
            const success = await apiClient.saveClientData(clientData.dni, { dietPlans: newDietPlans });
            
            if (success) {
                setClientData(prev => prev ? ({ ...prev, dietPlans: newDietPlans }) : null);
            } else {
                setError("No se pudo guardar el plan de nutrición generado.");
            }

        } catch (e: any) {
            setError(e.message || "Ocurrió un error al generar el plan de nutrición.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const currentPlan = clientData.dietPlans ? clientData.dietPlans[activePlan] : null;

    if (isGenerating) {
        return (
            <div className="generation-container placeholder-action">
                <div className="loading-container" style={{ minHeight: 'auto', padding: '2rem' }}>
                    <div className="spinner"></div>
                    <p>Generando plan de nutrición con IA...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="diet-generator-container">
            <div className="actions-bar">
                <h3>Planes de Nutrición</h3>
                <div className="plan-toggle">
                    <button className={activePlan === 0 ? 'active' : ''} onClick={() => setActivePlan(0)}>Plan A</button>
                    <button className={activePlan === 1 ? 'active' : ''} onClick={() => setActivePlan(1)}>Plan B</button>
                </div>
            </div>
            {error && <p className="error-text">{error}</p>}
            
            {currentPlan ? (
                <div>
                     <button className="cta-button secondary" onClick={() => handleGenerateDietPlan(activePlan)} style={{marginBottom: '1rem'}}>
                        Volver a Generar Plan {activePlan === 0 ? 'A' : 'B'}
                    </button>
                    <DietPlanDisplay dietPlan={currentPlan} />
                </div>
            ) : (
                <div className="placeholder-action">
                    <p>El Plan {activePlan === 0 ? 'A' : 'B'} no ha sido generado. La IA creará un plan de nutrición basado en el perfil del cliente.</p>
                     <button className="cta-button" onClick={() => handleGenerateDietPlan(activePlan)}>
                        Generar Plan {activePlan === 0 ? 'A' : 'B'}
                    </button>
                </div>
            )}
        </div>
    );
};

const ClientManagementView: React.FC<{ dni: string, onBack: () => void, onLogout: () => void, gym: Gym }> = ({ dni, onBack, onLogout, gym }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [requests, setRequests] = useState<TrainerRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'routine' | 'diet' | 'progress' | 'messages'>('routine');

     const fetchClientData = async () => {
        setIsLoading(true);
        const [data, reqs] = await Promise.all([
            apiClient.getClientData(dni),
            apiClient.getRequestsByClient(dni)
        ]);
        setClientData(data);
        setRequests(reqs);

        if (data && data.planType === 'nutrition' && activeTab === 'routine') {
            setActiveTab('diet');
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchClientData();
    }, [dni]);
    
    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div>Cargando datos del cliente...</div>;
    }

    if (!clientData) {
        return <div className="error-container">No se pudieron cargar los datos del cliente.</div>;
    }
    
    const planType = clientData.planType || 'full';


    return (
        <div className="client-management-view">
             <div className="main-header">
                <div className="header-title-wrapper">
                    {gym.logoSvg && <div className="app-logo"><SvgImage svgString={gym.logoSvg} altText={`${gym.name} logo`} /></div>}
                     <div>
                        <h1>{clientData.profile.name || `Cliente ${clientData.dni}`}</h1>
                        <p>DNI: {clientData.dni}</p>
                    </div>
                </div>
                 <div className="admin-header-nav">
                    <button onClick={onBack} className="back-button">Volver al Panel</button>
                    <button onClick={onLogout} className="logout-button admin-logout">Cerrar Sesión</button>
                 </div>
            </div>
            <div className="dashboard-grid">
                <aside className="profile-section">
                    <ProfileEditor clientData={clientData} setClientData={setClientData} onDataUpdate={fetchClientData}/>
                </aside>
                <main className="main-content">
                    <nav className="main-tabs-nav">
                        {(planType === 'full' || planType === 'routine') &&
                            <button 
                                className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} 
                                onClick={() => setActiveTab('routine')}>
                                Rutina
                            </button>
                        }
                        {(planType === 'full' || planType === 'nutrition') &&
                            <button 
                                className={`main-tab-button ${activeTab === 'diet' ? 'active' : ''}`} 
                                onClick={() => setActiveTab('diet')}>
                                Nutrición
                            </button>
                        }
                         <button 
                            className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('progress')}>
                            Progreso
                        </button>
                        <button 
                            className={`main-tab-button ${activeTab === 'messages' ? 'active' : ''}`} 
                            onClick={() => setActiveTab('messages')}>
                            Mensajes
                        </button>
                    </nav>
                    <div className="results-section">
                       {activeTab === 'routine' && <RoutineGenerator clientData={clientData} setClientData={setClientData} gymId={gym._id} />}
                       {activeTab === 'diet' && <DietPlanGenerator clientData={clientData} setClientData={setClientData} />}
                       {activeTab === 'progress' && <ProgressView clientData={clientData} onDataUpdate={fetchClientData} />}
                       {activeTab === 'messages' && <ClientRequestsView requests={requests} />}
                    </div>
                </main>
            </div>
        </div>
    );
};

const ClientRequestsView: React.FC<{ requests: TrainerRequest[] }> = ({ requests }) => {
    const sortedRequests = useMemo(() => {
        return [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [requests]);

    if (requests.length === 0) {
        return (
            <div className="placeholder" style={{ marginTop: '2rem' }}>
                Este cliente no ha enviado ningún mensaje.
            </div>
        );
    }

    return (
        <div className="request-list animated-fade-in">
            {sortedRequests.map(req => (
                <div key={req._id} className={`request-card status-${req.status}`}>
                    <div className="request-card-header">
                        <h4>{req.subject}</h4>
                        <span className="request-date">{new Date(req.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="request-message">{req.message}</p>
                </div>
            ))}
        </div>
    );
};

const ProfileEditor: React.FC<{
    clientData: ClientData;
    setClientData: React.Dispatch<React.SetStateAction<ClientData | null>>;
    onDataUpdate?: () => void;
    isClientOnboarding?: boolean;
}> = ({ clientData, setClientData, onDataUpdate, isClientOnboarding = false }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');

    const profile = clientData.profile;

    const handleProfileChange = (field: keyof Profile, value: any) => {
        setClientData(prev => {
            if (!prev) return null;
            return {
                ...prev,
                profile: { ...prev.profile, [field]: value },
            };
        });
    };

    const handleSaveProfile = async () => {
        setIsSaving(true);
        const success = await apiClient.saveClientData(clientData.dni, { profile: clientData.profile });
        if (success) {
            setSaveMessage('Perfil guardado con éxito!');
            if (onDataUpdate) {
                onDataUpdate();
            }
        } else {
            setSaveMessage('Error al guardar.');
        }
        setIsSaving(false);
        setTimeout(() => setSaveMessage(''), 2000);
    };
    
    const bmi = calculateBMI(parseFloat(profile.weight), parseFloat(profile.height));

    return (
        <div className={`profile-editor ${isClientOnboarding ? 'onboarding-style' : ''}`}>
            {!isClientOnboarding && <h3>Perfil del Cliente</h3>}
            <div className="profile-grid">
                <div className="form-group">
                    <label>Nombre</label>
                    <input type="text" value={profile.name} onChange={e => handleProfileChange('name', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Edad</label>
                    <input type="number" value={profile.age} onChange={e => handleProfileChange('age', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Peso (kg)</label>
                    <input type="number" step="0.1" value={profile.weight} onChange={e => handleProfileChange('weight', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Altura (cm)</label>
                    <input type="number" value={profile.height} onChange={e => handleProfileChange('height', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Género</label>
                    <select value={profile.gender} onChange={e => handleProfileChange('gender', e.target.value)}>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Nivel Experiencia</label>
                    <select value={profile.level} onChange={e => handleProfileChange('level', e.target.value)}>
                        <option value="Principiante">Principiante</option>
                        <option value="Intermedio">Intermedio</option>
                        <option value="Avanzado">Avanzado</option>
                    </select>
                </div>
                <div className="form-group full-width">
                    <label>Objetivo Principal</label>
                    <select value={profile.goal} onChange={e => handleProfileChange('goal', e.target.value)}>
                        <option value="Hipertrofia">Hipertrofia</option>
                        <option value="Pérdida de grasa">Pérdida de grasa</option>
                        <option value="Mantenimiento">Mantenimiento</option>
                        <option value="Resistencia">Resistencia</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Días/Semana</label>
                    <input type="number" min="1" max="7" value={profile.trainingDays} onChange={e => handleProfileChange('trainingDays', e.target.value)} />
                </div>
                 <div className="form-group">
                    <label>Intensidad Deseada</label>
                    <select value={profile.trainingIntensity} onChange={e => handleProfileChange('trainingIntensity', e.target.value)}>
                        <option value="Baja">Baja</option>
                        <option value="Moderada">Moderada</option>
                        <option value="Alta">Alta</option>
                        <option value="Extrema">Extrema</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Enfoque Corporal</label>
                    <select value={profile.bodyFocusArea} onChange={e => handleProfileChange('bodyFocusArea', e.target.value)}>
                         <option value="Cuerpo Completo">Cuerpo Completo (dividida)</option>
                         <option value="Full Body">Full Body (cuerpo entero)</option>
                         <option value="Tren Superior">Tren Superior</option>
                         <option value="Tren Inferior">Tren Inferior</option>
                    </select>
                </div>
                 <div className="form-group">
                    <label>Enfoque Muscular</label>
                    <input type="text" value={profile.muscleFocus} onChange={e => handleProfileChange('muscleFocus', e.target.value)} placeholder="Ej: General, Cuádriceps" />
                </div>
                 <div className="form-group switch-like">
                    <label>Usar Técnicas Avanzadas</label>
                    <select value={profile.useAdvancedTechniques} onChange={e => handleProfileChange('useAdvancedTechniques', e.target.value)}>
                        <option value="No">No</option>
                        <option value="Sí">Sí</option>
                    </select>
                </div>
                 <div className="form-group switch-like">
                    <label>Incluir Fase de Adaptación (1 sem)</label>
                    <select value={profile.includeAdaptationPhase} onChange={e => handleProfileChange('includeAdaptationPhase', e.target.value)}>
                        <option value="Sí">Sí</option>
                        <option value="No">No</option>
                    </select>
                </div>
                <div className="form-group switch-like">
                    <label>Incluir Fase de Descarga (1 sem)</label>
                     <select value={profile.includeDeloadPhase} onChange={e => handleProfileChange('includeDeloadPhase', e.target.value)}>
                        <option value="Sí">Sí</option>
                        <option value="No">No</option>
                    </select>
                </div>
            </div>
            {!isClientOnboarding && (
                 <div className="profile-actions">
                    <button className="cta-button" onClick={handleSaveProfile} disabled={isSaving}>
                        {isSaving ? "Guardando..." : "Guardar Perfil"}
                    </button>
                    {saveMessage && <span className="save-message">{saveMessage}</span>}
                </div>
            )}
             <div className="profile-summary">
                <div className="summary-item">
                    <h4>IMC</h4>
                    <p className={`bmi-value ${bmi.categoryClass}`}>{bmi.value || 'N/A'}</p>
                </div>
                 <div className="summary-item">
                    <h4>Peso Objetivo</h4>
                    <p>{calculateTargetWeight(parseFloat(profile.height))}</p>
                </div>
                <div className="summary-item">
                    <h4>Peso Final Estimado</h4>
                    <p>{calculateEstimatedFinalWeight(clientData)}</p>
                </div>
            </div>
        </div>
    );
};

// Added missing components for ClientView
const ClientRoutineView: React.FC<{
    routine: Routine;
    progressLog: ProgressLog;
    onProgressUpdate: (newLog: ProgressLog) => void;
}> = ({ routine, progressLog, onProgressUpdate }) => {
    const [logEntry, setLogEntry] = useState<{ exerciseName: string; weight: string; repetitions: string } | null>(null);

    const handleOpenLogModal = (exerciseName: string) => {
        const lastEntry = progressLog[exerciseName]?.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        setLogEntry({
            exerciseName,
            weight: lastEntry?.weight.toString() || '',
            repetitions: lastEntry?.repetitions.toString() || ''
        });
    };

    const handleSaveLog = () => {
        if (!logEntry || !logEntry.weight || !logEntry.repetitions) return;

        const newLogEntry: ProgressLogEntry = {
            date: new Date().toISOString(),
            weight: parseFloat(logEntry.weight),
            repetitions: parseInt(logEntry.repetitions, 10)
        };
        
        const newProgressLog = JSON.parse(JSON.stringify(progressLog || {}));
        if (!newProgressLog[logEntry.exerciseName]) {
            newProgressLog[logEntry.exerciseName] = [];
        }
        newProgressLog[logEntry.exerciseName].push(newLogEntry);
        
        onProgressUpdate(newProgressLog);
        setLogEntry(null);
    };
    
    // This is a simplified view for the client. The RoutinePlan component is more for editing.
    // Let's create a simpler display for the client.
    const [activePhaseIndex, setActivePhaseIndex] = useState(0);
    const activePhase = routine.phases[activePhaseIndex];

    return (
        <div className="plan-container animated-fade-in">
            {logEntry && (
                <div className="modal-overlay">
                    <div className="modal-content edit-modal">
                         <button className="close-button" onClick={() => setLogEntry(null)}>&times;</button>
                         <h3>Registrar Progreso: {logEntry.exerciseName}</h3>
                         <div className="form-group">
                             <label>Peso (kg)</label>
                             <input type="number" value={logEntry.weight} onChange={e => setLogEntry({...logEntry, weight: e.target.value})} />
                         </div>
                         <div className="form-group">
                             <label>Repeticiones</label>
                             <input type="number" value={logEntry.repetitions} onChange={e => setLogEntry({...logEntry, repetitions: e.target.value})} />
                         </div>
                         <div className="modal-actions">
                             <button className="cta-button secondary" onClick={() => setLogEntry(null)}>Cancelar</button>
                             <button className="cta-button" onClick={handleSaveLog}>Guardar</button>
                         </div>
                    </div>
                </div>
            )}
            
            <div className="plan-header">
                <h2>{routine.planName}</h2>
                <p>Duración Total: {routine.totalDurationWeeks} semanas</p>
            </div>

            {routine.phases.length > 1 && (
                <nav className="phases-nav">
                    {routine.phases.map((phase, index) => (
                        <button 
                            key={index} 
                            className={`phase-button ${index === activePhaseIndex ? 'active' : ''}`}
                            onClick={() => setActivePhaseIndex(index)}
                        >
                            {phase.phaseName} ({phase.durationWeeks} sem)
                        </button>
                    ))}
                </nav>
            )}

            <div className="phase-content">
                <h3>{activePhase.phaseName}</h3>
                <div className="days-grid">
                    {activePhase.routine.dias.map((day, dayIndex) => (
                        <div key={dayIndex} className="day-card">
                            <div className="day-header">
                                <h4>{day.dia}</h4>
                                <span>{day.grupoMuscular}</span>
                            </div>
                            <ul className="exercise-list">
                                {day.ejercicios.map((ex, exIndex) => (
                                    <li key={exIndex} className="exercise-item">
                                        <div className="exercise-details">
                                            <span className="exercise-name">{ex.nombre}</span>
                                            {ex.tecnicaAvanzada && <span className="advanced-technique-badge">{ex.tecnicaAvanzada}</span>}
                                        </div>
                                        <div className="exercise-sets">
                                            <span>{ex.series} x {ex.repeticiones} - {ex.descanso}</span>
                                        </div>
                                        <button className="log-progress-btn" onClick={() => handleOpenLogModal(ex.nombre)}>Registrar</button>
                                    </li>
                                ))}
                            </ul>
                            {day.cardio && day.cardio.toLowerCase() !== 'no aplica' && (
                                <div className="cardio-section">
                                    <strong>Cardio:</strong> {day.cardio}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const ClientDietView: React.FC<{ dietPlans: ClientData['dietPlans'] }> = ({ dietPlans }) => {
    const [activePlanIndex, setActivePlanIndex] = useState(0);

    if (!dietPlans || !dietPlans.some(p => p !== null)) {
        return <div className="placeholder">Aún no tienes un plan de nutrición.</div>;
    }
    
    const currentPlan = dietPlans[activePlanIndex];

    return (
        <div className="diet-generator-container">
            <div className="actions-bar">
                <h2>Mi Plan de Nutrición</h2>
                <div className="plan-toggle">
                    <button className={activePlanIndex === 0 ? 'active' : ''} onClick={() => setActivePlanIndex(0)} disabled={!dietPlans[0]}>Plan A</button>
                    <button className={activePlanIndex === 1 ? 'active' : ''} onClick={() => setActivePlanIndex(1)} disabled={!dietPlans[1]}>Plan B</button>
                </div>
            </div>
            {currentPlan ? (
                <DietPlanDisplay dietPlan={currentPlan} />
            ) : (
                <div className="placeholder">Este plan no está definido.</div>
            )}
        </div>
    );
};

const ClientMessageView: React.FC<{ clientData: ClientData }> = ({ clientData }) => {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject || !message) {
            alert("Por favor, completa el asunto y el mensaje.");
            return;
        }
        setIsSending(true);
        setSendStatus('idle');

        const success = await apiClient.createRequest({
            clientId: clientData.dni,
            clientName: clientData.profile.name,
            gymId: clientData.gymId,
            subject,
            message,
        });

        if (success) {
            setSendStatus('success');
            setSubject('');
            setMessage('');
            setTimeout(() => setSendStatus('idle'), 3000);
        } else {
            setSendStatus('error');
        }
        setIsSending(false);
    };

    return (
        <div className="message-view-container animated-fade-in">
            <h2>Contactar a mi Entrenador</h2>
            <p>Envía un mensaje o consulta a tu entrenador. Recibirás una respuesta pronto.</p>
            <form onSubmit={handleSubmit} className="message-form">
                <div className="form-group">
                    <label>Asunto</label>
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required />
                </div>
                <div className="form-group">
                    <label>Mensaje</label>
                    <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={5}></textarea>
                </div>
                {sendStatus === 'success' && <p className="success-text">¡Mensaje enviado con éxito!</p>}
                {sendStatus === 'error' && <p className="error-text">No se pudo enviar el mensaje. Inténtalo de nuevo.</p>}
                <button type="submit" className="cta-button" disabled={isSending}>
                    {isSending ? 'Enviando...' : 'Enviar Mensaje'}
                </button>
            </form>
        </div>
    );
};

// Fix: Added ClientOnboardingView and ClientView components that were missing.
const ClientOnboardingView: React.FC<{
    dni: string;
    onOnboardingComplete: () => void;
    onBack: () => void;
}> = ({ dni, onOnboardingComplete, onBack }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            const data = await apiClient.getClientData(dni);
            setClientData(data);
            setIsLoading(false);
        };
        fetchData();
    }, [dni]);

    const handleComplete = async () => {
        if (!clientData) return;

        // Simple validation
        const { name, age, weight, height, goal, trainingDays } = clientData.profile;
        if (!name || !age || !weight || !height || !goal || !trainingDays) {
            alert("Por favor, completa todos los campos principales del perfil (nombre, edad, peso, altura, objetivo y días de entrenamiento).");
            return;
        }

        setIsLoading(true);
        
        // Save profile and activate the plan
        const success = await apiClient.saveClientData(dni, {
            profile: clientData.profile,
            planStatus: 'active',
        });
        
        if (success) {
            onOnboardingComplete();
        } else {
            alert("Hubo un error al guardar tu perfil. Inténtalo de nuevo.");
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div></div>;
    }

    if (!clientData) {
        return <div className="error-container">No se pudieron cargar tus datos.</div>;
    }

    return (
        <div className="onboarding-container">
            <header className="onboarding-header">
                <h1>Completa tu Perfil</h1>
                <p>Necesitamos algunos datos para crear tu plan personalizado.</p>
            </header>
            <div className="onboarding-content">
                <ProfileEditor 
                    clientData={clientData} 
                    setClientData={setClientData} 
                    isClientOnboarding={true} 
                />
            </div>
             <div className="onboarding-actions">
                <button onClick={onBack} className="back-button simple" disabled={isLoading}>Volver</button>
                <button onClick={handleComplete} className="cta-button" disabled={isLoading}>
                    {isLoading ? 'Guardando...' : 'Crear mi Plan'}
                </button>
            </div>
        </div>
    );
};


const ClientView: React.FC<{ dni: string, onLogout: () => void }> = ({ dni, onLogout }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [gym, setGym] = useState<Gym | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'routine' | 'diet' | 'progress' | 'messages'>('routine');

    const fetchAllData = async () => {
        setIsLoading(true);
        const data = await apiClient.getClientData(dni);
        if (data) {
            setClientData(data);
            const allGyms = await apiClient.getGyms(); // In a real app with many gyms, we'd have a getGymById endpoint
            const clientGym = allGyms.find(g => g._id === data.gymId);
            
            if (clientGym) {
                setGym(clientGym);
            }
            
            // Adjust default tab based on plan type
            if (data.planType === 'nutrition' && activeTab === 'routine') {
                setActiveTab('diet');
            } else if (data.planType === 'routine' && activeTab === 'diet') {
                 setActiveTab('routine');
            }

        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchAllData();
    }, [dni]);

    const handleProgressUpdate = async (newProgressLog: ProgressLog) => {
        if (!clientData) return;
        
        setIsLoading(true);
        const success = await apiClient.saveClientData(dni, { progressLog: newProgressLog });
        if (success) {
            await fetchAllData(); // Re-fetch all data to update the view
        } else {
            alert("No se pudo guardar el progreso.");
            setIsLoading(false);
        }
    };
    
    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div></div>;
    }

    if (!clientData || !gym) {
        return (
            <div className="error-container">
                <p>No se pudieron cargar tus datos. Por favor, intenta de nuevo más tarde.</p>
                <button onClick={onLogout} className="cta-button">Cerrar Sesión</button>
            </div>
        );
    }
    
    const planType = clientData.planType || 'full';

    const renderContent = () => {
        switch (activeTab) {
            case 'routine':
                return clientData.routine ? <ClientRoutineView routine={clientData.routine} progressLog={clientData.progressLog} onProgressUpdate={handleProgressUpdate} /> : <div className="placeholder">Tu rutina aún no ha sido generada.</div>;
            case 'diet':
                return <ClientDietView dietPlans={clientData.dietPlans} />;
            case 'progress':
                return <ProgressView clientData={clientData} onDataUpdate={fetchAllData} />;
            case 'messages':
                return <ClientMessageView clientData={clientData} />;
            default:
                return null;
        }
    };

    return (
        <div className="client-dashboard-view">
            <div className="main-header">
                <div className="header-title-wrapper">
                     {gym.logoSvg && <div className="app-logo"><SvgImage svgString={gym.logoSvg} altText={`${gym.name} logo`} /></div>}
                     <div>
                        <h1>Hola, {clientData.profile.name}</h1>
                        <p>{gym.name}</p>
                    </div>
                </div>
                 <div className="admin-header-nav">
                    <button onClick={onLogout} className="logout-button">Cerrar Sesión</button>
                 </div>
            </div>
            
            <nav className="main-tabs-nav">
                {(planType === 'full' || planType === 'routine') && (
                     <button 
                        className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('routine')}>
                        Mi Rutina
                    </button>
                )}
                 {(planType === 'full' || planType === 'nutrition') && (
                     <button 
                        className={`main-tab-button ${activeTab === 'diet' ? 'active' : ''}`} 
                        onClick={() => setActiveTab('diet')}>
                        Nutrición
                    </button>
                 )}
                <button 
                    className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('progress')}>
                    Mi Progreso
                </button>
                <button 
                    className={`main-tab-button ${activeTab === 'messages' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('messages')}>
                    Contactar
                </button>
            </nav>
            
            <main className="client-main-content">
                {renderContent()}
            </main>
        </div>
    );
};

const App: React.FC = () => {
    type AppView = 'landing' | 'login' | 'adminDashboard' | 'clientDashboard' | 'clientView' | 'superAdminDashboard' | 'clientRegistration' | 'clientPasswordReset' | 'planSelection' | 'clientOnboarding';
    const [view, setView] = useState<AppView>('landing');
    const [currentClientDni, setCurrentClientDni] = useState<string | null>(null);
    const [currentGym, setCurrentGym] = useState<Gym | null>(null);
    const [impersonatedGym, setImpersonatedGym] = useState<Gym | null>(null);
    const [loginError, setLoginError] = useState<string>('');
    const [loginMessage, setLoginMessage] = useState('');

    useEffect(() => {
        // Check session storage to maintain login state
        const loggedInClientDni = sessionStorage.getItem('loggedInClientDni');
        const loggedInGym = sessionStorage.getItem('loggedInGym');

        if (loggedInClientDni) {
            handleClientLoginFlow(loggedInClientDni);
        } else if (loggedInGym) {
            const gymData = JSON.parse(loggedInGym);
            handleGymLoginFlow(gymData);
        }
    }, []);

    const handleClientLoginFlow = async (dni: string) => {
        const clientData = await apiClient.getClientData(dni);
        setCurrentClientDni(dni);
        if (clientData?.passwordResetRequired) {
             setView('clientPasswordReset');
        } else if (clientData?.planStatus === 'pending') {
            setView('planSelection');
        } else {
            setView('clientView');
        }
    };

    const handleGymLoginFlow = (gymData: Gym) => {
        setCurrentGym(gymData);
        if (gymData.username === 'superadmin') {
            setView('superAdminDashboard');
        } else {
            setView('adminDashboard');
        }
    };


    const handleLogin = async (type: 'client' | 'gym', id: string, code?: string): Promise<void> => {
        setLoginError('');
        setLoginMessage('');
        if (type === 'client') {
            const loginResult = await apiClient.loginClient(id, code!);
            if (loginResult.success) {
                sessionStorage.setItem('loggedInClientDni', id);
                await handleClientLoginFlow(id);
            } else {
                setLoginError('DNI o código de acceso/contraseña incorrecto.');
            }
        } else { // type === 'gym'
             const gymData = await apiClient.gymLogin(id, code!);
             if (gymData) {
                 sessionStorage.setItem('loggedInGym', JSON.stringify(gymData));
                 handleGymLoginFlow(gymData);
             } else {
                 setLoginError('Usuario o contraseña incorrecto.');
             }
        }
    };
    
    const handleLogout = () => {
        sessionStorage.clear();
        setCurrentClientDni(null);
        setCurrentGym(null);
        setImpersonatedGym(null);
        setView('landing');
    };
    
    const handleSelectClient = (dni: string) => {
        setCurrentClientDni(dni);
        setView('clientDashboard');
    };

    const handleBackToAdmin = () => {
        setCurrentClientDni(null);
        setView('adminDashboard');
    };
    
    const handleSelectGym = (gymToManage: Gym) => {
        setImpersonatedGym(gymToManage);
        setView('adminDashboard');
    };

    const handleBackToSuperAdmin = () => {
        setImpersonatedGym(null);
        setView('superAdminDashboard');
    };
    
    const handleRegisterAndContinue = (dni: string) => {
        sessionStorage.setItem('loggedInClientDni', dni);
        setCurrentClientDni(dni);
        setView('planSelection');
    };

    const renderView = () => {
        switch (view) {
            case 'landing':
                return <LandingPage onIngresar={() => setView('login')} />;
            case 'login':
                return <LoginPage onLogin={handleLogin} error={loginError} message={loginMessage} onBack={() => setView('landing')} onGoToRegister={() => setView('clientRegistration')} />;
            case 'clientRegistration':
                return <ClientRegistrationPage onRegister={handleRegisterAndContinue} onBack={() => setView('login')} />;
            case 'clientPasswordReset':
                return <NewPasswordResetPage 
                    dni={currentClientDni!} 
                    onPasswordSet={() => {
                        setCurrentClientDni(null);
                        setView('login');
                        setLoginMessage('¡Contraseña actualizada! Por favor, inicia sesión con tus nuevas credenciales.');
                    }} 
                    onBackToLogin={() => setView('login')} 
                />;
            case 'planSelection':
                 return <PlanSelectionPage 
                    dni={currentClientDni!} 
                    onSelectCustom={() => setView('clientOnboarding')} 
                    onPlanApplied={() => setView('clientView')}
                />;
            case 'clientOnboarding':
                return <ClientOnboardingView 
                    dni={currentClientDni!} 
                    onOnboardingComplete={() => setView('clientView')}
                    onBack={() => setView('planSelection')}
                />;
            case 'adminDashboard':
                return <AdminDashboard 
                            onSelectClient={handleSelectClient} 
                            onLogout={handleLogout} 
                            gym={impersonatedGym || currentGym!} 
                            loggedInGym={currentGym!}
                            onBackToSuperAdmin={handleBackToSuperAdmin}
                        />;
            case 'clientDashboard':
                return <ClientManagementView dni={currentClientDni!} onBack={handleBackToAdmin} onLogout={handleLogout} gym={impersonatedGym || currentGym!} />;
            case 'clientView':
                return <ClientView dni={currentClientDni!} onLogout={handleLogout} />;
            case 'superAdminDashboard':
                return <SuperAdminDashboard gym={currentGym!} onLogout={handleLogout} onSelectGym={handleSelectGym} />;
            default:
                return <LoginPage onLogin={handleLogin} error={loginError} message={loginMessage} onBack={() => setView('landing')} onGoToRegister={() => setView('clientRegistration')} />;
        }
    };

    return <>{renderView()}</>;
};

const container = document.getElementById("root");
createRoot(container!).render(<App />);