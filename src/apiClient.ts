// --- Type Definitions ---
export interface Profile {
    name: string;
    age: string;
    weight: string;
    height: string;
    gender: 'Masculino' | 'Femenino' | 'Prefiero no decirlo';
    level: 'Principiante' | 'Intermedio' | 'Avanzado';
    goal: 'Hipertrofia' | 'Pérdida de grasa' | 'Mantenimiento' | 'Resistencia';
    trainingDays: string;
    activityFactor: 'Sedentario' | 'Ligero' | 'Activo' | 'Muy Activo';
    useAdvancedTechniques: 'Sí' | 'No';
    bodyFocusArea: 'Cuerpo completo' | 'Tren Superior' | 'Tren Inferior';
    bodyFocusSpecific: string;
    includeAdaptationPhase: 'Sí' | 'No';
    trainingIntensity: 'Baja' | 'Moderada' | 'Alta' | 'Extrema';
}

export interface Exercise {
    nombre: string;
    series: string;
    repeticiones: string;
    descanso: string;
    tecnicaAvanzada?: string;
}

export interface DayPlan {
    dia: string;
    grupoMuscular: string;
    ejercicios: Exercise[];
    cardio: string;
}

export interface Phase {
    phaseName: string;
    durationWeeks: number;
    routine: {
        dias: DayPlan[];
    };
}

export interface Routine {
    planName: string;
    totalDurationWeeks: number;
    phases: Phase[];
}

export interface FoodItem {
    food: string;
    amount: string;
}

export interface Meal {
    mealName: string;
    foodItems: FoodItem[];
}

export interface DietPlan {
    planTitle: string;
    summary: {
        totalCalories: number;
        macronutrients: {
            proteinGrams: number;
            carbsGrams: number;
            fatGrams: number;
        };
    };
    meals: Meal[];
    recommendations: string[];
}

export interface ProgressLogEntry {
    date: string; // Should be a full ISO string
    weight: number;
    repetitions: number;
}

export type ProgressLog = Record<string, ProgressLogEntry[]>;

export interface BodyWeightEntry {
    date: string; // Should be a full ISO string
    weight: number;
    imc?: number;
    imcCategoryClass?: string;
}

export interface ExerciseDefinition {
    name: string;
    isEnabled: boolean;
    youtubeLink: string;
}

export type ExerciseLibrary = Record<string, ExerciseDefinition[]>;


export interface ClientData {
    dni: string;
    profile: Profile;
    routine: Routine | null;
    routineGeneratedDate?: string;
    dietPlan: DietPlan | null;
    progressLog: ProgressLog;
    bodyWeightLog?: BodyWeightEntry[];
    termsAccepted?: boolean;
    accessCode: string;
    status?: 'active' | 'archived';
}

export interface ClientListItem {
    dni: string;
    profile: Partial<Profile>;
    planName: string;
    status: 'active' | 'archived';
}

// --- Constants ---
export const ADMIN_PASSWORD = "admin";

export const advancedTechniqueOptions = [
      { value: '', label: 'Ninguna' },
      { value: 'Drop Set (2 descensos) - Al fallo, bajá el peso un 20-25% y seguí sin descanso. Repetilo 2 veces.', label: 'Drop Set (2 descensos)' },
      { value: 'Rest-Pause (3 pausas) - Al fallo, descansá 15s y sacá más reps. Repetilo 3 veces. Es una sola serie.', label: 'Rest-Pause (3 pausas)' },
      { value: 'Myo-reps (3 pasadas) - Tras una serie de activación al fallo, descansá 20-30s. Luego realizá 3 pasadas de 3-5 reps con el mismo peso, descansando solo 10-15s entre ellas.', label: 'Myo-reps (3 pasadas)' },
      { value: 'Excéntricas (fase de 4-6s) - Enfocate en la fase de bajada del peso, de forma lenta y controlada durante 4 a 6 segundos.', label: 'Excéntricas (Negativas)' }
];

