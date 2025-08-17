

declare var process: any;
"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type } from "@google/genai";
import "./index.css";

import {
    apiClient,
    SUPER_ADMIN_PASSWORD,
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
    Gym
} from './apiClient';


// --- Utility Functions ---
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

const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
});


// --- COMPONENTES DE VISTAS ---

// 0. Logo
const Logo = () => <span style={{ fontSize: '40px' }} role="img" aria-label="Scorpion Emoji">🦂</span>;

// 1. Modal de Confirmación
const ConfirmationModal = ({
  isOpen,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
}: {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="cta-button secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="cta-button" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// 2. Página de Bienvenida (Selección de Rol)
const LandingPage = ({ onSelectRole }: { onSelectRole: (role: 'superadmin' | 'gym' | 'client') => void }) => (
    <div className="login-container">
        <header>
            <Logo />
            <h1>ScorpionGYM AI</h1>
            <p>Tu plataforma de entrenamiento inteligente.</p>
        </header>
        <div className="landing-box">
            <h2>Bienvenido</h2>
            <p>¿Cómo querés acceder?</p>
            <div className="role-selection">
                <button className="cta-button" onClick={() => onSelectRole('superadmin')}>Acceso Administrador General</button>
                <button className="cta-button" onClick={() => onSelectRole('gym')}>Acceso Gimnasio / Entrenador</button>
                <button className="cta-button secondary" onClick={() => onSelectRole('client')}>Acceso Cliente</button>
            </div>
        </div>
    </div>
);

// 3. Logins
const SuperAdminLogin = ({ onLogin, onBack }: { onLogin: () => void; onBack: () => void; }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === SUPER_ADMIN_PASSWORD) {
            onLogin();
        } else {
            setError('Contraseña incorrecta.');
            setPassword('');
        }
    };

    return (
        <div className="login-container">
            <header><Logo /></header>
            <div className="login-box">
                <h2>Acceso de Súper Administrador</h2>
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        placeholder="Contraseña Maestra"
                        aria-label="Contraseña de súper administrador"
                    />
                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button" disabled={!password}>Ingresar</button>
                     <button type="button" className="back-button simple" onClick={onBack}>← Volver</button>
                </form>
            </div>
        </div>
    );
};

const GymLogin = ({ onLogin, onBack }: { onLogin: (gym: Gym) => void; onBack: () => void; }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        const gym = await apiClient.gymLogin(username, password);
        if (gym) {
            onLogin(gym);
        } else {
            setError('Usuario o contraseña incorrectos.');
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <header><Logo /></header>
            <div className="login-box">
                <h2>Acceso de Gimnasio / Entrenador</h2>
                <form onSubmit={handleSubmit}>
                    <input type="text" value={username} onChange={e => {setUsername(e.target.value); setError('')}} placeholder="Usuario" />
                    <input type="password" value={password} onChange={e => {setPassword(e.target.value); setError('')}} placeholder="Contraseña" />
                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button" disabled={!username || !password || isLoading}>
                        {isLoading ? <span className="spinner small" /> : 'Ingresar'}
                    </button>
                    <button type="button" className="back-button simple" onClick={onBack}>← Volver</button>
                </form>
            </div>
        </div>
    );
};

const ClientLogin = ({ onLogin, onBack }: { onLogin: (dni: string) => void; onBack: () => void; }) => {
    const [dni, setDni] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        const success = await apiClient.loginClient(dni, accessCode);
        if (success) {
            onLogin(dni);
        } else {
            setError('DNI o código incorrectos, o cliente inactivo.');
            setIsLoading(false);
        }
    };
    
    return (
         <div className="login-container">
             <header><Logo /></header>
            <div className="login-box">
                <h2>Acceso de Cliente</h2>
                <form onSubmit={handleSubmit}>
                    <input type="text" value={dni} onChange={e => {setDni(e.target.value); setError('')}} placeholder="DNI" />
                    <input type="password" value={accessCode} onChange={e => {setAccessCode(e.target.value); setError('')}} placeholder="Código de Acceso" />
                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button" disabled={!dni || !accessCode || isLoading}>
                        {isLoading ? <span className="spinner small" /> : 'Ingresar'}
                    </button>
                    <button type="button" className="back-button simple" onClick={onBack}>← Volver</button>
                </form>
            </div>
        </div>
    );
};

