


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
    PlanType
} from './apiClient';


// --- Utility Functions ---

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
const calculateHealthyWeightRange = (height: number): string => {
    if (!height) return 'N/A';
    const heightInMeters = height / 100;
    const lowerBound = 18.5 * (heightInMeters * heightInMeters);
    const upperBound = 24.9 * (heightInMeters * heightInMeters);
    return `${lowerBound.toFixed(1)} kg - ${upperBound.toFixed(1)} kg`;
};

/**
 * Formats a date string (YYYY-MM-DD or ISO) to a more readable format.
 * @param dateString The date string to format.
 * @returns A formatted date string (e.g., "15 de julio de 2024").
 */
const formatDate = (dateString: string) => {
    if (!dateString) return 'Fecha no disponible';
    try {
        const date = new Date(dateString);
        // Add time zone offset to prevent date from shifting
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const correctedDate = new Date(date.getTime() + userTimezoneOffset);

        return correctedDate.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch (e) {
        console.error("Error formatting date:", e);
        return dateString; // Fallback to original string
    }
};

/**
 * Generates a prompt for the AI to create a workout routine.
 * @param profile The client's profile.
 * @param exerciseLibrary The available exercises.
 * @param instructions Additional instructions from the coach.
 * @returns The complete prompt string.
 */
const generateRoutinePrompt = (profile: Profile, exerciseLibrary: ExerciseLibrary, instructions: string) => {
    let availableExercises = "Ejercicios disponibles (nombre, grupo muscular principal):\n";
    for (const group in exerciseLibrary) {
        availableExercises += `\n${group}:\n`;
        exerciseLibrary[group].forEach(ex => {
            if (ex.isEnabled) {
                availableExercises += `- ${ex.name}\n`;
            }
        });
    }

    const planName = `${profile.goal} - ${profile.trainingDays} Días`;
    const includeAdaptation = profile.includeAdaptationPhase === 'Sí';
    const includeDeload = profile.includeDeloadPhase === 'Sí';

    let totalWeeks = 8;
    if (includeAdaptation) totalWeeks += 2;
    if (includeDeload) totalWeeks += 1;


    return `
    Por favor, crea un plan de entrenamiento de gimnasio detallado y personalizado en formato JSON.
    El resultado DEBE SER un único objeto JSON válido, sin texto adicional, explicaciones, ni marcadores de formato como \`\`\`json.
    
    **Perfil del Cliente:**
    - **Edad:** ${profile.age} años
    - **Peso:** ${profile.weight} kg
    - **Altura:** ${profile.height} cm
    - **Género:** ${profile.gender}
    - **Nivel de Experiencia:** ${profile.level}
    - **Objetivo Principal:** ${profile.goal}
    - **Días de Entrenamiento por Semana:** ${profile.trainingDays}
    - **Factor de Actividad:** ${profile.activityFactor}
    - **Uso de Técnicas Avanzadas:** ${profile.useAdvancedTechniques}
    - **Área de Enfoque Corporal:** ${profile.bodyFocusArea}
    - **Músculo Específico a Enfocar:** ${profile.muscleFocus}
    - **Intensidad de Entrenamiento Deseada:** ${profile.trainingIntensity}
    - **Incluir Fase de Adaptación (2 semanas):** ${includeAdaptation ? 'Sí' : 'No'}
    - **Incluir Fase de Deload/Descarga (1 semana al final):** ${includeDeload ? 'Sí' : 'No'}

    **Instrucciones Adicionales del Entrenador:**
    ${instructions || "Sin instrucciones adicionales."}

    **Directrices para la Generación del Plan:**
    1.  **Nombre del Plan:** Genera un nombre creativo para el plan basado en el objetivo (ej. "Operación Hipertrofia", "Proyecto Definición Total").
    2.  **Estructura General:** El plan debe tener ${totalWeeks} semanas en total. Organiza el plan en fases.
    3.  **Fases:**
        -   Crea una fase de "Adaptación" de 2 semanas si se solicita. Debe ser de menor intensidad.
        -   Crea una o más fases principales (ej. "Fase de Acumulación", "Fase de Intensificación") de 3-4 semanas cada una, progresando en dificultad o volumen.
        -   Crea una fase de "Deload" (Descarga) de 1 semana al final si se solicita. Reduce el volumen (series) y/o la intensidad (peso) en un 40-50%.
    4.  **Distribución Semanal:** Distribuye los grupos musculares de forma lógica a lo largo de los ${profile.trainingDays} días disponibles, según el área de enfoque. Por ejemplo:
        -   **Full Body:** Días de cuerpo completo variando el énfasis.
        -   **Tren Superior/Inferior:** Alterna días de tren superior y tren inferior.
        -   **Otros:** Push/Pull/Legs, Weider, etc., según el nivel y días.
    5.  **Selección de Ejercicios:**
        -   Utiliza **EXCLUSIVAMENTE** los ejercicios proporcionados en la lista de "Ejercicios Disponibles". No inventes ni incluyas ejercicios que no estén en la lista.
        -   Selecciona ejercicios apropiados para el nivel de experiencia del cliente y su objetivo.
        -   Asegura una variedad adecuada de ejercicios para cada grupo muscular a lo largo de las fases.
    6.  **Series y Repeticiones:**
        -   **Hipertrofia:** Principalmente en el rango de 3-4 series de 8-12 repeticiones.
        -   **Pérdida de Grasa / Resistencia:** Puede incluir rangos de 12-15 repeticiones o superseries.
        -   **Principiante:** Empezar con 2-3 series por ejercicio.
        -   **Avanzado:** Puede llegar a 4-5 series en ejercicios clave.
    7.  **Descanso:** Asigna tiempos de descanso en segundos (ej. "60s", "90s") entre series. Menor para pérdida de grasa, mayor para hipertrofia.
    8.  **Técnicas Avanzadas:** Si se solicita ('Sí'), aplica **UNA SOLA** técnica avanzada (como 'Drop Set', 'Rest-Pause') a **UN ÚNICO EJERCICIO** por grupo muscular principal en los días clave, solo para niveles intermedios o avanzados. No apliques técnicas a todos los ejercicios.
    9.  **Cardio:** Asigna una recomendación de cardio al final de cada sesión. Debe ser coherente con el objetivo (ej. HIIT para pérdida de grasa, LISS para hipertrofia). Especifica duración e intensidad (ej. "20 min HIIT en cinta", "30 min LISS en elíptica").

    **Formato de Salida JSON Estricto:**
    El JSON debe seguir esta estructura exacta:
    {
      "planName": "Nombre del Plan",
      "totalDurationWeeks": ${totalWeeks},
      "phases": [
        {
          "phaseName": "Nombre de la Fase (ej. Adaptación, Acumulación, Deload)",
          "durationWeeks": 2,
          "routine": {
            "dias": [
              {
                "dia": "Día 1",
                "grupoMuscular": "Grupo Muscular Principal (ej. Pecho y Tríceps)",
                "ejercicios": [
                  {
                    "nombre": "Nombre del Ejercicio de la lista",
                    "series": "3",
                    "repeticiones": "10-12",
                    "descanso": "60s",
                    "tecnicaAvanzada": "Drop Set (opcional, si aplica)"
                  }
                ],
                "cardio": "Recomendación de Cardio (ej. 25 min LISS)"
              }
            ]
          }
        }
      ]
    }
    
    **Ejercicios Disponibles:**
    ${availableExercises}
    `;
};


/**
 * Generates a prompt for the AI to create a nutrition plan.
 * @param profile The client's profile.
 * @param instructions Additional instructions from the coach.
 * @returns The complete prompt string.
 */
const generateNutritionPrompt = (profile: Profile, instructions: string, planIndex: number) => {
    const planFocus = planIndex === 0 ? "principal" : "alternativo";
    const instructionFocus = planIndex === 0 
        ? "El plan debe ser balanceado y sostenible." 
        : "El plan debe ser una alternativa viable, quizás con diferentes opciones de alimentos o un enfoque ligeramente distinto (ej. más bajo en carbohidratos, o con comidas más rápidas de preparar).";

    return `
    Por favor, crea un plan de nutrición detallado y personalizado en formato JSON.
    El resultado DEBE SER un único objeto JSON válido, sin texto adicional, explicaciones, ni marcadores de formato como \`\`\`json.
    Este es el plan de nutrición ${planFocus}. ${instructionFocus}

    **Perfil del Cliente:**
    - **Edad:** ${profile.age} años
    - **Peso:** ${profile.weight} kg
    - **Altura:** ${profile.height} cm
    - **Género:** ${profile.gender}
    - **Nivel de Experiencia:** ${profile.level}
    - **Objetivo Principal:** ${profile.goal}
    - **Días de Entrenamiento por Semana:** ${profile.trainingDays}
    - **Factor de Actividad:** ${profile.activityFactor}

    **Instrucciones Adicionales del Entrenador:**
    ${instructions || "Sin instrucciones adicionales."}

    **Directrices para la Generación del Plan:**
    1.  **Calcular Requerimientos:**
        -   Usa la fórmula de Harris-Benedict o similar para estimar el Gasto Energético Basal (GEB).
        -   Aplica el Factor de Actividad para obtener el Gasto Energético Total (GET).
        -   Ajusta las calorías totales según el objetivo:
            -   **Hipertrofia:** Superávit de 300-500 kcal sobre el GET.
            -   **Pérdida de Grasa:** Déficit de 300-500 kcal bajo el GET.
            -   **Mantenimiento:** Igual al GET.
    2.  **Distribución de Macronutrientes (en gramos):**
        -   **Proteínas:** 1.6-2.2 g por kg de peso corporal.
        -   **Grasas:** 20-30% de las calorías totales.
        -   **Carbohidratos:** El resto de las calorías.
    3.  **Estructura del Plan:**
        -   **Título:** Genera un título para el plan (ej. "Plan Nutricional de Volumen Limpio").
        -   **Resumen:** Incluye el total de calorías y los gramos de cada macronutriente.
        -   **Comidas:** Divide el total en 4-5 comidas (Desayuno, Almuerzo, Merienda, Cena, y opcionalmente Media Mañana o Pre-entreno).
        -   **Alimentos:** Para cada comida, lista alimentos específicos y sus cantidades en gramos, tazas, o unidades (ej. "Pollo a la plancha", "150g"). Sé específico.
        -   **Recomendaciones:** Añade 3-5 recomendaciones generales (ej. "Beber 2-3 litros de agua al día", "Limitar el consumo de azúcares procesados").

    **Formato de Salida JSON Estricto:**
    El JSON debe seguir esta estructura exacta:
    {
      "planTitle": "Título del Plan Nutricional",
      "summary": {
        "totalCalories": 2500,
        "macronutrients": {
          "proteinGrams": 180,
          "carbsGrams": 250,
          "fatGrams": 80
        }
      },
      "meals": [
        {
          "mealName": "Desayuno",
          "foodItems": [
            { "food": "Avena en hojuelas", "amount": "80g" },
            { "food": "Claras de huevo", "amount": "4 unidades" },
            { "food": "Frutos rojos", "amount": "1/2 taza" }
          ]
        },
        {
          "mealName": "Almuerzo",
          "foodItems": [
            { "food": "Pechuga de pollo a la plancha", "amount": "150g" },
            { "food": "Arroz integral cocido", "amount": "200g" },
            { "food": "Brócoli al vapor", "amount": "1 taza" }
          ]
        }
      ],
      "recommendations": [
        "Beber al menos 3 litros de agua al día.",
        "Ajustar las porciones según la saciedad y el progreso."
      ]
    }
    `;
};


// --- Helper Components ---

/**
 * A reusable confirmation modal component.
 */
const ConfirmationModal = ({ message, onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar' }: { message: string, onConfirm: () => void, onCancel: () => void, confirmText?: string, cancelText?: string }) => (
    <div className="modal-overlay" onClick={onCancel}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
            <p>{message}</p>
            <div className="modal-actions">
                <button onClick={onCancel} className="cta-button secondary">{cancelText}</button>
                <button onClick={onConfirm} className="cta-button">{confirmText}</button>
            </div>
        </div>
    </div>
);

/**
 * A spinner component to indicate loading states.
 */
const Spinner = ({ size = 'normal' }: { size?: 'normal' | 'small' }) => <div className={`spinner ${size === 'small' ? 'small' : ''}`}></div>;

/**
 * Displays a BMI value and its corresponding category with color coding.
 */
const BMIDisplay = ({ weight, height, view }: { weight: number, height: number, view: 'admin' | 'client' }) => {
    const { value: bmi, categoryClass } = calculateBMI(weight, height);
    if (bmi === 0) return null;
    
    const categoryText = {
        underweight: 'Bajo Peso',
        normal: 'Normal',
        overweight: 'Sobrepeso',
        obesity: 'Obesidad'
    }[categoryClass] || 'Desconocido';

    return (
        <div className={`bmi-display ${view === 'client' ? 'client-bmi' : ''}`}>
            <span>IMC: <strong>{bmi}</strong></span>
            <span className={`bmi-category ${categoryClass}`}>{categoryText}</span>
        </div>
    );
};

// --- SVG Icons ---
const VideoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path d="M7 4v16l13 -8z"></path>
    </svg>
);

const CheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
    </svg>
);

const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"></path>
    </svg>
);

const ImageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"></path>
    </svg>
);


// --- Main Application Components ---

/**
 * SuperAdminDashboard: View for the superadmin to manage gyms.
 */
