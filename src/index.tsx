"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";
import "./index.css";

declare var process: any;

// --- Type Definitions ---
interface Profile {
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

interface Exercise {
    nombre: string;
    series: string;
    repeticiones: string;
    descanso: string;
    tecnicaAvanzada?: string;
}

interface DayPlan {
    dia: string;
    grupoMuscular: string;
    ejercicios: Exercise[];
    cardio: string;
}

interface Phase {
    phaseName: string;
    durationWeeks: number;
    routine: {
        dias: DayPlan[];
    };
}

interface Routine {
    planName: string;
    totalDurationWeeks: number;
    phases: Phase[];
}

interface FoodItem {
    food: string;
    amount: string;
}

interface Meal {
    mealName: string;
    foodItems: FoodItem[];
}

interface DietPlan {
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

interface ProgressLogEntry {
    date: string; // Should be a full ISO string
    weight: number;
    repetitions: number;
}

type ProgressLog = Record<string, ProgressLogEntry[]>;

interface BodyWeightEntry {
    date: string; // Should be a full ISO string
    weight: number;
    imc?: number;
    imcCategoryClass?: string;
}

// --- Nuevas definiciones para Biblioteca de Ejercicios ---
interface ExerciseDefinition {
    name: string;
    isEnabled: boolean;
    youtubeLink: string;
}

type ExerciseLibrary = Record<string, ExerciseDefinition[]>;


interface ClientData {
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

interface ClientListItem {
    dni: string;
    profile: Partial<Profile>;
    planName: string;
    status: 'active' | 'archived';
}


const ADMIN_PASSWORD = "admin";

const advancedTechniqueOptions = [
      { value: '', label: 'Ninguna' },
      { value: 'Drop Set (2 descensos) - Al fallo, bajá el peso un 20-25% y seguí sin descanso. Repetilo 2 veces.', label: 'Drop Set (2 descensos)' },
      { value: 'Rest-Pause (3 pausas) - Al fallo, descansá 15s y sacá más reps. Repetilo 3 veces. Es una sola serie.', label: 'Rest-Pause (3 pausas)' },
      { value: 'Myo-reps (3 pasadas) - Tras una serie de activación al fallo, descansá 20-30s. Luego realizá 3 pasadas de 3-5 reps con el mismo peso, descansando solo 10-15s entre ellas.', label: 'Myo-reps (3 pasadas)' },
      { value: 'Excéntricas (fase de 4-6s) - Enfocate en la fase de bajada del peso, de forma lenta y controlada durante 4 a 6 segundos.', label: 'Excéntricas (Negativas)' }
];

// --- Default Exercise Library ---
const DEFAULT_EXERCISE_LIBRARY: ExerciseLibrary = {
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

// --- Utility Function ---
const getBmiDetails = (weight: number, heightCm: number): { bmi: number | null, category: string, categoryClass: string } => {
    if (isNaN(weight) || weight <= 0 || isNaN(heightCm) || heightCm <= 0) {
        return { bmi: null, category: 'N/A', categoryClass: '' };
    }

    const heightM = heightCm / 100;
    const bmiValue = weight / (heightM * heightM);

    if (isNaN(bmiValue) || !isFinite(bmiValue)) {
        return { bmi: null, category: 'N/A', categoryClass: '' };
    }

    let category = 'N/A';
    let categoryClass = 'normal';
    if (bmiValue < 18.5) { category = 'Bajo peso'; categoryClass = 'underweight'; }
    else if (bmiValue < 25) { category = 'Peso normal'; categoryClass = 'normal'; }
    else if (bmiValue < 30) { category = 'Sobrepeso'; categoryClass = 'overweight'; }
    else { category = 'Obesidad'; categoryClass = 'obesity'; }

    return { bmi: bmiValue, category, categoryClass };
};


// --- COMPONENTES DE VISTAS ---

// 0. Modal de Confirmación
const ConfirmationModal = ({
  isOpen,
  message,
  onConfirm,
  onCancel,
}: {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="cta-button secondary" onClick={onCancel}>
            Cancelar
          </button>
          <button className="cta-button" onClick={onConfirm}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};

// 1. Página de Bienvenida (Selección de Rol)
const LandingPage = ({ onSelectRole }: { onSelectRole: (role: 'admin' | 'client') => void }) => (
    <div className="login-container">
        <header>
            <h1>ScorpionGYM AI</h1>
            <p>Tu plataforma de entrenamiento inteligente.</p>
        </header>
        <div className="landing-box">
            <h2>Bienvenido</h2>
            <p>¿Cómo querés acceder?</p>
            <div className="role-selection">
                <button className="cta-button" onClick={() => onSelectRole('admin')}>Acceso Entrenador</button>
                <button className="cta-button secondary" onClick={() => onSelectRole('client')}>Acceso Cliente</button>
            </div>
        </div>
    </div>
);

// 2. Login de Administrador
const AdminLogin = ({ onLogin }: { onLogin: () => void }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            onLogin();
        } else {
            setError('Contraseña incorrecta.');
            setPassword('');
        }
    };

    return (
        <div className="login-container">
            <header><h1>ScorpionGYM AI</h1></header>
            <div className="login-box">
                <h2>Acceso de Entrenador</h2>
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        placeholder="Contraseña"
                        aria-label="Contraseña de administrador"
                    />
                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button" disabled={!password}>Ingresar</button>
                </form>
            </div>
        </div>
    );
};

// 3. Login de Cliente
const ClientLogin = ({ onLogin, onBack }: { onLogin: (dni: string) => void; onBack: () => void; }) => {
    const [dni, setDni] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const storedData = localStorage.getItem(`gym_ai_user_${dni}`);
        if (storedData) {
            const userData = JSON.parse(storedData) as Partial<ClientData>;
            if (userData.accessCode === accessCode && (userData.status === 'active' || userData.status === undefined)) {
                onLogin(dni);
            } else {
                setError('DNI o código incorrectos, o cliente inactivo.');
            }
        } else {
            setError('DNI o código incorrectos.');
        }
    };
    
    return (
         <div className="login-container">
             <header><h1>ScorpionGYM AI</h1></header>
            <div className="login-box">
                <h2>Acceso de Cliente</h2>
                <form onSubmit={handleSubmit}>
                    <input type="text" value={dni} onChange={e => {setDni(e.target.value); setError('')}} placeholder="DNI" />
                    <input type="password" value={accessCode} onChange={e => {setAccessCode(e.target.value); setError('')}} placeholder="Código de Acceso" />
                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button" disabled={!dni || !accessCode}>Ingresar</button>
                    <button type="button" className="back-button simple" onClick={onBack}>← Volver</button>
                </form>
            </div>
        </div>
    );
};

// --- Componente de Gráfico de Peso Corporal y IMC ---
const BodyWeightChart = ({ data }: { data: BodyWeightEntry[] }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string; type: 'weight' | 'imc' } | null>(null);

    if (!data || data.length < 1) {
        return <div className="placeholder">Se necesita al menos 1 registro de peso para mostrar el gráfico.</div>;
    }
    