// --- Chat Assistant for Client ---
const ChatAssistantModal = ({ isOpen, onClose, ai, clientData, onUpdateClientData }: { isOpen: boolean; onClose: () => void; ai: GoogleGenAI | null; clientData: ClientData | null; onUpdateClientData: (updates: Partial<ClientData>) => void; }) => {
    const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string, image?: string }[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [image, setImage] = useState<{b64: string, mimeType: string} | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // This effect should only run when the modal is opened, not on every data update.
        if (isOpen && clientData) {
            setMessages([{ role: 'model' as const, text: `¡Hola ${clientData.profile.name}! Soy Scorpion AI. ¿En qué puedo ayudarte hoy con tu plan? Puedo darte alternativas para comidas, ejercicios, o analizar una foto de tu comida para darte una estimación de sus calorías.` }]);
            setInput('');
            setImage(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    
    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 4 * 1024 * 1024) { // 4MB limit
                alert("La imagen es muy grande. Por favor, elegí una de menos de 4MB.");
                return;
            }
            const b64 = await toBase64(file);
            setImage({ b64, mimeType: file.type });
        }
    };


    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && !image) || isLoading || !ai || !clientData) return;

        // --- Daily Question Limit Check ---
        const limit = clientData.dailyQuestionLimit;
        if (typeof limit === 'number' && limit >= 0) {
            const today = new Date().toISOString().split('T')[0];
            const usage = clientData.aiUsage || { date: today, count: 0 };
            const currentCount = usage.date === today ? usage.count : 0;
            
            if (currentCount >= limit) {
                setMessages(prev => [...prev, { role: 'model', text: `Llegaste a tu límite de ${limit} consultas por hoy. ¡Nos vemos mañana!` }]);
                setInput('');
                setImage(null);
                return;
            }
        }
        
        const userMessage = { role: 'user' as const, text: input, image: image ? `data:${image.mimeType};base64,${image.b64}` : undefined };
        setMessages(prev => [...prev, userMessage]);
        
        const currentInput = input;
        const currentImage = image;
        setInput('');
        setImage(null);
        setIsLoading(true);
        
        let modelResponse = '';
        setMessages(prev => [...prev, { role: 'model' as const, text: '' }]);

        const systemInstruction = `Sos "Scorpion AI", un asistente de IA para un cliente de gimnasio. Tu propósito es dar sugerencias rápidas y útiles sobre el plan de entrenamiento y nutrición del cliente, NUNCA para reemplazar el consejo del entrenador humano.
        - **Tu Identidad:** Sos amigable, motivador y usas voseo (hablás de "vos").
        - **Contexto del Cliente:** El plan actual del cliente es: ${JSON.stringify({ profile: clientData.profile, routine: clientData.routine, dietPlan: clientData.dietPlan })}
        - **Análisis de Imágenes (NUEVA FUNCIÓN):** Si el usuario sube una imagen de una comida, tu tarea principal es analizarla, identificar los alimentos y dar una estimación de las calorías totales, proteínas, carbohidratos y grasas. Siempre DEBES aclarar que es una estimación aproximada.
        - **Tus Límites (MUY IMPORTANTE):**
            1. NO podés hacer cambios permanentes en el plan. Siempre debés aclarar que tus sugerencias son temporales y que para un cambio definitivo, debe hablar con su entrenador.
            2. NO podés dar consejos médicos. Si te preguntan algo relacionado a una lesión o dolor, tu respuesta DEBE ser: "Para cualquier dolor o posible lesión, es fundamental que lo hables con tu entrenador y consultes a un médico o fisioterapeuta. Yo no puedo darte consejos médicos."
            3. Sé conciso. Tus respuestas deben ser cortas y al punto.
            4. Si te piden algo fuera de tu alcance (ej: "creame una rutina nueva"), negáte amablemente y recordá tu función: "Mi función es darte sugerencias rápidas para el día a día. Para cambios grandes como una rutina nueva, tenés que hablarlo con tu entrenador."`;
        
        const history = messages.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));
        
        const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
        if (currentImage) {
            parts.push({ inlineData: { mimeType: currentImage.mimeType, data: currentImage.b64 } });
        }
        const promptText = currentImage && !currentInput ? "Analizá esta comida y dame una estimación de sus calorías y macronutrientes (proteínas, carbohidratos, grasas)." : currentInput;
        parts.push({ text: promptText });
        
        const contents = [...history, { role: 'user' as const, parts }];

        try {
            const responseStream = await ai.models.generateContentStream({ model: "gemini-2.5-flash", contents, config: { systemInstruction } });

            for await (const chunk of responseStream) {
                modelResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].text = modelResponse;
                    return newMessages;
                });
            }

            // --- Update Usage Count ---
            const today = new Date().toISOString().split('T')[0];
            const usage = clientData.aiUsage || { date: today, count: 0 };
            const newCount = usage.date === today ? usage.count + 1 : 1;
            const newUsage = { date: today, count: newCount };
            await apiClient.saveClientData(clientData.dni, { aiUsage: newUsage });
            onUpdateClientData({ aiUsage: newUsage });


        } catch (error) {
            console.error("Error with AI chat:", error);
            const errorMessage = { role: 'model' as const, text: 'Oops, algo salió mal. Por favor, intentá de nuevo.' };
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = errorMessage;
                return newMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="chat-modal-overlay" onClick={onClose}>
            <div className="chat-modal-content" onClick={(e) => e.stopPropagation()}>
                <header className="chat-modal-header">
                    <h3>Asistente Scorpion AI</h3>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </header>
                <div className="chat-messages">
                    {messages.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.role}`}>
                            <div className="avatar">{msg.role === 'model' ? 'AI' : 'TÚ'}</div>
                            <div className="message-content">
                                {msg.image && <img src={msg.image} alt="Adjunto de usuario" />}
                                {msg.text ? <p>{msg.text}</p> : <div className="chat-typing-indicator"><span></span><span></span><span></span></div>}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <div className="chat-input-area">
                    {image && (
                        <div className="chat-image-preview">
                            <img src={`data:${image.mimeType};base64,${image.b64}`} alt="Previsualización" />
                            <button className="remove-image-btn" onClick={() => setImage(null)}>&times;</button>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage}>
                         <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                         <button type="button" className="chat-action-btn" onClick={() => fileInputRef.current?.click()} aria-label="Adjuntar imagen">
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21.586 10.414l-8-8A2 2 0 0012 2H4a2 2 0 00-2 2v16a2 2 0 002 2h16a2 2 0 002-2V11a1 1 0 00-1-1zm-9.172 2.172a3 3 0 114.242-4.242 3 3 0 01-4.242 4.242zM7 17a1 1 0 01-1-1 3 3 0 013-3h8a1 1 0 010 2H9a1 1 0 00-1 1 1 1 0 01-1 1z"/></svg>
                         </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Escribí tu consulta acá..."
                            disabled={isLoading}
                            aria-label="Escribir mensaje al asistente de IA"
                        />
                        <button type="submit" disabled={isLoading || (!input.trim() && !image)} aria-label="Enviar mensaje">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                        </button>
                    </form>
                </div>
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
const ClientPortal = ({ clientDni, onLogout, ai }: { clientDni: string, onLogout: () => void, ai: GoogleGenAI | null }) => {
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
    const [isChatOpen, setIsChatOpen] = useState(false);


    useEffect(() => {
        const loadInitialData = async () => {
          if (!clientDni) return;
          const data = await apiClient.getClientData(clientDni);
          setClientData(data);
          if (data?.gymId) {
              const library = await apiClient.getExerciseLibrary(data.gymId);
              setExerciseLibrary(library);
          }
        };
        loadInitialData();
    }, [clientDni]);
    
    const updateClientDataLocally = (updates: Partial<ClientData>) => {
        setClientData(prev => prev ? { ...prev, ...updates } : null);
    };

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

    const handleLogBodyWeight = async () => {
        if (!clientData || !clientDni || !currentBodyWeight || isNaN(parseFloat(currentBodyWeight)) || !profile?.height) return;

        const now = new Date().toISOString();
        const weight = parseFloat(currentBodyWeight);
        const height = parseFloat(profile.height);
        const { bmi, categoryClass } = getBmiDetails(weight, height);

        const newLogEntry: BodyWeightEntry = { date: now, weight: weight, imc: bmi ?? undefined, imcCategoryClass: categoryClass };

        const existingLog: BodyWeightEntry[] = clientData.bodyWeightLog ? [...clientData.bodyWeightLog] : [];
        existingLog.push(newLogEntry);
        existingLog.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const updatedClientData: Partial<ClientData> = { bodyWeightLog: existingLog };
        const success = await apiClient.saveClientData(clientDni, updatedClientData);
        if (success) {
            setClientData(prev => prev ? { ...prev, ...updatedClientData } as ClientData : null);
            setCurrentBodyWeight('');
            setLogWeightText("✓");
            setTimeout(() => setLogWeightText("Registrar"), 2000);
        }
    };

    const handleSaveProgress = async () => {
        if (!clientData || !clientDni) return;

        const now = new Date().toISOString();
        const newProgressLog: ProgressLog = JSON.parse(JSON.stringify(clientData.progressLog || {}));
        let progressWasSaved = false;

        const exercisesToLog = new Set([...Object.keys(dailyWeights), ...Object.keys(dailyReps)]);

        exercisesToLog.forEach(exerciseName => {
            const weight = dailyWeights[exerciseName];
            const reps = dailyReps[exerciseName];

            if (!weight || isNaN(parseFloat(weight)) || !reps || isNaN(parseInt(reps, 10))) return;

            if (!newProgressLog[exerciseName]) newProgressLog[exerciseName] = [];
            
            newProgressLog[exerciseName].push({ date: now, weight: parseFloat(weight), repetitions: parseInt(reps, 10) });
            newProgressLog[exerciseName].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            progressWasSaved = true;
        });

        if (progressWasSaved) {
            const updatedClientData = { progressLog: newProgressLog };
            const success = await apiClient.saveClientData(clientDni, updatedClientData);
            if (success) {
                setClientData(prev => prev ? { ...prev, ...updatedClientData } as ClientData : null);
                setDailyWeights({});
                setDailyReps({});
                setSaveProgressText("Guardado ✓");
                setTimeout(() => setSaveProgressText("Guardar Progreso"), 2000);
            }
        }
    };
    
    const handleAcceptTerms = async () => {
        if (!clientDni) return;
        const updatedClientData = { termsAccepted: true };
        const success = await apiClient.saveClientData(clientDni, updatedClientData);
        if (success) {
            setClientData(prev => prev ? { ...prev, ...updatedClientData } as ClientData : null);
        }
    };

    const routinePlanInfo = useMemo(() => {
        if (!clientData?.routine || !clientData?.routineGeneratedDate) return null;
        const startDate = new Date(clientData.routineGeneratedDate);
        const totalDurationMillis = clientData.routine.totalDurationWeeks * 7 * 24 * 60 * 60 * 1000;
        const expirationDate = new Date(startDate.getTime() + totalDurationMillis);
        const isExpired = new Date() > expirationDate;
        return { expirationDate, isExpired };
    }, [clientData]);

    if (!clientData || !profile) return <div className="client-view-container"><div className="spinner"></div></div>;
    
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
                <p>Por favor, contactá a tu entrenador para que te arme un nuevo plan.</p>
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
                <div className="plan-container">
                     <header className="plan-header"><h2>{routine.planName}</h2><p>Duración total: {routine.totalDurationWeeks} semanas</p></header>
                     <div className="phases-container">
                        <div className="accordion-phases">
                            {routine.phases.map((phase, index) => (
                                <div key={index} className="accordion-item">
                                    <button
                                        className={`accordion-header ${index === selectedPhaseTabIndex ? 'active' : ''}`}
                                        onClick={() => setSelectedPhaseTabIndex(prev => prev === index ? -1 : index)}
                                        aria-expanded={index === selectedPhaseTabIndex}
                                    >
                                        <span>{phase.phaseName} ({phase.durationWeeks} sem)</span>
                                        <span className="accordion-header-icon">+</span>
                                    </button>
                                    <div className={`accordion-content ${index === selectedPhaseTabIndex ? 'open' : ''}`}>
                                         {index === selectedPhaseTabIndex && (
                                            <div className="phase-tab-content">
                                                 <div className="day-tabs-nav">
                                                     {phase.routine.dias.map((day, dayIndex) => (
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
                                            </div>
                                         )}
                                    </div>
                                </div>
                            ))}
                        </div>
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

            <button className="chat-fab" onClick={() => setIsChatOpen(true)} aria-label="Abrir chat de asistencia">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"></path></svg>
            </button>
            <ChatAssistantModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} ai={ai} clientData={clientData} onUpdateClientData={updateClientDataLocally} />
        </div>
    );
};

// 5. Panel de Clientes para el Gimnasio
const ClientDashboard = ({ clients, isSelectionMode, selectedClients, onClientSelect, onSelectionChange }: {
    clients: ClientListItem[];
    isSelectionMode: boolean;
    selectedClients: Set<string>;
    onClientSelect: (dni: string) => void;
    onSelectionChange: (dni: string) => void;
}) => {
    
    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>, client: ClientListItem) => {
        if (isSelectionMode) {
             onSelectionChange(client.dni);
        } else {
             onClientSelect(client.dni);
        }
    };
    
    const handleCheckboxClick = (e: React.MouseEvent<HTMLInputElement>, dni: string) => {
        e.stopPropagation();
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
                            readOnly
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

// 6. Gestor de la Biblioteca de Ejercicios para el Gimnasio
const ExerciseLibraryManager = ({ gymId, onSave, onBack }: { gymId: string; onSave: (library: ExerciseLibrary, gymId: string) => Promise<boolean>, onBack: () => void }) => {
    const [library, setLibrary] = useState<ExerciseLibrary | null>(null);
    const [originalLibrary, setOriginalLibrary] = useState<ExerciseLibrary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [saveButtonText, setSaveButtonText] = useState("Guardar Cambios");
    const [newExerciseName, setNewExerciseName] = useState('');
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('');
    
    const [editingExercise, setEditingExercise] = useState<{ group: string; index: number } | null>(null);
    const [editingText, setEditingText] = useState('');
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ group: string; index: number; name: string } | null>(null);
    const [isUnsavedChangesModalOpen, setUnsavedChangesModalOpen] = useState(false);
    const [openGroup, setOpenGroup] = useState<string | null>(null);
    
    const isDirty = useMemo(() => {
        if (!library || !originalLibrary) return false;
        return JSON.stringify(library) !== JSON.stringify(originalLibrary);
    }, [library, originalLibrary]);

    useEffect(() => {
        const fetchLibrary = async () => {
            setIsLoading(true);
            const data = await apiClient.getExerciseLibrary(gymId);
             if (data && Object.keys(data).length > 0) {
                const deepCopy = JSON.parse(JSON.stringify(data));
                setLibrary(data);
                setOriginalLibrary(deepCopy);
                const firstGroup = Object.keys(data)[0];
                setSelectedMuscleGroup(firstGroup || '');
                setOpenGroup(firstGroup || null);
            } else {
                setLibrary({});
                setOriginalLibrary({});
            }
            setIsLoading(false);
        };
        fetchLibrary();
    }, [gymId]);

    const handleLinkChange = (group: string, index: number, link: string) => {
        setLibrary(prev => {
            if (!prev) return null;
            const newLibrary = JSON.parse(JSON.stringify(prev));
            newLibrary[group][index].youtubeLink = link;
            return newLibrary;
        });
    };

    const handleEnabledChange = (group: string, index: number, isEnabled: boolean) => {
        setLibrary(prev => {
            if (!prev) return null;
            const newLibrary = JSON.parse(JSON.stringify(prev));
            newLibrary[group][index].isEnabled = isEnabled;
            return newLibrary;
        });
    };
    
    const handleAddNewExercise = () => {
        if (!library || !newExerciseName.trim() || !selectedMuscleGroup) return;

        const trimmedName = newExerciseName.trim();
        
        setLibrary(prevLibrary => {
            if (!prevLibrary) return null;
            const newLibrary = JSON.parse(JSON.stringify(prevLibrary));
            const groupExercises = newLibrary[selectedMuscleGroup] || [];
            
            if (groupExercises.some((ex: ExerciseDefinition) => ex.name.toLowerCase() === trimmedName.toLowerCase())) {
                alert('Este ejercicio ya existe en este grupo muscular.');
                return prevLibrary; // Return original state if duplicate
            }

            const newExercise: ExerciseDefinition = { name: trimmedName, isEnabled: true, youtubeLink: '' };
            groupExercises.push(newExercise);
            groupExercises.sort((a: ExerciseDefinition, b: ExerciseDefinition) => a.name.localeCompare(b.name));
            newLibrary[selectedMuscleGroup] = groupExercises;
            
            return newLibrary;
        });
        setNewExerciseName('');
    };

    const handleStartEdit = (group: string, index: number) => {
        if (!library) return;
        setEditingExercise({ group, index });
        setEditingText(library[group][index].name);
    };

    const handleCancelEdit = () => {
        setEditingExercise(null);
        setEditingText('');
    };

    const handleSaveEdit = () => {
        if (!editingExercise || !editingText.trim() || !library) {
            handleCancelEdit();
            return;
        }

        const { group, index } = editingExercise;
        const newName = editingText.trim();

        setLibrary(prev => {
            if (!prev) return null;
            if (prev[group].some((ex: ExerciseDefinition, i: number) => i !== index && ex.name.toLowerCase() === newName.toLowerCase())) {
                alert("Ya existe un ejercicio con este nombre en el grupo.");
                return prev;
            }
            
            const newLibrary = JSON.parse(JSON.stringify(prev));
            newLibrary[group][index].name = newName;
            newLibrary[group].sort((a: ExerciseDefinition, b: ExerciseDefinition) => a.name.localeCompare(b.name));
            return newLibrary;
        });
        handleCancelEdit();
    };

    const handleDeleteRequest = (group: string, index: number) => {
        if (!library) return;
        setDeleteConfirmation({ group, index, name: library[group][index].name });
    };

    const confirmDelete = () => {
        if (!deleteConfirmation) return;
        const { group, index } = deleteConfirmation;
        
        setLibrary(prev => {
            if (!prev) return null;
            const newLibrary = JSON.parse(JSON.stringify(prev));
            newLibrary[group].splice(index, 1);
            return newLibrary;
        });
        setDeleteConfirmation(null);
    };

    const handleSave = async () => {
        if (!library || !isDirty) return;
        setSaveButtonText("Guardando...");
        const success = await onSave(library, gymId);
        if (success) {
            setSaveButtonText("Guardado ✓");
            setOriginalLibrary(JSON.parse(JSON.stringify(library)));
            setTimeout(() => setSaveButtonText("Guardar Cambios"), 2000);
        } else {
            setSaveButtonText("Error al Guardar");
            setTimeout(() => setSaveButtonText("Guardar Cambios"), 3000);
            alert("No se pudieron guardar los cambios. Revisa la consola del navegador y los logs para más detalles.");
        }
    };
    
    const handleAttemptBackNavigation = () => {
        if (isDirty) {
            setUnsavedChangesModalOpen(true);
        } else {
            onBack();
        }
    };

    if (isLoading) {
        return (
            <div className="library-container">
                 <header className="main-header">
                     <button onClick={onBack} className="back-button">← Volver al Panel</button>
                 </header>
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>Cargando biblioteca de ejercicios...</p>
                </div>
            </div>
        );
    }
    
    if (!library) {
         return (
             <div className="library-container">
                 <header className="main-header">
                     <button onClick={onBack} className="back-button">← Volver al Panel</button>
                 </header>
                 <div className="error-container">
                     <p>No se pudo cargar la biblioteca de ejercicios. Por favor, intentá de nuevo.</p>
                 </div>
             </div>
        );
    }

    return (
        <div className="library-container">
            <ConfirmationModal
                isOpen={!!deleteConfirmation}
                message={`¿Estás seguro de que querés eliminar el ejercicio "${deleteConfirmation?.name}"? Esta acción no se puede deshacer.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmation(null)}
            />
            <ConfirmationModal
                isOpen={isUnsavedChangesModalOpen}
                message="Tenés cambios sin guardar. ¿Estás seguro de que querés salir y descartarlos?"
                onConfirm={onBack}
                onCancel={() => setUnsavedChangesModalOpen(false)}
                confirmText="Salir sin guardar"
                cancelText="Quedarme"
            />
            <header className="main-header">
                <button onClick={handleAttemptBackNavigation} className="back-button">← Volver al Panel</button>
                 <div className="header-title-wrapper">
                    <h1>Biblioteca de Ejercicios</h1>
                    <p>Gestioná los ejercicios disponibles y sus videos.</p>
                </div>
            </header>
            
            <div className="library-instructions">
                <p>💡 Marcá los ejercicios que querés que la IA utilice para generar las rutinas. Podés agregar un link de YouTube para que el cliente vea la ejecución correcta.</p>
            </div>
            
            <div className="add-exercise-container">
                <div className="add-exercise-form-wrapper">
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
                            {Object.keys(library).sort().map(group => (
                                <option key={group} value={group}>{group}</option>
                            ))}
                        </select>
                        <button onClick={handleAddNewExercise} disabled={!newExerciseName.trim()}>
                            Agregar
                        </button>
                    </div>
                </div>
                <div className="library-save-action">
                    <button onClick={handleSave} className={`save-changes-button ${saveButtonText.includes('✓') ? 'saved' : ''}`} disabled={!isDirty || saveButtonText === "Guardando..."}>
                        {saveButtonText}
                    </button>
                </div>
            </div>

             <div className="library-accordion">
                {Object.entries(library).sort(([groupA], [groupB]) => groupA.localeCompare(groupB)).map(([group, exercises]) => (
                    <div key={group} className="library-accordion-item">
                        <button 
                            className={`library-accordion-header ${openGroup === group ? 'active' : ''}`} 
                            onClick={() => setOpenGroup(openGroup === group ? null : group)}
                            aria-expanded={openGroup === group}
                            aria-controls={`content-${group}`}
                        >
                            <span>{group} ({exercises.length})</span>
                            <span className="icon">+</span>
                        </button>
                        <div id={`content-${group}`} className={`library-accordion-content ${openGroup === group ? 'open' : ''}`}>
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
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEdit();
                                                    if (e.key === 'Escape') handleCancelEdit();
                                                }}
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
                    </div>
                ))}
            </div>
        </div>
    );
};