const SuperAdminDashboard = ({ onLogout }: { onLogout: () => void }) => {
    const [gyms, setGyms] = useState<Gym[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showEditModal, setShowEditModal] = useState<Gym | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<Gym | null>(null);

    // States for adding a new gym
    const [newGymName, setNewGymName] = useState('');
    const [newGymUsername, setNewGymUsername] = useState('');
    const [newGymPassword, setNewGymPassword] = useState('');
    const [newGymDailyLimit, setNewGymDailyLimit] = useState(10);
    const [newGymLogo, setNewGymLogo] = useState<string | null>(null);
    const [newGymPlanType, setNewGymPlanType] = useState<PlanType>('full');


    // States for editing a gym
    const [editGymName, setEditGymName] = useState('');
    const [editGymPassword, setEditGymPassword] = useState('');
    const [editGymDailyLimit, setEditGymDailyLimit] = useState(10);
    const [editGymLogo, setEditGymLogo] = useState<string | null>(null);
    const [editGymPlanType, setEditGymPlanType] = useState<PlanType>('full');


    const fetchGyms = async () => {
        setIsLoading(true);
        const fetchedGyms = await apiClient.getGyms();
        setGyms(fetchedGyms);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchGyms();
    }, []);

    const handleCreateGym = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await apiClient.createGym(newGymName, newGymUsername, newGymPassword, newGymDailyLimit, newGymLogo, newGymPlanType);
        if (success) {
            setNewGymName('');
            setNewGymUsername('');
            setNewGymPassword('');
            setNewGymDailyLimit(10);
            setNewGymLogo(null);
            setNewGymPlanType('full');
            fetchGyms();
        } else {
            alert('Error al crear el gimnasio. El nombre de usuario puede que ya exista.');
        }
    };
    
    const handleUpdateGym = async () => {
        if (!showEditModal) return;
        
        const updateData: { name?: string; password?: string, dailyQuestionLimit?: number, logoSvg?: string | null, planType?: PlanType } = {};
        if (editGymName && editGymName !== showEditModal.name) {
            updateData.name = editGymName;
        }
        if (editGymPassword) { // Only update password if a new one is entered
            updateData.password = editGymPassword;
        }
        if (editGymDailyLimit !== showEditModal.dailyQuestionLimit) {
            updateData.dailyQuestionLimit = editGymDailyLimit;
        }
        if (editGymLogo !== showEditModal.logoSvg) {
            updateData.logoSvg = editGymLogo;
        }
        if (editGymPlanType !== showEditModal.planType) {
            updateData.planType = editGymPlanType;
        }

        const success = await apiClient.updateGym(showEditModal._id, updateData);
        if (success) {
            setShowEditModal(null);
            fetchGyms();
        } else {
            alert('Error al actualizar el gimnasio.');
        }
    };


    const handleDeleteGym = async () => {
        if (!showDeleteModal) return;
        const success = await apiClient.deleteGym(showDeleteModal._id);
        if (success) {
            setShowDeleteModal(null);
            fetchGyms();
        } else {
            alert('Error al eliminar el gimnasio.');
        }
    };

    const handleOpenEditModal = (gym: Gym) => {
        setEditGymName(gym.name);
        setEditGymPassword(''); // Clear password field for security
        setEditGymDailyLimit(gym.dailyQuestionLimit || 10);
        setEditGymLogo(gym.logoSvg || null);
        setEditGymPlanType(gym.planType || 'full');
        setShowEditModal(gym);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setLogoState: React.Dispatch<React.SetStateAction<string | null>>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoState(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="admin-dashboard">
            <header className="main-header">
                <div className="header-title-wrapper">
                    <h1>Panel de Super Administrador</h1>
                </div>
                <button onClick={onLogout} className="logout-button">Cerrar Sesión</button>
            </header>

            <div className="add-gym-container">
                <h3>Añadir Nuevo Gimnasio</h3>
                <form onSubmit={handleCreateGym} className="add-gym-form">
                     <div className="form-group">
                        <label htmlFor="new-gym-name">Nombre del Gimnasio</label>
                        <input id="new-gym-name" type="text" value={newGymName} onChange={e => setNewGymName(e.target.value)} required />
                    </div>
                     <div className="form-group">
                        <label htmlFor="new-gym-user">Usuario (para login)</label>
                        <input id="new-gym-user" type="text" value={newGymUsername} onChange={e => setNewGymUsername(e.target.value)} required />
                    </div>
                     <div className="form-group">
                        <label htmlFor="new-gym-pass">Contraseña</label>
                        <input id="new-gym-pass" type="password" value={newGymPassword} onChange={e => setNewGymPassword(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="new-gym-limit">Límite Preguntas IA/día</label>
                        <input id="new-gym-limit" type="number" value={newGymDailyLimit} onChange={e => setNewGymDailyLimit(Number(e.target.value))} required />
                    </div>
                     <div className="form-group">
                        <label>Tipo de Plan</label>
                        <select value={newGymPlanType} onChange={e => setNewGymPlanType(e.target.value as PlanType)}>
                            <option value="full">Completo</option>
                            <option value="routine">Solo Rutina</option>
                            <option value="nutrition">Solo Nutrición</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Logo del Gimnasio (SVG)</label>
                        <div className="file-input-wrapper">
                            <label htmlFor="new-gym-logo" className="file-input-label">Seleccionar Archivo</label>
                            <input id="new-gym-logo" type="file" accept=".svg" onChange={(e) => handleFileChange(e, setNewGymLogo)} />
                            {newGymLogo ? <div className="file-input-preview"><img src={newGymLogo} alt="Logo Preview" style={{ maxWidth: '100%', maxHeight: '100%' }}/></div> : <div className="file-input-preview">SVG</div>}
                        </div>
                    </div>
                    <div className="add-gym-actions">
                        <button type="submit" className="cta-button">Crear Gimnasio</button>
                    </div>
                </form>
            </div>
            
            <h2>Gimnasios Existentes</h2>
            {isLoading ? <Spinner /> : (
                <div className="gym-list">
                    {gyms.filter(g => g.username !== 'superadmin').map(gym => (
                        <div key={gym._id} className="gym-card">
                            <div className="gym-card-header">
                                <div className="gym-card-logo">
                                    {gym.logoSvg ? <img src={gym.logoSvg} alt={`${gym.name} logo`} style={{ maxWidth: '100%', maxHeight: '100%' }} /> : <span>-</span>}
                                </div>
                                <div className="gym-card-info">
                                    <h3>{gym.name}</h3>
                                    <p>Usuario: {gym.username}</p>
                                </div>
                            </div>
                            <div className="gym-card-actions">
                                <button className="action-btn edit" onClick={() => handleOpenEditModal(gym)}>Editar</button>
                                <button className="action-btn delete" onClick={() => setShowDeleteModal(gym)}>Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Edit Gym Modal */}
            {showEditModal && (
                <div className="modal-overlay" onClick={() => setShowEditModal(null)}>
                    <div className="modal-content edit-modal" onClick={e => e.stopPropagation()}>
                        <button className="close-button" onClick={() => setShowEditModal(null)}>&times;</button>
                        <h3>Editar Gimnasio: {showEditModal.name}</h3>
                        <form className="profile-form" onSubmit={(e) => { e.preventDefault(); handleUpdateGym(); }}>
                             <div className="form-group">
                                <label htmlFor="edit-gym-name">Nombre del Gimnasio</label>
                                <input id="edit-gym-name" type="text" value={editGymName} onChange={e => setEditGymName(e.target.value)} />
                            </div>
                             <div className="form-group">
                                <label htmlFor="edit-gym-pass">Nueva Contraseña (dejar en blanco para no cambiar)</label>
                                <input id="edit-gym-pass" type="password" value={editGymPassword} onChange={e => setEditGymPassword(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-gym-limit">Límite Preguntas IA/día</label>
                                <input id="edit-gym-limit" type="number" value={editGymDailyLimit} onChange={e => setEditGymDailyLimit(Number(e.target.value))} />
                            </div>
                             <div className="form-group">
                                <label>Tipo de Plan</label>
                                <select value={editGymPlanType} onChange={e => setEditGymPlanType(e.target.value as PlanType)}>
                                    <option value="full">Completo</option>
                                    <option value="routine">Solo Rutina</option>
                                    <option value="nutrition">Solo Nutrición</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Logo del Gimnasio (SVG)</label>
                                <div className="file-input-wrapper">
                                    <label htmlFor="edit-gym-logo" className="file-input-label">Cambiar Archivo</label>
                                    <input id="edit-gym-logo" type="file" accept=".svg" onChange={(e) => handleFileChange(e, setEditGymLogo)} />
                                    {editGymLogo ? <div className="file-input-preview"><img src={editGymLogo} alt="Logo Preview" style={{ maxWidth: '100%', maxHeight: '100%' }} /></div> : <div className="file-input-preview">Sin Logo</div>}
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setShowEditModal(null)} className="cta-button secondary">Cancelar</button>
                                <button type="submit" className="cta-button">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <ConfirmationModal
                    message={`¿Estás seguro de que quieres eliminar "${showDeleteModal.name}"? Esta acción es irreversible y borrará TODOS los clientes y datos asociados.`}
                    onConfirm={handleDeleteGym}
                    onCancel={() => setShowDeleteModal(null)}
                    confirmText="Sí, Eliminar"
                />
            )}
        </div>
    );
};

/**
 * AdminDashboard: Main view for the gym owner/coach.
 */
const AdminDashboard = ({ gym, onLogout }: { gym: Gym, onLogout: () => void }) => {
    const [view, setView] = useState<'clients' | 'library' | 'requests'>('clients');
    const [clients, setClients] = useState<ClientListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newClientDni, setNewClientDni] = useState('');
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentClientDni, setCurrentClientDni] = useState<string | null>(null);
    const [activeClientView, setActiveClientView] = useState<'active' | 'archived'>('active');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
    const [requests, setRequests] = useState<TrainerRequest[]>([]);
    const [showQRModal, setShowQRModal] = useState(false);


    const fetchClients = async () => {
        setIsLoading(true);
        const fetchedClients = await apiClient.getClients(gym._id);
        setClients(fetchedClients);
        setIsLoading(false);
    };
    
     const fetchRequests = async () => {
        const fetchedRequests = await apiClient.getRequests(gym._id);
        setRequests(fetchedRequests);
    };

    useEffect(() => {
        fetchClients();
        fetchRequests();
    }, [gym._id]);

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!newClientDni.trim()) {
            setError('El DNI no puede estar vacío.');
            return;
        }
        const result = await apiClient.createClient(newClientDni.trim(), gym._id);
        if (result.success) {
            setNewClientDni('');
            fetchClients();
        } else {
            setError(result.message || 'Error al crear el cliente.');
        }
    };
    
    const toggleSelection = (dni: string) => {
        const newSelection = new Set(selectedClients);
        if (newSelection.has(dni)) {
            newSelection.delete(dni);
        } else {
            newSelection.add(dni);
        }
        setSelectedClients(newSelection);
    };

    const handleBulkAction = async (action: 'archive' | 'restore' | 'delete') => {
        if (selectedClients.size === 0) return;

        if (action === 'delete') {
            setShowDeleteConfirmation(true);
            return; // Wait for confirmation
        }

        const newStatus = action === 'archive' ? 'archived' : 'active';
        await apiClient.updateClientStatus(selectedClients, newStatus);
        
        // Refresh and exit selection mode
        setSelectedClients(new Set());
        setIsSelectionMode(false);
        fetchClients();
    };
    
    const confirmBulkDelete = async () => {
        await apiClient.deleteClients(selectedClients);
        setShowDeleteConfirmation(false);
        setSelectedClients(new Set());
        setIsSelectionMode(false);
        fetchClients();
    };

    const filteredClients = useMemo(() => {
        return clients.filter(c => 
            c.status === activeClientView &&
            (c.profile.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.dni.includes(searchTerm))
        );
    }, [clients, searchTerm, activeClientView]);
    
    const newRequestCount = useMemo(() => {
        return requests.filter(r => r.status === 'new').length;
    }, [requests]);

    if (currentClientDni) {
        return <ClientManagementView dni={currentClientDni} gym={gym} onBack={() => { setCurrentClientDni(null); fetchClients(); }} />;
    }
    
    if (view === 'library') {
        return <ExerciseLibraryManager gymId={gym._id} onBack={() => setView('clients')} />;
    }
    
    if (view === 'requests') {
        return <RequestManager gymId={gym._id} requests={requests} onBack={() => setView('clients')} onUpdateRequest={fetchRequests}/>
    }

    return (
        <div className="admin-dashboard">
            <header className="main-header">
                <div className="header-title-wrapper">
                    {gym.logoSvg && <div className="app-logo"><img src={gym.logoSvg} alt={`${gym.name} Logo`} style={{ maxWidth: '100%', maxHeight: '100%' }} /></div>}
                     <h1>Panel de {gym.name}</h1>
                </div>
                <nav className="admin-header-nav">
                    <button className="header-nav-button" onClick={() => setView('library')}>Biblioteca de Ejercicios</button>
                    <button className="header-nav-button" onClick={() => setView('requests')}>
                        Solicitudes de Clientes
                        {newRequestCount > 0 && <span className="notification-badge">{newRequestCount}</span>}
                    </button>
                    <button className="header-nav-button share-app-button" onClick={() => setShowQRModal(true)}>
                       Compartir App
                    </button>
                    <button onClick={onLogout} className="logout-button admin-logout">Cerrar Sesión</button>
                </nav>
            </header>
            
             <div className="client-management-bar">
                 <div className="add-client-form">
                    <form onSubmit={handleCreateClient}>
                        <input
                            type="text"
                            value={newClientDni}
                            onChange={(e) => {
                                setNewClientDni(e.target.value);
                                setError('');
                            }}
                            placeholder="DNI del nuevo cliente"
                            aria-label="DNI del nuevo cliente"
                        />
                        <button type="submit" className="cta-button">Añadir Cliente</button>
                    </form>
                    {error && <p className="error-text">{error}</p>}
                </div>
                 <div className="search-client-form">
                     <input
                        type="text"
                        placeholder="Buscar por nombre o DNI..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        aria-label="Buscar cliente"
                    />
                </div>
            </div>

            <div className="view-controls">
                <div className="view-toggle">
                    <button 
                        className={`view-toggle-button ${activeClientView === 'active' ? 'active' : ''}`}
                        onClick={() => setActiveClientView('active')}
                    >
                        Activos ({clients.filter(c => c.status === 'active').length})
                    </button>
                     <button 
                        className={`view-toggle-button ${activeClientView === 'archived' ? 'active' : ''}`}
                        onClick={() => setActiveClientView('archived')}
                    >
                        Archivados ({clients.filter(c => c.status === 'archived').length})
                    </button>
                </div>
                
                 <div className="selection-controls">
                    <button 
                        className="selection-toggle-button"
                        onClick={() => {
                            setIsSelectionMode(!isSelectionMode);
                            setSelectedClients(new Set());
                        }}
                    >
                        {isSelectionMode ? 'Cancelar Selección' : 'Seleccionar Múltiples'}
                    </button>
                    {isSelectionMode && (
                        <>
                           {activeClientView === 'active' ? (
                                <button className="archive-selected-button" disabled={selectedClients.size === 0} onClick={() => handleBulkAction('archive')}>
                                    Archivar ({selectedClients.size})
                                </button>
                           ) : (
                                <button className="restore-selected-button" disabled={selectedClients.size === 0} onClick={() => handleBulkAction('restore')}>
                                    Restaurar ({selectedClients.size})
                                </button>
                           )}
                           <button className="delete-selected-button" disabled={selectedClients.size === 0} onClick={() => handleBulkAction('delete')}>
                                Eliminar ({selectedClients.size})
                           </button>
                        </>
                    )}
                </div>
            </div>

            {isLoading ? <div className="loading-container"><Spinner /></div> : (
                <div className="client-list">
                    {filteredClients.map(client => (
                        <div
                            key={client.dni}
                            className={`client-card ${isSelectionMode ? 'selection-mode' : ''} ${selectedClients.has(client.dni) ? 'selected' : ''}`}
                            onClick={() => isSelectionMode ? toggleSelection(client.dni) : setCurrentClientDni(client.dni)}
                        >
                            {isSelectionMode && (
                                <input
                                    type="checkbox"
                                    className="client-selection-checkbox"
                                    checked={selectedClients.has(client.dni)}
                                    onChange={() => toggleSelection(client.dni)}
                                    onClick={e => e.stopPropagation()} // Prevent card click from firing
                                    aria-label={`Seleccionar a ${client.profile.name || client.dni}`}
                                />
                            )}
                             <div className="client-card-header">
                                 <div>
                                    <h3>{client.profile.name || `Cliente ${client.dni}`}</h3>
                                    <p>DNI: {client.dni}</p>
                                 </div>
                                {client.planStatus === 'pending' && <span className="client-status-badge pending">Pendiente</span>}
                             </div>
                             <p>Plan: {client.planName}</p>
                             <div className="client-card-access-code">
                                Código de Acceso: <strong>{client.accessCode}</strong>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {showDeleteConfirmation && (
                <ConfirmationModal
                    message={`¿Estás seguro de que quieres eliminar ${selectedClients.size} cliente(s)? Esta acción es irreversible.`}
                    onConfirm={confirmBulkDelete}
                    onCancel={() => setShowDeleteConfirmation(false)}
                    confirmText="Sí, Eliminar"
                />
            )}

            {showQRModal && (
                <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
                    <div className="modal-content qr-modal" onClick={e => e.stopPropagation()}>
                        <button className="close-button" onClick={() => setShowQRModal(false)}>&times;</button>
                        <h3>Acceso para Clientes</h3>
                         <p>Tus clientes pueden escanear este código QR o usar el enlace para acceder a la aplicación.</p>
                        <div className="qr-code-container">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${window.location.href}`} alt="QR Code for App Access" />
                        </div>
                        <div className="app-url-display">
                            <a href={window.location.href} target="_blank" rel="noopener noreferrer">{window.location.href}</a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


/**
 * ClientManagementView: View for managing a single client's profile and plans.
 */
const ClientManagementView = ({ dni, gym, onBack }: { dni: string, gym: Gym, onBack: () => void }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'routine' | 'nutrition'>('routine');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState('');
    const [generationProgress, setGenerationProgress] = useState({ routine: 'pending', nutrition1: 'pending', nutrition2: 'pending' });
    const [adminInstructions, setAdminInstructions] = useState({ routine: '', nutrition: '' });


    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError('');
            try {
                const [data, library] = await Promise.all([
                    apiClient.getClientData(dni),
                    apiClient.getExerciseLibrary(gym._id)
                ]);

                if (data) {
                    setClientData(data);
                } else {
                    setError('No se pudo encontrar el cliente.');
                }
                setExerciseLibrary(library);
            } catch (err) {
                console.error(err);
                setError('Error al cargar los datos. Inténtalo de nuevo.');
            }
            setIsLoading(false);
        };
        fetchData();
    }, [dni, gym._id]);

    const handleProfileChange = (field: keyof Profile, value: string) => {
        if (!clientData) return;
        setClientData({
            ...clientData,
            profile: { ...clientData.profile, [field]: value }
        });
        setSaveStatus('idle');
    };
    
    const handleRoutineChange = (updatedRoutine: Routine) => {
        if (!clientData) return;
        setClientData({ ...clientData, routine: updatedRoutine });
        setSaveStatus('idle');
    };

    const handleSaveChanges = async () => {
        if (!clientData) return;
        setIsSaving(true);
        const success = await apiClient.saveClientData(dni, {
            profile: clientData.profile,
            routine: clientData.routine,
            dietPlans: clientData.dietPlans
        });
        setIsSaving(false);
        if (success) {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            alert('Error al guardar los cambios.');
        }
    };
    
    const handleGeneratePlan = async (type: PlanType) => {
        if (!clientData) return;

        setIsGenerating(true);
        setGenerationError('');
        const newProgress = { routine: 'pending', nutrition1: 'pending', nutrition2: 'pending' };
        setGenerationProgress(newProgress);

        try {
            let updatedClientData = { ...clientData };

            // Generate Routine
            if (type === 'full' || type === 'routine') {
                newProgress.routine = 'loading';
                setGenerationProgress({ ...newProgress });

                const routinePrompt = generateRoutinePrompt(clientData.profile, exerciseLibrary, adminInstructions.routine);
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const response = await ai.models.generateContent({
                  model: 'gemini-2.5-flash',
                  contents: routinePrompt,
                });
                
                const jsonText = extractJson(response.text);
                if (!jsonText) throw new Error("La IA no devolvió un JSON de rutina válido.");
                const newRoutine: Routine = JSON.parse(jsonText);
                
                updatedClientData.routine = newRoutine;
                updatedClientData.routineGeneratedDate = new Date().toISOString();
                newProgress.routine = 'done';
                setGenerationProgress({ ...newProgress });
            }

            // Generate Nutrition Plan 1
            if (type === 'full' || type === 'nutrition') {
                 newProgress.nutrition1 = 'loading';
                setGenerationProgress({ ...newProgress });
                
                const nutritionPrompt1 = generateNutritionPrompt(clientData.profile, adminInstructions.nutrition, 0);
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const response1 = await ai.models.generateContent({
                  model: 'gemini-2.5-flash',
                  contents: nutritionPrompt1,
                });

                const jsonText1 = extractJson(response1.text);
                if (!jsonText1) throw new Error("La IA no devolvió un JSON de nutrición válido para el plan 1.");
                const newDietPlan1: DietPlan = JSON.parse(jsonText1);
                
                updatedClientData.dietPlans[0] = newDietPlan1;
                newProgress.nutrition1 = 'done';
                setGenerationProgress({ ...newProgress });

                // Generate Nutrition Plan 2
                newProgress.nutrition2 = 'loading';
                setGenerationProgress({ ...newProgress });

                const nutritionPrompt2 = generateNutritionPrompt(clientData.profile, adminInstructions.nutrition, 1);
                const response2 = await ai.models.generateContent({
                  model: 'gemini-2.5-flash',
                  contents: nutritionPrompt2,
                });
                
                const jsonText2 = extractJson(response2.text);
                if (!jsonText2) throw new Error("La IA no devolvió un JSON de nutrición válido para el plan 2.");
                const newDietPlan2: DietPlan = JSON.parse(jsonText2);
                
                updatedClientData.dietPlans[1] = newDietPlan2;
                newProgress.nutrition2 = 'done';
                setGenerationProgress({ ...newProgress });
            }
            
            // Save all generated data
            updatedClientData.planStatus = 'active';
            const success = await apiClient.saveClientData(dni, updatedClientData);
            if (!success) throw new Error("No se pudieron guardar los planes generados en la base de datos.");

            setClientData(updatedClientData);

        } catch (err: any) {
            console.error("Error en la generación del plan:", err);
            setGenerationError(err.message || "Ocurrió un error desconocido durante la generación.");
             const currentProgress = { ...generationProgress };
            if (currentProgress.routine === 'loading') currentProgress.routine = 'error';
            if (currentProgress.nutrition1 === 'loading') currentProgress.nutrition1 = 'error';
            if (currentProgress.nutrition2 === 'loading') currentProgress.nutrition2 = 'error';
            setGenerationProgress(currentProgress);

        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleEnableGeneration = async () => {
        const success = await apiClient.enablePlanGeneration(dni);
        if (success) {
            // Refetch client data to update the view
            const data = await apiClient.getClientData(dni);
            if (data) setClientData(data);
        } else {
            alert("No se pudo habilitar la generación del plan.");
        }
    };


    if (isLoading) return <div className="loading-container"><Spinner /></div>;
    if (error) return <div className="error-container"><p>{error}</p><button onClick={onBack} className="back-button">Volver</button></div>;
    if (!clientData) return <div className="error-container"><p>Cliente no encontrado.</p><button onClick={onBack} className="back-button">Volver</button></div>;

    const profile = clientData.profile;
    const { weight, height } = profile;
    const healthyWeightRange = calculateHealthyWeightRange(parseFloat(height));

    const isPlanGenerationAllowed = clientData.planStatus === 'pending';

    return (
        <div className="client-management-view animated-fade-in">
            <header className="main-header">
                <div className="header-title-wrapper">
                    {gym.logoSvg && <div className="app-logo"><img src={gym.logoSvg} alt={`${gym.name} Logo`} style={{ maxWidth: '100%', maxHeight: '100%' }} /></div>}
                    <div>
                        <h1>{profile.name || 'Cliente sin nombre'}</h1>
                        <p>DNI: {clientData.dni}</p>
                    </div>
                </div>
                 <button onClick={onBack} className="back-button">Volver a la Lista</button>
            </header>

            <div className="dashboard-grid">
                <aside className="profile-section">
                    <h2>Perfil del Cliente</h2>
                    <form className="profile-form">
                        <div className="form-group">
                            <label htmlFor="name">Nombre Completo</label>
                            <input id="name" type="text" value={profile.name} onChange={e => handleProfileChange('name', e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div className="form-group">
                                <label htmlFor="age">Edad</label>
                                <input id="age" type="number" value={profile.age} onChange={e => handleProfileChange('age', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="gender">Género</label>
                                <select id="gender" value={profile.gender} onChange={e => handleProfileChange('gender', e.target.value)}>
                                    <option>Masculino</option>
                                    <option>Femenino</option>
                                    <option>Prefiero no decirlo</option>
                                </select>
                            </div>
                        </div>
                         <div style={{ display: 'flex', gap: '1rem' }}>
                            <div className="form-group">
                                <label htmlFor="weight">Peso (kg)</label>
                                <input id="weight" type="number" value={profile.weight} onChange={e => handleProfileChange('weight', e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="height">Altura (cm)</label>
                                <input id="height" type="number" value={profile.height} onChange={e => handleProfileChange('height', e.target.value)} />
                            </div>
                        </div>
                        {parseFloat(weight) > 0 && parseFloat(height) > 0 && (
                           <>
                                <BMIDisplay weight={parseFloat(weight)} height={parseFloat(height)} view="admin" />
                                <div className="target-weight-info">
                                    <strong>Peso saludable:</strong> {healthyWeightRange}
                                </div>
                           </>
                        )}
                        <div className="form-group">
                            <label htmlFor="level">Nivel de Experiencia</label>
                            <select id="level" value={profile.level} onChange={e => handleProfileChange('level', e.target.value)}>
                                <option>Principiante</option>
                                <option>Intermedio</option>
                                <option>Avanzado</option>
                            </select>
                        </div>
                         <div className="form-group">
                            <label htmlFor="goal">Objetivo Principal</label>
                            <select id="goal" value={profile.goal} onChange={e => handleProfileChange('goal', e.target.value)}>
                                <option>Hipertrofia</option>
                                <option>Pérdida de grasa</option>
                                <option>Mantenimiento</option>
                                <option>Resistencia</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="trainingDays">Días de Entrenamiento / Semana</label>
                            <input id="trainingDays" type="number" min="1" max="7" value={profile.trainingDays} onChange={e => handleProfileChange('trainingDays', e.target.value)} />
                        </div>
                        
                        <div className="access-code-display">
                            <span>Código de Acceso del Cliente</span>
                            <strong>{clientData.accessCode}</strong>
                        </div>
                        
                        {!isPlanGenerationAllowed && (
                            <button type="button" onClick={handleEnableGeneration} className="cta-button secondary enable-generation-button">
                                Habilitar Nueva Generación
                            </button>
                        )}
                    </form>
                </aside>

                <main className="main-content">
                    <div className="actions-bar">
                         <h2 style={{ margin: 0 }}>Planes del Cliente</h2>
                         <button onClick={handleSaveChanges} disabled={isSaving || saveStatus === 'saved'} className={`save-changes-button ${saveStatus}`}>
                            {isSaving ? <><Spinner size="small" /> Guardando...</> : saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Cambios'}
                         </button>
                    </div>

                    {isPlanGenerationAllowed ? (
                        <PlanGenerationView 
                            onGenerate={handleGeneratePlan} 
                            isGenerating={isGenerating} 
                            generationError={generationError}
                            generationProgress={generationProgress}
                            adminInstructions={adminInstructions}
                            setAdminInstructions={setAdminInstructions}
                            planType={clientData.planType || 'full'}
                        />
                    ) : (
                       <>
                            <nav className="main-tabs-nav">
                                {(clientData.planType === 'full' || clientData.planType === 'routine') &&
                                    <button className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>
                                        Rutina
                                    </button>
                                }
                                {(clientData.planType === 'full' || clientData.planType === 'nutrition') &&
                                    <button className={`main-tab-button ${activeTab === 'nutrition' ? 'active' : ''}`} onClick={() => setActiveTab('nutrition')}>
                                        Nutrición
                                    </button>
                                }
                            </nav>
                            
                            <div className="results-section">
                                {activeTab === 'routine' && (
                                     clientData.routine ? (
                                        <RoutinePlan 
                                            routine={clientData.routine} 
                                            isEditable={true} 
                                            onRoutineChange={handleRoutineChange}
                                            exerciseLibrary={exerciseLibrary}
                                        />
                                    ) : (
                                        <div className="placeholder">
                                            <p>No se ha generado ninguna rutina para este cliente.</p>
                                        </div>
                                    )
                                )}

                                {activeTab === 'nutrition' && (
                                     (clientData.dietPlans && (clientData.dietPlans[0] || clientData.dietPlans[1])) ? (
                                        <DietPlanView dietPlans={clientData.dietPlans} />
                                    ) : (
                                         <div className="placeholder">
                                            <p>No se han generado planes de nutrición para este cliente.</p>
                                        </div>
                                    )
                                )}
                            </div>
                       </>
                    )}
                </main>
            </div>
        </div>
    );
};

/**
 * PlanGenerationView: Component for the initial plan generation interface.
 */
const PlanGenerationView = ({ onGenerate, isGenerating, generationError, generationProgress, adminInstructions, setAdminInstructions, planType }: {
    onGenerate: (type: PlanType) => void,
    isGenerating: boolean,
    generationError: string,
    generationProgress: { routine: string; nutrition1: string; nutrition2: string },
    adminInstructions: { routine: string; nutrition: string },
    setAdminInstructions: (instructions: { routine: string; nutrition: string }) => void,
    planType: PlanType
}) => {
    
    if (isGenerating || generationError) {
        return (
             <div className="loading-container">
                {isGenerating && <Spinner />}
                <h2>{isGenerating ? 'Generando planes, por favor espera...' : 'Error en la Generación'}</h2>
                <p>{isGenerating ? 'Este proceso puede tardar hasta 2 minutos.' : ''}</p>
                <div className="generation-progress-list">
                    {(planType === 'full' || planType === 'routine') && <ProgressItem label="Rutina de Entrenamiento" status={generationProgress.routine} />}
                    {(planType === 'full' || planType === 'nutrition') && <ProgressItem label="Plan Nutricional Principal" status={generationProgress.nutrition1} />}
                    {(planType === 'full' || planType === 'nutrition') && <ProgressItem label="Plan Nutricional Alternativo" status={generationProgress.nutrition2} />}
                </div>
                {generationError && <div className="error-container" style={{ width: '100%', marginTop: '1rem' }}>{generationError}</div>}
             </div>
        )
    }
    
    return (
        <div className="placeholder-action">
            <h3>Este cliente aún no tiene un plan.</h3>
            <p>Revisa y ajusta el perfil del cliente a la izquierda, luego genera su plan personalizado.</p>

            <div className="generation-container">
                 {(planType === 'full' || planType === 'routine') && (
                     <div className="admin-instructions-box">
                        <label htmlFor="routine-instructions">Instrucciones Adicionales para la Rutina (Opcional)</label>
                        <textarea
                            id="routine-instructions"
                            rows={3}
                            placeholder="Ej: Evitar sentadillas por dolor de rodilla. Enfocar más en hombro lateral."
                            value={adminInstructions.routine}
                            onChange={(e) => setAdminInstructions({ ...adminInstructions, routine: e.target.value })}
                        />
                    </div>
                 )}
                 {(planType === 'full' || planType === 'nutrition') && (
                    <div className="admin-instructions-box">
                        <label htmlFor="nutrition-instructions">Instrucciones Adicionales para la Nutrición (Opcional)</label>
                        <textarea
                            id="nutrition-instructions"
                            rows={3}
                            placeholder="Ej: Cliente es intolerante a la lactosa. Prefiere comidas rápidas de preparar."
                            value={adminInstructions.nutrition}
                            onChange={(e) => setAdminInstructions({ ...adminInstructions, nutrition: e.target.value })}
                        />
                    </div>
                )}
            </div>
            <button
                className="cta-button"
                onClick={() => onGenerate(planType)}
                disabled={isGenerating}
            >
                {isGenerating ? 'Generando...' : `Generar Plan ${planType === 'full' ? 'Completo' : planType === 'routine' ? 'de Rutina' : 'de Nutrición'}`}
            </button>
        </div>
    );
};

const ProgressItem = ({ label, status }: { label: string; status: string }) => {
    const getIcon = () => {
        switch (status) {
            case 'pending': return <span className="status-icon pending">●</span>;
            case 'loading': return <Spinner size="small" />;
            case 'done': return <span className="status-icon success">✔</span>;
            case 'error': return <span className="status-icon error">✖</span>;
            default: return null;
        }
    };
    return (
        <div className={`progress-item ${status}`}>
            {getIcon()}
            <span>{label}</span>
        </div>
    );
};


/**
 * RoutinePlan: Displays the generated workout routine with tabs for phases and days.
 */
const RoutinePlan = ({ routine, isEditable, onRoutineChange, exerciseLibrary }: { routine: Routine, isEditable: boolean, onRoutineChange?: (updatedRoutine: Routine) => void, exerciseLibrary: ExerciseLibrary }) => {
    
    // Find the first phase that has days, otherwise default to 0
    const initialPhaseIndex = Math.max(0, routine.phases.findIndex(p => p.routine && p.routine.dias && p.routine.dias.length > 0));
    
    const [activePhaseIndex, setActivePhaseIndex] = useState(initialPhaseIndex);
    const [activeDayIndex, setActiveDayIndex] = useState(0);

    // Effect to reset day index when phase changes
    useEffect(() => {
        setActiveDayIndex(0);
    }, [activePhaseIndex]);

    const activePhase = routine.phases[activePhaseIndex];
    
    // Guard against undefined or empty days array
    const activeDay = activePhase?.routine?.dias?.[activeDayIndex];

    const handleExerciseChange = (phaseIndex: number, dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string) => {
        if (!onRoutineChange) return;

        const updatedRoutine = JSON.parse(JSON.stringify(routine)); // Deep copy
        const exercise = updatedRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios[exerciseIndex];
        
        if (field === 'nombre') {
             // Find the new exercise in the library to potentially get a new video URL
            let newVideoUrl = '';
            for (const group in exerciseLibrary) {
                const foundEx = exerciseLibrary[group].find(ex => ex.name === value);
                if (foundEx) {
                    newVideoUrl = foundEx.videoUrl;
                    break;
                }
            }
            exercise.nombre = value;
            exercise.videoUrl = newVideoUrl;
        } else {
             (exercise as any)[field] = value;
        }

        onRoutineChange(updatedRoutine);
    };

    const handleAddExercise = (phaseIndex: number, dayIndex: number) => {
        if (!onRoutineChange) return;
        const updatedRoutine = JSON.parse(JSON.stringify(routine));
        const newExercise: Exercise = {
            nombre: '',
            series: '3',
            repeticiones: '10-12',
            descanso: '60s',
            tecnicaAvanzada: '',
            videoUrl: ''
        };
        updatedRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.push(newExercise);
        onRoutineChange(updatedRoutine);
    };
    
    const handleDeleteExercise = (phaseIndex: number, dayIndex: number, exerciseIndex: number) => {
        if (!onRoutineChange) return;
        const updatedRoutine = JSON.parse(JSON.stringify(routine));
        updatedRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.splice(exerciseIndex, 1);
        onRoutineChange(updatedRoutine);
    };

    if (!routine || !routine.phases || routine.phases.length === 0) {
        return <div className="placeholder"><p>No hay una rutina para mostrar.</p></div>;
    }

    return (
        <div className={`plan-container ${isEditable ? 'editable' : ''}`}>
             <div className="plan-header">
                <h2>{routine.planName}</h2>
                <p>Duración Total: {routine.totalDurationWeeks} semanas</p>
            </div>
            
            <AccordionPhases
                routine={routine}
                activePhaseIndex={activePhaseIndex}
                setActivePhaseIndex={setActivePhaseIndex}
            >
                {activePhase && activePhase.routine && activePhase.routine.dias && activePhase.routine.dias.length > 0 ? (
                   <>
                        <div className="day-tabs-nav">
                            {activePhase.routine.dias.map((day, index) => (
                                <button
                                    key={index}
                                    className={`day-tab-button ${index === activeDayIndex ? 'active' : ''}`}
                                    onClick={() => setActiveDayIndex(index)}
                                >
                                    {day.dia}
                                </button>
                            ))}
                        </div>
                        {activeDay && (
                            <DayCard 
                                day={activeDay}
                                isEditable={isEditable}
                                onExerciseChange={(exerciseIndex, field, value) => handleExerciseChange(activePhaseIndex, activeDayIndex, exerciseIndex, field, value)}
                                onAddExercise={() => handleAddExercise(activePhaseIndex, activeDayIndex)}
                                onDeleteExercise={(exerciseIndex) => handleDeleteExercise(activePhaseIndex, activeDayIndex, exerciseIndex)}
                                exerciseLibrary={exerciseLibrary}
                            />
                        )}
                   </>
                ) : (
                    <div className="placeholder" style={{marginTop: '1rem'}}><p>No hay días de entrenamiento definidos para esta fase.</p></div>
                )}
            </AccordionPhases>
        </div>
    );
};

const AccordionPhases = ({ routine, activePhaseIndex, setActivePhaseIndex, children }: { routine: Routine, activePhaseIndex: number, setActivePhaseIndex: (index: number) => void, children: React.ReactNode }) => {
    return (
        <div className="accordion-phases">
            {routine.phases.map((phase, index) => (
                <div key={index} className="accordion-item">
                    <button 
                        className={`accordion-header ${index === activePhaseIndex ? 'active' : ''}`}
                        onClick={() => setActivePhaseIndex(index === activePhaseIndex ? -1 : index)}
                        aria-expanded={index === activePhaseIndex}
                    >
                        <span>{phase.phaseName} ({phase.durationWeeks} Semanas)</span>
                        <span className="accordion-header-icon">+</span>
                    </button>
                    <div className={`accordion-content ${index === activePhaseIndex ? 'open' : ''}`}>
                        {index === activePhaseIndex && children}
                    </div>
                </div>
            ))}
        </div>
    );
};


const DayCard = ({ day, isEditable, onExerciseChange, onAddExercise, onDeleteExercise, exerciseLibrary }: { 
    day: DayPlan, 
    isEditable: boolean,
    onExerciseChange?: (exerciseIndex: number, field: keyof Exercise, value: string) => void,
    onAddExercise?: () => void,
    onDeleteExercise?: (exerciseIndex: number) => void,
    exerciseLibrary: ExerciseLibrary
}) => {
    
    return (
        <div className="day-card animated-fade-in">
            <h3>Día de <span className="muscle-group">{day.grupoMuscular}</span></h3>
            <ul className="exercise-list">
                {day.ejercicios.map((ex, index) => (
                    <li key={index}>
                        {isEditable && onExerciseChange && onDeleteExercise ? (
                             <ExerciseEditor
                                exercise={ex}
                                exerciseIndex={index}
                                onExerciseChange={onExerciseChange}
                                onDeleteExercise={onDeleteExercise}
                                exerciseLibrary={exerciseLibrary}
                            />
                        ) : (
                           <ExerciseItemViewer exercise={ex} />
                        )}
                    </li>
                ))}
            </ul>
             {isEditable && onAddExercise && (
                <div className="add-exercise-action">
                    <button className="add-exercise-button" onClick={onAddExercise}>
                        + Añadir Ejercicio
                    </button>
                </div>
            )}
            {day.cardio && (
                <div className="cardio-note">
                    <h4>Cardio:</h4>
                    <p>{day.cardio}</p>
                </div>
            )}
        </div>
    );
};

const ExerciseItemViewer = ({ exercise }: { exercise: Exercise }) => {
    const [showVideo, setShowVideo] = useState(false);

    return (
        <div className="exercise-item">
            <div className="exercise-name-wrapper">
                <span className="exercise-name">{exercise.nombre}</span>
                {exercise.videoUrl && (
                    <button onClick={() => setShowVideo(true)} className="video-play-button" aria-label={`Ver video de ${exercise.nombre}`}>
                        <VideoIcon />
                    </button>
                )}
            </div>
            <div className="exercise-details">
                <span><strong>Series:</strong> {exercise.series}</span>
                <span><strong>Reps:</strong> {exercise.repeticiones}</span>
                <span><strong>Descanso:</strong> {exercise.descanso}</span>
            </div>
            {exercise.tecnicaAvanzada && (
                <div className="advanced-technique">
                    <span>🔥</span> {exercise.tecnicaAvanzada}
                </div>
            )}
            {showVideo && <VideoPlayer url={exercise.videoUrl!} onClose={() => setShowVideo(false)} />}
        </div>
    );
};

const VideoPlayer = ({ url, onClose }: { url: string; onClose: () => void }) => {
    return (
        <div className="video-modal-overlay" onClick={onClose}>
            <div className="video-modal-content" onClick={e => e.stopPropagation()}>
                <button className="video-modal-close-btn" onClick={onClose}>&times;</button>
                <video src={url} controls autoPlay onEnded={onClose} onError={() => alert('No se pudo cargar el video.')}>
                    Tu navegador no soporta la etiqueta de video.
                </video>
            </div>
        </div>
    );
};


const ExerciseEditor = ({ exercise, exerciseIndex, onExerciseChange, onDeleteExercise, exerciseLibrary }: { 
    exercise: Exercise,
    exerciseIndex: number,
    onExerciseChange: (exerciseIndex: number, field: keyof Exercise, value: string) => void,
    onDeleteExercise: (exerciseIndex: number) => void,
    exerciseLibrary: ExerciseLibrary
}) => {
    const allExercises = useMemo(() => {
        const flatList: { name: string; group: string }[] = [];
        for (const group in exerciseLibrary) {
            exerciseLibrary[group].forEach(ex => {
                if (ex.isEnabled) {
                    flatList.push({ name: ex.name, group: group });
                }
            });
        }
        return flatList.sort((a, b) => a.name.localeCompare(b.name));
    }, [exerciseLibrary]);

    return (
        <div className="exercise-item editable">
            <div className="exercise-item-editor">
                 <div className="editor-row editor-row-main">
                    <select
                        className="exercise-select"
                        value={exercise.nombre}
                        onChange={(e) => onExerciseChange(exerciseIndex, 'nombre', e.target.value)}
                    >
                        <option value="">-- Seleccionar Ejercicio --</option>
                        {allExercises.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
                    </select>
                    <button className="delete-exercise-btn" onClick={() => onDeleteExercise(exerciseIndex)} aria-label="Eliminar ejercicio">&times;</button>
                </div>
                <div className="editor-row">
                    <div className="form-group-inline">
                        <label>Series</label>
                        <input type="text" value={exercise.series} onChange={(e) => onExerciseChange(exerciseIndex, 'series', e.target.value)} />
                    </div>
                     <div className="form-group-inline">
                        <label>Repeticiones</label>
                        <input type="text" value={exercise.repeticiones} onChange={(e) => onExerciseChange(exerciseIndex, 'repeticiones', e.target.value)} />
                    </div>
                     <div className="form-group-inline">
                        <label>Descanso</label>
                        <input type="text" value={exercise.descanso} onChange={(e) => onExerciseChange(exerciseIndex, 'descanso', e.target.value)} />
                    </div>
                </div>
                <div className="editor-row">
                     <div className="form-group-inline full-width">
                        <label>Técnica Avanzada (Opcional)</label>
                        <select
                            value={exercise.tecnicaAvanzada || ''}
                            onChange={(e) => onExerciseChange(exerciseIndex, 'tecnicaAvanzada', e.target.value)}
                        >
                            {advancedTechniqueOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};


/**
 * DietPlanView: Displays the generated nutrition plans.
 */
const DietPlanView = ({ dietPlans }: { dietPlans: (DietPlan | null)[] }) => {
    const [activePlanIndex, setActivePlanIndex] = useState(0);

    const activePlan = dietPlans[activePlanIndex];
    const hasMultiplePlans = dietPlans.filter(p => p !== null).length > 1;

    if (!activePlan) {
        return <div className="placeholder"><p>No hay un plan de nutrición disponible.</p></div>
    }

    return (
        <div className="diet-plan-container">
            <div className="plan-header">
                <h2>{activePlan.planTitle}</h2>
                {hasMultiplePlans && (
                    <div className="day-tabs-nav">
                        <button className={`day-tab-button ${activePlanIndex === 0 ? 'active' : ''}`} onClick={() => setActivePlanIndex(0)}>Opción 1</button>
                        <button className={`day-tab-button ${activePlanIndex === 1 ? 'active' : ''}`} onClick={() => setActivePlanIndex(1)}>Opción 2</button>
                    </div>
                )}
            </div>

            <div className="diet-summary">
                <div><strong>Calorías</strong> {activePlan.summary.totalCalories} kcal</div>
                <div><strong>Proteínas</strong> {activePlan.summary.macronutrients.proteinGrams}g</div>
                <div><strong>Carbohidratos</strong> {activePlan.summary.macronutrients.carbsGrams}g</div>
                <div><strong>Grasas</strong> {activePlan.summary.macronutrients.fatGrams}g</div>
            </div>
            
             <div className="meals-grid">
                {activePlan.meals.map((meal, index) => (
                    <div key={index} className="meal-card">
                        <h3>{meal.mealName}</h3>
                        <ul>
                            {meal.foodItems.map((item, itemIndex) => (
                                <li key={itemIndex}>
                                    <span>{item.food}</span>
                                    <strong>{item.amount}</strong>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {activePlan.recommendations && activePlan.recommendations.length > 0 && (
                <div className="recommendations-section">
                    <h4>Recomendaciones</h4>
                     <ul>
                        {activePlan.recommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

/**
 * ExerciseLibraryManager: Component for managing the gym's exercise library.
 */
const ExerciseLibraryManager = ({ gymId, onBack }: { gymId: string, onBack: () => void }) => {
    const [library, setLibrary] = useState<ExerciseLibrary>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

    // For adding a new exercise
    const [newExName, setNewExName] = useState('');
    const [newExGroup, setNewExGroup] = useState('');
    const [newExVideoUrl, setNewExVideoUrl] = useState('');
    const [customGroup, setCustomGroup] = useState('');

    // For editing an exercise
    const [editingEx, setEditingEx] = useState<{ group: string; index: number } | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingVideoUrl, setEditingVideoUrl] = useState('');
    
    // For accordion
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

    const muscleGroups = useMemo(() => {
        const groups = Object.keys(library).sort();
        return ['Pecho', 'Espalda', 'Hombros', 'Cuádriceps', 'Femorales e Isquiotibiales', 'Glúteos', 'Gemelos y Sóleos', 'Aductores y Abductores', 'Abdominales', 'Brazos (Bíceps y Tríceps)', 'Cardio y Cuerpo Completo']
            .filter(g => groups.includes(g))
            .concat(groups.filter(g => !['Pecho', 'Espalda', 'Hombros', 'Cuádriceps', 'Femorales e Isquiotibiales', 'Glúteos', 'Gemelos y Sóleos', 'Aductores y Abductores', 'Abdominales', 'Brazos (Bíceps y Tríceps)', 'Cardio y Cuerpo Completo'].includes(g)));
    }, [library]);

    useEffect(() => {
        const fetchLibrary = async () => {
            setIsLoading(true);
            const lib = await apiClient.getExerciseLibrary(gymId);
            setLibrary(lib);
            setIsLoading(false);
            // Open the first group by default
            const firstGroup = Object.keys(lib)[0];
            if (firstGroup) {
                setOpenGroups(new Set([firstGroup]));
            }
        };
        fetchLibrary();
    }, [gymId]);
    
    const handleLibraryChange = (updatedLibrary: ExerciseLibrary) => {
        setLibrary(updatedLibrary);
        setSaveStatus('idle');
    };

    const handleSaveLibrary = async () => {
        setIsSaving(true);
        const success = await apiClient.saveExerciseLibrary(library, gymId);
        setIsSaving(false);
        if (success) {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            alert('Error al guardar la biblioteca de ejercicios.');
        }
    };
    
    const toggleExerciseEnabled = (group: string, index: number) => {
        const updatedLibrary = JSON.parse(JSON.stringify(library));
        updatedLibrary[group][index].isEnabled = !updatedLibrary[group][index].isEnabled;
        handleLibraryChange(updatedLibrary);
    };

    const handleAddExercise = (e: React.FormEvent) => {
        e.preventDefault();
        const group = newExGroup === 'CUSTOM' ? customGroup : newExGroup;
        if (!newExName || !group) {
            alert("El nombre del ejercicio y el grupo muscular son obligatorios.");
            return;
        }

        const newExercise: ExerciseDefinition = {
            name: newExName.trim(),
            isEnabled: true,
            videoUrl: newExVideoUrl.trim()
        };

        const updatedLibrary = JSON.parse(JSON.stringify(library));
        if (!updatedLibrary[group]) {
            updatedLibrary[group] = [];
        }
        updatedLibrary[group].push(newExercise);
        
        // Sort exercises within the group alphabetically
        updatedLibrary[group].sort((a: ExerciseDefinition, b: ExerciseDefinition) => a.name.localeCompare(b.name));

        handleLibraryChange(updatedLibrary);

        // Reset form
        setNewExName('');
        setNewExVideoUrl('');
        setNewExGroup('');
        setCustomGroup('');
    };
    
    const startEditing = (group: string, index: number) => {
        setEditingEx({ group, index });
        setEditingName(library[group][index].name);
        setEditingVideoUrl(library[group][index].videoUrl);
    };

    const cancelEditing = () => {
        setEditingEx(null);
        setEditingName('');
        setEditingVideoUrl('');
    };

    const saveEditing = () => {
        if (!editingEx) return;
        const { group, index } = editingEx;
        const updatedLibrary = JSON.parse(JSON.stringify(library));
        updatedLibrary[group][index].name = editingName;
        updatedLibrary[group][index].videoUrl = editingVideoUrl;
        
        // Re-sort if name changed
        updatedLibrary[group].sort((a: ExerciseDefinition, b: ExerciseDefinition) => a.name.localeCompare(b.name));

        handleLibraryChange(updatedLibrary);
        cancelEditing();
    };

    const handleDeleteExercise = (group: string, index: number) => {
        if (window.confirm(`¿Seguro que quieres eliminar el ejercicio "${library[group][index].name}"?`)) {
            const updatedLibrary = JSON.parse(JSON.stringify(library));
            updatedLibrary[group].splice(index, 1);
            // If the group becomes empty, remove it
            if (updatedLibrary[group].length === 0) {
                delete updatedLibrary[group];
            }
            handleLibraryChange(updatedLibrary);
        }
    };
    
    const toggleGroup = (group: string) => {
        const newOpenGroups = new Set(openGroups);
        if (newOpenGroups.has(group)) {
            newOpenGroups.delete(group);
        } else {
            newOpenGroups.add(group);
        }
        setOpenGroups(newOpenGroups);
    };

    if (isLoading) {
        return <div className="loading-container"><Spinner /></div>;
    }

    return (
        <div className="library-container">
            <header className="main-header">
                <div className="header-title-wrapper">
                    <h1>Biblioteca de Ejercicios</h1>
                </div>
                 <div className="admin-header-nav">
                    <button onClick={handleSaveLibrary} disabled={isSaving || saveStatus === 'saved'} className="save-changes-button" style={{position: 'static'}}>
                         {isSaving ? <><Spinner size="small" /> Guardando...</> : saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Cambios'}
                    </button>
                    <button onClick={onBack} className="back-button">Volver</button>
                </div>
            </header>

            <div className="library-instructions">
                <p>Gestiona los ejercicios disponibles para la generación de rutinas. Puedes añadir, editar, eliminar y activar/desactivar ejercicios. Los cambios se aplicarán a las futuras rutinas generadas.</p>
            </div>
            
             <div className="add-exercise-container">
                <h3>Añadir Nuevo Ejercicio</h3>
                <form onSubmit={handleAddExercise} className="add-exercise-form">
                    <input type="text" placeholder="Nombre del Ejercicio" value={newExName} onChange={e => setNewExName(e.target.value)} required />
                    <input type="text" placeholder="URL del Video (Opcional)" value={newExVideoUrl} onChange={e => setNewExVideoUrl(e.target.value)} />
                    <select value={newExGroup} onChange={e => setNewExGroup(e.target.value)} required>
                        <option value="">-- Grupo Muscular --</option>
                        {muscleGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        <option value="CUSTOM">-- Otro (Nuevo Grupo) --</option>
                    </select>
                    {newExGroup === 'CUSTOM' && (
                        <input type="text" placeholder="Nombre del Nuevo Grupo" value={customGroup} onChange={e => setCustomGroup(e.target.value)} required />
                    )}
                    <button type="submit" disabled={isSaving}>Añadir</button>
                </form>
            </div>
            
            <div className="library-accordion">
                {muscleGroups.map(group => (
                    <div key={group} className="library-accordion-item">
                        <button className={`library-accordion-header ${openGroups.has(group) ? 'active' : ''}`} onClick={() => toggleGroup(group)}>
                           {group} ({library[group].length})
                           <span className="icon">+</span>
                        </button>
                         <div className={`library-accordion-content ${openGroups.has(group) ? 'open' : ''}`}>
                            <div className="exercise-entry-list">
                                <div className="exercise-entry-header">
                                    <span>Activado</span>
                                    <span>Nombre del Ejercicio</span>
                                    <span>URL Video</span>
                                    <span>Acciones</span>
                                </div>
                                {library[group].map((ex, index) => (
                                    <div key={index} className="exercise-entry-row">
                                        <label className="switch" aria-label={`Activar o desactivar ${ex.name}`}>
                                            <input type="checkbox" checked={ex.isEnabled} onChange={() => toggleExerciseEnabled(group, index)} />
                                            <span className="slider round"></span>
                                        </label>
                                        
                                        {editingEx?.group === group && editingEx?.index === index ? (
                                            <input type="text" value={editingName} onChange={e => setEditingName(e.target.value)} className="editing-input" />
                                        ) : (
                                            <span className="exercise-name-lib">{ex.name}</span>
                                        )}
                                        
                                        {editingEx?.group === group && editingEx?.index === index ? (
                                             <input type="text" value={editingVideoUrl} onChange={e => setEditingVideoUrl(e.target.value)} className="editing-input" />
                                        ) : (
                                             <a href={ex.videoUrl} target="_blank" rel="noopener noreferrer" className={`video-url-display ${!ex.videoUrl ? 'disabled' : ''}`} onClick={(e) => !ex.videoUrl && e.preventDefault()}>
                                                {ex.videoUrl ? 'Ver Video' : 'Sin video'}
                                            </a>
                                        )}

                                        <div className="exercise-row-actions">
                                             {editingEx?.group === group && editingEx?.index === index ? (
                                                <>
                                                    <button className="action-btn save" onClick={saveEditing}>Guardar</button>
                                                    <button className="action-btn cancel" onClick={cancelEditing}>Cancelar</button>
                                                </>
                                             ) : (
                                                <>
                                                    <button className="action-btn edit" onClick={() => startEditing(group, index)}>Editar</button>
                                                    <button className="action-btn delete" onClick={() => handleDeleteExercise(group, index)}>Eliminar</button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

        </div>
    );
};

const RequestManager = ({ gymId, requests, onBack, onUpdateRequest }: { 
    gymId: string, 
    requests: TrainerRequest[], 
    onBack: () => void,
    onUpdateRequest: () => void 
}) => {
    
    const handleUpdateStatus = async (id: string, status: 'read' | 'resolved') => {
        await apiClient.updateRequestStatus(id, status);
        onUpdateRequest();
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("¿Seguro que quieres eliminar esta solicitud?")) {
            await apiClient.deleteRequest(id);
            onUpdateRequest();
        }
    };
    
    const sortedRequests = useMemo(() => {
        const statusOrder = { 'new': 1, 'read': 2, 'resolved': 3 };
        return [...requests].sort((a, b) => {
            // Sort by status first
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            // Then by date (newest first)
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [requests]);

    return (
        <div className="library-container">
             <header className="main-header">
                <div className="header-title-wrapper">
                    <h1>Solicitudes de Clientes</h1>
                </div>
                 <button onClick={onBack} className="back-button">Volver</button>
            </header>
            
            <div className="library-instructions">
                <p>Aquí puedes ver las solicitudes de cambios o preguntas de tus clientes. Márcalas como leídas o resueltas para mantener un seguimiento.</p>
            </div>

            <div className="requests-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {sortedRequests.length > 0 ? sortedRequests.map(req => (
                    <div key={req._id} className="request-card" style={{
                        backgroundColor: 'var(--surface-color)',
                        padding: '1.5rem',
                        borderRadius: '10px',
                        borderLeft: `4px solid ${req.status === 'new' ? 'var(--primary-color)' : req.status === 'read' ? 'var(--archive-color)' : 'var(--border-color)'}`
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--text-color)' }}>{req.subject}</h3>
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary-color)', margin: '0.25rem 0 0 0' }}>
                                    De: {req.clientName} (DNI: {req.clientId}) - {formatDate(req.createdAt)}
                                </p>
                            </div>
                            <span className={`client-status-badge ${req.status}`} style={{textTransform: 'capitalize', backgroundColor: req.status === 'new' ? 'var(--primary-color)' : req.status === 'read' ? 'var(--archive-color)' : 'var(--secondary-button-color)'}}>
                                {req.status === 'new' ? 'Nuevo' : req.status === 'read' ? 'Leído' : 'Resuelto'}
                            </span>
                        </div>
                        <p style={{ margin: '0 0 1.5rem 0', whiteSpace: 'pre-wrap' }}>{req.message}</p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                           {req.status === 'new' && <button className="action-btn" onClick={() => handleUpdateStatus(req._id, 'read')}>Marcar como Leído</button>}
                           {req.status !== 'resolved' && <button className="action-btn save" onClick={() => handleUpdateStatus(req._id, 'resolved')}>Marcar como Resuelto</button>}
                           <button className="action-btn delete" onClick={() => handleDelete(req._id)}>Eliminar</button>
                        </div>
                    </div>
                )) : (
                     <div className="placeholder" style={{padding: '2rem'}}>
                        <p>No hay solicitudes pendientes.</p>
                    </div>
                )}
            </div>
        </div>
    );
};



/**
 * LandingView: The initial screen for the app, letting user choose their role.
 */
const LandingView = ({ onSelectRole }: { onSelectRole: (role: 'admin' | 'client') => void }) => (
    <div className="login-container landing-view">
        <header>
            <div className="app-logo">
                 <svg viewBox="0 0 205 250" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M148.911 250C163.333 250 172.062 235.12 165.719 221.921L120.787 138.318C114.869 125.968 115.101 111.446 121.344 98.986L199.303 14.8633C208.995 1.09334 196.47 -7.7818 181.721 5.91823L101.996 79.4057C89.5936 90.9669 71.071 90.8143 58.8354 79.088L18.4284 43.109C-0.74104 25.811 -12.4276 53.303 9.47954 65.594L90.0076 120.672C101.455 128.485 106.602 142.176 104.28 155.654L89.4124 239.527C86.7208 255.086 101.528 262.193 110.154 250.384L124.938 229.083C128.529 223.731 135.597 222.093 141.678 224.621L148.911 250Z" fill="#E50914"/>
                    <path d="M53.8475 0C39.4255 0 30.6974 14.8797 37.0407 28.079L81.9723 111.682C87.8906 124.032 87.6591 138.554 81.416 151.014L3.4572 235.137C-6.23438 248.907 6.28828 257.782 21.0372 244.082L100.762 170.594C113.165 159.033 131.687 159.186 143.923 170.912L184.33 206.891C203.5 224.189 215.186 196.697 193.279 184.406L112.751 129.328C101.294 121.515 96.157 107.824 98.479 94.346L113.347 10.473C116.038 -5.08602 101.231 -12.1934 92.6052 0.384033L77.821 21.6853C74.2295 27.037 67.1623 28.6749 61.0807 26.147L53.8475 0Z" fill="#E50914"/>
                </svg>
            </div>
            <h1>Bienvenido a ScorpionGYM AI</h1>
            <p className="landing-subtitle">Tu asistente de entrenamiento personalizado.</p>
        </header>
        <div className="landing-actions role-selection">
            <button onClick={() => onSelectRole('client')} className="cta-button">Soy Cliente</button>
            <button onClick={() => onSelectRole('admin')} className="cta-button secondary">Soy Entrenador / Dueño</button>
        </div>
    </div>
);

/**
 * LoginView: Handles both admin and client login forms.
 */
const LoginView = ({ role, onBack, onLoginSuccess }: { role: 'admin' | 'client', onBack: () => void, onLoginSuccess: (data: any, role: 'admin' | 'client') => void }) => {
    const [identifier, setIdentifier] = useState(''); // DNI for client, Username for admin
    const [password, setPassword] = useState(''); // Access code for client, Password for admin
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            if (role === 'admin') {
                const gymData = await apiClient.gymLogin(identifier, password);
                if (gymData) {
                    onLoginSuccess(gymData, 'admin');
                } else {
                    setError('Usuario o contraseña incorrectos.');
                }
            } else { // client
                const clientData = await apiClient.getClientData(identifier);
                 if (clientData && clientData.accessCode === password && (clientData.status === 'active' || clientData.status === undefined)) {
                    onLoginSuccess(clientData, 'client');
                } else if (clientData && clientData.status === 'archived') {
                    setError('Tu cuenta ha sido archivada. Contacta a tu entrenador.');
                }
                else {
                    setError('DNI o código de acceso incorrectos.');
                }
            }
        } catch (err) {
            setError('Ocurrió un error. Por favor, inténtalo de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const title = role === 'admin' ? "Acceso para Entrenadores" : "Acceso para Clientes";
    const identifierLabel = role === 'admin' ? "Usuario" : "DNI";
    const passwordLabel = role === 'admin' ? "Contraseña" : "Código de Acceso";

    return (
        <div className="login-container">
            <div className="login-box">
                <h1>{title}</h1>
                <p>Ingresa tus credenciales para continuar.</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder={identifierLabel}
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        aria-label={identifierLabel}
                    />
                    <input
                        type="password"
                        placeholder={passwordLabel}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        aria-label={passwordLabel}
                    />
                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button" disabled={isLoading}>
                        {isLoading ? <Spinner size="small" /> : 'Ingresar'}
                    </button>
                </form>
            </div>
             <button onClick={onBack} className="back-button simple">Volver</button>
        </div>
    );
};

// --- Views for the Client Portal ---

const ClientPortal = ({ initialClientData, onLogout }: { initialClientData: ClientData, onLogout: () => void }) => {
    const [clientData, setClientData] = useState<ClientData>(initialClientData);
    const [view, setView] = useState<'agreement' | 'onboarding' | 'dashboard'>('dashboard');

    useEffect(() => {
        if (!initialClientData.termsAccepted) {
            setView('agreement');
        } else if (!initialClientData.profile.name || !initialClientData.profile.weight) {
            setView('onboarding');
        } else {
            setView('dashboard');
        }
    }, [initialClientData]);
    
    const handleAcceptTerms = async () => {
        const updatedData = { ...clientData, termsAccepted: true };
        const success = await apiClient.saveClientData(clientData.dni, { termsAccepted: true });
        if (success) {
            setClientData(updatedData);
            if (!updatedData.profile.name || !updatedData.profile.weight) {
                setView('onboarding');
            } else {
                setView('dashboard');
            }
        } else {
            alert("No se pudieron guardar los cambios. Inténtalo de nuevo.");
        }
    };
    
    const handleOnboardingComplete = async (updatedProfile: Profile) => {
        const updatedData = { ...clientData, profile: updatedProfile };
        const success = await apiClient.saveClientData(clientData.dni, { profile: updatedProfile });
        if (success) {
            setClientData(updatedData);
            setView('dashboard');
        } else {
            alert("No se pudieron guardar tus datos. Inténtalo de nuevo.");
        }
    };
    
     const handleClientDataUpdate = (updatedData: ClientData) => {
        setClientData(updatedData);
    };


    switch (view) {
        case 'agreement':
            return <AgreementView onAccept={handleAcceptTerms} onDecline={onLogout} />;
        case 'onboarding':
            return <OnboardingView currentProfile={clientData.profile} onComplete={handleOnboardingComplete} />;
        case 'dashboard':
            return <ClientDashboardView clientData={clientData} onLogout={onLogout} onDataUpdate={handleClientDataUpdate} />;
        default:
            return null;
    }
};

const AgreementView = ({ onAccept, onDecline }: { onAccept: () => void, onDecline: () => void }) => {
    const [isChecked, setIsChecked] = useState(false);
    
     const termsText = `
    Bienvenido a ScorpionGYM AI.

    **1. Propósito de la Aplicación:**
    Esta aplicación genera planes de entrenamiento y nutrición personalizados basados en la información que proporcionas. Estos planes son sugerencias generadas por inteligencia artificial y deben ser considerados como una guía.

    **2. Importancia de la Supervisión Profesional:**
    Es fundamental que consultes con un profesional del fitness o un médico antes de comenzar cualquier nuevo programa de entrenamiento o nutrición, especialmente si tienes condiciones médicas preexistentes. El uso de esta aplicación no reemplaza el consejo de un profesional cualificado.

    **3. Responsabilidad del Usuario:**
    - Eres responsable de realizar los ejercicios con la técnica correcta para evitar lesiones. Si no estás seguro de cómo realizar un ejercicio, busca la guía de un entrenador.
    - Eres responsable de seguir el plan de nutrición de acuerdo a tus propias necesidades y posibles alergias o intolerancias.
    - ScorpionGYM AI y sus desarrolladores no se hacen responsables de las lesiones, problemas de salud o cualquier otro resultado adverso que pueda surgir del uso de los planes generados.

    **4. Uso de Datos:**
    La información que proporcionas (edad, peso, objetivos, etc.) se utiliza únicamente para personalizar tus planes y no se comparte con terceros.

    **5. Aceptación:**
    Al marcar la casilla y hacer clic en "Aceptar y Continuar", confirmas que has leído, entendido y aceptado estos términos y condiciones. Asumes toda la responsabilidad por tu participación en los planes de entrenamiento y nutrición.
    `;


    return (
        <div className="agreement-container animated-fade-in">
             <header><h1>Términos y Condiciones de Uso</h1></header>
            <div className="terms-box">
                <p>{termsText}</p>
            </div>
            <div className="agreement-actions">
                <div className="agreement-checkbox">
                    <input type="checkbox" id="terms" checked={isChecked} onChange={() => setIsChecked(!isChecked)} />
                    <label htmlFor="terms">He leído y acepto los términos y condiciones.</label>
                </div>
                <div className="agreement-buttons">
                    <button className="cta-button secondary" onClick={onDecline}>Rechazar</button>
                    <button className="cta-button" disabled={!isChecked} onClick={onAccept}>Aceptar y Continuar</button>
                </div>
            </div>
        </div>
    );
};

const OnboardingView = ({ currentProfile, onComplete }: { currentProfile: Profile, onComplete: (profile: Profile) => void }) => {
    const [profile, setProfile] = useState<Profile>(currentProfile);

    const handleChange = (field: keyof Profile, value: string) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onComplete(profile);
    };

    return (
        <div className="onboarding-container animated-fade-in">
            <div className="onboarding-header">
                <h1>¡Casi listo! Completa tu perfil</h1>
                <p>Esta información es crucial para generar un plan perfecto para ti.</p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="onboarding-section">
                    <h2>Información Básica</h2>
                     <div className="profile-form">
                        <div className="form-group">
                            <label htmlFor="name">Nombre Completo</label>
                            <input id="name" type="text" value={profile.name} onChange={e => handleChange('name', e.target.value)} required />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <div className="form-group">
                                <label htmlFor="age">Edad</label>
                                <input id="age" type="number" value={profile.age} onChange={e => handleChange('age', e.target.value)} required/>
                            </div>
                            <div className="form-group">
                                <label htmlFor="gender">Género</label>
                                <select id="gender" value={profile.gender} onChange={e => handleChange('gender', e.target.value)}>
                                    <option>Masculino</option>
                                    <option>Femenino</option>
                                    <option>Prefiero no decirlo</option>
                                </select>
                            </div>
                        </div>
                         <div style={{ display: 'flex', gap: '1rem' }}>
                            <div className="form-group">
                                <label htmlFor="weight">Peso (kg)</label>
                                <input id="weight" type="number" step="0.1" value={profile.weight} onChange={e => handleChange('weight', e.target.value)} required/>
                            </div>
                            <div className="form-group">
                                <label htmlFor="height">Altura (cm)</label>
                                <input id="height" type="number" value={profile.height} onChange={e => handleChange('height', e.target.value)} required/>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="onboarding-section">
                    <h2>Tu Entrenamiento</h2>
                    <div className="profile-form">
                        <div className="form-group">
                            <label htmlFor="level">¿Cuál es tu nivel de experiencia en el gimnasio?</label>
                            <select id="level" value={profile.level} onChange={e => handleChange('level', e.target.value)}>
                                <option>Principiante</option>
                                <option>Intermedio</option>
                                <option>Avanzado</option>
                            </select>
                        </div>
                         <div className="form-group">
                            <label htmlFor="goal">¿Cuál es tu objetivo principal?</label>
                            <select id="goal" value={profile.goal} onChange={e => handleChange('goal', e.target.value)}>
                                <option>Hipertrofia</option>
                                <option>Pérdida de grasa</option>
                                <option>Mantenimiento</option>
                                <option>Resistencia</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="trainingDays">¿Cuántos días a la semana puedes entrenar?</label>
                            <input id="trainingDays" type="number" min="1" max="7" value={profile.trainingDays} onChange={e => handleChange('trainingDays', e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="onboarding-actions">
                    <button type="submit" className="cta-button">Guardar y Ver Mi Plan</button>
                </div>
            </form>
        </div>
    );
};


const ClientDashboardView = ({ clientData, onLogout, onDataUpdate }: { clientData: ClientData, onLogout: () => void, onDataUpdate: (data: ClientData) => void }) => {
    const [activeTab, setActiveTab] = useState<'routine' | 'nutrition' | 'progress' | 'profile'>('routine');
    const [showChat, setShowChat] = useState(false);
    
    // Check plan expiration
    const isPlanExpired = useMemo(() => {
        if (!clientData.routineGeneratedDate) return false; // If no date, not expired
        const generatedDate = new Date(clientData.routineGeneratedDate);
        const totalDurationWeeks = clientData.routine?.totalDurationWeeks || 8;
        const expirationDate = new Date(generatedDate.setDate(generatedDate.getDate() + totalDurationWeeks * 7));
        return new Date() > expirationDate;
    }, [clientData.routineGeneratedDate, clientData.routine?.totalDurationWeeks]);


    if (clientData.planStatus === 'pending') {
        return (
             <div className="client-view-container animated-fade-in">
                 <header>
                    <div className="header-title-wrapper">
                         <h1>Hola, {clientData.profile.name}</h1>
                    </div>
                    <button onClick={onLogout} className="logout-button">Salir</button>
                </header>
                <div className="expired-view" style={{ textAlign: 'center' }}>
                     <h2>¡Tu plan está casi listo!</h2>
                    <p>Tu entrenador está preparando tu rutina y plan de nutrición personalizados. Por favor, vuelve a consultar más tarde.</p>
                </div>
             </div>
        )
    }
    
    if (isPlanExpired && clientData.planStatus !== 'expired') {
        // Update status to expired if it's not already
        apiClient.saveClientData(clientData.dni, { planStatus: 'expired' });
    }


    if (clientData.planStatus === 'expired') {
         return (
             <div className="client-view-container animated-fade-in">
                 <header>
                    <div className="header-title-wrapper">
                         <h1>Hola, {clientData.profile.name}</h1>
                    </div>
                    <button onClick={onLogout} className="logout-button">Salir</button>
                </header>
                <div className="expired-view" style={{ textAlign: 'center' }}>
                     <h2>Tu plan ha expirado</h2>
                    <p>Tu plan de entrenamiento ha finalizado. Por favor, contacta a tu entrenador para solicitar uno nuevo y continuar con tu progreso.</p>
                </div>
             </div>
        )
    }

    const planType = clientData.planType || 'full';
    
    // Adjust initial tab based on plan type
    useEffect(() => {
       if (planType === 'nutrition') {
           setActiveTab('nutrition');
       } else {
           setActiveTab('routine');
       }
    }, [planType]);


    return (
        <div className="client-view-container">
            <header>
                <div className="header-title-wrapper">
                    <h1>Hola, {clientData.profile.name}</h1>
                </div>
                 <div className="client-header-actions">
                     <button onClick={() => setShowChat(true)} className="cta-button secondary ai-assistant-button">Asistente IA</button>
                    <button onClick={onLogout} className="logout-button">Salir</button>
                 </div>
            </header>
            
            <nav className="main-tabs-nav">
                { (planType === 'full' || planType === 'routine') &&
                    <button className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>
                        Mi Rutina
                    </button>
                }
                 { (planType === 'full' || planType === 'nutrition') &&
                    <button className={`main-tab-button ${activeTab === 'nutrition' ? 'active' : ''}`} onClick={() => setActiveTab('nutrition')}>
                        Mi Nutrición
                    </button>
                 }
                <button className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
                    Mi Progreso
                </button>
                <button className={`main-tab-button ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
                    Mi Perfil
                </button>
            </nav>

            <div className="results-section" style={{ width: '100%' }}>
                {activeTab === 'routine' && (
                    clientData.routine ? <ClientRoutineView routine={clientData.routine} clientData={clientData} onDataUpdate={onDataUpdate}/> : <div className="placeholder"><p>No tienes una rutina asignada.</p></div>
                )}
                {activeTab === 'nutrition' && (
                    (clientData.dietPlans && (clientData.dietPlans[0] || clientData.dietPlans[1])) ? <DietPlanView dietPlans={clientData.dietPlans} /> : <div className="placeholder"><p>No tienes un plan de nutrición asignado.</p></div>
                )}
                 {activeTab === 'progress' && <ClientProgressView clientData={clientData} onDataUpdate={onDataUpdate} />}
                 {activeTab === 'profile' && <ClientProfileView clientData={clientData} />}
            </div>
            
             {showChat && <ChatAssistant clientData={clientData} onClose={() => setShowChat(false)} onDataUpdate={onDataUpdate}/>}
        </div>
    );
};

const ClientRoutineView = ({ routine, clientData, onDataUpdate }: { routine: Routine, clientData: ClientData, onDataUpdate: (data: ClientData) => void }) => {
    const [progress, setProgress] = useState<Record<string, { weight: string, reps: string }>>({});
    const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saved'>>({});
    const [showRequestModal, setShowRequestModal] = useState(false);
    
    // Find the first phase that has days, otherwise default to 0
    const initialPhaseIndex = Math.max(0, routine.phases.findIndex(p => p.routine && p.routine.dias && p.routine.dias.length > 0));

    const [activePhaseIndex, setActivePhaseIndex] = useState(initialPhaseIndex);
    const [activeDayIndex, setActiveDayIndex] = useState(0);

    const activePhase = routine.phases[activePhaseIndex];
    const activeDay = activePhase?.routine.dias[activeDayIndex];

    const handleProgressChange = (exerciseName: string, field: 'weight' | 'reps', value: string) => {
        setProgress(prev => ({
            ...prev,
            [exerciseName]: {
                ...prev[exerciseName],
                [field]: value
            }
        }));
        setSaveStatus(prev => ({...prev, [exerciseName]: 'idle'}));
    };

    const handleSaveProgress = async (exerciseName: string) => {
        const entry = progress[exerciseName];
        if (!entry || !entry.weight || !entry.reps) {
            alert("Por favor, ingresa peso y repeticiones.");
            return;
        }

        const newLogEntry: ProgressLogEntry = {
            date: new Date().toISOString(),
            weight: parseFloat(entry.weight),
            repetitions: parseInt(entry.reps, 10)
        };

        const updatedProgressLog = { ...clientData.progressLog };
        if (!updatedProgressLog[exerciseName]) {
            updatedProgressLog[exerciseName] = [];
        }
        updatedProgressLog[exerciseName].push(newLogEntry);
        
        const success = await apiClient.saveClientData(clientData.dni, { progressLog: updatedProgressLog });
        if(success) {
            onDataUpdate({ ...clientData, progressLog: updatedProgressLog });
            setSaveStatus(prev => ({...prev, [exerciseName]: 'saved'}));
             setTimeout(() => {
                setSaveStatus(prev => ({...prev, [exerciseName]: 'idle'}));
                 setProgress(prev => ({
                    ...prev,
                    [exerciseName]: { weight: '', reps: '' }
                }));
            }, 2000);
        } else {
            alert("Error al guardar el progreso.");
        }
    };
    
    const expirationDate = useMemo(() => {
        if (!clientData.routineGeneratedDate) return null;
        const generatedDate = new Date(clientData.routineGeneratedDate);
        const totalDurationWeeks = routine.totalDurationWeeks || 8;
        const expiration = new Date(generatedDate.setDate(generatedDate.getDate() + totalDurationWeeks * 7));
        return formatDate(expiration.toISOString());
    }, [clientData.routineGeneratedDate, routine.totalDurationWeeks]);

    return (
        <div className="plan-container animated-fade-in">
            <div className="plan-header">
                <h2>{routine.planName}</h2>
                <p>Duración Total: {routine.totalDurationWeeks} semanas</p>
                {expirationDate && <p className="expiration-date">Vence el: {expirationDate}</p>}
            </div>

            <AccordionPhases
                routine={routine}
                activePhaseIndex={activePhaseIndex}
                setActivePhaseIndex={(index) => {
                    setActivePhaseIndex(index);
                    setActiveDayIndex(0);
                }}
            >
                {activePhase && activePhase.routine && activePhase.routine.dias && activePhase.routine.dias.length > 0 ? (
                   <>
                        <div className="day-tabs-nav">
                            {activePhase.routine.dias.map((day, index) => (
                                <button
                                    key={index}
                                    className={`day-tab-button ${index === activeDayIndex ? 'active' : ''}`}
                                    onClick={() => setActiveDayIndex(index)}
                                >
                                    {day.dia}
                                </button>
                            ))}
                        </div>
                        {activeDay && (
                            <div className="day-card">
                                <h3>Día de <span className="muscle-group">{activeDay.grupoMuscular}</span></h3>
                                <ul className="exercise-list">
                                    {activeDay.ejercicios.map((ex, index) => (
                                        <li key={index}>
                                            <ExerciseItemViewer exercise={ex} />
                                             <div className="exercise-tracking">
                                                <div>
                                                    <label htmlFor={`weight-${index}`}>Peso (kg)</label>
                                                    <input
                                                        id={`weight-${index}`}
                                                        type="number"
                                                        placeholder="0"
                                                        value={progress[ex.nombre]?.weight || ''}
                                                        onChange={(e) => handleProgressChange(ex.nombre, 'weight', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor={`reps-${index}`}>Reps</label>
                                                    <input
                                                        id={`reps-${index}`}
                                                        type="number"
                                                        placeholder="0"
                                                        value={progress[ex.nombre]?.reps || ''}
                                                        onChange={(e) => handleProgressChange(ex.nombre, 'reps', e.target.value)}
                                                    />
                                                </div>
                                                 <button
                                                    className={`cta-button secondary ${saveStatus[ex.nombre] === 'saved' ? 'saved' : ''}`}
                                                    onClick={() => handleSaveProgress(ex.nombre)}
                                                    disabled={saveStatus[ex.nombre] === 'saved'}
                                                    aria-label="Guardar progreso"
                                                >
                                                     {saveStatus[ex.nombre] === 'saved' ? <CheckIcon /> : '+'}
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                {activeDay.cardio && (
                                    <div className="cardio-note">
                                        <h4>Cardio:</h4>
                                        <p>{activeDay.cardio}</p>
                                    </div>
                                )}
                            </div>
                        )}
                   </>
                ) : (
                    <div className="placeholder" style={{marginTop: '1rem'}}><p>No hay días de entrenamiento definidos para esta fase.</p></div>
                )}
            </AccordionPhases>
            
            <button className="cta-button secondary request-change-button" onClick={() => setShowRequestModal(true)}>
                Solicitar Cambio / Hacer una Pregunta
            </button>
            
            {showRequestModal && (
                <RequestModal 
                    clientData={clientData} 
                    onClose={() => setShowRequestModal(false)}
                />
            )}
        </div>
    );
};

const RequestModal = ({ clientData, onClose }: { clientData: ClientData, onClose: () => void }) => {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isSent, setIsSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        const requestData = {
            clientId: clientData.dni,
            clientName: clientData.profile.name,
            gymId: clientData.gymId,
            subject,
            message
        };
        const success = await apiClient.createRequest(requestData);
        if (success) {
            setIsSent(true);
        } else {
            alert("Hubo un error al enviar tu solicitud. Inténtalo de nuevo.");
        }
        setIsSending(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content edit-modal" onClick={e => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>&times;</button>
                <h3>Contactar a mi Entrenador</h3>
                {isSent ? (
                    <div className="success-message" style={{textAlign: 'center'}}>
                        <p>✅ ¡Tu solicitud ha sido enviada!</p>
                        <p style={{fontSize: '1rem', color: 'var(--text-secondary-color)', marginTop: '1rem'}}>Tu entrenador la revisará pronto.</p>
                        <button onClick={onClose} className="cta-button" style={{marginTop: '2rem'}}>Cerrar</button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="profile-form">
                        <div className="form-group">
                            <label htmlFor="subject">Asunto</label>
                            <select id="subject" value={subject} onChange={e => setSubject(e.target.value)} required>
                                <option value="">Selecciona un motivo...</option>
                                <option value="Pregunta sobre un ejercicio">Pregunta sobre un ejercicio</option>
                                <option value="Cambio en la rutina">Solicitar cambio en la rutina</option>
                                <option value="Pregunta sobre nutrición">Pregunta sobre nutrición</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="message">Mensaje</label>
                            <textarea id="message" value={message} onChange={e => setMessage(e.target.value)} rows={5} required placeholder="Describe tu pregunta o el cambio que necesitas..."></textarea>
                        </div>
                        <div className="modal-actions">
                            <button type="button" onClick={onClose} className="cta-button secondary">Cancelar</button>
                            <button type="submit" className="cta-button" disabled={isSending}>
                                {isSending ? <Spinner size="small" /> : 'Enviar'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};


const ClientProgressView = ({ clientData, onDataUpdate }: { clientData: ClientData, onDataUpdate: (data: ClientData) => void }) => {
    const [activeTab, setActiveTab] = useState('bodyWeight');
    const [newBodyWeight, setNewBodyWeight] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
    const [selectedExercise, setSelectedExercise] = useState('');
    
    const allLoggedExercises = useMemo(() => {
        return Object.keys(clientData.progressLog || {}).sort();
    }, [clientData.progressLog]);
    
    useEffect(() => {
        if(allLoggedExercises.length > 0 && !selectedExercise) {
            setSelectedExercise(allLoggedExercises[0]);
        }
    }, [allLoggedExercises, selectedExercise]);
    
    const handleAddBodyWeight = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBodyWeight) return;

        const weight = parseFloat(newBodyWeight);
        const { value: imc, categoryClass } = calculateBMI(weight, parseFloat(clientData.profile.height));

        const newEntry: BodyWeightEntry = {
            date: new Date().toISOString(),
            weight: weight,
            imc: imc,
            imcCategoryClass: categoryClass
        };

        const updatedLog = [...(clientData.bodyWeightLog || []), newEntry];
        const success = await apiClient.saveClientData(clientData.dni, { bodyWeightLog: updatedLog });

        if (success) {
            onDataUpdate({ ...clientData, bodyWeightLog: updatedLog });
            setNewBodyWeight('');
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            alert("Error al guardar el peso.");
        }
    };
    
     const selectedExerciseLogs = clientData.progressLog?.[selectedExercise] || [];

    return (
        <div className="progress-view animated-fade-in">
             <nav className="progress-tabs-nav">
                <button className={`progress-tab-button ${activeTab === 'bodyWeight' ? 'active' : ''}`} onClick={() => setActiveTab('bodyWeight')}>
                    Peso Corporal
                </button>
                <button className={`progress-tab-button ${activeTab === 'exercises' ? 'active' : ''}`} onClick={() => setActiveTab('exercises')}>
                    Ejercicios
                </button>
            </nav>

            {activeTab === 'bodyWeight' && (
                <div className="progress-section">
                    <h3>Registro de Peso Corporal</h3>
                    <form onSubmit={handleAddBodyWeight} className="add-weight-form">
                        <input
                            type="number"
                            step="0.1"
                            placeholder="Tu peso en kg"
                            value={newBodyWeight}
                            onChange={(e) => setNewBodyWeight(e.target.value)}
                            required
                        />
                        <button type="submit" className={`cta-button register-button ${saveStatus === 'saved' ? 'saved' : ''}`} disabled={saveStatus === 'saved'}>
                            {saveStatus === 'saved' ? 'Registrado ✓' : 'Registrar'}
                        </button>
                    </form>
                    
                     <ul className="log-list">
                         <li style={{backgroundColor: 'transparent', fontWeight: '600', color: 'var(--text-secondary-color)'}}>
                           <span>Fecha</span>
                           <span>Peso (kg)</span>
                           <span>IMC</span>
                         </li>
                        {[...(clientData.bodyWeightLog || [])].reverse().map(log => (
                           <li key={log.date} className="weight-log">
                               <span>{formatDate(log.date)}</span>
                               <span>{log.weight} kg</span>
                               <span>
                                   <div className={`bmi-category ${log.imcCategoryClass}`}>{log.imc}</div>
                               </span>
                           </li>
                        ))}
                    </ul>
                </div>
            )}
            
            {activeTab === 'exercises' && (
                 <div className="progress-section">
                    <h3>Progreso por Ejercicio</h3>
                    {allLoggedExercises.length > 0 ? (
                       <>
                            <select 
                                className="exercise-select-dropdown"
                                value={selectedExercise} 
                                onChange={(e) => setSelectedExercise(e.target.value)}
                            >
                                {allLoggedExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                            </select>
                            
                            <ul className="log-list">
                                 <li style={{backgroundColor: 'transparent', fontWeight: '600', color: 'var(--text-secondary-color)'}}>
                                   <span>Fecha</span>
                                   <span>Peso (kg)</span>
                                   <span>Reps</span>
                                 </li>
                                {[...selectedExerciseLogs].reverse().map(log => (
                                   <li key={log.date}>
                                       <span>{formatDate(log.date)}</span>
                                       <span>{log.weight} kg</span>
                                       <span>{log.repetitions}</span>
                                   </li>
                                ))}
                            </ul>
                       </>
                    ) : (
                        <p>Aún no has registrado progreso en ningún ejercicio.</p>
                    )}
                </div>
            )}
        </div>
    );
};

const ClientProfileView = ({ clientData }: { clientData: ClientData }) => {
    const { profile } = clientData;
     const healthyWeightRange = calculateHealthyWeightRange(parseFloat(profile.height));

    return (
        <div className="client-profile-view animated-fade-in">
            <h2>Mi Perfil</h2>
             <div className="profile-info-grid">
                 <div className="info-card">
                     <h3>Información Personal</h3>
                     <ul>
                         <li><strong>Nombre:</strong> <span>{profile.name}</span></li>
                         <li><strong>Edad:</strong> <span>{profile.age} años</span></li>
                         <li><strong>Género:</strong> <span>{profile.gender}</span></li>
                     </ul>
                 </div>
                 <div className="info-card">
                     <h3>Métricas Corporales</h3>
                     <div className="health-metrics">
                         <div className="metric-item">
                             <span className="metric-label">Peso Actual</span>
                             <span className="metric-value">{profile.weight} kg</span>
                         </div>
                          <div className="metric-item">
                             <span className="metric-label">Altura</span>
                             <span className="metric-value">{profile.height} cm</span>
                         </div>
                     </div>
                     {parseFloat(profile.weight) > 0 && parseFloat(profile.height) > 0 && (
                        <>
                             <BMIDisplay weight={parseFloat(profile.weight)} height={parseFloat(profile.height)} view="client" />
                             <div className="target-weight-info" style={{textAlign: 'center'}}>
                                <strong>Rango de peso saludable:</strong> {healthyWeightRange}
                            </div>
                        </>
                    )}
                 </div>
                 <div className="info-card full-width">
                     <h3>Mis Objetivos y Preferencias</h3>
                     <ul>
                         <li><strong>Nivel de Experiencia:</strong> <span>{profile.level}</span></li>
                         <li><strong>Objetivo Principal:</strong> <span>{profile.goal}</span></li>
                         <li><strong>Días de Entrenamiento:</strong> <span>{profile.trainingDays} por semana</span></li>
                         <li><strong>Factor de Actividad Diario:</strong> <span>{profile.activityFactor}</span></li>
                     </ul>
                 </div>
             </div>
        </div>
    );
};

const ChatAssistant = ({ clientData, onClose, onDataUpdate }: { clientData: ClientData, onClose: () => void, onDataUpdate: (data: ClientData) => void }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<{ role: 'user' | 'model', parts: { text: string, image?: string }[] }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [image, setImage] = useState<{ b64: string; mimeType: string } | null>(null);
    const [remainingQuestions, setRemainingQuestions] = useState(0);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);
    
    // Initialize Chat
    useEffect(() => {
        const initializeChat = () => {
             const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
             const systemInstruction = `
                Eres Scorpion AI, un asistente de fitness y nutrición experto para un cliente de gimnasio.
                Tu propósito es responder preguntas y dar consejos basados en el perfil y el plan del cliente.
                Sé conciso, amigable y motivador. Usa emojis para hacer las respuestas más atractivas.

                **Contexto del Cliente:**
                - Nombre: ${clientData.profile.name}
                - Edad: ${clientData.profile.age}
                - Peso: ${clientData.profile.weight} kg
                - Altura: ${clientData.profile.height} cm
                - Objetivo: ${clientData.profile.goal}
                - Días de entrenamiento: ${clientData.profile.trainingDays}
                
                **Plan de Rutina Actual:**
                ${JSON.stringify(clientData.routine, null, 2)}

                **Plan de Nutrición Actual:**
                ${JSON.stringify(clientData.dietPlans, null, 2)}

                **Reglas:**
                1.  **NO DES CONSEJOS MÉDICOS.** Si te preguntan sobre lesiones, dolor o salud, responde siempre: "No soy un profesional médico. Para cualquier problema de salud o dolor, es muy importante que consultes a tu médico o a un fisioterapeuta."
                2.  **Mantente en Contexto:** Basa tus respuestas en la información proporcionada. Si te preguntan algo fuera del fitness o nutrición, amablemente redirige la conversación.
                3.  **Sustitución de Ejercicios:** Si te piden sustituir un ejercicio, sugiere una alternativa de la lista de ejercicios disponibles que trabaje el mismo grupo muscular.
                4.  **Ajuste de Comidas:** Si te piden un cambio en la dieta, sugiere un alimento alternativo que tenga un perfil de macronutrientes similar (ej. cambiar pollo por pescado, arroz por quinoa).
                5. **Evita la sobre-escritura**: NO repitas todo el plan del usuario en tu respuesta. Responde solo a la pregunta específica.
             `;
             
             const newChat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: systemInstruction,
                },
             });
             setChat(newChat);
             
              // Set initial message
            setMessages([{ role: 'model', parts: [{ text: `¡Hola ${clientData.profile.name}! 👋 Soy Scorpion AI, tu asistente virtual. ¿En qué puedo ayudarte hoy con tu entrenamiento o nutrición?` }] }]);
        };
        initializeChat();
    }, [clientData]);
    
    // Track question limit
    useEffect(() => {
         const today = new Date().toISOString().split('T')[0];
         const usage = clientData.aiUsage;
         if (usage && usage.date === today) {
             setRemainingQuestions((clientData.dailyQuestionLimit || 5) - usage.count);
         } else {
             setRemainingQuestions(clientData.dailyQuestionLimit || 5);
         }
    }, [clientData.aiUsage, clientData.dailyQuestionLimit]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() && !image) return;
        if (remainingQuestions <= 0) {
            setError("Has alcanzado tu límite de preguntas por hoy. ¡Vuelve mañana!");
            return;
        }

        setIsLoading(true);
        setError('');
        const userMessage = { role: 'user' as const, parts: [{ text: input, image: image?.b64 }] };
        setMessages(prev => [...prev, userMessage]);

        const promptParts: any[] = [{ text: input }];
        if (image) {
            promptParts.push({ inlineData: { data: image.b64, mimeType: image.mimeType } });
        }
        
        try {
            if (!chat) throw new Error("Chat no inicializado.");
            
            // FIX: The parameter for sendMessage is `message`, not `parts`.
            const result = await chat.sendMessage({ message: promptParts });
            const responseText = result.text;
            
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
            
            // Update usage count
            const today = new Date().toISOString().split('T')[0];
            let newCount = 1;
            if (clientData.aiUsage && clientData.aiUsage.date === today) {
                newCount = clientData.aiUsage.count + 1;
            }
            const updatedUsage = { date: today, count: newCount };
            const updatedClientData = { ...clientData, aiUsage: updatedUsage };
            
            // Save to DB without waiting
            apiClient.saveClientData(clientData.dni, { aiUsage: updatedUsage });
            
            // Update local state immediately for UI responsiveness
            onDataUpdate(updatedClientData);
            setRemainingQuestions(prev => prev - 1);

        } catch (err) {
            console.error(err);
            setError("Hubo un problema al contactar al asistente. Inténtalo de nuevo.");
        } finally {
            setInput('');
            setImage(null);
            setIsLoading(false);
        }
    };
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setImage({ b64: base64String, mimeType: file.type });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="chat-fullscreen-container">
            <header className="main-header" style={{ padding: '1rem' }}>
                <div className="header-title-wrapper">
                    <h1>Asistente IA</h1>
                    <p>Preguntas restantes hoy: {remainingQuestions > 0 ? remainingQuestions : 0}</p>
                </div>
                <button onClick={onClose} className="back-button">Cerrar</button>
            </header>

            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.role}`}>
                        <div className="avatar">{msg.role === 'model' ? 'AI' : clientData.profile.name.charAt(0)}</div>
                        <div className="message-content">
                            {msg.parts.map((part, partIndex) => (
                                <div key={partIndex}>
                                    {part.image && <img src={`data:image/png;base64,${part.image}`} alt="User upload" />}
                                    <p>{part.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="chat-message model">
                         <div className="avatar">AI</div>
                         <div className="message-content">
                             <div className="chat-typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                         </div>
                    </div>
                )}
                 <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
                {error && <p className="error-text" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>{error}</p>}
                {image && (
                    <div className="chat-image-preview">
                        <img src={`data:${image.mimeType};base64,${image.b64}`} alt="Preview" />
                        <button className="remove-image-btn" onClick={() => setImage(null)}>&times;</button>
                    </div>
                )}
                <form onSubmit={handleSendMessage}>
                    <button type="button" className="chat-action-btn" onClick={() => fileInputRef.current?.click()}>
                        <ImageIcon />
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />

                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Escribe tu pregunta aquí..."
                        disabled={isLoading || remainingQuestions <= 0}
                    />
                    <button type="submit" disabled={isLoading || (!input.trim() && !image) || remainingQuestions <= 0}>
                        <SendIcon />
                    </button>
                </form>
            </div>
        </div>
    );
};


/**
 * App: The root component that manages the overall application state and routing.
 */
const App = () => {
  const [session, setSession] = useState<{ role: 'admin' | 'client' | 'superadmin', data: any } | null>(null);
  const [roleSelection, setRoleSelection] = useState<'admin' | 'client' | null>(null);

  useEffect(() => {
    // Check for saved session on component mount
    const savedSession = sessionStorage.getItem('scorpion-gym-session');
    if (savedSession) {
      // FIX: Cast the parsed session object to the expected type to resolve the TypeScript error.
      setSession(JSON.parse(savedSession) as { role: 'admin' | 'client' | 'superadmin'; data: any });
    }
  }, []);

  const handleLoginSuccess = (data: any, role: 'admin' | 'client') => {
      const isSuperAdmin = role === 'admin' && data.username === 'superadmin';
      const sessionRole = isSuperAdmin ? 'superadmin' : role;
      
      const newSession = { role: sessionRole, data: data };
      setSession(newSession);
      sessionStorage.setItem('scorpion-gym-session', JSON.stringify(newSession));
      setRoleSelection(null); // Clear role selection after login
  };

  const handleLogout = () => {
    setSession(null);
    setRoleSelection(null);
    sessionStorage.removeItem('scorpion-gym-session');
  };

  if (session) {
      if (session.role === 'superadmin') {
          return <SuperAdminDashboard onLogout={handleLogout} />;
      }
      if (session.role === 'admin') {
          return <AdminDashboard gym={session.data} onLogout={handleLogout} />;
      }
      if (session.role === 'client') {
          return <ClientPortal initialClientData={session.data} onLogout={handleLogout} />;
      }
  }
  
  if (roleSelection) {
      return <LoginView role={roleSelection} onBack={() => setRoleSelection(null)} onLoginSuccess={handleLoginSuccess} />;
  }

  return <LandingView onSelectRole={setRoleSelection} />;
};


const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}