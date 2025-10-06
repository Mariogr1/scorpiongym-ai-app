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

export interface StaffUser {
    _id: string;
    name: string;
    username: string;
    // FIX: Add optional 'password' property to allow password updates and user creation.
    password?: string;
    role?: 'trainer' | 'accountant' | 'superadmin';
    associatedGymId?: string; // For accountants to link to a gym
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

// --- NEW Accounting Types ---
export interface Transaction {
    _id: string;
    gymId: string;
    type: 'income' | 'expense';
    date: string; // ISO String
    description: string;
    amount: number;
    category: string;
    paymentMethod: string; // 'Efectivo', 'Tarjeta', 'Transferencia'
    accountId: string;
}

export interface Account {
    _id: string;
    gymId: string;
    name: string;
}

export interface Employee {
    _id: string;
    gymId: string;
    name: string;
    role: string;
    hourlyRate: number;
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
  async getStaffUsers(): Promise<StaffUser[]> {
    try {
        const response = await fetch('/api/gyms');
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch users:", error);
        return [];
    }
  },
  
  async createStaffUser(data: Partial<StaffUser>): Promise<boolean> {
     try {
        const response = await fetch('/api/gyms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return response.ok;
    } catch (error) {
        console.error("Failed to create user:", error);
        return false;
    }
  },
  
  async updateStaffUser(userId: string, data: Partial<StaffUser>): Promise<boolean> {
     try {
        const response = await fetch(`/api/gyms/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return response.ok;
    } catch (error) {
        console.error(`Failed to update user ${userId}:`, error);
        return false;
    }
  },

  async deleteStaffUser(userId: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/gyms/${userId}`, { method: 'DELETE' });
        return response.ok;
    } catch (error) {
        console.error(`Failed to delete user ${userId}:`, error);
        return false;
    }
  },

  // --- Gym/Coach Auth ---
  async gymLogin(username: string, password: string): Promise<StaffUser | null> {
    try {
        const response = await fetch('/api/auth/gym-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error("Staff login failed:", error);
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
        const data = await response.json();
        return data; // e.g., { success: true } or { success: true, resetRequired: true }
    } catch (error) {
        return { success: false };
    }
  },

  async enablePlanGeneration(dni: string): Promise<boolean> {
    try {
        const response = await fetch(`/api/clients/${dni}`, {
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
        const response = await fetch(`/api/clients/${dni}`, {
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
        const response = await fetch(`/api/clients/${dni}`, {
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

  // --- Trainer Request System ---
  async getRequests(gymId: string): Promise<Request[]> {
    try {
      const response = await fetch(`/api/requests?gymId=${gymId}`);
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch requests:", error);
      return [];
    }
  },

  async getRequestsByClient(clientId: string): Promise<Request[]> {
    try {
      const response = await fetch(`/api/requests?clientId=${clientId}`);
      if (!response.ok) throw new Error('Network response was not ok');
      return await response.json();
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
      const response = await fetch(`/api/requests/${requestId}`, {
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
      const response = await fetch(`/api/requests/${requestId}`, { method: 'DELETE' });
      return response.ok;
    } catch (error) {
      console.error(`Failed to delete request ${requestId}:`, error);
      return false;
    }
  },

  // --- NEW Accounting API Methods ---
  async getAccountingData(gymId: string, entity: 'transactions' | 'accounts' | 'employees'): Promise<any[]> {
    try {
        const response = await fetch(`/api/accounting?gymId=${gymId}&entity=${entity}`);
        if (!response.ok) throw new Error(`Failed to fetch ${entity}`);
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${entity}:`, error);
        return [];
    }
  },

  async addAccountingData(gymId: string, entity: 'transactions' | 'accounts' | 'employees', data: any): Promise<boolean> {
    try {
        const response = await fetch(`/api/accounting?gymId=${gymId}&entity=${entity}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, gymId }),
        });
        return response.ok;
    } catch (error) {
        console.error(`Error adding ${entity}:`, error);
        return false;
    }
  },
};