    const width = 500;
    const height = 300;
    const margin = { top: 30, right: 50, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const weights = data.map(d => d.weight);
    const imcs = data.map(d => d.imc || 0);

    const maxWeight = Math.max(0, ...weights);
    const maxImc = Math.max(0, ...imcs);

    const yScaleWeight = (weight: number) => margin.top + innerHeight - ((weight / (maxWeight || 1)) * innerHeight);
    const yScaleImc = (imc: number) => margin.top + innerHeight - ((imc / (maxImc || 1)) * innerHeight);

    const numEntries = data.length;
    const groupPadding = 0.2;
    const groupWidth = innerWidth / numEntries;
    const barAreaWidth = groupWidth * (1 - groupPadding);
    const barWidth = barAreaWidth / 2;

    const yAxisTicksWeight = Array.from({ length: 5 }, (_, i) => Math.round((maxWeight / 4) * i));
    const yAxisTicksImc = Array.from({ length: 5 }, (_, i) => parseFloat(((maxImc / 4) * i).toFixed(1)));

    return (
        <div className="chart-container body-weight-chart-container">
            <h4>Evolución del Peso Corporal y IMC</h4>
            <svg viewBox={`0 0 ${width} ${height}`} className="body-weight-chart" aria-label="Gráfico de evolución de peso corporal e IMC">
                {/* Y-axis Left (Weight) */}
                <g className="axis y-axis-left" aria-hidden="true">
                    {yAxisTicksWeight.map((tick, i) => (
                        <g key={`y-left-${i}`} transform={`translate(0, ${yScaleWeight(tick)})`}>
                            <line x1={margin.left} x2={width - margin.right} strokeDasharray="2,2" />
                            <text x={margin.left - 8} dy="0.32em">{tick}</text>
                        </g>
                    ))}
                    <text transform="rotate(-90)" y="10" x={-(margin.top + innerHeight / 2)} textAnchor="middle" className="axis-label">Peso (kg)</text>
                </g>

                {/* Y-axis Right (IMC) */}
                <g className="axis y-axis-right" aria-hidden="true">
                    {yAxisTicksImc.map((tick, i) => (
                        <g key={`y-right-${i}`} transform={`translate(0, ${yScaleImc(tick)})`}>
                            <text x={width - margin.right + 8} dy="0.32em">{tick}</text>
                        </g>
                    ))}
                    <text transform="rotate(90)" y={-(width - 15)} x={margin.top + innerHeight / 2} textAnchor="middle" className="axis-label">IMC</text>
                </g>
                
                {/* X-axis */}
                <g className="axis x-axis" aria-hidden="true">
                    {data.map((d, i) => {
                        const groupXStart = margin.left + i * groupWidth;
                        return (
                            <text key={`x-label-${i}`} x={groupXStart + groupWidth / 2} y={height - margin.bottom + 20} textAnchor="middle">
                                {new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                            </text>
                        );
                    })}
                </g>

                {/* Bars */}
                <g className="chart-bars">
                    {data.map((d, i) => {
                        const groupXStart = margin.left + i * groupWidth;
                        const paddingOffset = (groupWidth * groupPadding) / 2;
                        const x1 = groupXStart + paddingOffset;
                        const x2 = x1 + barWidth;
                        const yWeight = yScaleWeight(d.weight);
                        const yImc = yScaleImc(d.imc || 0);
                        const barHeightWeight = (innerHeight + margin.top) - yWeight;
                        const barHeightImc = (innerHeight + margin.top) - yImc;

                        return (
                            <g key={i}>
                                <rect
                                    className="bar-body-weight"
                                    x={x1}
                                    y={yWeight}
                                    width={barWidth}
                                    height={barHeightWeight > 0 ? barHeightWeight : 0}
                                    onMouseEnter={() => setTooltip({ x: x1 + barWidth / 2, y: yWeight, content: `${d.weight} kg`, type: 'weight' })}
                                    onMouseLeave={() => setTooltip(null)}
                                    aria-label={`Registro ${i + 1}: ${d.weight} kg`}
                                />
                                {d.imc && (
                                    <rect
                                        className={`bar-imc ${d.imcCategoryClass || ''}`}
                                        x={x2}
                                        y={yImc}
                                        width={barWidth}
                                        height={barHeightImc > 0 ? barHeightImc : 0}
                                        onMouseEnter={() => setTooltip({ x: x2 + barWidth / 2, y: yImc, content: `${d.imc.toFixed(1)} IMC`, type: 'imc' })}
                                        onMouseLeave={() => setTooltip(null)}
                                        aria-label={`Registro ${i + 1}: ${d.imc.toFixed(1)} IMC`}
                                    />
                                )}
                            </g>
                        );
                    })}
                </g>

                {/* Tooltip */}
                {tooltip && (
                    <g transform={`translate(${tooltip.x}, ${tooltip.y})`} className="chart-tooltip" aria-hidden="true">
                        <rect x="-35" y="-35" width="70" height="25" rx="5" className={`tooltip-bg ${tooltip.type}`} />
                        <text x="0" y="-22" textAnchor="middle" className="tooltip-text">{tooltip.content}</text>
                    </g>
                )}
            </svg>
            <div className="chart-legend">
                <span className="legend-item"><span className="legend-color-box body-weight"></span> Peso (kg)</span>
                <span className="legend-item"><span className="legend-color-box imc"></span> IMC (Semáforo)</span>
            </div>
        </div>
    );
};

// --- Componente de Gráfico de Progreso de Ejercicios ---
const ExerciseProgressChart = ({ data }: { data: ProgressLogEntry[] }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string; type: 'weight' | 'reps' } | null>(null);

    if (!data || data.length < 1) {
        return <div className="placeholder">Se necesita al menos 1 registro para mostrar el gráfico.</div>;
    }

    const width = 500;
    const height = 300;
    const margin = { top: 30, right: 50, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const weights = data.map(d => d.weight);
    const reps = data.map(d => d.repetitions);

    const maxWeight = Math.max(0, ...weights);
    const maxReps = Math.max(0, ...reps);

    const yScaleWeight = (weight: number) => margin.top + innerHeight - ((weight / (maxWeight || 1)) * innerHeight);
    const yScaleReps = (rep: number) => margin.top + innerHeight - ((rep / (maxReps || 1)) * innerHeight);

    const numEntries = data.length;
    const groupPadding = 0.2;
    const groupWidth = innerWidth / numEntries;
    const barAreaWidth = groupWidth * (1 - groupPadding);
    const barWidth = barAreaWidth / 2;

    const yAxisTicksWeight = Array.from({ length: 5 }, (_, i) => Math.round((maxWeight / 4) * i));
    const yAxisTicksReps = Array.from({ length: 5 }, (_, i) => Math.round((maxReps / 4) * i));

    return (
        <div className="chart-container exercise-chart">
            <h4>Progreso de Peso y Repeticiones</h4>
            <svg viewBox={`0 0 ${width} ${height}`} className="exercise-progress-chart" aria-label="Gráfico de progreso de peso y repeticiones del ejercicio">
                {/* Y-axis Left (Weight) */}
                <g className="axis y-axis-left" aria-hidden="true">
                    {yAxisTicksWeight.map((tick, i) => (
                        <g key={`y-left-${i}`} transform={`translate(0, ${yScaleWeight(tick)})`}>
                            <line x1={margin.left} x2={width - margin.right} strokeDasharray="2,2" />
                            <text x={margin.left - 8} dy="0.32em">{tick}</text>
                        </g>
                    ))}
                    <text transform="rotate(-90)" y="10" x={-(margin.top + innerHeight / 2)} textAnchor="middle" className="axis-label">Peso (kg)</text>
                </g>

                {/* Y-axis Right (Reps) */}
                <g className="axis y-axis-right" aria-hidden="true">
                    {yAxisTicksReps.map((tick, i) => (
                        <g key={`y-right-${i}`} transform={`translate(0, ${yScaleReps(tick)})`}>
                            <text x={width - margin.right + 8} dy="0.32em">{tick}</text>
                        </g>
                    ))}
                    <text transform="rotate(90)" y={-(width - 15)} x={margin.top + innerHeight / 2} textAnchor="middle" className="axis-label">Reps</text>
                </g>

                {/* X-axis */}
                <g className="axis x-axis" aria-hidden="true">
                    {data.map((d, i) => {
                        const groupXStart = margin.left + i * groupWidth;
                        return (
                            <text key={`x-label-${i}`} x={groupXStart + groupWidth / 2} y={height - margin.bottom + 20} textAnchor="middle">
                                {new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
                            </text>
                        );
                    })}
                </g>

                {/* Bars */}
                <g className="chart-bars">
                    {data.map((d, i) => {
                        const groupXStart = margin.left + i * groupWidth;
                        const paddingOffset = (groupWidth * groupPadding) / 2;
                        const x1 = groupXStart + paddingOffset;
                        const x2 = x1 + barWidth;
                        const yWeight = yScaleWeight(d.weight);
                        const yReps = yScaleReps(d.repetitions);
                        const barHeightWeight = (innerHeight + margin.top) - yWeight;
                        const barHeightReps = (innerHeight + margin.top) - yReps;

                        return (
                            <g key={i}>
                                <rect
                                    className="bar-weight"
                                    x={x1}
                                    y={yWeight}
                                    width={barWidth}
                                    height={barHeightWeight > 0 ? barHeightWeight : 0}
                                    onMouseEnter={() => setTooltip({ x: x1 + barWidth / 2, y: yWeight, content: `${d.weight} kg`, type: 'weight' })}
                                    onMouseLeave={() => setTooltip(null)}
                                    aria-label={`Registro ${i + 1}: ${d.weight} kg`}
                                />
                                <rect
                                    className="bar-reps"
                                    x={x2}
                                    y={yReps}
                                    width={barWidth}
                                    height={barHeightReps > 0 ? barHeightReps : 0}
                                    onMouseEnter={() => setTooltip({ x: x2 + barWidth / 2, y: yReps, content: `${d.repetitions} reps`, type: 'reps' })}
                                    onMouseLeave={() => setTooltip(null)}
                                     aria-label={`Registro ${i + 1}: ${d.repetitions} repeticiones`}
                                />
                            </g>
                        );
                    })}
                </g>

                {/* Tooltip */}
                {tooltip && (
                    <g transform={`translate(${tooltip.x}, ${tooltip.y})`} className="chart-tooltip" aria-hidden="true">
                        <rect x="-35" y="-35" width="70" height="25" rx="5" className={`tooltip-bg ${tooltip.type}`} />
                        <text x="0" y="-22" textAnchor="middle" className="tooltip-text">{tooltip.content}</text>
                    </g>
                )}
            </svg>
            <div className="chart-legend">
                <span className="legend-item"><span className="legend-color-box weight"></span> Peso (kg)</span>
                <span className="legend-item"><span className="legend-color-box reps"></span> Repeticiones</span>
            </div>
        </div>
    );
};


// --- ProgressView Component (replaces ProgressList) ---
interface ProgressViewProps {
    progressLog: ProgressLog;
    bodyWeightLog?: BodyWeightEntry[];
}
const ProgressView = ({ progressLog, bodyWeightLog }: ProgressViewProps) => {
    const [activeProgressTab, setActiveProgressTab] = useState('exercises');

    // Logic from original ProgressList
    const availableExercises = useMemo(() => Object.keys(progressLog).filter(key => progressLog[key]?.length > 0), [progressLog]);
    const [selectedExercise, setSelectedExercise] = useState(availableExercises[0] || '');

    useEffect(() => {
        if (!selectedExercise && availableExercises.length > 0) {
            setSelectedExercise(availableExercises[0]);
        }
    }, [availableExercises, selectedExercise]);
    
    const hasExerciseData = availableExercises.length > 0;
    const hasWeightData = bodyWeightLog && bodyWeightLog.length > 0;

    useEffect(() => {
        if (!hasExerciseData && hasWeightData) {
            setActiveProgressTab('weight');
        } else {
             setActiveProgressTab('exercises');
        }
    }, [hasExerciseData, hasWeightData]);

    const exerciseDataForChart = useMemo(() => {
        if (!selectedExercise || !progressLog[selectedExercise]) return [];
        return progressLog[selectedExercise]; // Chronological order for chart
    }, [selectedExercise, progressLog]);

    const exerciseHistoryForList = useMemo(() => {
        return [...exerciseDataForChart].reverse(); // Reversed for list display
    }, [exerciseDataForChart]);


    if (!hasExerciseData && !hasWeightData) {
        return <div className="placeholder">No hay datos de progreso registrados todavía. ¡Empezá a registrar tu entrenamiento y tu peso!</div>;
    }
    
    return (
        <div className="progress-view-container">
            <div className="progress-tabs-nav">
                {hasExerciseData && <button onClick={() => setActiveProgressTab('exercises')} className={`progress-tab-button ${activeProgressTab === 'exercises' ? 'active' : ''}`}>Progreso de Ejercicios</button>}
                {hasWeightData && <button onClick={() => setActiveProgressTab('weight')} className={`progress-tab-button ${activeProgressTab === 'weight' ? 'active' : ''}`}>Progreso Peso Corporal</button>}
            </div>

            {activeProgressTab === 'exercises' && hasExerciseData && (
                <div className="exercise-progress-view animated-fade-in">
                    <div className="form-group">
                        <label htmlFor="exercise-select">Seleccioná un ejercicio para ver tu progreso:</label>
                        <select
                            id="exercise-select"
                            className="exercise-select-dropdown"
                            value={selectedExercise}
                            onChange={e => setSelectedExercise(e.target.value)}
                        >
                            {availableExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                        </select>
                    </div>

                    {exerciseDataForChart.length > 0 && <ExerciseProgressChart data={exerciseDataForChart} />}

                    <div className="progress-list-container">
                        <h3>Historial de {selectedExercise}</h3>
                        <div className="progress-list">
                            <div className="progress-list-header">
                                <span>Fecha y Hora</span>
                                <span>Peso (kg)</span>
                                <span>Repeticiones</span>
                            </div>
                            {exerciseHistoryForList.map((entry, index) => (
                                <div key={index} className="progress-list-row">
                                    <span>{new Date(entry.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    <span>{entry.weight} kg</span>
                                    <span>{entry.repetitions}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeProgressTab === 'weight' && hasWeightData && (
                 <div className="weight-progress-view animated-fade-in">
                     <BodyWeightChart data={bodyWeightLog!} />
                      <div className="progress-list-container">
                          <h3>Historial de Peso Corporal</h3>
                          <div className="progress-list">
                              <div className="progress-list-header weight">
                                  <span>Fecha y Hora</span>
                                  <span>Peso (kg)</span>
                                  <span>IMC</span>
                              </div>
                              {[...bodyWeightLog!].reverse().map((entry, index) => (
                                  <div key={index} className="progress-list-row weight">
                                      <span>{new Date(entry.date).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                      <span>{entry.weight} kg</span>
                                      <span className={entry.imcCategoryClass || ''}>{entry.imc ? entry.imc.toFixed(1) : 'N/A'}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                 </div>
            )}
        </div>
    );
};

// --- Agreement View Component ---
const AgreementView = ({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void; }) => {
    const [isChecked, setIsChecked] = useState(false);
    const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    const termsText = `Última actualización: ${today}

Bienvenido a la plataforma digital de ScorpionGym, ubicada en la ciudad de Villa Mercedes. Al acceder y utilizar este sistema, usted acepta los siguientes términos y condiciones. Si no está de acuerdo con alguno de ellos, por favor no utilice el servicio.

1. Objeto del servicio
Este sistema ofrece rutinas de entrenamiento y recomendaciones nutricionales generadas por algoritmos automatizados, en base a los datos ingresados por el usuario. El objetivo es brindar orientación general para mejorar el bienestar físico.

2. Limitación de responsabilidad
- Las rutinas y recomendaciones nutricionales no constituyen diagnóstico médico ni tratamiento personalizado.
- El usuario reconoce que debe consultar a profesionales de la salud antes de iniciar cualquier plan de entrenamiento o dieta, especialmente si presenta condiciones médicas preexistentes.
- ScorpionGym no se responsabiliza por daños, lesiones o perjuicios derivados del uso de la información proporcionada por la plataforma.

3. Acceso y expiración de planes
- Los planes generados tienen una duración limitada y expiran automáticamente en la fecha indicada.
- Una vez vencido el plan, el usuario deberá solicitar uno nuevo a través del personal autorizado.
- El acceso a la rutina o dieta está restringido al usuario registrado y no puede compartirse, copiarse ni reproducirse sin autorización.

4. Propiedad intelectual
- Todos los contenidos, algoritmos, rutinas y diseños del sistema son propiedad de ScorpionGym.
- Está prohibida su reproducción, distribución o uso comercial sin autorización expresa.

5. Protección de datos personales
- La plataforma recopila datos físicos y objetivos de entrenamiento con fines de personalización.
- Estos datos se almacenan de forma segura y no se comparten con terceros sin consentimiento.
- El usuario puede solicitar la modificación o eliminación de sus datos conforme a la Ley 25.326 de Protección de Datos Personales.

6. Modificaciones
ScorpionGym se reserva el derecho de modificar estos términos en cualquier momento. Las actualizaciones serán publicadas en esta misma sección y entrarán en vigencia desde su publicación.

7. Jurisdicción
Este acuerdo se rige por las leyes de la República Argentina. Cualquier controversia será resuelta por los tribunales competentes de la ciudad de Villa Mercedes.

Al utilizar esta plataforma, usted declara haber leído, comprendido y aceptado estos términos y condiciones.`;

    const privacyText = `Última actualización: ${today}

En ScorpionGym, respetamos y protegemos la privacidad de nuestros usuarios. Esta política explica cómo recopilamos, usamos y protegemos sus datos personales.

1. Datos que recopilamos
- Información física: edad, peso, altura, nivel de entrenamiento.
- Objetivos personales: pérdida de grasa, ganancia muscular, mantenimiento.
- Datos de progreso: carga utilizada, frecuencia, sensaciones, recuperación.
- Información de contacto (si aplica): nombre, correo electrónico, teléfono.

2. Finalidad del uso
- Personalizar rutinas y recomendaciones.
- Realizar seguimiento del progreso físico.
- Mejorar la calidad del servicio y la experiencia del usuario.
- Contactar al usuario en caso de actualizaciones o vencimiento de planes.

3. Seguridad de los datos
- Los datos se almacenan en servidores seguros con acceso restringido.
- Se aplican medidas de protección como encriptación, autenticación y control de accesos.
- No se comparten con terceros sin consentimiento expreso del usuario.

4. Derechos del usuario
- Acceder a sus datos personales.
- Solicitar la rectificación, actualización o eliminación de sus datos.
- Retirar el consentimiento para el uso de sus datos en cualquier momento.

5. Modificaciones
ScorpionGym se reserva el derecho de modificar esta política. Las actualizaciones serán publicadas en esta sección.

6. Contacto
Para consultas sobre esta política o sobre sus datos personales, puede comunicarse con nosotros en [Contacto de ScorpionGym].`;

    return (
        <div className="agreement-container">
            <h1>Acuerdos de Uso y Privacidad</h1>
            <p style={{textAlign: "center", color: "var(--text-secondary-color)", marginTop: "-1.5rem"}}>Para continuar, por favor leé y aceptá los siguientes términos.</p>
            
            <h2>📝 Términos y Condiciones de Uso</h2>
            <div className="terms-box">
                <p>{termsText}</p>
            </div>
            
            <h2>🔐 Política de Privacidad</h2>
             <div className="terms-box">
                <p>{privacyText}</p>
            </div>
            
            <div className="agreement-actions">
                <div className="agreement-checkbox">
                    <input id="terms-check" type="checkbox" checked={isChecked} onChange={() => setIsChecked(!isChecked)} />
                    <label htmlFor="terms-check">He leído y acepto los Términos y Condiciones y la Política de Privacidad.</label>
                </div>
                <div className="agreement-buttons">
                    <button className="cta-button secondary" onClick={onDecline}>Rechazar y Salir</button>
                    <button className="cta-button" onClick={onAccept} disabled={!isChecked}>Aceptar y Continuar</button>
                </div>
            </div>
        </div>
    );
};


// 4. Portal del Cliente (Vista de solo lectura)
const ClientPortal = ({ clientDni, onLogout }: { clientDni: string, onLogout: () => void }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({});
    const [activeTab, setActiveTab] = useState<'training' | 'nutrition' | 'progress'>('training');
    const [selectedPhaseTabIndex, setSelectedPhaseTabIndex] = useState(0);
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [dailyWeights, setDailyWeights] = useState<Record<string, string>>({});
    const [dailyReps, setDailyReps] = useState<Record<string, string>>({});
    const [saveProgressText, setSaveProgressText] = useState("Guardar Progreso");
    const [currentBodyWeight, setCurrentBodyWeight] = useState('');
    const [logWeightText, setLogWeightText] = useState("Registrar");


    useEffect(() => {
        if (!clientDni) return;
        const storedData = localStorage.getItem(`gym_ai_user_${clientDni}`);
        if (storedData) {
            const data = JSON.parse(storedData) as Partial<ClientData>;
            if (!data.progressLog) data.progressLog = {};
            if (!data.bodyWeightLog) data.bodyWeightLog = [];
            if (data.termsAccepted === undefined) data.termsAccepted = false;
            setClientData(data as ClientData);
        }
         const storedLibrary = localStorage.getItem('gym_ai_exercise_library');
        if (storedLibrary) {
            setExerciseLibrary(JSON.parse(storedLibrary));
        }
    }, [clientDni]);

    const flatExerciseLibrary = useMemo(() => Object.values(exerciseLibrary).flat(), [exerciseLibrary]);

    useEffect(() => {
        setSelectedDayIndex(0);
    }, [selectedPhaseTabIndex]);
    
    const { profile, routine, dietPlan, progressLog, bodyWeightLog, termsAccepted } = clientData || {};

    const { bmi, bmiCategory } = useMemo(() => {
        if (!profile?.weight || !profile?.height) return { bmi: null, bmiCategory: 'N/A' };
        const { bmi, category } = getBmiDetails(parseFloat(profile.weight), parseFloat(profile.height));
        return { bmi, bmiCategory: category };
    }, [profile?.weight, profile?.height]);

    const targetWeight = useMemo(() => {
        if (!profile?.weight || !profile?.goal || !routine?.totalDurationWeeks) return null;
        const currentWeight = parseFloat(profile.weight);
        if (isNaN(currentWeight) || currentWeight <= 0) return null;

        const { goal } = profile;
        const { totalDurationWeeks } = routine;
        let target;
        if (goal === 'Pérdida de grasa') {
            const weeklyLoss = currentWeight * 0.005;
            target = currentWeight - (weeklyLoss * totalDurationWeeks);
        } else if (goal === 'Hipertrofia') {
            const weeklyGain = 0.2;
            target = currentWeight + (weeklyGain * totalDurationWeeks);
        } else {
            target = currentWeight;
        }
        return target > 0 ? target : null;
    }, [profile, routine]);


    const handleWeightChange = (exerciseName: string, weight: string) => {
        setDailyWeights(prev => ({ ...prev, [exerciseName]: weight }));
    };

    const handleRepChange = (exerciseName: string, reps: string) => {
        setDailyReps(prev => ({ ...prev, [exerciseName]: reps }));
    };

    const handleLogBodyWeight = () => {
        if (!clientData || !clientDni || !currentBodyWeight || isNaN(parseFloat(currentBodyWeight)) || !profile?.height) return;

        const now = new Date().toISOString();
        const weight = parseFloat(currentBodyWeight);
        const height = parseFloat(profile.height);
        const { bmi, categoryClass } = getBmiDetails(weight, height);

        const newLogEntry: BodyWeightEntry = { date: now, weight: weight, imc: bmi ?? undefined, imcCategoryClass: categoryClass };

        const existingLog: BodyWeightEntry[] = clientData.bodyWeightLog ? [...clientData.bodyWeightLog] : [];
        existingLog.push(newLogEntry);
        existingLog.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const updatedClientData: ClientData = { ...clientData, bodyWeightLog: existingLog };
        localStorage.setItem(`gym_ai_user_${clientDni}`, JSON.stringify(updatedClientData));
        setClientData(updatedClientData);
        setCurrentBodyWeight('');
        setLogWeightText("✓");
        setTimeout(() => setLogWeightText("Registrar"), 2000);
    };

    const handleSaveProgress = () => {
        if (!clientData || !clientDni) return;

        const now = new Date().toISOString();
        const newProgressLog: ProgressLog = JSON.parse(JSON.stringify(clientData.progressLog || {}));
        let progressWasSaved = false;

        const exercisesToLog = new Set([...Object.keys(dailyWeights), ...Object.keys(dailyReps)]);

        exercisesToLog.forEach(exerciseName => {
            const weight = dailyWeights[exerciseName];
            const reps = dailyReps[exerciseName];

            // Only log if both weight and reps are valid numbers
            if (!weight || isNaN(parseFloat(weight)) || !reps || isNaN(parseInt(reps, 10))) {
                return;
            }

            if (!newProgressLog[exerciseName]) {
                newProgressLog[exerciseName] = [];
            }
            
            newProgressLog[exerciseName].push({ date: now, weight: parseFloat(weight), repetitions: parseInt(reps, 10) });
            newProgressLog[exerciseName].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            progressWasSaved = true;
        });

        if (progressWasSaved) {
            const updatedClientData: ClientData = { ...clientData, progressLog: newProgressLog };
            localStorage.setItem(`gym_ai_user_${clientDni}`, JSON.stringify(updatedClientData));
            setClientData(updatedClientData);
            setDailyWeights({});
            setDailyReps({});
            setSaveProgressText("Guardado ✓");
            setTimeout(() => setSaveProgressText("Guardar Progreso"), 2000);
        }
    };
    
    const handleAcceptTerms = () => {
        if (!clientData || !clientDni) return;
        const updatedClientData: ClientData = { ...clientData, termsAccepted: true };
        localStorage.setItem(`gym_ai_user_${clientDni}`, JSON.stringify(updatedClientData));
        setClientData(updatedClientData);
    };

    const routinePlanInfo = useMemo(() => {
        if (!clientData?.routine || !clientData?.routineGeneratedDate) return null;
        const startDate = new Date(clientData.routineGeneratedDate);
        const totalDurationMillis = clientData.routine.totalDurationWeeks * 7 * 24 * 60 * 60 * 1000;
        const expirationDate = new Date(startDate.getTime() + totalDurationMillis);
        const isExpired = new Date() > expirationDate;
        return { expirationDate, isExpired };
    }, [clientData]);

    if (!clientData) return <div className="client-view-container"><div className="spinner"></div></div>;
    
    if (!termsAccepted) {
        return <AgreementView onAccept={handleAcceptTerms} onDecline={onLogout} />;
    }

    const selectedPhase = routine?.phases?.[selectedPhaseTabIndex];
    const selectedDay = selectedPhase?.routine?.dias?.[selectedDayIndex];
    const hasProgressData = (progressLog && Object.keys(progressLog).some(key => progressLog[key].length > 0)) || (bodyWeightLog && bodyWeightLog.length > 0);
    const lastWeightEntry = bodyWeightLog && bodyWeightLog.length > 0 ? bodyWeightLog[bodyWeightLog.length-1] : null;


    if (routinePlanInfo?.isExpired) {
        return (
            <div className="client-view-container expired-view">
                 <button onClick={onLogout} className="logout-button">Cerrar Sesión</button>
                <h2>Tu Plan Expiró</h2>
                <p>¡Bien ahí! Completaste tu ciclo. 💪</p>
                <p>Por favor, contactá a tu entrenador en ScorpionGYM para que te arme un nuevo plan.</p>
            </div>
        );
    }
    
    return (
        <div className="client-view-container">
            <header className="plan-header">
                <h1>Plan para {profile.name}</h1>
                {routinePlanInfo && <p>Válido hasta el {routinePlanInfo.expirationDate.toLocaleDateString()}.</p>}
                {targetWeight !== null && routine && (
                  <p className="target-weight-info">
                      Objetivo de peso al final del plan: ~{targetWeight.toFixed(1)} kg
                  </p>
                )}
                <button onClick={onLogout} className="logout-button">Cerrar Sesión</button>
            </header>
            
            {bmi !== null && (
              <div className="bmi-display client-bmi">
                  <span>IMC Actual: <strong>{bmi.toFixed(1)}</strong> ({bmiCategory})</span>
              </div>
            )}
            
            <div className="body-weight-logger">
                <label htmlFor="body-weight-input">¿Tu peso corporal de hoy?</label>
                <div className="input-group">
                    <input 
                        id="body-weight-input"
                        type="number" 
                        value={currentBodyWeight}
                        onChange={e => setCurrentBodyWeight(e.target.value)}
                        placeholder={lastWeightEntry ? `Último: ${lastWeightEntry.weight}kg` : "kg"}
                        aria-label="Peso corporal en kilogramos"
                    />
                    <button onClick={handleLogBodyWeight} className={`log-button ${logWeightText === '✓' ? 'saved' : ''}`}>
                        {logWeightText}
                    </button>
                </div>
            </div>

            <div className="main-tabs-nav">
                <button onClick={() => setActiveTab('training')} className={`main-tab-button ${activeTab === 'training' ? 'active' : ''}`}>Entrenamiento</button>
                {dietPlan && <button onClick={() => setActiveTab('nutrition')} className={`main-tab-button ${activeTab === 'nutrition' ? 'active' : ''}`}>Nutrición</button>}
                {hasProgressData && <button onClick={() => setActiveTab('progress')} className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`}>Progreso</button>}
            </div>

            {activeTab === 'training' && routine && (
                <div className="phases-container-client">
                     <header className="plan-header"><h2>{routine.planName}</h2><p>Duración total: {routine.totalDurationWeeks} semanas</p></header>
                     <div className="phases-container">
                         <div className="phase-tabs-nav">{routine.phases.map((phase, index) => (<button key={index} className={`phase-tab-button ${index === selectedPhaseTabIndex ? 'active' : ''}`} onClick={() => setSelectedPhaseTabIndex(index)}>{phase.phaseName} ({phase.durationWeeks} sem)</button>))}</div>
                         {selectedPhase && (
                         <div className="phase-tab-content">
                             <div className="day-tabs-nav">
                                 {selectedPhase.routine.dias.map((day, dayIndex) => (
                                     <button 
                                         key={dayIndex} 
                                         className={`day-tab-button ${dayIndex === selectedDayIndex ? 'active' : ''}`}
                                         onClick={() => setSelectedDayIndex(dayIndex)}>
                                         {day.dia}
                                     </button>
                                 ))}
                             </div>
                             {selectedDay && (
                                <div className="routine-plan">
                                     <div className="day-card animated-fade-in">
                                       <h4>{selectedDay.dia} - <span className="muscle-group">{selectedDay.grupoMuscular}</span></h4>
                                       <ul className="exercise-list">
                                           {selectedDay.ejercicios.map((exercise, i) => {
                                                const history = progressLog?.[exercise.nombre] || [];
                                                const lastEntry = history.length > 0 ? history[history.length - 1] : null;
                                                const lastWeight = lastEntry ? `Últ.: ${lastEntry.weight}kg` : 'kg';
                                                const lastReps = lastEntry ? `Últ.: ${lastEntry.repetitions}` : 'reps';
                                                const videoLink = flatExerciseLibrary.find(def => def.name === exercise.nombre)?.youtubeLink;

                                                return (
                                                <li key={i} className="exercise-item">
                                                    <div className="exercise-name-wrapper">
                                                        <p className="exercise-name">{exercise.nombre}</p>
                                                        {videoLink && (
                                                          <a href={videoLink} target="_blank" rel="noopener noreferrer" className="video-link" aria-label={`Ver video de ${exercise.nombre}`}>
                                                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
                                                          </a>
                                                        )}
                                                    </div>
                                                   <div className="exercise-details">
                                                       <span>Series: {exercise.series}</span>
                                                       <span>Reps: {exercise.repeticiones}</span>
                                                       <span>Descanso: {exercise.descanso}s</span>
                                                   </div>
                                                    <div className="exercise-tracking">
                                                        <div>
                                                            <label htmlFor={`weight-${i}`}>Peso (kg)</label>
                                                            <input 
                                                                id={`weight-${i}`}
                                                                type="number" 
                                                                className="weight-input"
                                                                placeholder={lastWeight}
                                                                value={dailyWeights[exercise.nombre] || ''}
                                                                onChange={(e) => handleWeightChange(exercise.nombre, e.target.value)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label htmlFor={`reps-${i}`}>Repeticiones</label>
                                                            <input 
                                                                id={`reps-${i}`}
                                                                type="number" 
                                                                className="reps-input"
                                                                placeholder={lastReps}
                                                                value={dailyReps[exercise.nombre] || ''}
                                                                onChange={(e) => handleRepChange(exercise.nombre, e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                   {exercise.tecnicaAvanzada && (
                                                       <div className="advanced-technique">
                                                           <span>⚡️</span> {exercise.tecnicaAvanzada}
                                                       </div>
                                                   )}
                                               </li>
                                           )})}
                                       </ul>
                                       <p className="cardio-note">{selectedDay.cardio}</p>
                                       <button className={`save-progress-button ${saveProgressText === 'Guardado ✓' ? 'saved' : ''}`} onClick={handleSaveProgress}>
                                            {saveProgressText}
                                       </button>
                                     </div>
                                </div>
                             )}
                         </div>)}
                     </div>
                </div>
            )}
            
            {activeTab === 'nutrition' && dietPlan && (
                 <div className="diet-plan-container client-view">
                      <h2>{dietPlan.planTitle}</h2>
                      <div className="diet-summary">
                          <div><strong>Calorías:</strong> {dietPlan.summary?.totalCalories || 'N/A'} kcal</div>
                          <div><strong>Proteínas:</strong> {dietPlan.summary?.macronutrients?.proteinGrams || 'N/A'}g</div>
                          <div><strong>Carbs:</strong> {dietPlan.summary?.macronutrients?.carbsGrams || 'N/A'}g</div>
                          <div><strong>Grasas:</strong> {dietPlan.summary?.macronutrients?.fatGrams || 'N/A'}g</div>
                      </div>
                      <div className="meals-grid">
                          {dietPlan.meals?.map((meal, index) => (
                              <div key={index} className="meal-card">
                                  <h4>{meal.mealName}</h4>
                                  <ul>
                                      {meal.foodItems?.map((item, i) => (
                                          <li key={i}>{item.food} <span>({item.amount})</span></li>
                                      ))}
                                  </ul>
                              </div>
                          ))}
                      </div>
                      {dietPlan.recommendations && dietPlan.recommendations.length > 0 && (
                          <div className="recommendations-section">
                              <h4>💡 Recomendaciones clave</h4>
                              <ul>
                                  {dietPlan.recommendations.map((rec, i) => (
                                      <li key={i}>{rec}</li>
                                  ))}
                              </ul>
                          </div>
                      )}
                </div>
            )}

            {activeTab === 'progress' && (
                <ProgressView progressLog={progressLog} bodyWeightLog={bodyWeightLog} />
            )}
        </div>
    );
};

// 5. Panel de Administración (Presentational Component)
interface ClientDashboardProps {
    clients: ClientListItem[];
    isSelectionMode: boolean;
    selectedClients: Set<string>;
    onClientSelect: (dni: string) => void;
    onSelectionChange: (dni: string) => void;
}
const ClientDashboard = ({ clients, isSelectionMode, selectedClients, onClientSelect, onSelectionChange }: ClientDashboardProps) => {
    
    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>, client: ClientListItem) => {
        if (isSelectionMode) {
             onSelectionChange(client.dni);
        } else {
             onClientSelect(client.dni);
        }
    };
    
    const handleCheckboxClick = (e: React.MouseEvent<HTMLInputElement>, dni: string) => {
        e.stopPropagation(); // Previene que el click en el checkbox dispare el click de la tarjeta
        onSelectionChange(dni);
    };

    return (
        <div className="client-list">
            {clients.length > 0 ? clients.map(client => (
                <div 
                    key={client.dni} 
                    className={`client-card ${isSelectionMode ? 'selection-mode' : ''} ${selectedClients.has(client.dni) ? 'selected' : ''}`}
                    onClick={(e) => handleCardClick(e, client)}
                >
                     {isSelectionMode && (
                        <input 
                            type="checkbox" 
                            className="client-selection-checkbox" 
                            checked={selectedClients.has(client.dni)}
                            onClick={(e) => handleCheckboxClick(e, client.dni)}
                            readOnly // El click se maneja en el manejador para evitar conflictos
                        />
                    )}
                    <h3>{client.profile?.name || `DNI: ${client.dni}`}</h3>
                    <p>DNI: {client.dni}</p>
                    <p>Nivel: {client.profile?.level || 'N/A'}</p>
                    <p>Plan actual: {client.planName}</p>
                </div>
            )) : <p>No hay clientes en esta vista.</p>}
        </div>
    );
};

// 6. Nuevo Componente: Gestor de la Biblioteca de Ejercicios
const ExerciseLibraryManager = ({ initialLibrary, onSave, onBack }: { initialLibrary: ExerciseLibrary, onSave: (library: ExerciseLibrary) => void, onBack: () => void }) => {
    const [library, setLibrary] = useState<ExerciseLibrary>(JSON.parse(JSON.stringify(initialLibrary)));
    const [saveButtonText, setSaveButtonText] = useState("Guardar Cambios");
    const [newExerciseName, setNewExerciseName] = useState('');
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState(Object.keys(initialLibrary)[0] || '');
    
    const [editingExercise, setEditingExercise] = useState<{ group: string; index: number } | null>(null);
    const [editingText, setEditingText] = useState('');
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ group: string; index: number; name: string } | null>(null);

    const handleLinkChange = (group: string, index: number, link: string) => {
        const newLibrary = { ...library };
        newLibrary[group][index].youtubeLink = link;
        setLibrary(newLibrary);
    };

    const handleEnabledChange = (group: string, index: number, isEnabled: boolean) => {
        const newLibrary = { ...library };
        newLibrary[group][index].isEnabled = isEnabled;
        setLibrary(newLibrary);
    };
    
    const handleAddNewExercise = () => {
        const trimmedName = newExerciseName.trim();
        if (!trimmedName || !selectedMuscleGroup) return;

        const newLibrary = { ...library };
        const groupExercises = newLibrary[selectedMuscleGroup];

        if (groupExercises.some(ex => ex.name.toLowerCase() === trimmedName.toLowerCase())) {
            alert('Este ejercicio ya existe en este grupo muscular.');
            return;
        }

        newLibrary[selectedMuscleGroup].push({
            name: trimmedName,
            isEnabled: true,
            youtubeLink: ''
        });
        
        newLibrary[selectedMuscleGroup].sort((a, b) => a.name.localeCompare(b.name));
        setLibrary(newLibrary);
        setNewExerciseName('');
    };

    const handleStartEdit = (group: string, index: number) => {
        setEditingExercise({ group, index });
        setEditingText(library[group][index].name);
    };

    const handleCancelEdit = () => {
        setEditingExercise(null);
        setEditingText('');
    };

    const handleSaveEdit = () => {
        if (!editingExercise || !editingText.trim()) {
            handleCancelEdit();
            return;
        }
        
        const { group, index } = editingExercise;
        const newLibrary = { ...library };

        const isDuplicate = newLibrary[group]
            .some((ex, i) => i !== index && ex.name.toLowerCase() === editingText.trim().toLowerCase());
        
        if (isDuplicate) {
            alert("Ya existe un ejercicio con este nombre en el grupo.");
            return;
        }
        
        newLibrary[group][index].name = editingText.trim();
        newLibrary[group].sort((a, b) => a.name.localeCompare(b.name));
        setLibrary(newLibrary);
        handleCancelEdit();
    };

    const handleDeleteRequest = (group: string, index: number) => {
        setDeleteConfirmation({ group, index, name: library[group][index].name });
    };

    const confirmDelete = () => {
        if (!deleteConfirmation) return;
        const { group, index } = deleteConfirmation;
        const newLibrary = { ...library };
        newLibrary[group].splice(index, 1);
        setLibrary(newLibrary);
        setDeleteConfirmation(null);
    };

    const handleSave = () => {
        onSave(library);
        setSaveButtonText("Guardado ✓");
        setTimeout(() => setSaveButtonText("Guardar Cambios"), 2000);
    };

    return (
        <div className="library-container">
            <ConfirmationModal
                isOpen={!!deleteConfirmation}
                message={`¿Estás seguro de que querés eliminar el ejercicio "${deleteConfirmation?.name}"? Esta acción no se puede deshacer.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmation(null)}
            />
            <header className="main-header">
                <button onClick={onBack} className="back-button">← Volver al Panel</button>
                 <div className="header-title-wrapper">
                    <h1>Biblioteca de Ejercicios</h1>
                    <p>Gestioná los ejercicios disponibles y sus videos.</p>
                </div>
                 <button onClick={handleSave} className={`save-changes-button ${saveButtonText === 'Guardado ✓' ? 'saved' : ''}`}>
                    {saveButtonText}
                </button>
            </header>
            
            <div className="library-instructions">
                <p>💡 Marcá los ejercicios que querés que la IA utilice para generar las rutinas. Podés agregar un link de YouTube para que el cliente vea la ejecución correcta.</p>
            </div>
            
            <div className="add-exercise-container">
                <h3>Agregar Nuevo Ejercicio</h3>
                <div className="add-exercise-form">
                    <input 
                        type="text" 
                        placeholder="Nombre del nuevo ejercicio" 
                        value={newExerciseName}
                        onChange={(e) => setNewExerciseName(e.target.value)}
                    />
                    <select 
                        value={selectedMuscleGroup} 
                        onChange={(e) => setSelectedMuscleGroup(e.target.value)}
                    >
                        {Object.keys(library).map(group => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </select>
                    <button onClick={handleAddNewExercise} disabled={!newExerciseName.trim()}>
                        Agregar
                    </button>
                </div>
            </div>

            {Object.entries(library).map(([group, exercises]) => (
                <div key={group} className="muscle-group-section">
                    <h2>{group}</h2>
                    <div className="exercise-entry-list">
                         <div className="exercise-entry-header">
                            <span>Habilitado</span>
                            <span>Nombre del Ejercicio</span>
                            <span>Link de YouTube</span>
                            <span>Acciones</span>
                        </div>
                        {exercises.map((exercise, index) => (
                            <div key={`${group}-${index}`} className="exercise-entry-row">
                                <label className="switch">
                                    <input
                                        type="checkbox"
                                        checked={exercise.isEnabled}
                                        onChange={(e) => handleEnabledChange(group, index, e.target.checked)}
                                    />
                                    <span className="slider round"></span>
                                </label>

                                {editingExercise?.group === group && editingExercise?.index === index ? (
                                    <input 
                                        type="text" 
                                        value={editingText}
                                        onChange={(e) => setEditingText(e.target.value)}
                                        className="editing-input"
                                        autoFocus
                                        onBlur={handleSaveEdit} // Save on blur
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                                    />
                                ) : (
                                    <span className="exercise-name-lib">{exercise.name}</span>
                                )}
                                
                                <input
                                    type="text"
                                    className="link-input"
                                    placeholder="Pegá el link de YouTube acá..."
                                    value={exercise.youtubeLink}
                                    onChange={(e) => handleLinkChange(group, index, e.target.value)}
                                />

                                <div className="exercise-row-actions">
                                    {editingExercise?.group === group && editingExercise?.index === index ? (
                                        <>
                                            <button onClick={handleSaveEdit} className="action-btn save">Guardar</button>
                                            <button onClick={handleCancelEdit} className="action-btn cancel">Cancelar</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => handleStartEdit(group, index)} className="action-btn edit">Editar</button>
                                            <button onClick={() => handleDeleteRequest(group, index)} className="action-btn delete">Borrar</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};


// --- Componente Principal ---
const App = () => {
    // --- State de la Aplicación ---
    const [currentView, setCurrentView] = useState('landing'); // 'landing', 'adminLogin', 'clientLogin', 'adminDashboard', 'clientPortal'
    const [selectedClientDNI, setSelectedClientDNI] = useState<string | null>(null);
    const [loggedInClientDNI, setLoggedInClientDNI] = useState<string | null>(null);
    
    // --- State de la Gestión del Dashboard de Admin ---
    const [adminView, setAdminView] = useState<'dashboard' | 'library'>('dashboard');
    const [clients, setClients] = useState<ClientListItem[]>([]);
    const [newDni, setNewDni] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
    const [confirmationModal, setConfirmationModal] = useState({ isOpen: false, message: '', onConfirm: () => {} });
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({});
    
    // Estado para la gestión del cliente individual por parte del admin
    const [profile, setProfile] = useState<Profile | null>(null);
    const [routine, setRoutine] = useState<Routine | null>(null);
    const [routineGeneratedDate, setRoutineGeneratedDate] = useState<string | null>(null);
    const [dietPlan, setDietPlan] = useState<DietPlan | null>(null);
    const [clientAccessCode, setClientAccessCode] = useState<string>('');
    
    // Estado de la UI del Admin
    const [activeTab, setActiveTab] = useState<'training' | 'nutrition'>('training');
    const [selectedPhaseTabIndex, setSelectedPhaseTabIndex] = useState(0);
    const [adminSelectedDayIndex, setAdminSelectedDayIndex] = useState(0);
    const [loadingRoutine, setLoadingRoutine] = useState(false);
    const [loadingDiet, setLoadingDiet] = useState(false);
    const [error, setError] = useState("");
    const [saveButtonText, setSaveButtonText] = useState("Guardar cambios");

    const ai = useMemo(() => {
        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) {
                console.error("API Key de Google no encontrada. Asegúrate de que tu archivo .env.local existe y la variable está definida, y reinicia el servidor de desarrollo.");
                return null;
            }
            return new GoogleGenAI({ apiKey });
        } catch (e) {
            console.error("Error al inicializar GoogleGenAI:", e);
            return null;
        }
    }, []);

    // --- Hooks ---
    const { bmi, bmiCategory, bmiCategoryClass } = useMemo(() => {
        if (!profile?.weight || !profile?.height) return { bmi: null, bmiCategory: 'N/A', bmiCategoryClass: '' };
        const { bmi, category, categoryClass } = getBmiDetails(parseFloat(profile.weight), parseFloat(profile.height));
        return { bmi, bmiCategory: category, bmiCategoryClass: categoryClass };
    }, [profile?.weight, profile?.height]);

    const targetWeight = useMemo(() => {
        if (!profile?.weight || !profile?.goal || !routine?.totalDurationWeeks) return null;
        const currentWeight = parseFloat(profile.weight);
        if (isNaN(currentWeight) || currentWeight <= 0) return null;

        const { goal } = profile;
        const { totalDurationWeeks } = routine;
        let target;
        if (goal === 'Pérdida de grasa') {
            const weeklyLoss = currentWeight * 0.005;
            target = currentWeight - (weeklyLoss * totalDurationWeeks);
        } else if (goal === 'Hipertrofia') {
            const weeklyGain = 0.2;
            target = currentWeight + (weeklyGain * totalDurationWeeks);
        } else {
            target = currentWeight;
        }
        return target > 0 ? target : null;
    }, [profile, routine]);
    
    // Carga inicial de clientes y biblioteca de ejercicios
    useEffect(() => {
        if (currentView === 'adminDashboard') {
            loadClients();
            
            const storedLibrary = localStorage.getItem('gym_ai_exercise_library');
            if (storedLibrary) {
                setExerciseLibrary(JSON.parse(storedLibrary));
            } else {
                setExerciseLibrary(DEFAULT_EXERCISE_LIBRARY);
                localStorage.setItem('gym_ai_exercise_library', JSON.stringify(DEFAULT_EXERCISE_LIBRARY));
            }
        }
    }, [currentView]);

    // Cargar datos del cliente seleccionado por el admin
    useEffect(() => {
        if (selectedClientDNI) {
            const storedData = localStorage.getItem(`gym_ai_user_${selectedClientDNI}`);
            if (storedData) {
                const userData = JSON.parse(storedData) as Partial<ClientData> & { profile?: { password?: any } };

                let code = userData.accessCode;
                let dataWasChanged = false;
                if (!code) {
                    code = Math.floor(100000 + Math.random() * 900000).toString();
                    userData.accessCode = code;
                    dataWasChanged = true;
                }
                if (userData.profile?.password) {
                    delete userData.profile.password;
                    dataWasChanged = true;
                }
                if (dataWasChanged) {
                    localStorage.setItem(`gym_ai_user_${selectedClientDNI}`, JSON.stringify(userData));
                }
                setClientAccessCode(code);
                
                const profileWithDefaults: Profile = {
                    name: "", age: "", weight: "", height: "", gender: "Prefiero no decirlo", level: "Principiante", goal: "Hipertrofia", trainingDays: "4", activityFactor: "Sedentario", useAdvancedTechniques: "No", bodyFocusArea: 'Cuerpo completo', bodyFocusSpecific: '', includeAdaptationPhase: 'Sí', trainingIntensity: 'Moderada', ...userData.profile
                };
                
                setProfile(profileWithDefaults);
                setRoutine(userData.routine || null);
                setDietPlan(userData.dietPlan || null);
                setRoutineGeneratedDate(userData.routineGeneratedDate || null);
                setSelectedPhaseTabIndex(0);
                setAdminSelectedDayIndex(0);
                setActiveTab('training');
                if (!ai) {
                    setError("La API Key de Google no está configurada. No se pueden generar planes.");
                } else {
                    setError('');
                }
                setCurrentView('adminClientManagement');
            }
        }
    }, [selectedClientDNI, ai]);
    
    // Reset day index on phase change para la vista del admin
    useEffect(() => {
        setAdminSelectedDayIndex(0);
    }, [selectedPhaseTabIndex]);

    // --- Funciones de Gestión de Clientes (movidas a App) ---
    const loadClients = () => {
        const clientList: ClientListItem[] = [];
        const seenDnis = new Set<string>();
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('gym_ai_user_')) {
                try {
                    const cleanDni = key.replace('gym_ai_user_', '').trim();
                    if (!cleanDni || seenDnis.has(cleanDni)) {
                        localStorage.removeItem(key); // Remove empty or duplicate keys
                        return;
                    }
                    seenDnis.add(cleanDni);
                    const clientData = JSON.parse(localStorage.getItem(key)!) as Partial<ClientData>;
                    clientList.push({
                        dni: cleanDni,
                        profile: clientData.profile || {},
                        planName: clientData.routine?.planName || 'Sin plan',
                        status: clientData.status || 'active',
                    });
                } catch (e) { console.error(`Error processing key ${key}:`, e); }
            }
        });
        setClients(clientList.sort((a, b) => (a.profile.name || a.dni).localeCompare(b.profile.name || b.dni)));
    };

    const handleAddClient = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedDni = newDni.trim();
        if (trimmedDni && !clients.some(c => c.dni === trimmedDni)) {
            const newAccessCode = Math.floor(100000 + Math.random() * 900000).toString();
            const newClientProfile: Profile = { name: "", age: "", weight: "", height: "", gender: "Prefiero no decirlo", level: "Principiante", goal: "Hipertrofia", trainingDays: "4", activityFactor: "Sedentario", useAdvancedTechniques: "No", bodyFocusArea: "Cuerpo completo", bodyFocusSpecific: "", includeAdaptationPhase: "Sí", trainingIntensity: "Moderada" };
            const newClientData: ClientData = { profile: newClientProfile, routine: null, dietPlan: null, progressLog: {}, bodyWeightLog: [], termsAccepted: false, accessCode: newAccessCode, status: 'active' };
            localStorage.setItem(`gym_ai_user_${trimmedDni}`, JSON.stringify(newClientData));
            setNewDni('');
            loadClients();
        }
    };

    const handleSelectionChange = (dni: string) => {
        setSelectedClients(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dni)) {
                newSet.delete(dni);
            } else {
                newSet.add(dni);
            }
            return newSet;
        });
    };
    
    // --- Handlers de acciones ---
    const closeConfirmationModal = () => {
        setConfirmationModal({ isOpen: false, message: '', onConfirm: () => {} });
    };

    const updateClientStatus = (dnis: Set<string>, newStatus: 'active' | 'archived') => {
        dnis.forEach(dni => {
            const key = `gym_ai_user_${dni.trim()}`;
            const data = localStorage.getItem(key);
            if (data) {
                const clientData = JSON.parse(data) as ClientData;
                clientData.status = newStatus;
                localStorage.setItem(key, JSON.stringify(clientData));
            }
        });
        loadClients();
        setIsSelectionMode(false);
        setSelectedClients(new Set());
        closeConfirmationModal();
    };
    
    const deleteClientsPermanently = (dnis: Set<string>) => {
        dnis.forEach(dni => {
             const key = `gym_ai_user_${dni.trim()}`;
             localStorage.removeItem(key);
        });
        loadClients();
        setIsSelectionMode(false);
        setSelectedClients(new Set());
        closeConfirmationModal();
    }

    const handleArchiveSelected = () => {
        if (selectedClients.size === 0) return;
        setConfirmationModal({
            isOpen: true,
            message: `¿Estás seguro de que querés archivar ${selectedClients.size} cliente(s)?`,
            onConfirm: () => updateClientStatus(selectedClients, 'archived')
        });
    };

    const handleRestoreSelected = () => {
        if (selectedClients.size === 0) return;
        setConfirmationModal({
            isOpen: true,
            message: `¿Estás seguro de que querés restaurar ${selectedClients.size} cliente(s)?`,
            onConfirm: () => updateClientStatus(selectedClients, 'active')
        });
    };

    const handleDeletePermanentlySelected = () => {
        if (selectedClients.size === 0) return;
        setConfirmationModal({
            isOpen: true,
            message: `¡ACCIÓN IRREVERSIBLE! ¿Estás seguro de que querés eliminar permanentemente ${selectedClients.size} cliente(s)?`,
            onConfirm: () => deleteClientsPermanently(selectedClients)
        });
    };

    const handleSelectionModeToggle = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedClients(new Set());
    };

    const handleSaveLibrary = (updatedLibrary: ExerciseLibrary) => {
        setExerciseLibrary(updatedLibrary);
        localStorage.setItem('gym_ai_exercise_library', JSON.stringify(updatedLibrary));
    };

    const filteredClients = clients
        .filter(client => (client.status || 'active') === viewMode)
        .filter(client =>
            client.profile?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.dni.toLowerCase().includes(searchTerm.toLowerCase())
        );

    // --- Handlers y Funciones de Navegación y Generación ---
    const saveData = (dataToSave: Partial<ClientData>) => {
        if (!selectedClientDNI) return;
        const currentData = JSON.parse(localStorage.getItem(`gym_ai_user_${selectedClientDNI}`) || '{}') as Partial<ClientData>;
        localStorage.setItem(`gym_ai_user_${selectedClientDNI}`, JSON.stringify({ ...currentData, ...dataToSave }));
    };

    const handleRoleSelect = (role: 'admin' | 'client') => {
        if (role === 'admin') setCurrentView('adminLogin');
        if (role === 'client') setCurrentView('clientLogin');
    };
    
    const handleAdminLogin = () => setCurrentView('adminDashboard');
    
    const handleClientLogin = (dni: string) => {
        setLoggedInClientDNI(dni);
        setCurrentView('clientPortal');
    };

    const handleLogout = () => {
        setCurrentView('landing');
        setSelectedClientDNI(null);
        setLoggedInClientDNI(null);
    };
    
    const handleBackToDashboard = () => {
        setSelectedClientDNI(null);
        setCurrentView('adminDashboard');
        setAdminView('dashboard');
        loadClients();
    };
    
    const isFormValid = useMemo(() => {
        if (!profile) return false;
        const { age, weight, height, name } = profile;
        return [age, weight, height, name].every((value) => String(value).trim() !== "");
    }, [profile]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setProfile(prev => {
            if (!prev) return null;
            const newProfile = { ...prev, [name]: value };
            if (name === 'bodyFocusArea' && prev.bodyFocusArea !== value) {
                newProfile.bodyFocusSpecific = '';
            }
            return newProfile;
        });
    };

    const handleSaveChanges = () => {
        saveData({ profile: profile!, routine, dietPlan });
        setSaveButtonText("Guardado ✓");
        setTimeout(() => setSaveButtonText("Guardar cambios"), 2000);
    };
    
    const handleExerciseChange = (phaseIndex: number, dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string) => {
        if (!routine) return;
        const newRoutine = JSON.parse(JSON.stringify(routine)) as Routine;
        (newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios[exerciseIndex] as any)[field] = value;
        setRoutine(newRoutine);
    };

    const handleRemoveExercise = (phaseIndex: number, dayIndex: number, exerciseIndex: number) => {
        if (!routine) return;
        const newRoutine = JSON.parse(JSON.stringify(routine)) as Routine;
        newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.splice(exerciseIndex, 1);
        setRoutine(newRoutine);
    };

    const handleAddExercise = (phaseIndex: number, dayIndex: number) => {
        if (!routine) return;
        const newRoutine = JSON.parse(JSON.stringify(routine)) as Routine;
        const enabledExercises = Object.values(exerciseLibrary).flat().filter(ex => ex.isEnabled);
        const defaultExerciseName = enabledExercises.length > 0 ? enabledExercises[0].name : 'Press de banca plano con barra';

        const newExercise: Exercise = {
            nombre: defaultExerciseName,
            series: '3',
            repeticiones: '10-12',
            descanso: '60',
        };
        newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.push(newExercise);
        setRoutine(newRoutine);
    };

    const handleGenerateDiet = async () => {
        if (!ai) {
            setError("La API Key de Google no está configurada. No se pueden generar planes.");
            return;
        }
        if (!isFormValid || !profile) return; 
        setLoadingDiet(true); 
        setError("");

        const dietSystemInstruction = `Sos un nutricionista deportivo experto. Tu tarea es crear un plan de alimentación personalizado en JSON, usando un español bien argentino, basado en los datos del cliente.
        Datos del usuario: ${JSON.stringify(profile)}.
        Principios Clave:
        1.  **Cálculo de Requerimientos:** Basá las calorías y macronutrientes en el objetivo del cliente (Hipertrofia = superávit, Pérdida de grasa = déficit). Para el cálculo, considerá la Tasa Metabólica Basal (TMB) del cliente y AJUSTALA usando su 'activityFactor'. Este factor describe su actividad DIARIA, FUERA del gimnasio. El gasto por entrenamiento (basado en 'trainingDays' e 'trainingIntensity') debe sumarse a este cálculo para obtener el gasto calórico total.
        2.  **Distribución de Macronutrientes:** Priorizá una alta ingesta de proteínas (1.6-2.2g por kg), y adecuá los carbohidratos y las grasas.
        3.  **Sugerencias de Alimentos (CRÍTICO):** Usá nombres de alimentos comunes en Argentina. Por ejemplo: usá "banana" (NO "plátano"), "palta" (NO "aguacate"), "frutillas" (NO "fresas"), "choclo" (NO "maíz" o "elote"), y "zapallo" (NO "calabaza"). Sé específico y ofrecé opciones saludables y accesibles en un supermercado argentino.
        4.  **Estructura (REQUISITO INDISPENSABLE):** El plan DEBE tener un mínimo de 5 comidas diarias. Utilizá nombres como: Desayuno, Colación de Mañana, Almuerzo, Merienda, Cena. Si el objetivo es hipertrofia o el cliente tiene una alta demanda calórica, podés agregar una sexta comida como "Colación Nocturna". No generes planes con menos de 5 comidas bajo ninguna circunstancia.
        5.  **Recomendaciones (IMPORTANTE):** Agregá una lista de 2 a 4 recomendaciones generales clave, usando voseo (ej: "Tomá 2-3 litros de agua por día", "Intentá comer 1-2 horas antes de entrenar.").
        6.  **Formato:** Devolvé exclusivamente un objeto JSON que siga el schema.`;

        const dietSchema = {
            type: Type.OBJECT,
            properties: {
                planTitle: { type: Type.STRING },
                summary: { type: Type.OBJECT, properties: {
                    totalCalories: { type: Type.INTEGER }, macronutrients: { type: Type.OBJECT, properties: {
                        proteinGrams: { type: Type.INTEGER }, carbsGrams: { type: Type.INTEGER }, fatGrams: { type: Type.INTEGER }
                    }, required: ["proteinGrams", "carbsGrams", "fatGrams"] }
                }, required: ["totalCalories", "macronutrients"] },
                meals: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                    mealName: { type: Type.STRING },
                    foodItems: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
                        food: { type: Type.STRING }, amount: { type: Type.STRING }
                    }, required: ["food", "amount"] } }
                }, required: ["mealName", "foodItems"] } },
                recommendations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Lista de 2-4 recomendaciones nutricionales generales y de hidratación."
                }
            }, required: ["planTitle", "summary", "meals", "recommendations"]
        };

        try {
            const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "Creá el plan nutricional.", config: { systemInstruction: dietSystemInstruction, responseMimeType: "application/json", responseSchema: dietSchema } });
            const parsedDiet = JSON.parse(response.text) as DietPlan;
            setDietPlan(parsedDiet);
            saveData({ dietPlan: parsedDiet });
        } catch (err) { setError("No se pudo generar el plan nutricional."); console.error(err); } finally { setLoadingDiet(false); }
    };
    
    const handleGenerateRoutine = async () => {
        if (!ai) {
            setError("La API Key de Google no está configurada. No se pueden generar planes.");
            return;
        }
      if (!isFormValid || !profile) return; 
      setLoadingRoutine(true); 
      setError("");
      
      const focusDescription = profile.bodyFocusArea + (profile.bodyFocusSpecific ? ` con un fuerte énfasis en ${profile.bodyFocusSpecific}` : '');
      const enabledExercises = Object.values(exerciseLibrary).flat().filter(ex => ex.isEnabled).map(ex => ex.name);

      if (enabledExercises.length === 0) {
        setError("No hay ejercicios habilitados en la biblioteca. Habilitá algunos antes de generar una rutina.");
        setLoadingRoutine(false);
        return;
      }
      
      const systemInstruction = `
        Sos un entrenador personal de élite de Argentina. Tu laburo es crear un plan de entrenamiento periodizado (8-12 semanas) en JSON.
        Datos: ${JSON.stringify(profile)}.
        Principios:
        1.  **Periodización Creativa:** Usá fases (Adaptación, Hipertrofia, Fuerza, Descarga) con duración flexible.
        2.  **Intensidad (CRÍTICO):** El cliente eligió una intensidad '${profile.trainingIntensity}'. AJUSTÁ EL VOLUMEN, LA DURACIÓN Y LA CANTIDAD DE EJERCICIOS:
            - **Extrema:** Este es el nivel MÁS DURO. Diseñá un entrenamiento brutalmente exigente de más de 90 mins antes de cardio. Mantené el volumen alto con **entre 9 y 12 ejercicios por día y cada ejercicio debe tener entre 4 y 6 series**. Para los ejercicios que trabajen directamente el grupo muscular del ENFOQUE ESPECÍFICO ('${profile.bodyFocusSpecific}') o el ÁREA DE ENFOQUE ('${profile.bodyFocusArea}'), las repeticiones DEBEN estar en un rango de 15 a 25 para maximizar la congestión y la resistencia muscular. Para el resto de ejercicios, mantené un rango de hipertrofia normal (ej. 8-12). Los descansos deben ser cortos (30-60s). Usá técnicas avanzadas liberalmente si el cliente lo permite.
            - **Alta:** Diseñá un entrenamiento muy exigente de ~90 mins ANTES del cardio. Aumentá significativamente el volumen. **Cada día de entrenamiento DEBE tener entre 7 y 9 ejercicios.** Acortá los descansos (45-60s) y usá técnicas avanzadas (si está permitido).
            - **Moderada:** Diseñá un entrenamiento estándar de 60-75 mins antes de cardio, con **5 a 6 ejercicios por día**. Volumen y descansos equilibrados (60-90s).
            - **Baja:** Diseñá un entrenamiento más corto y tranqui de 45-60 mins, con **4 a 5 ejercicios básicos por día**. Menor volumen, descansos más largos (90s+).
        3.  **Fase de Adaptación:** ${profile.includeAdaptationPhase === 'Sí' ? 'DEBES incluir una fase de adaptación anatómica al principio del plan.' : 'NO incluyas una fase de adaptación anatómica. Arrancá directamente con la fase principal del objetivo (ej. Hipertrofia).'}
        4.  **Complejidad Controlada y Técnicas Avanzadas:** Si 'useAdvancedTechniques' es 'Sí' y el nivel es 'Intermedio' o 'Avanzado', podés incluir con moderación una de las siguientes técnicas. **NO USES SUPERSERIES.** Al aplicar una, es CRÍTICO que el campo 'tecnicaAvanzada' contenga el nombre de la técnica (ej: 'Drop Set'), los detalles específicos (ej: '2 descensos') Y una breve descripción de cómo ejecutarla. Usá un guion para separar el nombre/detalles de la descripción. Ejemplos de formato EXACTO:
            - "Drop Set (2 descensos) - Al fallo, bajá el peso un 20-25% y seguí sin descanso. Repetilo 2 veces."
            - "Rest-Pause (3 pausas) - Al fallo, descansá 15s y sacá más reps. Repetilo 3 veces. Es una sola serie."
            - "Myo-reps (3 pasadas) - Tras una serie de activación al fallo, descansá 20-30s. Luego realizá 3 pasadas de 3-5 reps con el mismo peso, descansando solo 10-15s entre ellas."
            - "Excéntricas (fase de 4-6s) - Enfocate en la fase de bajada del peso, de forma lenta y controlada durante 4 a 6 segundos."
            Si 'useAdvancedTechniques' es 'No', no incluyas el campo 'tecnicaAvanzada'.
        5.  **Descanso (REGLA IMPORTANTE):** El campo 'descanso' DEBE ser una cadena de texto que represente únicamente el número de segundos (ej: '60', '90'). NO incluyas la letra 's' ni la palabra 'segundos'. El valor debe estar entre 30 y 180 segundos, dependiendo de la intensidad del ejercicio.
        6.  **Descarga Activa:** TENÉS QUE generar una rutina detallada de cuerpo completo (4-5 ejercicios compuestos, 2-3 series, 12-15 reps, baja intensidad) para los días de esta fase. NO uses frases genéricas, poné los ejercicios.
        7.  **Cardio:** Agregá "15-25 min de cardio moderado" al final de cada día.
        8.  **Personalización del Enfoque:** El enfoque principal es '${focusDescription}'. Si se especifica un músculo, ese grupo DEBE tener más volumen o prioridad en el plan.
        9.  **Selección de Ejercicios (REGLA FUNDAMENTAL):** Debés usar ÚNICAMENTE ejercicios de la siguiente lista aprobada: ${enabledExercises.join(', ')}. No inventes ni uses ejercicios que no estén en esta lista.
      `;
      
      const prompt = `Armá un plan de entrenamiento completo para este cliente, basado en tus directivas.`;
      
      const schema = { type: Type.OBJECT, properties: { planName: { type: Type.STRING }, totalDurationWeeks: { type: Type.INTEGER }, phases: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { phaseName: { type: Type.STRING }, durationWeeks: { type: Type.INTEGER }, routine: { type: Type.OBJECT, properties: { dias: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { dia: { type: Type.STRING, description: "El nombre o número del día de entrenamiento (ej. 'Día 1', 'Día A'). NO incluyas el grupo muscular en este campo." }, grupoMuscular: { type: Type.STRING, description: "El grupo muscular principal para este día (ej. 'Pecho y Tríceps', 'Piernas y Glúteos')." }, ejercicios: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { nombre: { type: Type.STRING }, series: { type: Type.STRING }, repeticiones: { type: Type.STRING }, descanso: { type: Type.STRING, description: "El tiempo de descanso en segundos, como una cadena de texto que contenga SÓLO el número (ej: '60')." }, tecnicaAvanzada: { type: Type.STRING } }, required: ["nombre", "series", "repeticiones", "descanso"] }}, cardio: { type: Type.STRING } }, required: ["dia", "grupoMuscular", "ejercicios", "cardio"] }}}}}, required: ["phaseName", "durationWeeks", "routine"] }}}, required: ["planName", "totalDurationWeeks", "phases"] };

