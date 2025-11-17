

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
    RoutineTemplate
} from './apiClient';

// --- Gemini AI Functions ---

// FIX: Initialize the GoogleGenAI client.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Generates a complete workout routine for a client using the Gemini API.
 * @param clientData The client's profile and data.
 * @param gymId The ID of the gym to fetch the exercise library from.
 * @param adminInstructions Optional instructions from the trainer.
 * @returns A promise that resolves to a Routine object.
 */
// FIX: Implement the missing 'generateRoutineForClient' function.
async function generateRoutineForClient(clientData: ClientData, gymId: string, adminInstructions?: string): Promise<Routine> {
    console.log("Generating routine for:", clientData.profile.name);

    const exerciseLibrary = await apiClient.getExerciseLibrary(gymId);
    if (!exerciseLibrary || Object.keys(exerciseLibrary).length === 0) {
        throw new Error("La biblioteca de ejercicios está vacía. Por favor, añade ejercicios antes de generar una rutina.");
    }
    
    // Filter out disabled exercises to provide a clean list to the AI
    const enabledExerciseLibrary: ExerciseLibrary = {};
    for (const group in exerciseLibrary) {
        enabledExerciseLibrary[group] = (exerciseLibrary[group] as ExerciseDefinition[]).filter(ex => ex.isEnabled);
    }


    const routineSchema = {
        type: Type.OBJECT,
        properties: {
            planName: { type: Type.STRING, description: "Nombre creativo para el plan de rutina. Ej: 'Plan de Fuerza Total', 'Operación Verano'." },
            totalDurationWeeks: { type: Type.NUMBER, description: "Número total de semanas que dura el plan completo." },
            phases: {
                type: Type.ARRAY,
                description: "Un array de fases de entrenamiento (ej. Adaptación, Hipertrofia, Descarga).",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        phaseName: { type: Type.STRING, description: "Nombre de la fase. Ej: 'Fase de Adaptación Anatómica', 'Fase 1: Hipertrofia', 'Semana de Descarga Activa'." },
                        durationWeeks: { type: Type.NUMBER, description: "Duración de esta fase en semanas." },
                        routine: {
                            type: Type.OBJECT,
                            properties: {
                                dias: {
                                    type: Type.ARRAY,
                                    description: "Array de los planes diarios para esta fase.",
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            dia: { type: Type.STRING, description: "El día de la semana para este entrenamiento, ej. 'Día 1', 'Día 2'." },
                                            grupoMuscular: { type: Type.STRING, description: "El grupo muscular principal trabajado ese día. Ej: 'Pecho y Tríceps', 'Piernas (Enfoque Cuádriceps)', 'Espalda y Bíceps'." },
                                            ejercicios: {
                                                type: Type.ARRAY,
                                                description: "Array de ejercicios para el día.",
                                                items: {
                                                    type: Type.OBJECT,
                                                    properties: {
                                                        nombre: { type: Type.STRING, description: "Nombre exacto del ejercicio de la lista proporcionada." },
                                                        series: { type: Type.STRING, description: "Número de series. Ej: '4', '3'." },
                                                        repeticiones: { type: Type.STRING, description: "Rango de repeticiones o tiempo. Ej: '8-12', '15', '30s'." },
                                                        descanso: { type: Type.STRING, description: "Tiempo de descanso entre series en segundos. Ej: '60s', '90s'." },
                                                        tecnicaAvanzada: {
                                                            type: Type.STRING,
                                                            description: `Opcional. Si se usa, debe ser uno de: ${advancedTechniqueOptions.map(o => o.value).filter(Boolean).join(', ')}.`
                                                        }
                                                    },
                                                    required: ['nombre', 'series', 'repeticiones', 'descanso']
                                                }
                                            },
                                            cardio: { type: Type.STRING, description: "Descripción del cardio para ese día. Ej: '30 min cinta caminadora', '20 min HIIT en bici', o 'Ninguno'." }
                                        },
                                        required: ['dia', 'grupoMuscular', 'ejercicios', 'cardio']
                                    }
                                }
                            },
                             required: ['dias']
                        }
                    },
                    required: ['phaseName', 'durationWeeks', 'routine']
                }
            }
        },
        required: ['planName', 'totalDurationWeeks', 'phases']
    };


    const prompt = `
        Sos un experto entrenador personal para un gimnasio en Argentina. Tu tarea es crear un plan de entrenamiento completo y estructurado en formato JSON para un cliente.

        PERFIL DEL CLIENTE:
        ${JSON.stringify(clientData.profile, null, 2)}

        BIBLIOTECA DE EJERCICIOS DISPONIBLES (USA ESTOS NOMBRES EXACTAMENTE):
        ${JSON.stringify(enabledExerciseLibrary, null, 2)}
        
        INSTRUCCIONES ADICIONALES DEL ENTRENADOR:
        "${adminInstructions || 'Ninguna'}"

        REGLAS ESTRICTAS PARA TU RESPUESTA:
        1.  **JSON VÁLIDO Y ÚNICO:** Tu respuesta DEBE ser únicamente un objeto JSON válido que se ajuste al esquema proporcionado, sin texto adicional, formato markdown, o explicaciones.
        2.  **SELECCIÓN DE EJERCICIOS:** DEBES seleccionar ejercicios EXCLUSIVAMENTE de la biblioteca proporcionada. NO inventes ejercicios. Usa los nombres tal cual están escritos.
        3.  **ESTRUCTURA DEL PLAN:**
            -   El plan debe tener una duración total realista basada en el objetivo. Un plan de hipertrofia o pérdida de grasa suele durar entre 8 y 12 semanas.
            -   Si el cliente solicitó una "Fase de Adaptación", esta debe ser la primera fase, durar 1-2 semanas y usar pesos más ligeros/reps más altas (ej. 12-15 reps).
            -   Si el cliente solicitó una "Fase de Descarga", esta debe ser la ÚLTIMA fase, durar 1 semana, y reducir significativamente el volumen y la intensidad (menos series, menos peso).
            -   Las fases principales deben tener una duración lógica (ej. 4-6 semanas).
            -   La cantidad de días de entrenamiento por fase debe coincidir con los "trainingDays" del perfil del cliente.
        4.  **LÓGICA DE ENTRENAMENTO:**
            -   Distribuye los grupos musculares de forma inteligente a lo largo de los días de entrenamiento disponibles. Ej: para 4 días, una buena división es 'Tren Superior', 'Tren Inferior', 'Tren Superior', 'Tren Inferior'. Para 5 días, puede ser 'Pecho', 'Espalda', 'Hombros', 'Piernas', 'Brazos'.
            -   Ajusta el volumen (series/reps) según el nivel y objetivo del cliente. Principiantes: 3 series. Intermedios/Avanzados: 4-5 series. Hipertrofia: 8-12 reps. Pérdida de grasa: 12-15 reps.
            -   Asigna técnicas avanzadas (de la lista: ${advancedTechniqueOptions.map(o => o.value).filter(Boolean).join(', ')}) solo si el perfil lo indica ("useAdvancedTechniques: 'Sí'") y solo a clientes intermedios o avanzados, en el último ejercicio de un grupo muscular.
        5.  **IDIOMA:** Todo el texto en el JSON (nombres de planes, fases, etc.) debe estar en español.

        Genera el plan de entrenamiento en formato JSON ahora.
    `;

    try {
        const result = await withRetry(async () => {
             const response: GenerateContentResponse = await ai.models.generateContent({
                model: "gemini-2.5-pro",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: routineSchema,
                },
             });
             return response;
        });

        const jsonText = result.text.trim();
        const rawRoutine = JSON.parse(jsonText);
        
        // Validate and correct any minor AI exercise name hallucinations
        const correctedRoutine = validateAndCorrectRoutine(rawRoutine as Routine, exerciseLibrary);

        // Final save to client data will happen in the component that calls this function.
        return correctedRoutine;

    } catch (error) {
        console.error("Error generating routine with Gemini:", error);
        let errorMessage = "La IA no pudo generar una rutina. Intenta ajustar el perfil del cliente o ser más específico en las instrucciones.";
        // FIX: Add type guard for error object to safely access 'message' property.
        if (error instanceof Error) {
            if (error.message.includes('SAFETY')) {
                errorMessage = "La solicitud fue bloqueada por políticas de seguridad. Revisa las instrucciones y el perfil del cliente por si hay texto inapropiado."
            } else if (error.message.includes('JSON')) {
                 errorMessage = "La IA generó una respuesta con formato incorrecto. Por favor, intenta de nuevo."
            }
        }
        throw new Error(errorMessage);
    }
}


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

