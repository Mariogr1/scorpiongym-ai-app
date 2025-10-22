// --- Type Definitions ---
export type PlanType = 'full' | 'routine' | 'nutrition';
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
    bodyFocusArea: 'Full Body' | 'Cuerpo Completo' | 'Tren Superior' | 'Tren Inferior';
    muscleFocus: string; // e.g., 'General', 'Cuádriceps', 'Pecho'
    includeAdaptationPhase: 'Sí' | 'No';
    includeDeloadPhase: 'Sí' | 'No';
    trainingIntensity: 'Baja' | 'Moderada' | 'Alta' | 'Extrema';
}

export interface Exercise {
    nombre: string;
    series: string;
    repeticiones: string;
    descanso: string;
    tecnicaAvanzada?: string;
    videoUrl?: string;
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
    videoUrl: string;
}

export type ExerciseLibrary = Record<string, ExerciseDefinition[]>;

export interface DayStructure {
    dia: string;
    grupoMuscular: string;
}

export interface RoutineTemplate {
    _id: string;
    gymId: string;
    templateName: string;
    description: string;
    trainingDays: number;
    structure: DayStructure[];
}


export interface ClientData {
    dni: string;
    gymId: string;
    profile: Profile;
    routine: Routine | null;
    routineGeneratedDate?: string;
    dietPlans: (DietPlan | null)[];
    progressLog: ProgressLog;
    bodyWeightLog?: BodyWeightEntry[];
    termsAccepted?: boolean;
    accessCode: string | null;
    password?: string;
    passwordResetRequired?: boolean;
    status?: 'active' | 'archived';
    planStatus: 'pending' | 'active' | 'expired';
    dailyQuestionLimit?: number; // Added from Gym
    planType?: PlanType;
    aiUsage?: { date: string; count: number }; // Added to track usage
}

export interface ClientListItem {
    dni: string;
    profile: Partial<Profile>;
    planName: string;
    status: 'active' | 'archived';
    accessCode: string | null;
    planStatus: 'pending' | 'active' | 'expired';
}

export interface Gym {
    _id: string;
    name: string;
    username: string;
    dailyQuestionLimit?: number;
    logoSvg?: string;
    planType?: PlanType;
}

export interface Request {
    _id: string;
    clientId: string;
    clientName: string;
    gymId: string;
    subject: string;
    message: string;
    status: 'new' | 'read' | 'resolved';
    createdAt: string;
}

// --- Constants ---

export const advancedTechniqueOptions: { value: string; label: string; description: string; }[] = [
      { value: '', label: 'Ninguna', description: 'Sin técnica avanzada.' },
      { value: 'Drop Set', label: 'Drop Set (2 descensos)', description: 'Al fallo, bajá el peso un 20-25% y seguí sin descanso. Repetilo 2 veces.' },
      { value: 'Rest-Pause', label: 'Rest-Pause (3 pausas)', description: 'Al fallo, descansá 15s y sacá más reps. Repetilo 3 veces. Es una sola serie.' },
      { value: 'Myo-reps', label: 'Myo-reps (3 pasadas)', description: 'Tras una serie de activación al fallo, descansá 20-30s. Luego realizá 3 pasadas de 3-5 reps con el mismo peso, descansando solo 10-15s entre ellas.' },
      { value: 'Excéntricas', label: 'Excéntricas (Negativas)', description: 'Enfocate en la fase de bajada del peso, de forma lenta y controlada durante 4 a 6 segundos.' }
];