      try {
        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { systemInstruction, responseMimeType: "application/json", responseSchema: schema } });
        const parsedPlan = JSON.parse(response.text) as Routine;
        
        // Sanitize data from AI
        parsedPlan.phases.forEach(phase => {
            phase.routine.dias.forEach(dia => {
                dia.ejercicios.forEach(ex => {
                    let rest = String(ex.descanso || '60').replace(/[^0-9]/g, '');
                    if (!rest || isNaN(parseInt(rest))) {
                        rest = '60'; // Default to 60 if empty or invalid
                    }
                    ex.descanso = rest;
                });
            });
        });

        const generatedDate = new Date().toISOString();
        
        setRoutine(parsedPlan);
        setRoutineGeneratedDate(generatedDate);
        setDietPlan(null);
        setActiveTab('training');
        saveData({ routine: parsedPlan, routineGeneratedDate: generatedDate, dietPlan: null, progressLog: {}, bodyWeightLog: [], termsAccepted: false });
      } catch (err) { setError("No se pudo generar el plan."); console.error(err); } finally { setLoadingRoutine(false); }
    };
    
    // --- Lógica de Renderizado ---

    const renderContent = () => {
        if (currentView === 'landing') return <LandingPage onSelectRole={handleRoleSelect} />;
        if (currentView === 'adminLogin') return <AdminLogin onLogin={handleAdminLogin} />;
        if (currentView === 'clientLogin') return <ClientLogin onLogin={handleClientLogin} onBack={() => setCurrentView('landing')} />;
        if (currentView === 'clientPortal' && loggedInClientDNI) return <ClientPortal clientDni={loggedInClientDNI} onLogout={handleLogout} />;
        
        if (currentView === 'adminDashboard') {
            if (adminView === 'library') {
                 return <ExerciseLibraryManager 
                            initialLibrary={exerciseLibrary} 
                            onSave={handleSaveLibrary} 
                            onBack={() => setAdminView('dashboard')} 
                        />;
            }

            return (
                <div className="admin-dashboard">
                    <header className="main-header">
                        <div className="header-title-wrapper">
                             <h1>Panel de Clientes</h1>
                             <p>Gestioná a tus clientes.</p>
                        </div>
                        <div className="admin-header-nav">
                             <button onClick={() => setAdminView('library')} className="header-nav-button">Gestionar Ejercicios</button>
                             <button onClick={handleLogout} className="logout-button admin-logout">Cerrar Sesión</button>
                        </div>
                    </header>
    
                    <div className="client-management-bar">
                        <div className="add-client-form">
                            <form onSubmit={handleAddClient}>
                                <input type="text" value={newDni} onChange={(e) => setNewDni(e.target.value)} placeholder="DNI del nuevo cliente/a" />
                                <button type="submit" className="cta-button" disabled={!newDni.trim()}>Agregar Cliente/a</button>
                            </form>
                        </div>
                        <div className="search-client-form">
                            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por Nombre o DNI..." />
                        </div>
                    </div>
                    
                    <div className="view-controls">
                        <div className="view-toggle">
                            <button onClick={() => { setViewMode('active'); setSelectedClients(new Set()); setIsSelectionMode(false); }} className={`view-toggle-button ${viewMode === 'active' ? 'active' : ''}`}>
                                Activos
                            </button>
                            <button onClick={() => { setViewMode('archived'); setSelectedClients(new Set()); setIsSelectionMode(false); }} className={`view-toggle-button ${viewMode === 'archived' ? 'active' : ''}`}>
                                Archivados
                            </button>
                        </div>
    
                        <div className="selection-controls">
                            <button className="selection-toggle-button" onClick={handleSelectionModeToggle}>
                                {isSelectionMode ? 'Cancelar Selección' : 'Seleccionar...'}
                            </button>
                            {isSelectionMode && viewMode === 'active' && (
                                <button 
                                    className="archive-selected-button"
                                    onClick={handleArchiveSelected} 
                                    disabled={selectedClients.size === 0}>
                                    Archivar ({selectedClients.size})
                                </button>
                            )}
                            {isSelectionMode && viewMode === 'archived' && (
                                <>
                                    <button className="restore-selected-button" onClick={handleRestoreSelected} disabled={selectedClients.size === 0}>
                                        Restaurar ({selectedClients.size})
                                    </button>
                                    <button className="delete-selected-button" onClick={handleDeletePermanentlySelected} disabled={selectedClients.size === 0}>
                                        Eliminar ({selectedClients.size})
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    
                    <ClientDashboard
                        clients={filteredClients}
                        isSelectionMode={isSelectionMode}
                        selectedClients={selectedClients}
                        onClientSelect={setSelectedClientDNI}
                        onSelectionChange={handleSelectionChange}
                    />
                </div>
            );
        }
    
        if (currentView === 'adminClientManagement' && profile) {
            const isLoading = loadingRoutine || loadingDiet;
            const selectedPhase = routine?.phases?.[selectedPhaseTabIndex];
            const selectedDay = selectedPhase?.routine?.dias?.[adminSelectedDayIndex];
            const enabledExercisesByGroup = Object.entries(exerciseLibrary).reduce((acc, [group, exercises]) => {
                const enabled = exercises.filter(ex => ex.isEnabled);
                if (enabled.length > 0) {
                    acc[group] = enabled;
                }
                return acc;
            }, {} as ExerciseLibrary);
            
            const handleTabSwitch = (tab: 'training' | 'nutrition') => {
                setActiveTab(tab);
            };

            return (
                <>
                  <header className="main-header">
                    <button onClick={handleBackToDashboard} className="back-button">← Volver</button>
                    <div className="header-title-wrapper">
                      <h1>Panel de Cliente: {profile.name || selectedClientDNI}</h1>
                      <p>Gestioná el perfil y los planes de tu cliente.</p>
                    </div>
                    <button onClick={handleLogout} className="logout-button">Cerrar Sesión</button>
                  </header>
            
                  <div className="dashboard-grid">
                    <aside className="profile-section">
                        <h2>Perfil del cliente/a</h2>
                        <form className="profile-form" onSubmit={(e) => e.preventDefault()}>
                          <div className="form-group"><label>Nombre</label><input type="text" name="name" value={profile.name} onChange={handleInputChange}/></div>
                          <div className="form-group"><label>Edad</label><input type="number" name="age" value={profile.age} onChange={handleInputChange}/></div>
                          <div className="form-group"><label>Peso (kg)</label><input type="number" name="weight" value={profile.weight} onChange={handleInputChange}/></div>
                          <div className="form-group"><label>Altura (cm)</label><input type="number" name="height" value={profile.height} onChange={handleInputChange}/></div>
                          <div className="form-group"><label>Género</label><select name="gender" value={profile.gender} onChange={handleInputChange}><option>Prefiero no decirlo</option><option>Masculino</option><option>Femenino</option></select></div>
                          <div className="form-group"><label>Nivel</label><select name="level" value={profile.level} onChange={handleInputChange}><option>Principiante</option><option>Intermedio</option><option>Avanzado</option></select></div>
                          <div className="form-group"><label>Objetivo</label><select name="goal" value={profile.goal} onChange={handleInputChange}><option>Hipertrofia</option><option>Pérdida de grasa</option><option>Mantenimiento</option><option>Resistencia</option></select></div>
                          <div className="form-group"><label>Días por semana</label><input type="number" name="trainingDays" value={profile.trainingDays} min="1" max="7" onChange={handleInputChange}/></div>
                          
                          <div className="form-group">
                            <label>Factor de Actividad (fuera del gym)</label>
                            <select name="activityFactor" value={profile.activityFactor || 'Sedentario'} onChange={handleInputChange}>
                                <option value="Sedentario">Sedentario (trabajo de oficina)</option>
                                <option value="Ligero">Ligero (trabajo de pie, caminatas)</option>
                                <option value="Activo">Activo (trabajo físico moderado)</option>
                                <option value="Muy Activo">Muy Activo (trabajo físico intenso)</option>
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Área de Enfoque</label>
                            <select name="bodyFocusArea" value={profile.bodyFocusArea || 'Cuerpo completo'} onChange={handleInputChange}>
                                <option value="Cuerpo completo">Cuerpo completo</option>
                                <option value="Tren Superior">Tren Superior</option>
                                <option value="Tren Inferior">Tren Inferior</option>
                            </select>
                          </div>
                          {profile.bodyFocusArea && profile.bodyFocusArea !== 'Cuerpo completo' && (
                              <div className="form-group">
                                  <label>Músculo Específico (Opcional)</label>
                                  <select name="bodyFocusSpecific" value={profile.bodyFocusSpecific || ''} onChange={handleInputChange}>
                                      <option value="">Enfoque General</option>
                                      {profile.bodyFocusArea === 'Tren Superior' && (
                                          <>
                                              <option value="Pecho">Pecho</option>
                                              <option value="Espalda">Espalda</option>
                                              <option value="Hombros">Hombros</option>
                                              <option value="Brazos">Brazos</option>
                                          </>
                                      )}
                                      {profile.bodyFocusArea === 'Tren Inferior' && (
                                          <>
                                              <option value="Piernas">Piernas (Cuádriceps/Femorales)</option>
                                              <option value="Glúteos">Glúteos</option>
                                          </>
                                      )}
                                  </select>
                              </div>
                          )}
                          
                           <div className="form-group">
                            <label>Intensidad del entrenamiento</label>
                            <select name="trainingIntensity" value={profile.trainingIntensity || 'Moderada'} onChange={handleInputChange}>
                                <option value="Baja">Baja</option>
                                <option value="Moderada">Moderada</option>
                                <option value="Alta">Alta</option>
                                <option value="Extrema">Extrema</option>
                            </select>
                          </div>
    
                          <div className="form-group">
                            <label>Fase de adaptación</label>
                            <select name="includeAdaptationPhase" value={profile.includeAdaptationPhase || 'Sí'} onChange={handleInputChange}>
                                <option value="Sí">Incluir fase de adaptación</option>
                                <option value="No">Empezar directo sin adaptación</option>
                            </select>
                          </div>
    
                          <div className="form-group"><label>Complejidad de la rutina</label><select name="useAdvancedTechniques" value={profile.useAdvancedTechniques} onChange={handleInputChange}><option value="No">Ejercicios simples</option><option value="Sí">Incluir técnicas avançadas</option></select></div>
                        </form>
                         {clientAccessCode && (
                            <div className="access-code-display">
                                <span>Código de Acceso del Cliente</span>
                                <strong>{clientAccessCode}</strong>
                            </div>
                        )}
                         {bmi !== null && (
                            <div className="bmi-display">
                                <span>IMC: <strong>{bmi.toFixed(1)}</strong></span>
                                <span className={`bmi-category ${bmiCategoryClass}`}>{bmiCategory}</span>
                            </div>
                        )}
                    </aside>
            
                    <main className="main-content">
                      <div className="actions-bar">
                        <button className="cta-button" onClick={handleGenerateRoutine} disabled={!isFormValid || isLoading}>{loadingRoutine ? <><span className="spinner small"></span>Armando rutina...</> : (routine ? "Volver a generar rutina" : "Generar rutina")}</button>
                        <button className={`save-changes-button ${saveButtonText === 'Guardado ✓' ? 'saved' : ''}`} onClick={handleSaveChanges} disabled={isLoading}>{saveButtonText}</button>
                      </div>
                      
                        <div className="main-tabs-nav">
                            <button onClick={() => handleTabSwitch('training')} className={`main-tab-button ${activeTab === 'training' ? 'active' : ''}`}>Entrenamiento</button>
                            <button onClick={() => handleTabSwitch('nutrition')} className={`main-tab-button ${activeTab === 'nutrition' ? 'active' : ''}`}>Nutrición</button>
                        </div>
            
                        <section className="results-section">
                            {isLoading && (
                                <div className="loading-container">
                                    <div className="spinner"></div>
                                    <p>{loadingRoutine ? 'Armando el plan de entrenamiento...' : 'Armando el plan de nutrición...'}</p>
                                </div>
                            )}

                            {!isLoading && error && (
                                 <div className="error-container"><p>{error}</p></div>
                            )}
                            
                            {!isLoading && !error && (
                                <>
                                    {activeTab === 'training' && (
                                        !routine ? (
                                            <p className="placeholder">Completá el perfil del cliente/a y generá un plan de entrenamiento.</p>
                                        ) : (
                                            <div className="plan-container">
                                                <header className="plan-header">
                                                  <h2>{routine.planName}</h2>
                                                  <p>Duración total: {routine.totalDurationWeeks} semanas</p>
                                                  {targetWeight !== null && (
                                                    <p className="target-weight-info">
                                                        Objetivo de peso al final del plan: ~{targetWeight.toFixed(1)} kg
                                                    </p>
                                                  )}
                                                </header>
                                                <div className="phases-container">
                                                    <div className="phase-tabs-nav">{routine.phases.map((phase, index) => (<button key={index} className={`phase-tab-button ${index === selectedPhaseTabIndex ? 'active' : ''}`} onClick={() => setSelectedPhaseTabIndex(index)}>{phase.phaseName} ({phase.durationWeeks} sem)</button>))}</div>
                                                    {selectedPhase && (<div className="phase-tab-content">
                                                        <div className="day-tabs-nav">
                                                          {selectedPhase.routine.dias.map((day, dayIndex) => (
                                                              <button 
                                                                  key={dayIndex} 
                                                                  className={`day-tab-button ${dayIndex === adminSelectedDayIndex ? 'active' : ''}`}
                                                                  onClick={() => setAdminSelectedDayIndex(dayIndex)}>
                                                                  {day.dia}
                                                              </button>
                                                          ))}
                                                        </div>
                                                        {selectedDay && (<div className="routine-plan editable">
                                                            <div className="day-card animated-fade-in">
                                                                <h3>{selectedDay.dia} - <span className="muscle-group">{selectedDay.grupoMuscular}</span></h3>
                                                                <ul className="exercise-list">{selectedDay.ejercicios.map((ex, exIndex) => (
                                                                    <li key={exIndex} className="exercise-item editable">
                                                                        <div className="exercise-item-header">
                                                                            <h4>Ejercicio {exIndex + 1}</h4>
                                                                            <button
                                                                                className="action-btn delete"
                                                                                onClick={() => handleRemoveExercise(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex)}
                                                                                aria-label={`Borrar ejercicio ${exIndex + 1}`}
                                                                            >
                                                                                Borrar
                                                                            </button>
                                                                        </div>
                                                                        <div className="form-group">
                                                                            <label>Ejercicio</label>
                                                                             <select
                                                                                className="exercise-input name-select"
                                                                                value={ex.nombre}
                                                                                onChange={(e) => handleExerciseChange(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex, 'nombre', e.target.value)}
                                                                            >
                                                                                 {Object.entries(enabledExercisesByGroup).map(([group, exercises]) => (
                                                                                    <optgroup key={group} label={group}>
                                                                                        {exercises.map(exDef => (
                                                                                            <option key={exDef.name} value={exDef.name}>{exDef.name}</option>
                                                                                        ))}
                                                                                    </optgroup>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                        <div className="exercise-details editable">
                                                                            <span>Series: <input type="text" value={ex.series} onChange={(e) => handleExerciseChange(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex, 'series', e.target.value)} /></span>
                                                                            <span>Reps: <input type="text" value={ex.repeticiones} onChange={(e) => handleExerciseChange(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex, 'repeticiones', e.target.value)} /></span>
                                                                            <span>Descanso: <input type="number" value={ex.descanso} onChange={(e) => handleExerciseChange(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex, 'descanso', e.target.value)} />s</span>
                                                                        </div>
                                                                         <div className="form-group">
                                                                            <label>Técnica Avanzada</label>
                                                                            <select
                                                                                name="tecnicaAvanzada"
                                                                                value={ex.tecnicaAvanzada || ''}
                                                                                onChange={(e) => handleExerciseChange(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex, 'tecnicaAvanzada', e.target.value)}
                                                                            >
                                                                                {advancedTechniqueOptions.map(opt => <option key={opt.label} value={opt.value}>{opt.label}</option>)}
                                                                            </select>
                                                                        </div>
                                                                    </li>))}
                                                                </ul>
                                                                <div className="add-exercise-action">
                                                                    <button className="add-exercise-button" onClick={() => handleAddExercise(selectedPhaseTabIndex, adminSelectedDayIndex)}>
                                                                        + Agregar Ejercicio
                                                                    </button>
                                                                </div>
                                                                <p className="cardio-note">{selectedDay.cardio}</p>
                                                            </div>
                                                        </div>)}
                                                    </div>)}
                                                </div>
                                            </div>
                                        )
                                    )}

                                    {activeTab === 'nutrition' && (
                                        !dietPlan ? (
                                            <div className="placeholder-action">
                                                <p>Todavía no hay un plan de nutrición para este cliente/a.</p>
                                                <button className="cta-button" onClick={handleGenerateDiet} disabled={!isFormValid || isLoading}>
                                                    Generar plan de nutrición
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="diet-plan-container">
                                                <header className="plan-header">
                                                    <h2>{dietPlan.planTitle}</h2>
                                                </header>
                                                <div className="diet-summary">
                                                    <div><strong>Calorías:</strong> {dietPlan.summary?.totalCalories || 'N/A'} kcal</div>
                                                    <div><strong>Proteínas:</strong> {dietPlan.summary?.macronutrients?.proteinGrams || 'N/A'}g</div>
                                                    <div><strong>Carbs:</strong> {dietPlan.summary?.macronutrients?.carbsGrams || 'N/A'}g</div>
                                                    <div><strong>Grasas:</strong> {dietPlan.summary?.macronutrients?.fatGrams || 'N/A'}g</div>
                                                </div>
                                                <div className="meals-grid">
                                                    {dietPlan.meals?.map((meal, index) => (
                                                        <div key={index} className="meal-card">
                                                            <h3>{meal.mealName}</h3>
                                                            <ul>
                                                                {meal.foodItems?.map((item, i) => (
                                                                    <li key={i}>{item.food} <span>({item.amount})</span></li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    ))}
                                                </div>
                                                {dietPlan.recommendations && dietPlan.recommendations.length > 0 && (
                                                    <div className="recommendations-section">
                                                        <h4>💡 Recomendaciones clave</h4>
                                                        <ul>
                                                            {dietPlan.recommendations.map((rec, i) => (
                                                                <li key={i}>{rec}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                <button className="cta-button regenerate" onClick={handleGenerateDiet} disabled={!isFormValid || isLoading}>
                                                    {loadingDiet ? <><span className="spinner small"></span>Regenerando...</> : "Volver a generar plan"}
                                                </button>
                                            </div>
                                        )
                                    )}
                                </>
                            )}
                        </section>
                    </main>
                  </div>
                </>
            );
        }
    
        return <div className="login-container"><div className="spinner"></div></div>; // Fallback
    };
    
    return (
        <>
            <ConfirmationModal 
                isOpen={confirmationModal.isOpen}
                message={confirmationModal.message}
                onConfirm={confirmationModal.onConfirm}
                onCancel={closeConfirmationModal}
            />
            {renderContent()}
        </>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}