// 7. Portal del Gimnasio / Entrenador
const GymPortal = ({ gym, ai, onLogout, onBackToSuperAdmin }: { 
    gym: Gym; 
    ai: GoogleGenAI | null; 
    onLogout: () => void;
    onBackToSuperAdmin?: () => void;
}) => {
    // State de la Gestión del Dashboard de Admin
    const [view, setView] = useState<'dashboard' | 'library' | 'clientManagement'>('dashboard');
    const [selectedClientDNI, setSelectedClientDNI] = useState<string | null>(null);
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
    const [additionalInstructions, setAdditionalInstructions] = useState('');
    
    // Estado de la UI del Admin
    const [activeTab, setActiveTab] = useState<'training' | 'nutrition'>('training');
    const [selectedPhaseTabIndex, setSelectedPhaseTabIndex] = useState(0);
    const [adminSelectedDayIndex, setAdminSelectedDayIndex] = useState(0);
    const [loadingRoutine, setLoadingRoutine] = useState(false);
    const [loadingDiet, setLoadingDiet] = useState(false);
    const [error, setError] = useState("");
    const [saveButtonText, setSaveButtonText] = useState("Guardar cambios");

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
    
    const loadClientsAndLibrary = async () => {
        const [clientsData, libraryData] = await Promise.all([
            apiClient.getClients(gym._id),
            apiClient.getExerciseLibrary(gym._id)
        ]);
        setClients(clientsData);
        setExerciseLibrary(libraryData);
    };

    useEffect(() => {
        loadClientsAndLibrary();
    }, [gym._id]);

    useEffect(() => {
        const loadSelectedClient = async () => {
          if (selectedClientDNI) {
              const userData = await apiClient.getClientData(selectedClientDNI);
              if (userData && userData.gymId === gym._id) {
                  setClientAccessCode(userData.accessCode);
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
                  if (!ai) setError("La API Key de Google no está configurada. No se pueden generar planes.");
                  else setError('');
                  setView('clientManagement');
              } else if (userData) {
                  alert("Error: Este cliente no pertenece a tu gimnasio.");
                  setSelectedClientDNI(null);
              }
          }
        };
        loadSelectedClient();
    }, [selectedClientDNI, ai, gym._id]);
    
    useEffect(() => {
        setAdminSelectedDayIndex(0);
    }, [selectedPhaseTabIndex]);

    // --- Funciones de Gestión de Clientes ---
    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedDni = newDni.trim();
        if (!trimmedDni) return;
        
        const result = await apiClient.createClient(trimmedDni, gym._id);
        if (result.success) {
            setNewDni('');
            const updatedClients = await apiClient.getClients(gym._id);
            setClients(updatedClients);
        } else {
            alert(result.message);
        }
    };

    const handleSelectionChange = (dni: string) => {
        setSelectedClients(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dni)) newSet.delete(dni);
            else newSet.add(dni);
            return newSet;
        });
    };
    
    // --- Handlers de acciones ---
    const closeConfirmationModal = () => setConfirmationModal({ isOpen: false, message: '', onConfirm: () => {} });

    const handleUpdateClientStatus = async (dnis: Set<string>, newStatus: 'active' | 'archived') => {
        await apiClient.updateClientStatus(dnis, newStatus);
        const updatedClients = await apiClient.getClients(gym._id);
        setClients(updatedClients);
        setIsSelectionMode(false);
        setSelectedClients(new Set());
        closeConfirmationModal();
    };
    
    const handleDeleteClientsPermanently = async (dnis: Set<string>) => {
        await apiClient.deleteClients(dnis);
        const updatedClients = await apiClient.getClients(gym._id);
        setClients(updatedClients);
        setIsSelectionMode(false);
        setSelectedClients(new Set());
        closeConfirmationModal();
    }

    const handleArchiveSelected = () => {
        if (selectedClients.size === 0) return;
        setConfirmationModal({
            isOpen: true,
            message: `¿Estás seguro de que querés archivar ${selectedClients.size} cliente(s)?`,
            onConfirm: () => handleUpdateClientStatus(selectedClients, 'archived')
        });
    };

    const handleRestoreSelected = () => {
        if (selectedClients.size === 0) return;
        setConfirmationModal({
            isOpen: true,
            message: `¿Estás seguro de que querés restaurar ${selectedClients.size} cliente(s)?`,
            onConfirm: () => handleUpdateClientStatus(selectedClients, 'active')
        });
    };

    const handleDeletePermanentlySelected = () => {
        if (selectedClients.size === 0) return;
        setConfirmationModal({
            isOpen: true,
            message: `¿Estás seguro de que querés eliminar permanentemente a ${selectedClients.size} cliente(s)? Esta acción no se puede deshacer y borrará todos sus datos.`,
            onConfirm: () => handleDeleteClientsPermanently(selectedClients)
        });
    };

    const filteredClients = useMemo(() => {
        const lowercasedFilter = searchTerm.toLowerCase();
        return clients.filter(c => {
            const matchesSearch = c.dni.includes(lowercasedFilter) || (c.profile.name && c.profile.name.toLowerCase().includes(lowercasedFilter));
            return c.status === viewMode && matchesSearch;
        });
    }, [clients, searchTerm, viewMode]);

    // --- Funciones de Gestión de Cliente Individual (dentro del panel) ---
    const handleProfileChange = (field: keyof Profile, value: string) => {
        setProfile(prev => {
            if (!prev) return null;
            const newProfile = { ...prev, [field]: value };
            // Si cambia el foco principal, reseteamos el específico
            if (field === 'bodyFocusArea') {
                newProfile.bodyFocusSpecific = '';
            }
            return newProfile;
        });
    };

    const handleSaveChanges = async () => {
        if (!selectedClientDNI || !profile) return;
        setSaveButtonText("Guardando...");
        const dataToSave: Partial<ClientData> = {
            profile: profile,
            routine: routine,
            dietPlan: dietPlan,
            routineGeneratedDate: routineGeneratedDate
        };
        const success = await apiClient.saveClientData(selectedClientDNI, dataToSave);
        if (success) {
            setSaveButtonText("Guardado ✓");
            setTimeout(() => setSaveButtonText("Guardar cambios"), 2000);
            
            // Actualizar la lista de clientes en el dashboard principal
            const updatedClients = await apiClient.getClients(gym._id);
            setClients(updatedClients);
        } else {
            setSaveButtonText("Error al Guardar");
        }
    };
    
    // --- Lógica de IA ---
    const handleGenerateRoutine = async () => {
        if (!ai || !profile) {
            setError("Error: El cliente IA no está inicializado o no hay perfil.");
            return;
        }

        const enabledExercises = Object.entries(exerciseLibrary).reduce((acc, [group, exercises]) => {
            const enabled = exercises.filter(ex => ex.isEnabled).map(ex => ex.name);
            if (enabled.length > 0) {
                acc[group] = enabled;
            }
            return acc;
        }, {} as Record<string, string[]>);


        setLoadingRoutine(true);
        setError("");
        
        const routineSchema = {
            type: Type.OBJECT,
            properties: {
                planName: { type: Type.STRING, description: "Nombre creativo para el plan de entrenamiento (ej: 'Plan de Fuerza y Volumen')." },
                totalDurationWeeks: { type: Type.INTEGER, description: "La duración total del plan en semanas, basado en la suma de las duraciones de las fases." },
                phases: {
                    type: Type.ARRAY,
                    description: "Un array de fases de entrenamiento.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            phaseName: { type: Type.STRING, description: "Nombre de la fase (ej: 'Fase de Adaptación', 'Fase de Hipertrofia', 'Semana de Descarga')." },
                            durationWeeks: { type: Type.INTEGER, description: "Duración de esta fase en semanas." },
                            routine: {
                                type: Type.OBJECT,
                                properties: {
                                    dias: {
                                        type: Type.ARRAY,
                                        description: "Array con los planes de entrenamiento para cada día.",
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                dia: { type: Type.STRING, description: "Día de la semana (ej: 'Día 1', 'Día 2')." },
                                                grupoMuscular: { type: Type.STRING, description: "Grupo muscular principal trabajado ese día (ej: 'Pecho y Tríceps', 'Piernas (Cuádriceps y Femorales)')." },
                                                ejercicios: {
                                                    type: Type.ARRAY,
                                                    description: "Lista de ejercicios para el día. Deben ser elegidos de la lista de ejercicios habilitados.",
                                                    items: {
                                                        type: Type.OBJECT,
                                                        properties: {
                                                            nombre: { type: Type.STRING, description: "Nombre exacto del ejercicio de la lista." },
                                                            series: { type: Type.STRING, description: "Número de series (ej: '4')." },
                                                            repeticiones: { type: Type.STRING, description: "Rango de repeticiones (ej: '8-12')." },
                                                            descanso: { type: Type.STRING, description: "Tiempo de descanso en segundos (ej: '60')." },
                                                            tecnicaAvanzada: { type: Type.STRING, description: "Opcional. Una técnica avanzada a aplicar (ej: 'Drop Set').", nullable: true },
                                                        },
                                                        required: ["nombre", "series", "repeticiones", "descanso"]
                                                    }
                                                },
                                                cardio: { type: Type.STRING, description: "Recomendación de cardio para el día (ej: '25 min de cinta a ritmo moderado')." }
                                            },
                                            required: ["dia", "grupoMuscular", "ejercicios", "cardio"]
                                        }
                                    }
                                },
                                required: ["dias"]
                            }
                        },
                        required: ["phaseName", "durationWeeks", "routine"]
                    }
                }
            },
            required: ["planName", "totalDurationWeeks", "phases"]
        };
        
        const systemInstruction = `Sos un experto en fitness y tu única función es generar un plan de entrenamiento en formato JSON.
- **REGLA INQUEBRANTABLE Y MÁS IMPORTANTE:** JAMÁS mezcles ejercicios de grupos musculares que no correspondan al día de entrenamiento. Es un error CRÍTICO y no debe ocurrir. Por ejemplo, si un día es 'Pecho y Tríceps', SOLO puede contener ejercicios de 'Pecho' y 'Brazos (Bíceps y Tríceps)'. NUNCA incluyas un ejercicio de 'Cuádriceps' en un día de pecho. La adherencia a los grupos musculares del día es tu máxima prioridad.
- **REGLAS DE INTENSIDAD Y VOLUMEN (CRÍTICO - DEBES SEGUIRLAS ESTRICTAMENTE):**
  - **Baja:** 4-5 ejercicios por día. Repeticiones en el rango de 12-15.
  - **Moderada:** 5-7 ejercicios por día. Repeticiones principalmente 8-12.
  - **Alta:** 7-10 ejercicios por día. Mezclá rangos de repeticiones: algunos ejercicios pesados (5-8 reps) y otros de hipertrofia (8-12 reps).
  - **Extrema:** 10-13 ejercicios por día. Incorporá técnicas avanzadas, y una mezcla de rangos de fuerza (4-6 reps), hipertrofia (8-12 reps) y resistencia (15-20 reps).
- **SEMANA DE DESCARGA (OBLIGATORIO):** Al final de TODAS las fases de trabajo, agregá una fase final llamada 'Semana de Descarga'. Debe durar 1 semana. En esta fase, el volumen debe ser un 50% del de la última fase de trabajo (ej, si eran 4 series, ahora son 2) y la intensidad debe ser baja (ejercicios básicos, sin fallo muscular).
- **Formato:** El JSON de salida DEBE ser perfecto y validar con el esquema. No incluyas "json" ni ningún otro texto fuera del objeto JSON.
- **Lenguaje:** Utilizá voseo (hablá de "vos").
- **Creatividad y Variedad:** Rotá los ejercicios disponibles para dar variedad.
- **Fases:** La duración total de la rutina se divide en fases. La suma de las semanas de cada fase (incluida la descarga) debe ser igual a la duración total.
- **Fase de Adaptación:** Si se solicita, la primera fase debe ser de 2 semanas, con ejercicios básicos, menor volumen y sin técnicas avanzadas.
- **Técnicas Avanzadas:** Aplicalas solo si el perfil lo solicita y en las fases finales. Sé coherente.
- **Foco Corporal:** Si se especifica un área de foco, asigna más volumen (más ejercicios o más series) a esos grupos musculares.
- **Cardio:** Añadí una recomendación de cardio al final de cada día.
- **Instrucciones Adicionales:** Tenelas en cuenta, pero NUNCA deben sobreescribir la REGLA INQUEBRANTABLE de los grupos musculares o las reglas de intensidad.`;
        
        const prompt = `Generá una rutina de entrenamiento basada en este perfil: ${JSON.stringify(profile)}. Los ejercicios disponibles, agrupados por músculo, son: ${JSON.stringify(enabledExercises)}. Instrucciones adicionales del entrenador: "${additionalInstructions || 'Ninguna'}".`;
        
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: routineSchema,
                    systemInstruction: systemInstruction,
                    seed: Math.floor(Math.random() * 1000000),
                },
            });

            const jsonText = response.text.trim();
            const generatedRoutine = JSON.parse(jsonText) as Routine;
            setRoutine(generatedRoutine);
            setRoutineGeneratedDate(new Date().toISOString());

        } catch (e) {
            console.error(e);
            setError("Hubo un error al generar la rutina. Por favor, intentá de nuevo. Revisa la consola para más detalles.");
        } finally {
            setLoadingRoutine(false);
        }
    };
    
    const handleGenerateDiet = async () => {
        if (!ai || !profile) {
            setError("Error: El cliente IA no está inicializado o no hay perfil.");
            return;
        }

        setLoadingDiet(true);
        setError("");

        const dietSchema = {
            type: Type.OBJECT,
            properties: {
                planTitle: { type: Type.STRING, description: "Un nombre para el plan de nutrición (ej. 'Dieta de Volumen Limpio')." },
                summary: {
                    type: Type.OBJECT,
                    properties: {
                        totalCalories: { type: Type.INTEGER, description: "Calorías totales diarias." },
                        macronutrients: {
                            type: Type.OBJECT,
                            properties: {
                                proteinGrams: { type: Type.INTEGER, description: "Gramos de proteína diarios." },
                                carbsGrams: { type: Type.INTEGER, description: "Gramos de carbohidratos diarios." },
                                fatGrams: { type: Type.INTEGER, description: "Gramos de grasas diarias." },
                            },
                            required: ["proteinGrams", "carbsGrams", "fatGrams"]
                        }
                    },
                    required: ["totalCalories", "macronutrients"]
                },
                meals: {
                    type: Type.ARRAY,
                    description: "Un array de comidas para el día.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            mealName: { type: Type.STRING, description: "Nombre de la comida (ej. 'Desayuno', 'Almuerzo')." },
                            foodItems: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        food: { type: Type.STRING, description: "Nombre del alimento (ej. 'Pechuga de pollo a la plancha')." },
                                        amount: { type: Type.STRING, description: "Cantidad del alimento (ej. '200g', '1 taza')." },
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
                    description: "Una lista de 3 a 5 recomendaciones clave (ej. 'Beber 3 litros de agua al día', 'Evitar azúcares refinados').",
                    items: { type: Type.STRING }
                }
            },
            required: ["planTitle", "summary", "meals", "recommendations"]
        };
        
        const systemInstruction = `Sos un nutricionista deportivo para ScorpionGYM. Tu tarea es generar un plan de nutrición en formato JSON basado en el perfil del cliente.
- Usá voseo (hablá de "vos").
- El JSON debe ser perfecto y validar con el esquema proporcionado. No incluyas "json" ni nada fuera del objeto JSON.
- Calculá las calorías y macros basándote en el Gasto Energético Total (GET) del cliente, usando la fórmula de Harris-Benedict y el factor de actividad proporcionado. Ajustá el total calórico según su objetivo (+300-500 kcal para hipertrofia, -300-500 kcal para pérdida de grasa).
- Distribuí los macros de forma balanceada (ej. 40% carbs, 30% proteínas, 30% grasas).
- Creá entre 4 y 6 comidas. Incluí alimentos comunes y saludables disponibles en Argentina.
- Las recomendaciones deben ser prácticas y útiles.`;

        const prompt = `Generá un plan de nutrición completo para este perfil: ${JSON.stringify(profile)}. Instrucciones adicionales del entrenador: "${additionalInstructions || 'Ninguna'}".`;
        
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: dietSchema,
                    systemInstruction: systemInstruction,
                    seed: Math.floor(Math.random() * 1000000),
                },
            });

            const jsonText = response.text.trim();
            const generatedDiet = JSON.parse(jsonText) as DietPlan;
            setDietPlan(generatedDiet);

        } catch (e) {
            console.error(e);
            setError("Hubo un error al generar la dieta. Por favor, intentá de nuevo. Revisa la consola para más detalles.");
        } finally {
            setLoadingDiet(false);
        }
    };

    const upperBodyFocusOptions = [
        { value: '', label: 'Seleccionar foco...' },
        { value: 'Pecho y Hombros', label: 'Pecho y Hombros' },
        { value: 'Espalda y Brazos', label: 'Espalda y Brazos' },
        { value: 'Hombros (énfasis en deltoides)', label: 'Hombros (énfasis en deltoides)' },
    ];

    const lowerBodyFocusOptions = [
        { value: '', label: 'Seleccionar foco...' },
        { value: 'Glúteos y Femorales', label: 'Glúteos y Femorales' },
        { value: 'Cuádriceps y Gemelos', label: 'Cuádriceps y Gemelos' },
        { value: 'Énfasis en Glúteos', label: 'Énfasis en Glúteos' },
    ];
    
    // --- Renderizado del Componente ---

    // Vista del Dashboard principal del gimnasio
    if (view === 'dashboard') {
        return (
             <div className="admin-dashboard">
                <ConfirmationModal 
                    isOpen={confirmationModal.isOpen} 
                    message={confirmationModal.message}
                    onConfirm={confirmationModal.onConfirm}
                    onCancel={closeConfirmationModal}
                />
                <header className="main-header">
                     <div className="header-title-wrapper">
                        {gym.logoSvg ? <img src={gym.logoSvg} alt={`${gym.name} Logo`} className="gym-logo" /> : <Logo />}
                        <h1>Panel de {gym.name}</h1>
                    </div>
                    <nav className="admin-header-nav">
                        <button onClick={() => setView('library')} className="header-nav-button">Biblioteca de Ejercicios</button>
                        {onBackToSuperAdmin && <button onClick={onBackToSuperAdmin} className="header-nav-button">Volver al Súper Admin</button>}
                        <button onClick={onLogout} className="logout-button admin-logout">Cerrar Sesión</button>
                    </nav>
                </header>

                <div className="client-management-bar">
                    <div className="add-client-form">
                        <form onSubmit={handleAddClient}>
                            <input type="text" value={newDni} onChange={(e) => setNewDni(e.target.value)} placeholder="DNI del nuevo cliente" />
                            <button type="submit" className="cta-button" disabled={!newDni.trim()}>Agregar Cliente</button>
                        </form>
                    </div>
                    <div className="search-client-form">
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por nombre o DNI..." />
                    </div>
                </div>

                <div className="view-controls">
                    <div className="view-toggle">
                        <button onClick={() => setViewMode('active')} className={`view-toggle-button ${viewMode === 'active' ? 'active' : ''}`}>Activos</button>
                        <button onClick={() => setViewMode('archived')} className={`view-toggle-button ${viewMode === 'archived' ? 'active' : ''}`}>Archivados</button>
                    </div>
                    <div className="selection-controls">
                        <button onClick={() => setIsSelectionMode(!isSelectionMode)} className="selection-toggle-button">
                            {isSelectionMode ? 'Cancelar Selección' : 'Seleccionar Varios'}
                        </button>
                        {isSelectionMode && (
                            <>
                                {viewMode === 'active' && <button onClick={handleArchiveSelected} disabled={selectedClients.size === 0} className="archive-selected-button">Archivar</button>}
                                {viewMode === 'archived' && (
                                    <>
                                        <button onClick={handleRestoreSelected} disabled={selectedClients.size === 0} className="restore-selected-button">Restaurar</button>
                                        <button onClick={handleDeletePermanentlySelected} disabled={selectedClients.size === 0} className="delete-selected-button">Eliminar</button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <ClientDashboard
                    clients={filteredClients}
                    isSelectionMode={isSelectionMode}
                    selectedClients={selectedClients}
                    onClientSelect={(dni) => setSelectedClientDNI(dni)}
                    onSelectionChange={handleSelectionChange}
                />
            </div>
        );
    }
    
    // Vista de la Biblioteca de Ejercicios
    if (view === 'library') {
        return <ExerciseLibraryManager gymId={gym._id} onSave={apiClient.saveExerciseLibrary} onBack={() => setView('dashboard')} />
    }

    // Vista de gestión de un cliente individual
    if (view === 'clientManagement' && profile) {
        const selectedPhase = routine?.phases?.[selectedPhaseTabIndex];
        const adminSelectedDay = selectedPhase?.routine?.dias?.[adminSelectedDayIndex];

        return (
            <div className="client-management-view">
                <div className="dashboard-grid">
                    <div className="profile-section">
                        <h2>Perfil de {profile.name || `Cliente ${selectedClientDNI}`}</h2>
                         <form className="profile-form">
                             <div className="form-group"><label>Nombre</label><input type="text" value={profile.name} onChange={e => handleProfileChange('name', e.target.value)} /></div>
                             <div className="form-group"><label>DNI</label><input type="text" value={selectedClientDNI || ''} readOnly /></div>
                             <div className="form-group"><label>Edad</label><input type="number" value={profile.age} onChange={e => handleProfileChange('age', e.target.value)} /></div>
                             <div className="form-group"><label>Peso (kg)</label><input type="number" step="0.1" value={profile.weight} onChange={e => handleProfileChange('weight', e.target.value)} /></div>
                             <div className="form-group"><label>Altura (cm)</label><input type="number" value={profile.height} onChange={e => handleProfileChange('height', e.target.value)} /></div>
                             {bmi && <div className="bmi-display"><span className={`bmi-category ${bmiCategoryClass}`}>{bmi.toFixed(1)}</span><span>{bmiCategory}</span></div>}
                             <div className="form-group"><label>Género</label><select value={profile.gender} onChange={e => handleProfileChange('gender', e.target.value)}><option>Masculino</option><option>Femenino</option><option>Prefiero no decirlo</option></select></div>
                             <div className="form-group"><label>Nivel</label><select value={profile.level} onChange={e => handleProfileChange('level', e.target.value)}><option>Principiante</option><option>Intermedio</option><option>Avanzado</option></select></div>
                             <div className="form-group"><label>Objetivo</label><select value={profile.goal} onChange={e => handleProfileChange('goal', e.target.value)}><option>Hipertrofia</option><option>Pérdida de grasa</option><option>Mantenimiento</option><option>Resistencia</option></select></div>
                             <div className="form-group"><label>Días de entrenamiento/semana</label><input type="number" min="1" max="7" value={profile.trainingDays} onChange={e => handleProfileChange('trainingDays', e.target.value)} /></div>
                             <div className="form-group"><label>Factor de Actividad</label><select value={profile.activityFactor} onChange={e => handleProfileChange('activityFactor', e.target.value)}><option>Sedentario</option><option>Ligero</option><option>Activo</option><option>Muy Activo</option></select></div>
                             <div className="form-group"><label>Incluir Fase de Adaptación</label><select value={profile.includeAdaptationPhase} onChange={e => handleProfileChange('includeAdaptationPhase', e.target.value)}><option>Sí</option><option>No</option></select></div>
                             <div className="form-group"><label>Usar Técnicas Avanzadas</label><select value={profile.useAdvancedTechniques} onChange={e => handleProfileChange('useAdvancedTechniques', e.target.value)}><option>No</option><option>Sí</option></select></div>
                              <div className="form-group"><label>Intensidad del Entrenamiento</label><select value={profile.trainingIntensity} onChange={e => handleProfileChange('trainingIntensity', e.target.value)}><option>Baja</option><option>Moderada</option><option>Alta</option><option>Extrema</option></select></div>
                             <div className="form-group">
                                 <label>Foco Corporal Principal</label>
                                 <select value={profile.bodyFocusArea} onChange={e => handleProfileChange('bodyFocusArea', e.target.value)}>
                                     <option>Cuerpo completo</option><option>Tren Superior</option><option>Tren Inferior</option>
                                 </select>
                             </div>
                              <div className="form-group">
                                <label>Foco Específico (Opcional)</label>
                                <select 
                                    value={profile.bodyFocusSpecific} 
                                    onChange={e => handleProfileChange('bodyFocusSpecific', e.target.value)}
                                    disabled={profile.bodyFocusArea === 'Cuerpo completo'}
                                >
                                    {profile.bodyFocusArea === 'Tren Superior' && upperBodyFocusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    {profile.bodyFocusArea === 'Tren Inferior' && lowerBodyFocusOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    {profile.bodyFocusArea === 'Cuerpo completo' && <option value="">N/A</option>}
                                </select>
                             </div>
                         </form>
                         <div className="access-code-display">
                            <span>Código de Acceso del Cliente</span>
                            <strong>{clientAccessCode}</strong>
                         </div>
                    </div>

                    <div className="main-content-wrapper">
                         <header className="main-header">
                            <div className="header-title-wrapper">
                                <button onClick={() => { setView('dashboard'); setSelectedClientDNI(null); }} className="back-button">← Volver</button>
                            </div>
                        </header>
                        <div className="main-content">
                            <div className="actions-bar">
                                <div className="main-tabs-nav">
                                    <button onClick={() => setActiveTab('training')} className={`main-tab-button ${activeTab === 'training' ? 'active' : ''}`}>Entrenamiento</button>
                                    <button onClick={() => setActiveTab('nutrition')} className={`main-tab-button ${activeTab === 'nutrition' ? 'active' : ''}`}>Nutrición</button>
                                </div>
                                <button onClick={handleSaveChanges} className={`save-changes-button ${saveButtonText.includes('✓') ? 'saved' : ''}`} disabled={saveButtonText === "Guardando..."}>
                                    {saveButtonText}
                                </button>
                            </div>
                             {error && <p className="error-text" style={{textAlign: "center", marginBottom: '1rem'}}>{error}</p>}

                            <div className="admin-instructions-box">
                               <label htmlFor="additional-instructions">Instrucciones Adicionales para la IA (Opcional)</label>
                               <textarea 
                                    id="additional-instructions"
                                    value={additionalInstructions} 
                                    onChange={e => setAdditionalInstructions(e.target.value)} 
                                    placeholder="Ej: 'Priorizar ejercicios con peso libre', 'Evitar sentadillas por una molestia en la rodilla', 'Agregar más volumen a los hombros'."
                                    rows={3}
                                />
                            </div>

                            {activeTab === 'training' && (
                                <div className="results-section">
                                    <button onClick={handleGenerateRoutine} className="cta-button" disabled={loadingRoutine}>
                                        {loadingRoutine ? <><span className="spinner small"></span>Generando Rutina...</> : (routine ? 'Volver a Generar Rutina' : 'Generar Rutina con IA')}
                                    </button>

                                    {loadingRoutine ? (
                                        <div className="loading-container"><div className="spinner"></div><p>Creando plan de entrenamiento...</p></div>
                                    ) : routine ? (
                                        <div className="plan-container">
                                             <header className="plan-header"><h2>{routine.planName}</h2><p>Duración total: {routine.totalDurationWeeks} semanas</p></header>
                                              {targetWeight && <p className="target-weight-info">Objetivo de peso al final del plan: ~{targetWeight.toFixed(1)} kg</p>}
                                             <div className="accordion-phases">
                                                {routine.phases.map((phase, index) => (
                                                    <div key={index} className="accordion-item">
                                                        <button
                                                            className={`accordion-header ${index === selectedPhaseTabIndex ? 'active' : ''}`}
                                                            onClick={() => setSelectedPhaseTabIndex(prev => prev === index ? -1 : index)}
                                                            aria-expanded={index === selectedPhaseTabIndex}
                                                        >
                                                            <span>{phase.phaseName} ({phase.durationWeeks} sem)</span>
                                                            <span className="accordion-header-icon">+</span>
                                                        </button>
                                                        <div className={`accordion-content ${index === selectedPhaseTabIndex ? 'open' : ''}`}>
                                                             {index === selectedPhaseTabIndex && (
                                                                <div className="phase-tab-content">
                                                                     <div className="day-tabs-nav">
                                                                         {phase.routine.dias.map((day, dayIndex) => (
                                                                             <button key={dayIndex} className={`day-tab-button ${dayIndex === adminSelectedDayIndex ? 'active' : ''}`} onClick={() => setAdminSelectedDayIndex(dayIndex)}>
                                                                                 {day.dia}
                                                                             </button>
                                                                         ))}
                                                                     </div>
                                                                     {adminSelectedDay && (
                                                                         <div className="day-card animated-fade-in">
                                                                            <h4>{adminSelectedDay.dia} - <span className="muscle-group">{adminSelectedDay.grupoMuscular}</span></h4>
                                                                            <ul className="exercise-list">
                                                                                {adminSelectedDay.ejercicios.map((ex, i) => (
                                                                                    <li key={i} className="exercise-item">
                                                                                        <p className="exercise-name">{ex.nombre}</p>
                                                                                        <div className="exercise-details">
                                                                                            <span>Series: {ex.series}</span><span>Reps: {ex.repeticiones}</span><span>Descanso: {ex.descanso}s</span>
                                                                                        </div>
                                                                                        {ex.tecnicaAvanzada && <div className="advanced-technique"><span>⚡️</span>{ex.tecnicaAvanzada}</div>}
                                                                                    </li>
                                                                                ))}
                                                                            </ul>
                                                                            <p className="cardio-note">{adminSelectedDay.cardio}</p>
                                                                         </div>
                                                                     )}
                                                                </div>
                                                             )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="placeholder">La rutina generada aparecerá aquí.</div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'nutrition' && (
                                <div className="results-section">
                                    <button onClick={handleGenerateDiet} className="cta-button" disabled={loadingDiet}>
                                        {loadingDiet ? <><span className="spinner small"></span>Generando Dieta...</> : (dietPlan ? 'Volver a Generar Dieta' : 'Generar Dieta con IA')}
                                    </button>
                                    
                                    {loadingDiet ? (
                                        <div className="loading-container"><div className="spinner"></div><p>Calculando macros y creando plan...</p></div>
                                    ) : dietPlan ? (
                                        <div className="diet-plan-container">
                                            <h2>{dietPlan.planTitle}</h2>
                                            <div className="diet-summary">
                                                <div><strong>Calorías:</strong> {dietPlan.summary.totalCalories} kcal</div>
                                                <div><strong>Proteínas:</strong> {dietPlan.summary.macronutrients.proteinGrams}g</div>
                                                <div><strong>Carbs:</strong> {dietPlan.summary.macronutrients.carbsGrams}g</div>
                                                <div><strong>Grasas:</strong> {dietPlan.summary.macronutrients.fatGrams}g</div>
                                            </div>
                                            <div className="meals-grid">
                                                {dietPlan.meals.map((meal, index) => (
                                                    <div key={index} className="meal-card">
                                                        <h4>{meal.mealName}</h4>
                                                        <ul>{meal.foodItems.map((item, i) => <li key={i}>{item.food} <span>({item.amount})</span></li>)}</ul>
                                                    </div>
                                                ))}
                                            </div>
                                             {dietPlan.recommendations && (
                                                  <div className="recommendations-section">
                                                      <h4>💡 Recomendaciones clave</h4>
                                                      <ul>{dietPlan.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}</ul>
                                                  </div>
                                             )}
                                        </div>
                                    ) : (
                                        <div className="placeholder">El plan de nutrición generado aparecerá aquí.</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null; // Fallback
};

// --- Super Admin Portal Component ---
const SuperAdminPortal = ({ ai, onLogout }: { ai: GoogleGenAI | null; onLogout: () => void; }) => {
    const [gyms, setGyms] = useState<Gym[]>([]);
    const [view, setView] = useState<'dashboard' | 'manageGym'>('dashboard');
    const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
    
    // States for adding/editing a gym
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingGym, setEditingGym] = useState<Gym | { _id: null } | null>(null);
    const [gymName, setGymName] = useState('');
    const [gymUsername, setGymUsername] = useState('');
    const [gymPassword, setGymPassword] = useState('');
    const [gymLogoSvg, setGymLogoSvg] = useState<string | null>(null);
    const [gymDailyLimit, setGymDailyLimit] = useState(10);
    const [isUploading, setIsUploading] = useState(false);
    
    const [deleteConfirmation, setDeleteConfirmation] = useState<Gym | null>(null);

    const fetchGyms = async () => {
        const data = await apiClient.getGyms();
        setGyms(data);
    };

    useEffect(() => {
        fetchGyms();
    }, []);
    
    const handleOpenAddModal = () => {
        setEditingGym({ _id: null }); // Indicador para "agregar nuevo"
        setGymName('');
        setGymUsername('');
        setGymPassword('');
        setGymLogoSvg(null);
        setGymDailyLimit(10);
        setIsEditModalOpen(true);
    };

    const handleOpenEditModal = (gym: Gym) => {
        setEditingGym(gym);
        setGymName(gym.name);
        setGymUsername(gym.username);
        setGymPassword(''); // La contraseña se edita por separado, no se muestra
        setGymLogoSvg(gym.logoSvg || null);
        setGymDailyLimit(gym.dailyQuestionLimit || 10);
        setIsEditModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsEditModalOpen(false);
        setEditingGym(null);
    };
    
     const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/svg+xml')) {
                alert('Por favor, subí un archivo SVG para el logo.');
                return;
            }
            setIsUploading(true);
            const reader = new FileReader();
            reader.onload = (event) => {
                setGymLogoSvg(event.target?.result as string);
                setIsUploading(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveGym = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingGym?._id) { // Editando
            const dataToUpdate: { name: string; logoSvg: string | null; password?: string, dailyQuestionLimit: number } = {
                name: gymName,
                logoSvg: gymLogoSvg,
                dailyQuestionLimit: gymDailyLimit
            };
            if (gymPassword) {
                dataToUpdate.password = gymPassword;
            }
            await apiClient.updateGym(editingGym._id, dataToUpdate);
        } else { // Creando
            await apiClient.createGym(gymName, gymUsername, gymPassword, gymLogoSvg, gymDailyLimit);
        }
        
        await fetchGyms();
        handleCloseModal();
    };

    const handleDeleteRequest = (gym: Gym) => {
        setDeleteConfirmation(gym);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmation) return;
        await apiClient.deleteGym(deleteConfirmation._id);
        await fetchGyms();
        setDeleteConfirmation(null);
    };

    // --- Renderizado del Componente ---
    if (view === 'manageGym' && selectedGym) {
        return <GymPortal gym={selectedGym} ai={ai} onLogout={() => {}} onBackToSuperAdmin={() => { setView('dashboard'); setSelectedGym(null); }} />
    }

    return (
        <div className="admin-dashboard">
            <ConfirmationModal
                isOpen={!!deleteConfirmation}
                message={`¿Estás seguro de que querés eliminar el gimnasio "${deleteConfirmation?.name}"? Esta acción borrará permanentemente el gimnasio y TODOS sus clientes asociados.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmation(null)}
            />
            
            {isEditModalOpen && editingGym && (
                 <div className="modal-overlay" onClick={handleCloseModal}>
                     <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
                          <h3>{editingGym._id !== null ? `Editar ${(editingGym as Gym).name}` : 'Agregar Nuevo Gimnasio'}</h3>
                          <form onSubmit={handleSaveGym}>
                             <div className="form-group">
                                 <label>Nombre del Gimnasio</label>
                                 <input type="text" value={gymName} onChange={e => setGymName(e.target.value)} required />
                             </div>
                              <div className="form-group">
                                 <label>Usuario (para login)</label>
                                 <input type="text" value={gymUsername} onChange={e => setGymUsername(e.target.value)} required disabled={!!editingGym._id} />
                             </div>
                             <div className="form-group">
                                 <label>Contraseña {editingGym._id ? '(dejar en blanco para no cambiar)' : ''}</label>
                                 <input type="password" value={gymPassword} onChange={e => setGymPassword(e.target.value)} required={!editingGym._id} />
                             </div>
                              <div className="form-group">
                                 <label>Límite de Preguntas a IA por Día (por cliente)</label>
                                 <input type="number" value={gymDailyLimit} onChange={e => setGymDailyLimit(Number(e.target.value) || 0)} required />
                             </div>
                             <div className="form-group">
                                <label>Logo (SVG)</label>
                                <div className="logo-upload-wrapper">
                                    <label htmlFor="logo-upload" className="file-input-label">
                                        {isUploading ? <span className="spinner small"/> : 'Seleccionar archivo SVG'}
                                    </label>
                                    <input id="logo-upload" type="file" accept="image/svg+xml" onChange={handleLogoUpload} />
                                    <div className="logo-preview">
                                        {gymLogoSvg ? <img src={gymLogoSvg} alt="Logo preview" /> : 'Sin logo'}
                                    </div>
                                </div>
                             </div>
                             <div className="modal-actions" style={{marginTop: '2rem'}}>
                                <button type="button" className="cta-button secondary" onClick={handleCloseModal}>Cancelar</button>
                                <button type="submit" className="cta-button">Guardar</button>
                             </div>
                          </form>
                     </div>
                 </div>
            )}
            
            <header className="main-header">
                <div className="header-title-wrapper">
                    <h1>Panel de Súper Administrador</h1>
                </div>
                <button onClick={onLogout} className="logout-button">Cerrar Sesión</button>
            </header>

            <div className="add-gym-container">
                <button onClick={handleOpenAddModal} className="cta-button">
                    + Agregar Nuevo Gimnasio
                </button>
            </div>

            <div className="gym-list">
                {gyms.map(gym => (
                    <div key={gym._id} className="gym-card">
                        <div>
                            <div className="gym-card-header">
                                <div className="gym-card-logo">
                                    {gym.logoSvg ? <img src={gym.logoSvg} alt={`${gym.name} Logo`} /> : <Logo />}
                                </div>
                                <div className="gym-card-info">
                                    <h3>{gym.name}</h3>
                                </div>
                            </div>
                            <p>Usuario: {gym.username}</p>
                        </div>
                        <div className="gym-card-actions">
                            <button onClick={() => handleDeleteRequest(gym)} className="action-btn delete">Eliminar</button>
                            <button onClick={() => handleOpenEditModal(gym)} className="action-btn edit">Editar</button>
                             <button onClick={() => { setSelectedGym(gym); setView('manageGym'); }} className="cta-button">
                                Administrar
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- Componente Principal de la App ---
const App = () => {
    const [view, setView] = useState<'landing' | 'superadminLogin' | 'gymLogin' | 'clientLogin' | 'superadminPortal' | 'gymPortal' | 'clientPortal'>('landing');
    const [loggedInGym, setLoggedInGym] = useState<Gym | null>(null);
    const [loggedInClientDni, setLoggedInClientDni] = useState<string | null>(null);
    const [ai, setAi] = useState<GoogleGenAI | null>(null);

    useEffect(() => {
        try {
            if (process.env.API_KEY) {
                setAi(new GoogleGenAI({ apiKey: process.env.API_KEY }));
            } else {
                 console.error("API_KEY is not defined in process.env");
            }
        } catch (error) {
             console.error("Failed to initialize GoogleGenAI:", error);
        }
    }, []);

    const handleRoleSelect = (role: 'superadmin' | 'gym' | 'client') => {
        if (role === 'superadmin') setView('superadminLogin');
        else if (role === 'gym') setView('gymLogin');
        else if (role === 'client') setView('clientLogin');
    };

    const handleLogout = () => {
        setLoggedInGym(null);
        setLoggedInClientDni(null);
        setView('landing');
    };

    switch (view) {
        case 'landing':
            return <LandingPage onSelectRole={handleRoleSelect} />;
        case 'superadminLogin':
            return <SuperAdminLogin onLogin={() => setView('superadminPortal')} onBack={() => setView('landing')} />;
        case 'gymLogin':
             return <GymLogin onLogin={(gym) => { setLoggedInGym(gym); setView('gymPortal'); }} onBack={() => setView('landing')} />;
        case 'clientLogin':
             return <ClientLogin onLogin={(dni) => { setLoggedInClientDni(dni); setView('clientPortal'); }} onBack={() => setView('landing')} />;
        case 'superadminPortal':
            return <SuperAdminPortal ai={ai} onLogout={handleLogout} />;
        case 'gymPortal':
            if (loggedInGym) {
                return <GymPortal gym={loggedInGym} ai={ai} onLogout={handleLogout} />;
            }
            // Fallback si no hay gimnasio logueado
            setView('gymLogin');
            return null;
        case 'clientPortal':
            if (loggedInClientDni) {
                return <ClientPortal clientDni={loggedInClientDni} ai={ai} onLogout={handleLogout} />;
            }
            // Fallback si no hay cliente logueado
            setView('clientLogin');
            return null;
        default:
            return <LandingPage onSelectRole={handleRoleSelect} />;
    }
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}