export const apiClient = {
  // --- Super Admin ---
  async getGyms(): Promise<Gym[]> {
    try {
        const response = await fetch('/api/gyms');
        if (!response.ok) throw new Error('Network response was not ok');
        // FIX: Explicitly cast the result of response.json() to the correct type.
        return (await response.json()) as Gym[];
    } catch (error) {
        console.error("Failed to fetch gyms:", error);
        return [];
    }
  },
  
  async createGym(name: string, username: string, password: string, dailyQuestionLimit: number, logoSvg: string | null, planType: PlanType): Promise<boolean> {
     try {
        const response = await fetch('/api/gyms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, password, dailyQuestionLimit, logoSvg, planType }),
        });
        return response.ok;
    } catch (error) {
        console.error("Failed to create gym:", error);
        return false;
    }
  },
  
  async updateGym(gymId: string, data: Partial<Gym & { password?: string }>): Promise<boolean> {
     try {
        const response = await fetch(`/api/gyms?id=${gymId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return response.ok;
    } catch (error) {
        console.error(`Failed to update gym ${gymId}:`, error);
        return false;
    }
  },

  async deleteGym(gymId: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/gyms?id=${gymId}`, { method: 'DELETE' });
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
        // FIX: Explicitly cast the result of response.json() to the correct type.
        return (await response.json()) as Gym;
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
        const response = await fetch(`/api/clients?dni=${dni}`);
        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error('Network response was not ok');
        }
        // FIX: Explicitly cast the result of response.json() to the correct type.
        return (await response.json()) as ClientData;
    } catch (error) {
        console.error(`Failed to fetch client data for DNI ${dni}:`, error);
        return null;
    }
  },

  async saveClientData(dni: string, dataToSave: Partial<ClientData>): Promise<boolean> {
    try {
        const response = await fetch(`/api/clients?dni=${dni}`, {
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
            fetch(`/api/clients?dni=${dni}`, {
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
            fetch(`/api/clients?dni=${dni}`, { method: 'DELETE' })
        );
        await Promise.all(promises);
    } catch (error) {
        console.error(`Failed to delete clients:`, error);
    }
  },

  async registerClient(dni: string, name: string, password: string, gymId: string): Promise<{ success: boolean; message?: string }> {
    try {
        const response = await fetch('/api/auth/client-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni, name, password, gymId }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            return { success: false, message: errorData.message || 'Failed to register client' };
        }
        return { success: true };
    } catch (error) {
        console.error(`Failed to register client with DNI ${dni}:`, error);
        return { success: false, message: 'An unexpected error occurred.' };
    }
  },

  async loginClient(dni: string, accessCode: string): Promise<{ success: boolean; resetRequired?: boolean; }> {
     try {
        const response = await fetch(`/api/auth/client-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni, code: accessCode }),
        });
        if (!response.ok) return { success: false };
        // FIX: Explicitly cast the result of response.json() to the correct type.
        const data = await response.json();
        return data as { success: boolean; resetRequired?: boolean; };
    } catch (error) {
        return { success: false };
    }
  },

  async enablePlanGeneration(dni: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/clients?dni=${dni}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reset_plan' }),
        });
        return response.ok;
    } catch (error) {
        console.error(`Failed to enable plan generation for client ${dni}:`, error);
        return false;
    }
  },
  
   async requestPasswordReset(dni: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/clients?dni=${dni}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'request_password_reset' }),
        });
        return response.ok;
    } catch (error) {
        console.error(`Failed to request password reset for client ${dni}:`, error);
        return false;
    }
  },

  async setNewPassword(dni: string, password: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/clients?dni=${dni}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_new_password', password: password }),
        });
        return response.ok;
    } catch (error) {
        console.error(`Failed to set new password for client ${dni}:`, error);
        return false;
    }
  },


  // Exercise Library Management (Scoped by Gym)
  async getExerciseLibrary(gymId: string): Promise<ExerciseLibrary> {
    try {
        const response = await fetch(`/api/library?gymId=${gymId}`);
        if (!response.ok) throw new Error('Network response was not ok');
        // FIX: Explicitly cast the result of response.json() to the correct type.
        return (await response.json()) as ExerciseLibrary;
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

  // --- Trainer Request System ---
  async getRequests(gymId: string): Promise<Request[]> {
    try {
      const response = await fetch(`/api/requests?gymId=${gymId}`);
      if (!response.ok) throw new Error('Network response was not ok');
      // FIX: Explicitly cast the result of response.json() to the correct type.
      return (await response.json()) as Request[];
    } catch (error) {
      console.error("Failed to fetch requests:", error);
      return [];
    }
  },

  async getRequestsByClient(clientId: string): Promise<Request[]> {
    try {
      const response = await fetch(`/api/requests?clientId=${clientId}`);
      if (!response.ok) throw new Error('Network response was not ok');
      // FIX: Explicitly cast the result of response.json() to the correct type.
      return (await response.json()) as Request[];
    } catch (error) {
      console.error(`Failed to fetch requests for client ${clientId}:`, error);
      return [];
    }
  },

  async createRequest(requestData: Omit<Request, '_id' | 'status' | 'createdAt'>): Promise<boolean> {
    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });
      return response.ok;
    } catch (error) {
      console.error("Failed to create request:", error);
      return false;
    }
  },

  async updateRequestStatus(requestId: string, status: 'read' | 'resolved'): Promise<boolean> {
    try {
      const response = await fetch(`/api/requests?id=${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      return response.ok;
    } catch (error) {
      console.error(`Failed to update request ${requestId}:`, error);
      return false;
    }
  },

  async deleteRequest(requestId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/requests?id=${requestId}`, { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error(`Failed to delete request ${requestId}:`, error);
      return false;
    }
  },

  // --- Routine Templates ---
  async getRoutineTemplates(gymId: string): Promise<RoutineTemplate[]> {
    try {
        const response = await fetch(`/api/routine-templates?gymId=${gymId}`);
        if (!response.ok) throw new Error('Network response was not ok');
        return (await response.json()) as RoutineTemplate[];
    } catch (error) {
        console.error("Failed to fetch routine templates:", error);
        return [];
    }
  },

  async createRoutineTemplate(templateData: Omit<RoutineTemplate, '_id'>): Promise<RoutineTemplate | null> {
    try {
        const response = await fetch('/api/routine-templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(templateData),
        });
        if (!response.ok) return null;
        return (await response.json()) as RoutineTemplate;
    } catch (error) {
        console.error("Failed to create routine template:", error);
        return null;
    }
  },

  async updateRoutineTemplate(templateId: string, templateData: Partial<RoutineTemplate>): Promise<boolean> {
    try {
        const response = await fetch(`/api/routine-templates?id=${templateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(templateData),
        });
        return response.ok;
    } catch (error) {
        console.error(`Failed to update routine template ${templateId}:`, error);
        return false;
    }
  },

  async deleteRoutineTemplate(templateId: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/routine-templates?id=${templateId}`, { method: 'DELETE' });
        return response.ok;
    } catch (error) {
        console.error(`Failed to delete routine template ${templateId}:`, error);
        return false;
    }
  },
};