// FIX: Add missing component 'ClientOnboardingView'.
const ClientOnboardingView: React.FC<{
    dni: string;
    onOnboardingComplete: () => void;
    onBack: () => void;
}> = ({ dni, onOnboardingComplete, onBack }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchClientData = async () => {
            const data = await apiClient.getClientData(dni);
            setClientData(data);
            setIsLoading(false);
        };
        fetchClientData();
    }, [dni]);

    const handleContinue = async () => {
        if (!clientData) return;
        setIsLoading(true);
        // Save the profile data entered by the user
        const success = await apiClient.saveClientData(dni, { profile: clientData.profile });
        if (success) {
            onOnboardingComplete();
        } else {
            alert("No se pudieron guardar los datos del perfil. Inténtalo de nuevo.");
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div></div>;
    }

    if (!clientData) {
        return <div className="error-container">No se pudieron cargar los datos del cliente.</div>;
    }

    return (
        <div className="onboarding-container">
            <header className="onboarding-header">
                <h1>¡Casi listo!</h1>
                <p>Completa tu perfil para que podamos crear el plan perfecto para vos.</p>
            </header>
            <main className="onboarding-content">
                <ProfileEditor
                    clientData={clientData}
                    setClientData={setClientData}
                    isClientOnboarding={true}
                />
            </main>
            <footer className="onboarding-footer">
                <button onClick={onBack} className="back-button">Volver</button>
                <button onClick={handleContinue} className="cta-button" disabled={isLoading}>
                    {isLoading ? "Guardando..." : "Continuar y Generar Plan"}
                </button>
            </footer>
        </div>
    );
};

// --- Progress & Chart Components ---
const ProgressChart: React.FC<{ data: BodyWeightEntry[] }> = ({ data }) => {
    // FIX: The ref is attached to a div, so its type should be HTMLDivElement, not SVGSVGElement.
    const svgRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 250 });

    useEffect(() => {
        if (svgRef.current) {
            // FIX: Since the ref is on the container div, use its clientWidth directly instead of its parent's.
            setDimensions({ width: svgRef.current.clientWidth, height: 250 });
        }
    }, []);

    if (data.length < 2) {
        return <div className="chart-placeholder">Se necesitan al menos 2 registros de peso para mostrar la gráfica.</div>;
    }

    const { width, height } = dimensions;
    const padding = { top: 20, right: 20, bottom: 40, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const sortedData = data.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const weights = sortedData.map(d => d.weight);
    const dates = sortedData.map(d => new Date(d.date));

    const minWeight = Math.min(...weights) - 2;
    const maxWeight = Math.max(...weights) + 2;
    const minDate = dates[0].getTime();
    const maxDate = dates[dates.length - 1].getTime();

    const getX = (date: Date) => (date.getTime() - minDate) / (maxDate - minDate) * chartWidth + padding.left;
    const getY = (weight: number) => chartHeight - ((weight - minWeight) / (maxWeight - minWeight)) * chartHeight + padding.top;

    const path = sortedData.map((d, i) => {
        const x = getX(new Date(d.date));
        const y = getY(d.weight);
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');

    const yAxisLabels = Array.from({ length: 5 }, (_, i) => {
        const weight = minWeight + (maxWeight - minWeight) / 4 * i;
        return { y: getY(weight), label: weight.toFixed(1) };
    });
    
    const formatDate = (date: Date) => date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });

    return (
        <div className="progress-chart-container" ref={svgRef}>
            {width > 0 && (
                <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
                    {/* Y-Axis Grid Lines & Labels */}
                    {yAxisLabels.map(({ y, label }) => (
                        <g key={label}>
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border-color)" strokeDasharray="2" />
                            <text x={padding.left - 8} y={y + 4} textAnchor="end" fill="var(--text-secondary-color)" fontSize="10">{label}</text>
                        </g>
                    ))}
                    {/* X-Axis Labels */}
                     <g>
                        <text x={padding.left} y={height - 10} textAnchor="start" fill="var(--text-secondary-color)" fontSize="10">{formatDate(dates[0])}</text>
                        <text x={width - padding.right} y={height - 10} textAnchor="end" fill="var(--text-secondary-color)" fontSize="10">{formatDate(dates[dates.length - 1])}</text>
                    </g>
                    
                    {/* Data Line */}
                    <path d={path} fill="none" stroke="var(--primary-color)" strokeWidth="2" />
                    
                    {/* Data Points */}
                    {sortedData.map((d, i) => (
                        <circle key={i} cx={getX(new Date(d.date))} cy={getY(d.weight)} r="4" fill="var(--primary-color)" />
                    ))}
                </svg>
            )}
        </div>
    );
};

// FIX: Add missing component 'ProgressView'.
const ProgressView: React.FC<{ clientData: ClientData; onDataUpdate: () => void; }> = ({ clientData, onDataUpdate }) => {
    const [activeTab, setActiveTab] = useState<'bodyweight' | 'exercises'>('bodyweight');
    const [isAddingEntry, setIsAddingEntry] = useState(false);
    
    // State for new body weight entry
    const [newWeight, setNewWeight] = useState<string>(clientData.profile.weight || '');

    // State for new exercise log entry
    const [selectedExercise, setSelectedExercise] = useState('');
    const [newLogWeight, setNewLogWeight] = useState('');
    const [newLogReps, setNewLogReps] = useState('');

    const exerciseOptions = useMemo(() => {
        if (!clientData.routine) return [];
        const exercises = new Set<string>();
        clientData.routine.phases.forEach(phase => {
            phase.routine.dias.forEach(dia => {
                dia.ejercicios.forEach(ex => exercises.add(ex.nombre));
            });
        });
        return Array.from(exercises).sort();
    }, [clientData.routine]);

    useEffect(() => {
        // Pre-select the first exercise if available
        if (exerciseOptions.length > 0 && !selectedExercise) {
            setSelectedExercise(exerciseOptions[0]);
        }
    }, [exerciseOptions, selectedExercise]);
    
    const handleAddBodyWeight = async (e: React.FormEvent) => {
        e.preventDefault();
        const weightValue = parseFloat(newWeight);
        if (!weightValue || weightValue <= 0) {
            alert("Por favor, ingresa un peso válido.");
            return;
        }

        const newEntry: BodyWeightEntry = {
            date: new Date().toISOString(),
            weight: weightValue,
        };

        const updatedLog = [...(clientData.bodyWeightLog || []), newEntry];
        const success = await apiClient.saveClientData(clientData.dni, { bodyWeightLog: updatedLog });
        if (success) {
            onDataUpdate();
            setIsAddingEntry(false);
            setNewWeight(clientData.profile.weight); // Reset to current profile weight
        } else {
            alert("No se pudo guardar el registro.");
        }
    };

    const handleAddExerciseLog = async (e: React.FormEvent) => {
         e.preventDefault();
        const weightValue = parseFloat(newLogWeight);
        const repsValue = parseInt(newLogReps, 10);
        if (!selectedExercise || !weightValue || weightValue < 0 || !repsValue || repsValue <= 0) {
            alert("Por favor, completa todos los campos con valores válidos.");
            return;
        }

        const newEntry: ProgressLogEntry = {
            date: new Date().toISOString(),
            weight: weightValue,
            repetitions: repsValue,
        };

        const updatedLog = { ...clientData.progressLog };
        if (!updatedLog[selectedExercise]) {
            updatedLog[selectedExercise] = [];
        }
        updatedLog[selectedExercise].push(newEntry);

        const success = await apiClient.saveClientData(clientData.dni, { progressLog: updatedLog });
        if (success) {
            onDataUpdate();
            setIsAddingEntry(false);
            setNewLogWeight('');
            setNewLogReps('');
        } else {
            alert("No se pudo guardar el registro.");
        }
    };
    
    const renderBodyWeightContent = () => {
        const sortedLog = [...(clientData.bodyWeightLog || [])].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return (
            <div>
                 <ProgressChart data={sortedLog} />
                 {!isAddingEntry ? (
                     <button onClick={() => setIsAddingEntry(true)} className="cta-button" style={{marginTop: '2rem'}}>Añadir Nuevo Registro de Peso</button>
                 ) : (
                    <form onSubmit={handleAddBodyWeight} className="add-progress-form">
                        <input type="number" step="0.1" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="Peso en kg" required />
                        <button type="submit">Guardar</button>
                        <button type="button" className="secondary" onClick={() => setIsAddingEntry(false)}>Cancelar</button>
                    </form>
                 )}
                 <div className="progress-log-list" style={{marginTop: '2rem'}}>
                    {sortedLog.length === 0 ? <p className="placeholder">No hay registros de peso corporal.</p> : sortedLog.map(entry => (
                        <div key={entry.date} className="progress-log-item">
                            <span>{new Date(entry.date).toLocaleDateString()}</span>
                            <strong>{entry.weight.toFixed(1)} kg</strong>
                        </div>
                    ))}
                 </div>
            </div>
        );
    };

    const renderExerciseContent = () => {
        if (exerciseOptions.length === 0) {
             return <p className="placeholder">No hay una rutina activa para registrar el progreso de los ejercicios.</p>
        }
        
        const sortedLog = (clientData.progressLog[selectedExercise] || []).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        return (
            <div>
                <div className="exercise-progress-selector">
                    <label>Seleccionar Ejercicio:</label>
                    <select value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)}>
                        {exerciseOptions.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                    </select>
                </div>
                 {!isAddingEntry ? (
                     <button onClick={() => setIsAddingEntry(true)} className="cta-button">Añadir Nuevo Registro</button>
                 ) : (
                    <form onSubmit={handleAddExerciseLog} className="add-progress-form">
                        <input type="number" step="0.5" value={newLogWeight} onChange={e => setNewLogWeight(e.target.value)} placeholder="Peso (kg)" required />
                        <input type="number" value={newLogReps} onChange={e => setNewLogReps(e.target.value)} placeholder="Repeticiones" required />
                        <button type="submit">Guardar</button>
                        <button type="button" className="secondary" onClick={() => setIsAddingEntry(false)}>Cancelar</button>
                    </form>
                 )}
                 <div className="progress-log-list exercise-log" style={{marginTop: '2rem'}}>
                     {sortedLog.length === 0 ? <p className="placeholder">No hay registros para este ejercicio.</p> : sortedLog.map(entry => (
                        <div key={entry.date} className="progress-log-item">
                            <span>{new Date(entry.date).toLocaleDateString()}</span>
                            <span><strong>Peso:</strong> {entry.weight.toFixed(1)} kg</span>
                             <span><strong>Reps:</strong> {entry.repetitions}</span>
                        </div>
                    ))}
                 </div>
            </div>
        );
    };

    return (
        <div className="progress-view animated-fade-in">
             <h2>Registra tu Progreso</h2>
            <nav className="progress-tabs-nav">
                <button 
                    className={`progress-tab-button ${activeTab === 'bodyweight' ? 'active' : ''}`} 
                    onClick={() => { setActiveTab('bodyweight'); setIsAddingEntry(false); }}>
                    Peso Corporal
                </button>
                <button 
                    className={`progress-tab-button ${activeTab === 'exercises' ? 'active' : ''}`} 
                    onClick={() => { setActiveTab('exercises'); setIsAddingEntry(false); }}>
                    Ejercicios
                </button>
            </nav>
            <div className="progress-content">
                {activeTab === 'bodyweight' ? renderBodyWeightContent() : renderExerciseContent()}
            </div>
        </div>
    );
};

