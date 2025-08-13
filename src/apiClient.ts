
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
    gymId: string;
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

export interface Gym {
    _id: string;
    name: string;
    username: string;
}


// --- Constants ---
export const SUPER_ADMIN_PASSWORD = "admin";

export const advancedTechniqueOptions = [
      { value: '', label: 'Ninguna' },
      { value: 'Drop Set (2 descensos) - Al fallo, bajá el peso un 20-25% y seguí sin descanso. Repetilo 2 veces.', label: 'Drop Set (2 descensos)' },
      { value: 'Rest-Pause (3 pausas) - Al fallo, descansá 15s y sacá más reps. Repetilo 3 veces. Es una sola serie.', label: 'Rest-Pause (3 pausas)' },
      { value: 'Myo-reps (3 pasadas) - Tras una serie de activación al fallo, descansá 20-30s. Luego realizá 3 pasadas de 3-5 reps con el mismo peso, descansando solo 10-15s entre ellas.', label: 'Myo-reps (3 pasadas)' },
      { value: 'Excéntricas (fase de 4-6s) - Enfocate en la fase de bajada del peso, de forma lenta y controlada durante 4 a 6 segundos.', label: 'Excéntricas (Negativas)' }
];

export const apiClient = {
  // --- Super Admin ---
  async getGyms(): Promise<Gym[]> {
    try {
        const response = await fetch('/api/gyms');
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch gyms:", error);
        return [];
    }
  },
  
  async createGym(name: string, username: string, password: string): Promise<boolean> {
     try {
        const response = await fetch('/api/gyms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, password }),
        });
        return response.ok;
    } catch (error) {
        console.error("Failed to create gym:", error);
        return false;
    }
  },

  async deleteGym(gymId: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/gyms/${gymId}`, { method: 'DELETE' });
        return response.ok;
    } catch (error) {
        console.error(`Failed to delete gym ${gymId}:`, error);
        return false;
    }
  },

  // --- Gym/Coach Auth ---
  async gymLogin(username: string, password: string): Promise<Gym | null> {
    try {
        const response = await fetch('/api/auth/gym-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Gym login failed:", error);
        return null;
    }
  },

  // --- Client Management (Scoped by Gym) ---
  async getClients(gymId: string): Promise<ClientListItem[]> {
    try {
        const response = await fetch(`/api/clients?gymId=${gymId}`);
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

  async saveClientData(dni: string, dataToSave: Partial<ClientData>): Promise<boolean> {
    try {
        const response = await fetch(`/api/clients/${dni}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dataToSave),
        });
        if (!response.ok) {
            console.error(`Failed to save client data for DNI ${dni}, server responded with error:`, await response.text());
            return false;
        }
        return true;
    } catch (error) {
        console.error(`Failed to save client data for DNI ${dni}:`, error);
        return false;
    }
  },

  async createClient(dni: string, gymId: string): Promise<{ success: boolean; message?: string }> {
    try {
        const response = await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni, gymId }),
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

  // Exercise Library Management (Scoped by Gym)
  async getExerciseLibrary(gymId: string): Promise<ExerciseLibrary> {
    try {
        const response = await fetch(`/api/library?gymId=${gymId}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const library: ExerciseLibrary = await response.json();
        return library;
    } catch (error) {
        console.error("Failed to fetch exercise library:", error);
        return {};
    }
  },

  async saveExerciseLibrary(library: ExerciseLibrary, gymId: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/library?gymId=${gymId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(library),
        });
        if (!response.ok) {
            console.error('Failed to save exercise library, server responded with error:', await response.text());
            return false;
        }
        return true;
    } catch (error) {
        console.error(`Failed to save exercise library:`, error);
        return false;
    }
  },
};