export const DEFAULT_EXERCISE_LIBRARY: ExerciseLibrary = {
    "Pecho": [
        { name: "Press de banca plano con barra", isEnabled: true, youtubeLink: "" },
        { name: "Press inclinado con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Aperturas con mancuernas en banco plano", isEnabled: true, youtubeLink: "" },
        { name: "Fondos en paralelas (Dips)", isEnabled: true, youtubeLink: "" },
        { name: "Press declinado con barra", isEnabled: true, youtubeLink: "" },
        { name: "Cruce de poleas (crossover)", isEnabled: true, youtubeLink: "" },
        { name: "Flexiones de brazos (Push-ups)", isEnabled: true, youtubeLink: "" },
        { name: "Press en máquina hammer", isEnabled: true, youtubeLink: "" }
    ],
    "Espalda": [
        { name: "Dominadas (Pull-ups)", isEnabled: true, youtubeLink: "" },
        { name: "Remo con barra (inclinado)", isEnabled: true, youtubeLink: "" },
        { name: "Jalón al pecho (Polea alta)", isEnabled: true, youtubeLink: "" },
        { name: "Remo en punta con barra T", isEnabled: true, youtubeLink: "" },
        { name: "Remo con mancuerna a una mano", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto convencional", isEnabled: true, youtubeLink: "" },
        { name: "Pull-over con mancuerna", isEnabled: true, youtubeLink: "" },
        { name: "Remo sentado en polea (agarre estrecho)", isEnabled: true, youtubeLink: "" }
    ],
    "Hombros": [
        { name: "Press militar con barra (de pie)", isEnabled: true, youtubeLink: "" },
        { name: "Press Arnold con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Elevaciones laterales con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Elevaciones frontales con disco", isEnabled: true, youtubeLink: "" },
        { name: "Pájaros (Bent-over reverse flyes)", isEnabled: true, youtubeLink: "" },
        { name: "Remo al mentón con barra", isEnabled: true, youtubeLink: "" },
        { name: "Face pulls en polea", isEnabled: true, youtubeLink: "" },
        { name: "Press en máquina de hombros", isEnabled: true, youtubeLink: "" }
    ],
    "Piernas": [
        { name: "Sentadilla libre con barra", isEnabled: true, youtubeLink: "" },
        { name: "Prensa de piernas a 45 grados", isEnabled: true, youtubeLink: "" },
        { name: "Zancadas (lunges) con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Extensiones de cuádriceps en máquina", isEnabled: true, youtubeLink: "" },
        { name: "Curl femoral tumbado en máquina", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto rumano con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Elevación de talones (gemelos) de pie", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla búlgara con mancuernas", isEnabled: true, youtubeLink: "" }
    ],
    "Glúteos": [
        { name: "Hip thrust con barra", isEnabled: true, youtubeLink: "" },
        { name: "Patada de glúteo en polea", isEnabled: true, youtubeLink: "" },
        { name: "Abducción de cadera en máquina", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto sumo con mancuerna", isEnabled: true, youtubeLink: "" },
        { name: "Puente de glúteos con disco", isEnabled: true, youtubeLink: "" }
    ],
    "Brazos (Bíceps y Tríceps)": [
        { name: "Curl de bíceps con barra recta", isEnabled: true, youtubeLink: "" },
        { name: "Press francés con barra Z", isEnabled: true, youtubeLink: "" },
        { name: "Curl martillo con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Extensiones de tríceps en polea alta con soga", isEnabled: true, youtubeLink: "" },
        { name: "Curl de bíceps concentrado", isEnabled: true, youtubeLink: "" },
        { name: "Fondos entre bancos", isEnabled: true, youtubeLink: "" },
        { name: "Curl predicador (Scott) con barra Z", isEnabled: true, youtubeLink: "" },
        { name: "Patada de tríceps con mancuerna", isEnabled: true, youtubeLink: "" }
    ]
};

export const apiClient = {
  // Client Management
  async getClients(): Promise<ClientListItem[]> {
    try {
        const response = await fetch('/api/clients');
        if (!response.ok) throw new Error('Network response was not ok');
        const clients: ClientListItem[] = await response.json();
        return clients.sort((a, b) => (a.profile.name || a.dni).localeCompare(b.profile.name || b.dni));
    } catch (error) {
        console.error("Failed to fetch clients:", error);
        return [];
    }
  },

  async getClientData(dni: string): Promise<ClientData | null> {
    try {
        const response = await fetch(`/api/clients/${dni}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error('Network response was not ok');
        }
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch client data for DNI ${dni}:`, error);
        return null;
    }
  },

  async saveClientData(dni: string, dataToSave: Partial<ClientData>): Promise<void> {
    try {
        const response = await fetch(`/api/clients/${dni}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave),
        });
        if (!response.ok) throw new Error('Network response was not ok');
    } catch (error) {
        console.error(`Failed to save client data for DNI ${dni}:`, error);
    }
  },

  async createClient(dni: string): Promise<{ success: boolean; message?: string }> {
    try {
        const response = await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            return { success: false, message: errorData.message || 'Failed to create client' };
        }
        return { success: true };
    } catch (error) {
        console.error(`Failed to create client with DNI ${dni}:`, error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
  },
  
  async updateClientStatus(dnis: Set<string>, newStatus: 'active' | 'archived'): Promise<void> {
    try {
        const promises = Array.from(dnis).map(dni => 
            fetch(`/api/clients/${dni}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            })
        );
        await Promise.all(promises);
    } catch (error) {
        console.error(`Failed to update status for clients:`, error);
    }
  },

  async deleteClients(dnis: Set<string>): Promise<void> {
    try {
        const promises = Array.from(dnis).map(dni =>
            fetch(`/api/clients/${dni}`, { method: 'DELETE' })
        );
        await Promise.all(promises);
    } catch (error) {
        console.error(`Failed to delete clients:`, error);
    }
  },

  async loginClient(dni: string, accessCode: string): Promise<boolean> {
     try {
        const response = await fetch(`/api/clients/${dni}`);
        if (!response.ok) return false;
        const data: ClientData = await response.json();
        return data.accessCode === accessCode && (data.status === 'active' || data.status === undefined);
    } catch (error) {
        return false;
    }
  },

  // Exercise Library Management (still uses localStorage for simplicity)
  async getExerciseLibrary(): Promise<ExerciseLibrary> {
    const storedLibrary = localStorage.getItem('gym_ai_exercise_library');
    if (storedLibrary) {
        return JSON.parse(storedLibrary);
    } else {
        localStorage.setItem('gym_ai_exercise_library', JSON.stringify(DEFAULT_EXERCISE_LIBRARY));
        return DEFAULT_EXERCISE_LIBRARY;
    }
  },

  async saveExerciseLibrary(library: ExerciseLibrary): Promise<void> {
    localStorage.setItem('gym_ai_exercise_library', JSON.stringify(library));
  },
};