// FIX: Add missing component 'ClientView' and its sub-components.
const ClientRoutineView: React.FC<{ 
    routine: Routine, 
    onPlayVideo: (url: string) => void,
    getExerciseVideoUrl: (name: string) => string | undefined 
}> = ({ routine, onPlayVideo, getExerciseVideoUrl }) => {
    return (
        <div className="plan-container animated-fade-in">
            <header className="plan-header">
                <h2>{routine.planName}</h2>
                <p>Duración Total: {routine.totalDurationWeeks} semanas</p>
            </header>
            <RoutinePlan 
                routine={routine}
                isEditing={false}
                onRoutineChange={() => {}} // No-op for client view
                exerciseLibrary={{}} // Not needed for read-only view
            />
        </div>
    );
};

const ClientChatView: React.FC<{ clientData: ClientData }> = ({ clientData }) => {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject || !message) {
            alert("Por favor, completa el asunto y el mensaje.");
            return;
        }
        setIsSending(true);
        setStatus('idle');
        
        const requestData = {
            clientId: clientData.dni,
            clientName: clientData.profile.name,
            gymId: clientData.gymId,
            subject,
            message,
        };

        const success = await apiClient.createRequest(requestData as any);
        if (success) {
            setStatus('success');
            setSubject('');
            setMessage('');
            setTimeout(() => setStatus('idle'), 3000);
        } else {
            setStatus('error');
        }
        setIsSending(false);
    };

    return (
        <div className="client-chat-view animated-fade-in">
            <h2>Enviar un Mensaje a tu Entrenador</h2>
            <p>Usa este formulario para hacer preguntas, pedir ajustes en tu plan o cualquier otra consulta.</p>
            <form onSubmit={handleSubmit} className="chat-form">
                <div className="form-group">
                    <label htmlFor="chat-subject">Asunto</label>
                    <input 
                        type="text" 
                        id="chat-subject" 
                        value={subject} 
                        onChange={e => setSubject(e.target.value)} 
                        required 
                        placeholder="Ej: Duda sobre un ejercicio"
                    />
                </div>
                <div className="form-group">
                     <label htmlFor="chat-message">Mensaje</label>
                    <textarea 
                        id="chat-message"
                        rows={6}
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        required
                        placeholder="Escribe tu consulta aquí..."
                    ></textarea>
                </div>
                <button type="submit" className="cta-button" disabled={isSending}>
                    {isSending ? "Enviando..." : "Enviar Mensaje"}
                </button>
            </form>
            {status === 'success' && <p className="success-text" style={{marginTop: '1rem'}}>¡Mensaje enviado con éxito!</p>}
            {status === 'error' && <p className="error-text" style={{marginTop: '1rem'}}>No se pudo enviar el mensaje. Inténtalo de nuevo.</p>}
        </div>
    );
};

/**
 * Main application component that handles routing and state.
 */
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
                return <ClientDashboardView dni={currentClientDni!} onLogout={handleLogout} />;
            case 'superAdminDashboard':
                return <SuperAdminDashboard gym={currentGym!} onLogout={handleLogout} onSelectGym={handleSelectGym} />;
            default:
                return <LoginPage onLogin={handleLogin} error={loginError} message={loginMessage} onBack={() => setView('landing')} onGoToRegister={() => setView('clientRegistration')} />;
        }
    };

    return <>{renderView()}</>;
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
    const [accountingPassword, setAccountingPassword] = useState('');
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
        const success = await apiClient.createGym(name, username, password, accountingPassword, dailyQuestionLimit, logoSvg, planType);
        if (success) {
            setName('');
            setUsername('');
            setPassword('');
            setAccountingPassword('');
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
                    <label>Contraseña de Contabilidad</label>
                    <input type="password" value={accountingPassword} onChange={(e) => setAccountingPassword(e.target.value)} required />
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
    const [accountingPassword, setAccountingPassword] = useState('');
    const [dailyQuestionLimit, setDailyQuestionLimit] = useState(gym.dailyQuestionLimit || 10);
    const [logoSvg, setLogoSvg] = useState<string | null>(gym.logoSvg || null);
    const [planType, setPlanType] = useState<PlanType>(gym.planType || 'full');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const dataToUpdate: { 
            name?: string; 
            password?: string; 
            accountingPassword?: string;
            dailyQuestionLimit?: number; 
            logoSvg?: string | null; 
            planType?: PlanType; 
        } = {
            name: name,
            dailyQuestionLimit: dailyQuestionLimit,
            logoSvg: logoSvg,
            planType: planType,
        };
        if (password) {
            dataToUpdate.password = password;
        }
        if (accountingPassword) {
            dataToUpdate.accountingPassword = accountingPassword;
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
                        <label>Nueva Contraseña de Contabilidad (dejar en blanco para no cambiar)</label>
                        <input type="password" value={accountingPassword} onChange={(e) => setAccountingPassword(e.target.value)} />
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

const PasswordEntryModal: React.FC<{
    onClose: () => void;
    onSuccess: () => void;
    gymId: string;
}> = ({ onClose, onSuccess, gymId }) => {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        const success = await apiClient.verifyAccountingPassword(gymId, password);
        if (success) {
            onSuccess();
        } else {
            setError('Contraseña incorrecta.');
        }
        setIsLoading(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>&times;</button>
                <h3>Acceso a Contabilidad</h3>
                <p>Ingresa la contraseña para acceder a esta sección.</p>
                <form onSubmit={handleVerify} className="login-box" style={{padding: 0, background: 'none', border: 'none', boxShadow: 'none'}}>
                    <input
                        type="password"
                        placeholder="Contraseña de Contabilidad"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoFocus
                    />
                     {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button" disabled={isLoading}>
                        {isLoading ? 'Verificando...' : 'Ingresar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const AccountingView: React.FC<{}> = () => {
    return (
        <div className="placeholder animated-fade-in" style={{marginTop: '2rem'}}>
            <h2>Módulo de Contabilidad</h2>
            <p>Esta sección está en construcción.</p>
        </div>
    );
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
    const [showAccountingPasswordModal, setShowAccountingPasswordModal] = useState(false);
    const [isAccountingUnlocked, setIsAccountingUnlocked] = useState(sessionStorage.getItem(`accountingUnlocked_${gym._id}`) === 'true');

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

    const handleAccountingClick = () => {
        if (isAccountingUnlocked) {
            setAdminView('accounting');
        } else {
            setShowAccountingPasswordModal(true);
        }
    };

    const handlePasswordSuccess = () => {
        setIsAccountingUnlocked(true);
        sessionStorage.setItem(`accountingUnlocked_${gym._id}`, 'true');
        setShowAccountingPasswordModal(false);
        setAdminView('accounting');
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
                return <AccountingView />;
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
                     <button className="header-nav-button" onClick={() => setAdminView('templates')}>Plantillas</button>
                     <button className="header-nav-button" onClick={() => setAdminView('requests')}>
                        Bandeja de Entrada
                        {newRequestCount > 0 && <span className="notification-badge">{newRequestCount}</span>}
                    </button>
                    <button className="header-nav-button" onClick={() => setAdminView('library')}>Biblioteca</button>
                    <button className="header-nav-button" onClick={handleAccountingClick}>Contabilidad</button>
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
             {showAccountingPasswordModal && (
                <PasswordEntryModal
                    gymId={gym._id}
                    onClose={() => setShowAccountingPasswordModal(false)}
                    onSuccess={handlePasswordSuccess}
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
                    <ProfileEditor clientData={clientData} setClientData={setClientData as React.Dispatch<React.SetStateAction<ClientData>>} onDataUpdate={fetchClientData}/>
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
                       {activeTab === 'routine' && <RoutineGenerator clientData={clientData} setClientData={setClientData as React.Dispatch<React.SetStateAction<ClientData>>} gymId={gym._id} />}
                       {activeTab === 'diet' && <DietPlanGenerator clientData={clientData} setClientData={setClientData as React.Dispatch<React.SetStateAction<ClientData>>} />}
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
    setClientData: React.Dispatch<React.SetStateAction<ClientData>>; 
    onDataUpdate?: () => void; // Optional callback for parent
    isClientOnboarding?: boolean;
}> = ({ clientData, setClientData, onDataUpdate, isClientOnboarding = false }) => {
    const [profile, setProfile] = useState<Profile>(clientData.profile);
    const [isModified, setIsModified] = useState(isClientOnboarding);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [resetStatus, setResetStatus] = useState<'idle' | 'success'>('idle');


    const muscleGroups = {
        superior: ['General', 'Pecho', 'Espalda', 'Hombros', 'Brazos (Bíceps y Tríceps)'],
        inferior: ['General', 'Cuádriceps', 'Femorales e Isquiotibiales', 'Glúteos', 'Aductores y Abductores', 'Gemelos y Sóleos']
    };

    useEffect(() => {
        setProfile(clientData.profile);
    }, [clientData.profile]);

    // Reset muscle focus when body focus changes
    useEffect(() => {
        if (['Full Body', 'Cuerpo Completo'].includes(profile.bodyFocusArea)) {
             if (profile.muscleFocus !== 'General') {
                handleChange('muscleFocus', 'General');
             }
        } else if (profile.muscleFocus && !getMuscleFocusOptions().includes(profile.muscleFocus)) {
            handleChange('muscleFocus', 'General');
        }
    }, [profile.bodyFocusArea]);


    const handleChange = (field: keyof Profile, value: string) => {
        const updatedProfile = { ...profile, [field]: value };
        setProfile(updatedProfile);
        setClientData(prev => ({ ...prev, profile: updatedProfile }));
        if (!isClientOnboarding) {
            setIsModified(true);
            setSaveStatus('idle');
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const success = await apiClient.saveClientData(clientData.dni, { profile });
        if (success) {
            setSaveStatus('saved');
            setIsModified(false);
            if(onDataUpdate) onDataUpdate();
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            setSaveStatus('error');
        }
        setIsSaving(false);
    };

    const handleEnableGeneration = async () => {
        if (window.confirm("¿Estás seguro de que quieres habilitar la generación de un nuevo plan para este cliente? Su plan actual será borrado.")) {
            const success = await apiClient.enablePlanGeneration(clientData.dni);
            if (success) {
                alert("¡Listo! El cliente ahora puede generar un nuevo plan.");
                if(onDataUpdate) onDataUpdate();
            } else {
                alert("Error al habilitar la generación del plan.");
            }
        }
    };
    
    const handleRequestPasswordReset = async () => {
        setShowResetConfirm(false);
        const success = await apiClient.requestPasswordReset(clientData.dni);
        if (success) {
            setResetStatus('success');
            setTimeout(() => setResetStatus('idle'), 3000);
        } else {
            alert("Error al iniciar el reseteo de contraseña.");
        }
    };


    const bmi = useMemo(() => {
        return calculateBMI(parseFloat(profile.weight), parseFloat(profile.height));
    }, [profile.weight, profile.height]);
    
    const getMuscleFocusOptions = () => {
        if (profile.bodyFocusArea === 'Tren Superior') return muscleGroups.superior;
        if (profile.bodyFocusArea === 'Tren Inferior') return muscleGroups.inferior;
        return [];
    };

    return (
        <div>
            <h2>{isClientOnboarding ? "Completa tu Perfil" : "Perfil del Cliente"}</h2>
            <form className="profile-form">
                 <div className="form-group">
                    <label>Nombre</label>
                    <input type="text" value={profile.name} onChange={e => handleChange('name', e.target.value)} />
                </div>
                 <div className="form-group">
                    <label>Edad</label>
                    <input type="number" value={profile.age} onChange={e => handleChange('age', e.target.value)} />
                </div>
                 <div className="form-group">
                    <label>Peso (kg)</label>
                    <input type="number" step="0.1" value={profile.weight} onChange={e => handleChange('weight', e.target.value)} />
                </div>
                 <div className="form-group">
                    <label>Altura (cm)</label>
                    <input type="number" value={profile.height} onChange={e => handleChange('height', e.target.value)} />
                </div>
                 {bmi.value > 0 && (
                    <div className="bmi-display">
                        <span>IMC: <strong>{bmi.value}</strong></span>
                        <span className={`bmi-category ${bmi.categoryClass}`}>{bmi.categoryClass.charAt(0).toUpperCase() + bmi.categoryClass.slice(1)}</span>
                    </div>
                 )}
                 <div className="form-group">
                    <label>Género</label>
                    <select value={profile.gender} onChange={e => handleChange('gender', e.target.value)}>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Prefiero no decirlo">Prefiero no decirlo</option>
                    </select>
                </div>
                 <div className="form-group">
                    <label>Nivel de Experiencia</label>
                    <select value={profile.level} onChange={e => handleChange('level', e.target.value)}>
                        <option value="Principiante">Principiante</option>
                        <option value="Intermedio">Intermedio</option>
                        <option value="Avanzado">Avanzado</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Objetivo Principal</label>
                    <select value={profile.goal} onChange={e => handleChange('goal', e.target.value)}>
                        <option value="Hipertrofia">Hipertrofia</option>
                        <option value="Pérdida de grasa">Pérdida de grasa</option>
                        <option value="Mantenimiento">Mantenimiento</option>
                        <option value="Resistencia">Resistencia</option>
                    </select>
                </div>
                 <div className="form-group">
                    <label>Días de Entrenamiento por Semana</label>
                    <select value={profile.trainingDays} onChange={e => handleChange('trainingDays', e.target.value)}>
                        <option value="1">1 día</option>
                        <option value="2">2 días</option>
                        <option value="3">3 días</option>
                        <option value="4">4 días</option>
                        <option value="5">5 días</option>
                        <option value="6">6 días</option>
                        <option value="7">7 días</option>
                    </select>
                </div>
                 <div className="form-group">
                    <label>Índice de Actividad (fuera del gym)</label>
                     <select value={profile.activityFactor} onChange={e => handleChange('activityFactor', e.target.value)}>
                        <option value="Sedentario">Sedentario (poco o nada de ejercicio)</option>
                        <option value="Ligero">Ligero (ejercicio/deporte 1-3 días/sem)</option>
                        <option value="Activo">Activo (ejercicio/deporte 3-5 días/sem)</option>
                        <option value="Muy Activo">Muy Activo (ejercicio/deporte 6-7 días/sem)</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Intensidad del Entrenamiento</label>
                     <select value={profile.trainingIntensity} onChange={e => handleChange('trainingIntensity', e.target.value)}>
                        <option value="Baja">Baja</option>
                        <option value="Moderada">Moderada</option>
                        <option value="Alta">Alta</option>
                        <option value="Extrema">Extrema</option>
                    </select>
                </div>
                 <div className="form-group">
                    <label>Enfoque Corporal</label>
                     <select value={profile.bodyFocusArea} onChange={e => handleChange('bodyFocusArea', e.target.value)}>
                        <option value="Cuerpo Completo">Cuerpo Completo (Rutina Dividida)</option>
                        <option value="Full Body">Full Body (Cuerpo Entero por Sesión)</option>
                        <option value="Tren Superior">Tren Superior</option>
                        <option value="Tren Inferior">Tren Inferior</option>
                    </select>
                </div>
                {['Tren Superior', 'Tren Inferior'].includes(profile.bodyFocusArea) && (
                    <div className="form-group animated-fade-in">
                        <label>Músculo a Enfocar</label>
                        <select value={profile.muscleFocus} onChange={e => handleChange('muscleFocus', e.target.value)}>
                            {getMuscleFocusOptions().map(group => (
                                <option key={group} value={group}>{group}</option>
                            ))}
                        </select>
                    </div>
                )}
                 <div className="form-group">
                    <label>Técnicas Avanzadas</label>
                     <select value={profile.useAdvancedTechniques} onChange={e => handleChange('useAdvancedTechniques', e.target.value)}>
                        <option value="No">No</option>
                        <option value="Sí">Sí</option>
                    </select>
                </div>
                 <div className="form-group">
                    <label>Incluir Fase de Adaptación</label>
                    <select value={profile.includeAdaptationPhase} onChange={e => handleChange('includeAdaptationPhase', e.target.value)}>
                        <option value="Sí">Sí</option>
                        <option value="No">No</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Incluir Fase de Descarga</label>
                    <select value={profile.includeDeloadPhase} onChange={e => handleChange('includeDeloadPhase', e.target.value)}>
                        <option value="No">No</option>
                        <option value="Sí">Sí</option>
                    </select>
                </div>
                {!isClientOnboarding && isModified && (
                     <button type="button" onClick={handleSave} disabled={isSaving} className={`save-changes-button ${saveStatus === 'saved' ? 'saved' : ''}`}>
                         {isSaving ? <><span className="spinner small"></span> Guardando...</> : (saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Cambios')}
                    </button>
                )}
            </form>
             {!isClientOnboarding && (
                 <>
                    {clientData.accessCode && (
                        <div className="access-code-display">
                            <span>Código de Acceso del Cliente</span>
                            <strong>{clientData.accessCode}</strong>
                        </div>
                    )}
                     <button onClick={handleEnableGeneration} className="cta-button secondary enable-generation-button">
                        Habilitar Nueva Generación
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setShowResetConfirm(true)} 
                        className="cta-button secondary enable-generation-button" 
                        style={{marginTop: '0.5rem', backgroundColor: 'var(--warning-border-color)', color: 'var(--background-color)'}}
                    >
                        Resetear Contraseña
                    </button>
                    {resetStatus === 'success' && <p className="success-text" style={{textAlign: 'center', marginTop: '1rem'}}>¡Reseteo iniciado! El cliente deberá crear una nueva contraseña en su próximo inicio de sesión.</p>}

                 </>
            )}
             {showResetConfirm && (
                <ConfirmationModal
                    message={`¿Estás seguro de que quieres resetear la contraseña para ${clientData.profile.name}? El cliente será forzado a crear una nueva contraseña la próxima vez que inicie sesión.`}
                    onConfirm={handleRequestPasswordReset}
                    onCancel={() => setShowResetConfirm(false)}
                    confirmText="Sí, Resetear"
                    confirmClass="delete" // Re-using delete class for warning color
                />
            )}
        </div>
    );
};


// --- Plan Generators ---

const RoutineGenerator: React.FC<{ clientData: ClientData; setClientData: (data: ClientData) => void; gymId: string; }> = ({ clientData, setClientData, gymId }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [currentRoutine, setCurrentRoutine] = useState<Routine | null>(clientData.routine);
    const [isEditing, setIsEditing] = useState(false);
    const [adminInstructions, setAdminInstructions] = useState('');
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({});

    useEffect(() => {
        const fetchLibrary = async () => {
            const library = await apiClient.getExerciseLibrary(gymId);
            setExerciseLibrary(library);
        };
        fetchLibrary();
    }, [gymId]);


    const handleGenerate = async (isRegeneration = false) => {
        setIsGenerating(true);
        setError('');
        try {
            const generatedRoutine = await generateRoutineForClient(clientData, gymId, adminInstructions);
            
            setCurrentRoutine(generatedRoutine);
            setClientData({ ...clientData, routine: generatedRoutine, routineGeneratedDate: new Date().toISOString() });
            setIsEditing(false); // Salir del modo edición al generar un nuevo plan
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Ocurrió un error al generar la rutina.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleSaveChanges = async () => {
        setIsGenerating(true); // Re-use loading state for saving
        const success = await apiClient.saveClientData(clientData.dni, { 
            routine: currentRoutine,
            routineGeneratedDate: clientData.routineGeneratedDate 
        });
        if (success) {
            setIsEditing(false);
        } else {
            setError("No se pudieron guardar los cambios.");
        }
        setIsGenerating(false);
    };

    if (isGenerating) {
        return <div className="loading-container"><div className="spinner"></div><p>Generando rutina personalizada...</p></div>;
    }
    if (error) {
        return <div className="error-container"><p>{error}</p><button className="cta-button" onClick={() => handleGenerate()}>Intentar de Nuevo</button></div>;
    }

    if (!currentRoutine) {
        return (
            <div className="placeholder-action generation-container">
                <div className="admin-instructions-box">
                    <label htmlFor="admin-instructions-gen">Instrucciones Adicionales para la IA (Opcional)</label>
                    <textarea
                        id="admin-instructions-gen"
                        rows={3}
                        value={adminInstructions}
                        onChange={(e) => setAdminInstructions(e.target.value)}
                        placeholder="Ej: Evitar sentadillas por lesión de rodilla. Enfocar en espalda alta."
                    ></textarea>
                </div>
                <button className="cta-button" onClick={() => handleGenerate(false)}>
                    Generar Rutina con IA
                </button>
                <p className="text-secondary">Se creará una rutina de entrenamiento basada en el perfil.</p>
            </div>
        );
    }
    
    return (
        <div className="plan-container">
            <div className="actions-bar">
                <h2>Plan de Entrenamiento</h2>
                <div>
                     {isEditing ? (
                        <button onClick={handleSaveChanges} className="save-changes-button" disabled={isGenerating}>
                            {isGenerating ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="cta-button secondary">
                            Editar Plan
                        </button>
                    )}
                </div>
            </div>
            
            <RoutinePlan 
                routine={currentRoutine} 
                isEditing={isEditing}
                onRoutineChange={setCurrentRoutine}
                exerciseLibrary={exerciseLibrary}
            />
            
            <div className="regeneration-container">
                 <div className="admin-instructions-box">
                    <label htmlFor="admin-instructions-regen">Instrucciones para Regenerar (Opcional)</label>
                    <textarea
                        id="admin-instructions-regen"
                        rows={3}
                        value={adminInstructions}
                        onChange={(e) => setAdminInstructions(e.target.value)}
                        placeholder="Ej: Hacer la rutina más intensa. Cambiar ejercicios de pecho."
                    ></textarea>
                </div>
                <button className="cta-button regenerate" onClick={() => handleGenerate(true)} disabled={isGenerating}>
                    Regenerar Rutina con IA
                </button>
            </div>
        </div>
    );
};


const RoutinePlan: React.FC<{
    routine: Routine;
    isEditing: boolean;
    onRoutineChange: (routine: Routine) => void;
    exerciseLibrary: ExerciseLibrary;
}> = ({ routine, isEditing, onRoutineChange, exerciseLibrary }) => {
    const [activePhaseIndex, setActivePhaseIndex] = useState(0);

    if (!routine || !routine.phases || routine.phases.length === 0) {
        return <p>El plan de rutina no es válido o está vacío.</p>;
    }
    
    const handleExerciseChange = (phaseIndex: number, dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string) => {
        const newRoutine = { ...routine };
        // @ts-ignore
        newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios[exerciseIndex][field] = value;
        onRoutineChange(newRoutine);
    };

    const handleDayChange = (phaseIndex: number, dayIndex: number, field: 'grupoMuscular' | 'cardio', value: string) => {
        const newRoutine = { ...routine };
        newRoutine.phases[phaseIndex].routine.dias[dayIndex][field] = value;
        onRoutineChange(newRoutine);
    };
    
    const handleAddExercise = (phaseIndex: number, dayIndex: number) => {
        const newRoutine = { ...routine };
        const newExercise: Exercise = {
            nombre: Object.values(exerciseLibrary).flat()[0]?.name || '',
            series: '4',
            repeticiones: '10',
            descanso: '60s',
            tecnicaAvanzada: '',
        };
        newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.push(newExercise);
        onRoutineChange(newRoutine);
    };

    const handleDeleteExercise = (phaseIndex: number, dayIndex: number, exerciseIndex: number) => {
        const newRoutine = { ...routine };
        newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.splice(exerciseIndex, 1);
        onRoutineChange(newRoutine);
    };

    return (
        <div className={`routine-plan ${isEditing ? 'editable' : ''}`}>
             <AccordionPhases
                phases={routine.phases}
                activePhaseIndex={activePhaseIndex}
                setActivePhaseIndex={setActivePhaseIndex}
                isEditing={isEditing}
                onDayChange={handleDayChange}
                onExerciseChange={handleExerciseChange}
                onAddExercise={handleAddExercise}
                onDeleteExercise={handleDeleteExercise}
                exerciseLibrary={exerciseLibrary}
            />
        </div>
    );
};

const AccordionPhases: React.FC<{
    phases: Phase[];
    activePhaseIndex: number;
    setActivePhaseIndex: (index: number) => void;
    isEditing: boolean;
    onDayChange: (phaseIndex: number, dayIndex: number, field: 'grupoMuscular' | 'cardio', value: string) => void;
    onExerciseChange: (phaseIndex: number, dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string) => void;
    onAddExercise: (phaseIndex: number, dayIndex: number) => void;
    onDeleteExercise: (phaseIndex: number, dayIndex: number, exerciseIndex: number) => void;
    exerciseLibrary: ExerciseLibrary;
}> = ({ phases, activePhaseIndex, setActivePhaseIndex, isEditing, ...rest }) => {
    
    const togglePhase = (index: number) => {
        setActivePhaseIndex(activePhaseIndex === index ? -1 : index);
    };

    return (
        <div className="accordion-phases">
            {phases.map((phase, phaseIndex) => (
                <div key={phaseIndex} className="accordion-item">
                    <button 
                        className={`accordion-header ${activePhaseIndex === phaseIndex ? 'active' : ''}`}
                        onClick={() => togglePhase(phaseIndex)}
                        aria-expanded={activePhaseIndex === phaseIndex}
                    >
                        <span>{phase.phaseName} (Semanas: {phase.durationWeeks})</span>
                        <span className="accordion-header-icon">+</span>
                    </button>
                    <div className={`accordion-content ${activePhaseIndex === phaseIndex ? 'open' : ''}`}>
                        <PhaseContent 
                            phase={phase} 
                            phaseIndex={phaseIndex} 
                            isEditing={isEditing}
                            {...rest} 
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

const PhaseContent: React.FC<{
    phase: Phase;
    phaseIndex: number;
    isEditing: boolean;
    onDayChange: (phaseIndex: number, dayIndex: number, field: 'grupoMuscular' | 'cardio', value: string) => void;
    onExerciseChange: (phaseIndex: number, dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string) => void;
    onAddExercise: (phaseIndex: number, dayIndex: number) => void;
    onDeleteExercise: (phaseIndex: number, dayIndex: number, exerciseIndex: number) => void;
    exerciseLibrary: ExerciseLibrary;
}> = ({ phase, phaseIndex, isEditing, onDayChange, onExerciseChange, onAddExercise, onDeleteExercise, exerciseLibrary }) => {
    const [activeDayIndex, setActiveDayIndex] = useState(0);

    const dayPlan = phase.routine.dias[activeDayIndex];

    if (!dayPlan) {
        return <p>No hay días de entrenamiento definidos para esta fase.</p>;
    }

    return (
        <div>
            <nav className="day-tabs-nav">
                {phase.routine.dias.map((dia, index) => (
                    <button
                        key={index}
                        className={`day-tab-button ${activeDayIndex === index ? 'active' : ''}`}
                        onClick={() => setActiveDayIndex(index)}
                    >
                        {dia.dia}
                    </button>
                ))}
            </nav>
            <DayCard
                dayPlan={dayPlan}
                isEditing={isEditing}
                dayIndex={activeDayIndex}
                phaseIndex={phaseIndex}
                onDayChange={onDayChange}
                onExerciseChange={onExerciseChange}
                onAddExercise={onAddExercise}
                onDeleteExercise={onDeleteExercise}
                exerciseLibrary={exerciseLibrary}
            />
        </div>
    );
};


const DayCard: React.FC<{
    dayPlan: DayPlan;
    isEditing: boolean;
    dayIndex: number;
    phaseIndex: number;
    onDayChange: (phaseIndex: number, dayIndex: number, field: 'grupoMuscular' | 'cardio', value: string) => void;
    onExerciseChange: (phaseIndex: number, dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string) => void;
    onAddExercise: (phaseIndex: number, dayIndex: number) => void;
    onDeleteExercise: (phaseIndex: number, dayIndex: number, exerciseIndex: number) => void;
    exerciseLibrary: ExerciseLibrary;
}> = ({ dayPlan, isEditing, dayIndex, phaseIndex, onDayChange, onExerciseChange, onAddExercise, onDeleteExercise, exerciseLibrary }) => {
    
    const handleExerciseChangeCurried = (exerciseIndex: number, field: keyof Exercise, value: string) => {
        onExerciseChange(phaseIndex, dayIndex, exerciseIndex, field, value);
    };

    const handleDayChangeCurried = (field: 'grupoMuscular' | 'cardio', value: string) => {
        onDayChange(phaseIndex, dayIndex, field, value);
    };

    return (
        <div className="day-card">
            {isEditing ? (
                 <div className="form-group" style={{marginBottom: '1.5rem'}}>
                    <label>Grupo Muscular Principal</label>
                    <input type="text" value={dayPlan.grupoMuscular} onChange={(e) => handleDayChangeCurried('grupoMuscular', e.target.value)} />
                </div>
            ) : (
                <h3>
                    {dayPlan.dia}: <span className="muscle-group">{dayPlan.grupoMuscular}</span>
                </h3>
            )}
            <ul className="exercise-list">
                {dayPlan.ejercicios.map((exercise, exerciseIndex) => (
                    <li key={exerciseIndex} className={`exercise-item ${isEditing ? 'editable' : ''}`}>
                         {isEditing ? (
                            <ExerciseItemEditor
                                exercise={exercise}
                                exerciseIndex={exerciseIndex}
                                dayIndex={dayIndex}
                                handleExerciseChange={handleExerciseChangeCurried}
                                handleDeleteExercise={() => onDeleteExercise(phaseIndex, dayIndex, exerciseIndex)}
                                exerciseLibrary={exerciseLibrary}
                            />
                        ) : (
                           <ExerciseView exercise={exercise} onPlayVideo={() => {}} />
                        )}
                    </li>
                ))}
            </ul>
            {isEditing && (
                 <div className="add-exercise-action">
                    <button onClick={() => onAddExercise(phaseIndex, dayIndex)} className="add-exercise-button">+ Añadir Ejercicio</button>
                </div>
            )}
             <div style={{marginTop: '1.5rem'}}>
                {isEditing ? (
                    <div className="form-group">
                        <label htmlFor={`cardio-${dayIndex}`}>Cardio (Opcional)</label>
                        <input
                            type="text"
                            id={`cardio-${dayIndex}`}
                            value={dayPlan.cardio || ''}
                            onChange={(e) => handleDayChangeCurried('cardio', e.target.value)}
                            placeholder="Ej: 30 min en cinta"
                        />
                    </div>
                ) : (
                    dayPlan.cardio && <p className="cardio-note"><strong>Cardio:</strong> {dayPlan.cardio}</p>
                )}
            </div>
        </div>
    );
};

const ExerciseItemEditor: React.FC<{
    exercise: Exercise;
    exerciseIndex: number;
    dayIndex: number;
    handleExerciseChange: (exerciseIndex: number, field: keyof Exercise, value: string) => void;
    handleDeleteExercise: () => void;
    exerciseLibrary: ExerciseLibrary;
}> = ({ exercise, exerciseIndex, dayIndex, handleExerciseChange, handleDeleteExercise, exerciseLibrary }) => {
    
    const handleLocalChange = (field: keyof Exercise, value: string) => {
        handleExerciseChange(exerciseIndex, field, value);
    };
    
    return (
        <div className="exercise-item-editor animated-fade-in">
            <div className="editor-row editor-row-main">
                 <select
                    id={`exercise-name-${dayIndex}-${exerciseIndex}`}
                    className="exercise-select"
                    value={exercise.nombre}
                    onChange={(e) => handleLocalChange('nombre', e.target.value)}
                >
                    {Object.entries(exerciseLibrary).map(([group, exercises]) => (
                        <optgroup label={group} key={group}>
                            {(exercises as ExerciseDefinition[]).map(ex => (
                                <option key={ex.name} value={ex.name}>{ex.name}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                <button onClick={handleDeleteExercise} className="delete-exercise-btn" aria-label="Eliminar ejercicio">&times;</button>
            </div>
            <div className="editor-row">
                <div className="form-group-inline">
                    <label htmlFor={`series-${dayIndex}-${exerciseIndex}`}>Series</label>
                    <input type="text" id={`series-${dayIndex}-${exerciseIndex}`} value={exercise.series} onChange={(e) => handleLocalChange('series', e.target.value)} />
                </div>
                 <div className="form-group-inline">
                    <label htmlFor={`reps-${dayIndex}-${exerciseIndex}`}>Reps</label>
                    <input type="text" id={`reps-${dayIndex}-${exerciseIndex}`} value={exercise.repeticiones} onChange={(e) => handleLocalChange('repeticiones', e.target.value)} />
                </div>
                 <div className="form-group-inline">
                    <label htmlFor={`rest-${dayIndex}-${exerciseIndex}`}>Descanso</label>
                    <input type="text" id={`rest-${dayIndex}-${exerciseIndex}`} value={exercise.descanso} onChange={(e) => handleLocalChange('descanso', e.target.value)} />
                </div>
            </div>
             <div className="editor-row">
                <div className="form-group-inline full-width">
                    <label htmlFor={`technique-${dayIndex}-${exerciseIndex}`}>Técnica Avanzada (Opcional)</label>
                    <select
                        id={`technique-${dayIndex}-${exerciseIndex}`}
                        value={exercise.tecnicaAvanzada || ''}
                        onChange={(e) => handleLocalChange('tecnicaAvanzada', e.target.value)}
                    >
                        {advancedTechniqueOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.value || opt.label}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};

const ExerciseView: React.FC<{ exercise: Exercise, onPlayVideo: (url: string) => void; videoUrl?: string; }> = ({ exercise, onPlayVideo, videoUrl }) => {
     const techOption = advancedTechniqueOptions.find(opt => opt.value === exercise.tecnicaAvanzada);
    return (
         <>
            <div className="exercise-name-wrapper">
                <span className="exercise-name">{exercise.nombre}</span>
                 {videoUrl && (
                    <button onClick={() => onPlayVideo(videoUrl)} className="video-play-button" aria-label="Reproducir video del ejercicio">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M10,16.5L16,12L10,7.5V16.5Z"></path></svg>
                    </button>
                 )}
            </div>
            <div className="exercise-details">
                <span><strong>Series:</strong> {exercise.series}</span>
                <span><strong>Reps:</strong> {exercise.repeticiones}</span>
                <span><strong>Descanso:</strong> {exercise.descanso}</span>
            </div>
             {techOption && techOption.value && (
                <div className="advanced-technique">
                    <span>💪</span>
                    <strong>{techOption.label}:</strong> {techOption.description}
                </div>
            )}
         </>
    );
};

// FIX: Added ClientDietView component, as it was missing.
const ClientDietView: React.FC<{ dietPlan: DietPlan }> = ({ dietPlan }) => {
    if (!dietPlan) {
        return <div className="placeholder">No hay plan de nutrición disponible.</div>;
    }

    const { planTitle, summary, meals, recommendations } = dietPlan;

    return (
        <div className="diet-plan-container animated-fade-in">
            <div className="plan-header">
                <h2>{planTitle}</h2>
                <div className="diet-summary">
                    <div className="summary-item">
                        <span>Calorías</span>
                        <strong>{summary.totalCalories}</strong>
                    </div>
                    <div className="summary-item">
                        <span>Proteínas</span>
                        <strong>{summary.macronutrients.proteinGrams}g</strong>
                    </div>
                    <div className="summary-item">
                        <span>Carbs</span>
                        <strong>{summary.macronutrients.carbsGrams}g</strong>
                    </div>
                    <div className="summary-item">
                        <span>Grasas</span>
                        <strong>{summary.macronutrients.fatGrams}g</strong>
                    </div>
                </div>
            </div>
            <div className="meals-container">
                {meals.map((meal, index) => (
                    <div key={index} className="meal-card">
                        <h3>{meal.mealName}</h3>
                        <ul>
                            {meal.foodItems.map((item, itemIndex) => (
                                <li key={itemIndex}>
                                    <span>{item.food}</span>
                                    <span>{item.amount}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            <div className="recommendations">
                <h3>Recomendaciones</h3>
                <ul>
                    {recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

// FIX: Replace incomplete and mistyped 'DietPlanGenerator' component.
const DietPlanGenerator: React.FC<{ clientData: ClientData; setClientData: (data: ClientData) => void; }> = ({ clientData, setClientData }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [adminInstructions, setAdminInstructions] = useState('');
    const [activePlanIndex, setActivePlanIndex] = useState(0);
    
    const currentPlan = clientData.dietPlans ? clientData.dietPlans[activePlanIndex] : null;

    const handleGenerate = async (planIndex: number) => {
        setIsGenerating(true);
        setError('');
        try {
            const dietSchema = {
                type: Type.OBJECT,
                properties: {
                    planTitle: { type: Type.STRING, description: "Un nombre para el plan de nutrición. Ej: 'Plan de Volumen Limpio', 'Dieta de Definición'."},
                    summary: {
                        type: Type.OBJECT,
                        properties: {
                            totalCalories: { type: Type.NUMBER, description: "Total de calorías diarias del plan." },
                            macronutrients: {
                                type: Type.OBJECT,
                                properties: {
                                    proteinGrams: { type: Type.NUMBER, description: "Gramos de proteína." },
                                    carbsGrams: { type: Type.NUMBER, description: "Gramos de carbohidratos." },
                                    fatGrams: { type: Type.NUMBER, description: "Gramos de grasas." },
                                },
                                required: ["proteinGrams", "carbsGrams", "fatGrams"]
                            }
                        },
                         required: ["totalCalories", "macronutrients"]
                    },
                    meals: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                mealName: { type: Type.STRING, description: "Nombre de la comida (Ej: 'Desayuno', 'Almuerzo', 'Colación', 'Cena')." },
                                foodItems: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            food: { type: Type.STRING, description: "Nombre del alimento. Ej: 'Pechuga de pollo', 'Arroz integral'." },
                                            amount: { type: Type.STRING, description: "Cantidad del alimento. Ej: '150g', '1 taza'." }
                                        },
                                        required: ["food", "amount"]
                                    }
                                }
                            },
                            required: ["mealName", "foodItems"]
                        }
                    },
                    recommendations: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.STRING,
                            description: "Una recomendación nutricional general. Ej: 'Beber 2-3 litros de agua por día'."
                        }
                    }
                },
                required: ["planTitle", "summary", "meals", "recommendations"]
            };

            const prompt = `
                Por favor, crea un plan de nutrición para un cliente con el siguiente perfil:
                - Perfil: ${JSON.stringify(clientData.profile)}
                
                Instrucciones Adicionales del Entrenador: "${adminInstructions || 'Ninguna'}"

                REGLAS ESTRICTAS PARA TU RESPUESTA:
                1.  **Idioma:** Tu respuesta DEBE estar redactada en español de Argentina. Utiliza vocabulario y expresiones comunes de ese país (ej. "vos" en lugar de "tú", nombres de comidas locales como "bife", "milanesa", "tostadas con palta", etc.).
                2.  Tu respuesta DEBE ser únicamente un objeto JSON válido que se ajuste al esquema proporcionado, sin ningún texto adicional, formato markdown, o explicaciones.
                3.  Calcula las calorías y macronutrientes basándote en el perfil completo del cliente (peso, altura, edad, género, nivel de actividad y objetivo). Usa una fórmula estándar como Mifflin-St Jeor o Harris-Benedict y ajusta por el factor de actividad y el objetivo (déficit para pérdida de grasa, superávit para hipertrofia).
                4.  Distribuye los macronutrientes de forma apropiada:
                    - **Hipertrofia:** ~1.8-2.2g de proteína por kg de peso corporal, ~0.8-1g de grasa por kg, el resto carbohidratos.
                    - **Pérdida de grasa:** ~2.0-2.5g de proteína por kg, ~0.6-0.8g de grasa por kg, el resto carbohidratos.
                    - **Mantenimiento:** ~1.5-2.0g de proteína por kg.
                5.  Crea un plan con 4 a 5 comidas (desayuno, almuerzo, merienda, cena, y opcionalmente una colación).
                6.  Las comidas deben ser realistas, variadas y usar alimentos comunes en Argentina.
                7.  Las recomendaciones deben ser prácticas y útiles (ej: hidratación, timing de comidas, etc.).
                8.  El \`planTitle\`, los \`mealName\` y todo el texto debe estar en español.

                Genera el plan de nutrición en formato JSON ahora.
            `;

            const result = await withRetry(async () => {
                const response = await ai.models.generateContent({
                    model: "gemini-2.5-pro",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: dietSchema,
                    },
                });
                return response;
            });

            const jsonText = result.text.trim();
            const newDietPlan = JSON.parse(jsonText);
            
            const updatedDietPlans = [...(clientData.dietPlans || [null, null])];
            updatedDietPlans[planIndex] = newDietPlan;

            setClientData({ ...clientData, dietPlans: updatedDietPlans });
            await apiClient.saveClientData(clientData.dni, { dietPlans: updatedDietPlans });

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Ocurrió un error al generar el plan de nutrición.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleDeletePlan = async () => {
        if(window.confirm("¿Estás seguro de que quieres eliminar este plan de nutrición?")) {
             const updatedDietPlans = [...(clientData.dietPlans || [null, null])];
             updatedDietPlans[activePlanIndex] = null;
             setClientData({ ...clientData, dietPlans: updatedDietPlans });
             await apiClient.saveClientData(clientData.dni, { dietPlans: updatedDietPlans });
        }
    };


    if (isGenerating) {
        return <div className="loading-container"><div className="spinner"></div><p>Generando plan de nutrición...</p></div>;
    }
    if (error) {
        return <div className="error-container"><p>{error}</p><button className="cta-button" onClick={() => handleGenerate(activePlanIndex)}>Intentar de Nuevo</button></div>;
    }
    
    return (
         <div className="plan-container">
            {currentPlan ? (
                 <>
                    <div className="actions-bar">
                         <h2>Plan de Nutrición</h2>
                         <button onClick={handleDeletePlan} className="cta-button secondary delete">
                             Eliminar Plan
                        </button>
                    </div>
                    <ClientDietView dietPlan={currentPlan} />
                 </>
            ) : (
                <div className="placeholder-action generation-container">
                    <div className="admin-instructions-box">
                        <label htmlFor="admin-instructions-diet">Instrucciones Adicionales para la IA (Opcional)</label>
                        <textarea
                            id="admin-instructions-diet"
                            rows={3}
                            value={adminInstructions}
                            onChange={(e) => setAdminInstructions(e.target.value)}
                            placeholder="Ej: Cliente es intolerante a la lactosa. Prefiere comidas rápidas de preparar."
                        ></textarea>
                    </div>
                    <button className="cta-button" onClick={() => handleGenerate(activePlanIndex)}>
                        Generar Plan de Nutrición
                    </button>
                    <p className="text-secondary">Se creará un plan de nutrición basado en el perfil.</p>
                </div>
            )}
        </div>
    );
};

// --- Client-Facing Views (Read-Only) ---

const ClientStats: React.FC<{ clientData: ClientData }> = ({ clientData }) => {
    const { profile, routine, routineGeneratedDate } = clientData;
    const initialWeight = parseFloat(profile.weight);
    
    const bmi = useMemo(() => calculateBMI(initialWeight, parseFloat(profile.height)), [initialWeight, profile.height]);
    const targetWeight = useMemo(() => calculateTargetWeight(parseFloat(profile.height)), [profile.height]);
    const estimatedFinalWeight = useMemo(() => calculateEstimatedFinalWeight(clientData), [clientData]);

    const routineStartDate = routineGeneratedDate ? new Date(routineGeneratedDate) : null;
    const routineDuration = routine?.totalDurationWeeks;
    const routineEndDate = routineStartDate && routineDuration ? new Date(routineStartDate.getTime() + routineDuration * 7 * 24 * 60 * 60 * 1000) : null;
    
    return (
        <div className="profile-section">
            <h2>Tus Estadísticas</h2>
             <div className="profile-form">
                <div className="form-group"><label>Peso Inicial</label><p>{initialWeight ? `${initialWeight.toFixed(1)} kg` : 'N/A'}</p></div>
                <div className="form-group"><label>IMC Actual</label><p>{bmi.value || 'N/A'}</p></div>
                <div className="form-group"><label>Peso Objetivo</label><p>{targetWeight}</p></div>
                <div className="form-group"><label>Peso Estimado Final</label><p>{estimatedFinalWeight}</p></div>
                <div className="form-group"><label>Duración del Plan</label><p>{routineEndDate ? `${routineStartDate?.toLocaleDateString()} - ${routineEndDate.toLocaleDateString()}` : 'N/A'}</p></div>
            </div>
        </div>
    );
};

const ClientDashboardView: React.FC<{ dni: string, onLogout: () => void }> = ({ dni, onLogout }) => {
     const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'routine' | 'diet' | 'progress' | 'chat'>('routine');
    const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({});

    const fetchAllData = async () => {
        setIsLoading(true);
        const data = await apiClient.getClientData(dni);
        if (data) {
            setClientData(data);
             if (data.planType === 'nutrition' && activeTab === 'routine') {
                setActiveTab('diet');
            }
            if(data.gymId) {
                const lib = await apiClient.getExerciseLibrary(data.gymId);
                setExerciseLibrary(lib);
            }
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchAllData();
    }, [dni]);
    
    const getExerciseVideoUrl = (exerciseName: string): string | undefined => {
        for (const group in exerciseLibrary) {
            const exercise = (exerciseLibrary[group] as ExerciseDefinition[]).find(ex => ex.name === exerciseName);
            if (exercise) return exercise.videoUrl;
        }
        return undefined;
    };
    

    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div>Cargando tu plan...</div>;
    }

    if (!clientData) {
        return <div className="error-container">No se pudieron cargar tus datos. Por favor, contacta a tu entrenador. <button onClick={onLogout} className="logout-button">Cerrar Sesión</button></div>;
    }
    
    const planType = clientData.planType || 'full';

    const renderContent = () => {
        switch (activeTab) {
            case 'routine':
                 if (!clientData.routine) return <div className="placeholder">Aún no tienes una rutina asignada. Contacta a tu entrenador.</div>;
                 return <ClientRoutineView routine={clientData.routine} onPlayVideo={setVideoModalUrl} getExerciseVideoUrl={getExerciseVideoUrl} />;
            case 'diet':
                 if (!clientData.dietPlans || clientData.dietPlans.every(p => p === null)) return <div className="placeholder">Aún no tienes un plan de nutrición. Contacta a tu entrenador.</div>;
                 return <ClientDietView dietPlan={clientData.dietPlans[0]!} />;
            case 'progress':
                 return <ProgressView clientData={clientData} onDataUpdate={fetchAllData} />;
            case 'chat':
                 return <ClientChatView clientData={clientData} />;
            default:
                return null;
        }
    };


    return (
         <div className="client-management-view">
             <div className="main-header">
                <div className="header-title-wrapper">
                     <div>
                        <h1>Hola, {clientData.profile.name || 'Cliente'}!</h1>
                        <p>¡Listo para entrenar!</p>
                    </div>
                </div>
                 <div className="admin-header-nav">
                    <button onClick={onLogout} className="logout-button">Cerrar Sesión</button>
                 </div>
            </div>
            <div className="dashboard-grid">
                 <aside className="profile-section">
                    <ClientStats clientData={clientData} />
                </aside>
                <main className="main-content">
                    <nav className="main-tabs-nav">
                         {(planType === 'full' || planType === 'routine') &&
                            <button className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>Rutina</button>
                         }
                         {(planType === 'full' || planType === 'nutrition') &&
                            <button className={`main-tab-button ${activeTab === 'diet' ? 'active' : ''}`} onClick={() => setActiveTab('diet')}>Nutrición</button>
                         }
                        <button className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>Progreso</button>
                        <button className={`main-tab-button ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>Mensaje</button>
                    </nav>
                     <div className="results-section">
                        {renderContent()}
                    </div>
                </main>
            </div>
             {videoModalUrl && (
                <VideoPlayerModal videoUrl={videoModalUrl} onClose={() => setVideoModalUrl(null)} />
            )}
        </div>
    );
};


const root = createRoot(document.getElementById("root")!);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);