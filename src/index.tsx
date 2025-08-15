


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
const Logo = () => (
    <img src="/logo.svg" alt="ScorpionGYM AI Logo" className="app-logo" />
);


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
        if (isOpen && clientData) {
            setMessages([{ role: 'model' as const, text: `¡Hola ${clientData.profile.name}! Soy Scorpion AI. ¿En qué puedo ayudarte hoy con tu plan? Puedo darte alternativas para comidas, ejercicios, o analizar una foto de tu comida para darte una estimación de sus calorías.` }]);
            setInput('');
            setImage(null);
        }
    }, [isOpen, clientData]);

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
                setSelectedMuscleGroup(Object.keys(data)[0] || '');
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
                            {Object.keys(library).map(group => (
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
                                        onBlur={handleSaveEdit}
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
            message: `¡ACCIÓN IRREVERSIBLE! ¿Estás seguro de que querés eliminar permanentemente ${selectedClients.size} cliente(s)?`,
            onConfirm: () => handleDeleteClientsPermanently(selectedClients)
        });
    };

    const handleSelectionModeToggle = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedClients(new Set());
    };

    const handleSaveLibrary = async (updatedLibrary: ExerciseLibrary, gymId: string): Promise<boolean> => {
        const success = await apiClient.saveExerciseLibrary(updatedLibrary, gymId);
        if (success) {
            setExerciseLibrary(updatedLibrary);
        }
        return success;
    };


    const filteredClients = clients
        .filter(client => (client.status || 'active') === viewMode)
        .filter(client =>
            client.profile?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.dni.toLowerCase().includes(searchTerm.toLowerCase())
        );

    // --- Handlers y Funciones de Navegación y Generación ---
    const handleBackToDashboard = async () => {
        setSelectedClientDNI(null);
        setView('dashboard');
        loadClientsAndLibrary();
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

    const handleSaveChanges = async () => {
        if (!selectedClientDNI) return;
        setSaveButtonText("Guardando...");
        const success = await apiClient.saveClientData(selectedClientDNI, { profile: profile!, routine, dietPlan });
        if (success) {
            setSaveButtonText("Guardado ✓");
        } else {
            setSaveButtonText("Error al Guardar");
            alert("No se pudieron guardar los cambios del cliente. Revisa la consola del navegador y los logs.");
        }
        setTimeout(() => setSaveButtonText("Guardar cambios"), 3000);
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
        if (!ai) { setError("La API Key de Google no está configurada. No se pueden generar planes."); return; }
        if (!isFormValid || !profile || !selectedClientDNI) return; 
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
        
        const finalSystemInstruction = dietSystemInstruction + (additionalInstructions ? `\n\nInstrucciones Adicionales del Entrenador: ${additionalInstructions}` : '');

        const dietSchema = { type: Type.OBJECT, properties: { planTitle: { type: Type.STRING }, summary: { type: Type.OBJECT, properties: { totalCalories: { type: Type.INTEGER }, macronutrients: { type: Type.OBJECT, properties: { proteinGrams: { type: Type.INTEGER }, carbsGrams: { type: Type.INTEGER }, fatGrams: { type: Type.INTEGER } }, required: ["proteinGrams", "carbsGrams", "fatGrams"] } }, required: ["totalCalories", "macronutrients"] }, meals: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { mealName: { type: Type.STRING }, foodItems: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { food: { type: Type.STRING }, amount: { type: Type.STRING } }, required: ["food", "amount"] } } }, required: ["mealName", "foodItems"] } }, recommendations: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de 2-4 recomendaciones nutricionales generales y de hidratación." } }, required: ["planTitle", "summary", "meals", "recommendations"] };

        try {
            const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: "Creá el plan nutricional.", config: { systemInstruction: finalSystemInstruction, responseMimeType: "application/json", responseSchema: dietSchema } });
            const parsedDiet = JSON.parse(response.text) as DietPlan;
            setDietPlan(parsedDiet);
            await apiClient.saveClientData(selectedClientDNI, { dietPlan: parsedDiet });
            setAdditionalInstructions('');
        } catch (err) { setError("No se pudo generar el plan nutricional."); console.error(err); } finally { setLoadingDiet(false); }
    };
    
    const handleGenerateRoutine = async () => {
      if (!ai) { setError("La API Key de Google no está configurada. No se pueden generar planes."); return; }
      if (!isFormValid || !profile || !selectedClientDNI) return; 
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
      
      const finalSystemInstruction = systemInstruction + (additionalInstructions ? `\n\nInstrucciones Adicionales del Entrenador: ${additionalInstructions}` : '');
      const prompt = `Armá un plan de entrenamiento completo para este cliente, basado en tus directivas.`;
      const schema = { type: Type.OBJECT, properties: { planName: { type: Type.STRING }, totalDurationWeeks: { type: Type.INTEGER }, phases: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { phaseName: { type: Type.STRING }, durationWeeks: { type: Type.INTEGER }, routine: { type: Type.OBJECT, properties: { dias: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { dia: { type: Type.STRING, description: "El nombre o número del día de entrenamiento (ej. 'Día 1', 'Día A'). NO incluyas el grupo muscular en este campo." }, grupoMuscular: { type: Type.STRING, description: "El grupo muscular principal para este día (ej. 'Pecho y Tríceps', 'Piernas y Glúteos')." }, ejercicios: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { nombre: { type: Type.STRING }, series: { type: Type.STRING }, repeticiones: { type: Type.STRING }, descanso: { type: Type.STRING, description: "El tiempo de descanso en segundos, como una cadena de texto que contenga SÓLO el número (ej: '60')." }, tecnicaAvanzada: { type: Type.STRING } }, required: ["nombre", "series", "repeticiones", "descanso"] }}, cardio: { type: Type.STRING } }, required: ["dia", "grupoMuscular", "ejercicios", "cardio"] }}}}}, required: ["phaseName", "durationWeeks", "routine"] }}}, required: ["planName", "totalDurationWeeks", "phases"] };

      try {
        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { systemInstruction: finalSystemInstruction, responseMimeType: "application/json", responseSchema: schema } });
        const parsedPlan = JSON.parse(response.text) as Routine;
        
        parsedPlan.phases.forEach(phase => phase.routine.dias.forEach(dia => dia.ejercicios.forEach(ex => {
            ex.descanso = String(ex.descanso || '60').replace(/[^0-9]/g, '') || '60';
        })));

        const generatedDate = new Date().toISOString();
        
        setRoutine(parsedPlan);
        setRoutineGeneratedDate(generatedDate);
        setDietPlan(null);
        setActiveTab('training');
        await apiClient.saveClientData(selectedClientDNI, { routine: parsedPlan, routineGeneratedDate: generatedDate, dietPlan: null, progressLog: {}, bodyWeightLog: [], termsAccepted: false });
        setAdditionalInstructions('');
      } catch (err) { setError("No se pudo generar el plan."); console.error(err); } finally { setLoadingRoutine(false); }
    };
    
    const selectedPhase = routine?.phases?.[selectedPhaseTabIndex];
    const selectedDay = selectedPhase?.routine?.dias?.[adminSelectedDayIndex];

    if (view === 'dashboard') {
        return (
            <div className="admin-dashboard">
                <header className="main-header">
                    <div className="header-title-wrapper">
                         {gym.logoSvg ? <img src={gym.logoSvg} alt={`${gym.name} logo`} className="gym-logo" /> : <Logo />}
                         <div>
                            <h1>Panel de {gym.name}</h1>
                            <p>Gestioná a tus clientes.</p>
                         </div>
                    </div>
                    <div className="admin-header-nav">
                         <button onClick={() => setView('library')} className="header-nav-button">Gestionar Ejercicios</button>
                         {onBackToSuperAdmin 
                             ? <button onClick={onBackToSuperAdmin} className="logout-button admin-logout">Volver a Super Admin</button>
                             : <button onClick={onLogout} className="logout-button admin-logout">Cerrar Sesión</button>
                         }
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
                        <button onClick={() => { setViewMode('active'); setSelectedClients(new Set()); setIsSelectionMode(false); }} className={`view-toggle-button ${viewMode === 'active' ? 'active' : ''}`}>Activos</button>
                        <button onClick={() => { setViewMode('archived'); setSelectedClients(new Set()); setIsSelectionMode(false); }} className={`view-toggle-button ${viewMode === 'archived' ? 'active' : ''}`}>Archivados</button>
                    </div>

                    <div className="selection-controls">
                        <button className="selection-toggle-button" onClick={handleSelectionModeToggle}>{isSelectionMode ? 'Cancelar Selección' : 'Seleccionar...'}</button>
                        {isSelectionMode && viewMode === 'active' && (
                            <button className="archive-selected-button" onClick={handleArchiveSelected} disabled={selectedClients.size === 0}>Archivar ({selectedClients.size})</button>
                        )}
                        {isSelectionMode && viewMode === 'archived' && (
                            <>
                                <button className="restore-selected-button" onClick={handleRestoreSelected} disabled={selectedClients.size === 0}>Restaurar ({selectedClients.size})</button>
                                <button className="delete-selected-button" onClick={handleDeletePermanentlySelected} disabled={selectedClients.size === 0}>Eliminar ({selectedClients.size})</button>
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
    
    if (view === 'library') {
        return <ExerciseLibraryManager gymId={gym._id} onSave={handleSaveLibrary} onBack={() => setView('dashboard')} />;
    }

    if (view === 'clientManagement' && profile) {
        const isLoading = loadingRoutine || loadingDiet;
        const enabledExercisesByGroup = Object.entries(exerciseLibrary).reduce((acc, [group, exercises]) => {
            const enabled = exercises.filter(ex => ex.isEnabled);
            if (enabled.length > 0) acc[group] = enabled;
            return acc;
        }, {} as ExerciseLibrary);
            
        return (
            <>
              <header className="main-header">
                <button onClick={handleBackToDashboard} className="back-button">← Volver al panel de {gym.name}</button>
                <div className="header-title-wrapper">
                  {gym.logoSvg ? <img src={gym.logoSvg} alt={`${gym.name} logo`} className="gym-logo" /> : <Logo />}
                  <div>
                    <h1>Panel de Cliente: {profile.name || selectedClientDNI}</h1>
                    <p>Gestioná el perfil y los planes de tu cliente.</p>
                  </div>
                </div>
                {onBackToSuperAdmin 
                     ? <button onClick={onBackToSuperAdmin} className="logout-button admin-logout">Volver a Super Admin</button>
                     : <button onClick={onLogout} className="logout-button">Cerrar Sesión</button>
                 }
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
                      <div className="form-group"><label>Factor de Actividad (fuera del gym)</label><select name="activityFactor" value={profile.activityFactor || 'Sedentario'} onChange={handleInputChange}><option value="Sedentario">Sedentario (trabajo de oficina)</option><option value="Ligero">Ligero (trabajo de pie, caminatas)</option><option value="Activo">Activo (trabajo físico moderado)</option><option value="Muy Activo">Muy Activo (trabajo físico intenso)</option></select></div>
                      <div className="form-group"><label>Área de Enfoque</label><select name="bodyFocusArea" value={profile.bodyFocusArea || 'Cuerpo completo'} onChange={handleInputChange}><option value="Cuerpo completo">Cuerpo completo</option><option value="Tren Superior">Tren Superior</option><option value="Tren Inferior">Tren Inferior</option></select></div>
                      {profile.bodyFocusArea && profile.bodyFocusArea !== 'Cuerpo completo' && (<div className="form-group"><label>Músculo Específico (Opcional)</label><select name="bodyFocusSpecific" value={profile.bodyFocusSpecific || ''} onChange={handleInputChange}><option value="">Enfoque General</option>{profile.bodyFocusArea === 'Tren Superior' && (<><option value="Pecho">Pecho</option><option value="Espalda">Espalda</option><option value="Hombros">Hombros</option><option value="Brazos">Brazos</option></>)}{profile.bodyFocusArea === 'Tren Inferior' && (<><option value="Piernas">Piernas (Cuádriceps/Femorales)</option><option value="Glúteos">Glúteos</option></>)}</select></div>)}
                      <div className="form-group"><label>Intensidad del entrenamiento</label><select name="trainingIntensity" value={profile.trainingIntensity || 'Moderada'} onChange={handleInputChange}><option value="Baja">Baja</option><option value="Moderada">Moderada</option><option value="Alta">Alta</option><option value="Extrema">Extrema</option></select></div>
                      <div className="form-group"><label>Fase de adaptación</label><select name="includeAdaptationPhase" value={profile.includeAdaptationPhase || 'Sí'} onChange={handleInputChange}><option value="Sí">Incluir fase de adaptación</option><option value="No">Empezar directo sin adaptación</option></select></div>
                      <div className="form-group"><label>Complejidad de la rutina</label><select name="useAdvancedTechniques" value={profile.useAdvancedTechniques} onChange={handleInputChange}><option value="No">Ejercicios simples</option><option value="Sí">Incluir técnicas avançadas</option></select></div>
                    </form>
                     {clientAccessCode && (<div className="access-code-display"><span>Código de Acceso del Cliente</span><strong>{clientAccessCode}</strong></div>)}
                     {bmi !== null && (<div className="bmi-display"><span>IMC: <strong>{bmi.toFixed(1)}</strong></span><span className={`bmi-category ${bmiCategoryClass}`}>{bmiCategory}</span></div>)}
                </aside>
        
                <main className="main-content">
                    <div className="admin-instructions-box">
                        <label htmlFor="additional-instructions">Instrucciones Adicionales para la IA</label>
                        <textarea
                            id="additional-instructions"
                            name="additional-instructions"
                            rows={3}
                            placeholder="Ej: El cliente es intolerante a la lactosa, evitar productos lácteos y reemplazar proteína en polvo. Tiene una lesión en la rodilla, evitar sentadillas y zancadas."
                            value={additionalInstructions}
                            onChange={(e) => setAdditionalInstructions(e.target.value)}
                        ></textarea>
                    </div>
                  <div className="actions-bar">
                    <button className="cta-button" onClick={handleGenerateRoutine} disabled={!isFormValid || isLoading}>{loadingRoutine ? <><span className="spinner small"></span>Armando rutina...</> : (routine ? "Volver a generar rutina" : "Generar rutina")}</button>
                    <button className={`save-changes-button ${saveButtonText.includes('✓') ? 'saved' : ''}`} onClick={handleSaveChanges} disabled={isLoading || saveButtonText === "Guardando..."}>{saveButtonText}</button>
                  </div>
                  
                    <div className="main-tabs-nav">
                        <button onClick={() => setActiveTab('training')} className={`main-tab-button ${activeTab === 'training' ? 'active' : ''}`}>Entrenamiento</button>
                        <button onClick={() => setActiveTab('nutrition')} className={`main-tab-button ${activeTab === 'nutrition' ? 'active' : ''}`}>Nutrición</button>
                    </div>
        
                    <section className="results-section">
                        {activeTab === 'training' && (<>
                          {loadingRoutine && <div className="loading-container"><div className="spinner"></div><p>Armando el plan de entrenamiento...</p></div>}
                          {!isLoading && !routine && !error && <p className="placeholder">Completá el perfil del cliente/a y generá un plan de entrenamiento.</p>}
                          {error && !isLoading && <div className="error-container"><p>{error}</p></div>}
                          {routine && (<div className="plan-container">
                                <header className="plan-header"><h2>{routine.planName}</h2><p>Duración total: {routine.totalDurationWeeks} semanas</p>{targetWeight !== null && (<p className="target-weight-info">Objetivo de peso al final del plan: ~{targetWeight.toFixed(1)} kg</p>)}</header>
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
                                                            <div className="day-tabs-nav">{phase.routine.dias.map((day, dayIndex) => (<button key={dayIndex} className={`day-tab-button ${dayIndex === adminSelectedDayIndex ? 'active' : ''}`} onClick={() => setAdminSelectedDayIndex(dayIndex)}>{day.dia}</button>))}</div>
                                                            {selectedDay && (<div className="routine-plan editable">
                                                                <div className="day-card animated-fade-in">
                                                                    <h3>{selectedDay.dia} - <span className="muscle-group">{selectedDay.grupoMuscular}</span></h3>
                                                                    <ul className="exercise-list">{selectedDay.ejercicios.map((ex, exIndex) => (
                                                                        <li key={exIndex} className="exercise-item editable">
                                                                            <div className="exercise-item-header"><h4>Ejercicio {exIndex + 1}</h4><button className="action-btn delete" onClick={() => handleRemoveExercise(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex)} aria-label={`Borrar ejercicio ${exIndex + 1}`}>Borrar</button></div>
                                                                            <div className="form-group"><label>Ejercicio</label><select className="exercise-input name-select" value={ex.nombre} onChange={(e) => handleExerciseChange(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex, 'nombre', e.target.value)}>{Object.entries(enabledExercisesByGroup).map(([group, exercises]) => (<optgroup key={group} label={group}>{exercises.map(exDef => (<option key={exDef.name} value={exDef.name}>{exDef.name}</option>))}</optgroup>))}</select></div>
                                                                            <div className="exercise-details editable"><span>Series: <input type="text" value={ex.series} onChange={(e) => handleExerciseChange(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex, 'series', e.target.value)} /></span><span>Reps: <input type="text" value={ex.repeticiones} onChange={(e) => handleExerciseChange(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex, 'repeticiones', e.target.value)} /></span><span>Descanso: <input type="number" value={ex.descanso} onChange={(e) => handleExerciseChange(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex, 'descanso', e.target.value)} />s</span></div>
                                                                            <div className="form-group"><label>Técnica Avanzada</label><select name="tecnicaAvanzada" value={ex.tecnicaAvanzada || ''} onChange={(e) => handleExerciseChange(selectedPhaseTabIndex, adminSelectedDayIndex, exIndex, 'tecnicaAvanzada', e.target.value)}>{advancedTechniqueOptions.map(opt => <option key={opt.label} value={opt.value}>{opt.label}</option>)}</select></div>
                                                                        </li>))}
                                                                    </ul>
                                                                    <div className="add-exercise-action"><button className="add-exercise-button" onClick={() => handleAddExercise(selectedPhaseTabIndex, adminSelectedDayIndex)}>+ Agregar Ejercicio</button></div>
                                                                    <p className="cardio-note">{selectedDay.cardio}</p>
                                                                </div>
                                                            </div>)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>)}
                          </>)}
                        {activeTab === 'nutrition' && (
                            <div className="diet-plan-container">
                                {loadingDiet && (<div className="loading-container"><div className="spinner"></div><p>Armando el plan de nutrición...</p></div>)}
                                {!loadingDiet && !dietPlan && !error && (<div className="placeholder-action"><p>Todavía no hay un plan de nutrición para este cliente/a.</p><button className="cta-button" onClick={handleGenerateDiet} disabled={!isFormValid || isLoading}>Generar plan de nutrición</button></div>)}
                                {error && !isLoading && <div className="error-container"><p>{error}</p></div>}
                                {!loadingDiet && dietPlan && (
                                    <>
                                        <header className="plan-header"><h2>{dietPlan.planTitle}</h2></header>
                                        <div className="diet-summary"><div><strong>Calorías:</strong> {dietPlan.summary?.totalCalories || 'N/A'} kcal</div><div><strong>Proteínas:</strong> {dietPlan.summary?.macronutrients?.proteinGrams || 'N/A'}g</div><div><strong>Carbs:</strong> {dietPlan.summary?.macronutrients?.carbsGrams || 'N/A'}g</div><div><strong>Grasas:</strong> {dietPlan.summary?.macronutrients?.fatGrams || 'N/A'}g</div></div>
                                        <div className="meals-grid">{dietPlan.meals?.map((meal, index) => (<div key={index} className="meal-card"><h3>{meal.mealName}</h3><ul>{meal.foodItems?.map((item, i) => (<li key={i}>{item.food} <span>({item.amount})</span></li>))}</ul></div>))}</div>
                                        {dietPlan.recommendations && dietPlan.recommendations.length > 0 && (<div className="recommendations-section"><h4>💡 Recomendaciones clave</h4><ul>{dietPlan.recommendations.map((rec, i) => (<li key={i}>{rec}</li>))}</ul></div>)}
                                        <button className="cta-button regenerate" onClick={handleGenerateDiet} disabled={!isFormValid || isLoading}>{loadingDiet ? <><span className="spinner small"></span>Regenerando...</> : "Volver a generar plan"}</button>
                                    </>
                                )}
                            </div>
                        )}
                    </section>
                </main>
              </div>
            </>
        );
    }

    return <div className="login-container"><div className="spinner"></div></div>;
};

// 8. Super Admin Portal
const SuperAdminPortal = ({ onManageGym, onLogout }: { onManageGym: (gym: Gym) => void; onLogout: () => void; }) => {
    const [gyms, setGyms] = useState<Gym[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newGymName, setNewGymName] = useState('');
    const [newGymUsername, setNewGymUsername] = useState('');
    const [newGymPassword, setNewGymPassword] = useState('');
    const [newGymLogo, setNewGymLogo] = useState<string | null>(null);
    const [newGymDailyQuestionLimit, setNewGymDailyQuestionLimit] = useState(10);
    const [deleteConfirmation, setDeleteConfirmation] = useState<Gym | null>(null);
    const [editGym, setEditGym] = useState<Gym | null>(null);

    useEffect(() => {
        fetchGyms();
    }, []);

    const fetchGyms = async () => {
        setIsLoading(true);
        const fetchedGyms = await apiClient.getGyms();
        setGyms(fetchedGyms);
        setIsLoading(false);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string | null>>) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onloadend = () => {
                setter(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            alert('Por favor, seleccioná un archivo SVG válido.');
            setter(null);
            e.target.value = '';
        }
    };

    const handleCreateGym = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGymName || !newGymUsername || !newGymPassword) {
            alert("Todos los campos son obligatorios.");
            return;
        }
        const success = await apiClient.createGym(newGymName, newGymUsername, newGymPassword, newGymLogo, newGymDailyQuestionLimit);
        if (success) {
            setNewGymName('');
            setNewGymUsername('');
            setNewGymPassword('');
            setNewGymLogo(null);
            setNewGymDailyQuestionLimit(10);
            fetchGyms();
        } else {
            alert("Error al crear el gimnasio. Es posible que el nombre de usuario ya exista.");
        }
    };
    
    const handleUpdateGym = async (gymId: string, name: string, logoSvg: string | null, password: string, dailyQuestionLimit: number) => {
        const updatePayload: { name: string; logoSvg?: string | null; password?: string; dailyQuestionLimit?: number; } = { name, dailyQuestionLimit };
        
        if (logoSvg !== undefined) {
             updatePayload.logoSvg = logoSvg;
        }

        const trimmedPassword = password.trim();
        if (trimmedPassword) {
            updatePayload.password = trimmedPassword;
        }
    
        const success = await apiClient.updateGym(gymId, updatePayload);
        if (success) {
            setEditGym(null);
            fetchGyms();
        } else {
            alert("Error al actualizar el gimnasio.");
        }
    };

    const handleDeleteRequest = (gym: Gym) => {
        setDeleteConfirmation(gym);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmation) return;
        const success = await apiClient.deleteGym(deleteConfirmation._id);
        if (success) {
            setDeleteConfirmation(null);
            fetchGyms();
        } else {
            alert("Error al eliminar el gimnasio.");
        }
    };

    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div><p>Cargando gimnasios...</p></div>;
    }
    
    const EditGymModal = ({ gym, onClose, onSave }: { gym: Gym, onClose: () => void, onSave: (id: string, name: string, logo: string | null, password: string, limit: number) => void }) => {
        const [name, setName] = useState(gym.name);
        const [logo, setLogo] = useState<string | null>(gym.logoSvg || null);
        const [password, setPassword] = useState('');
        const [limit, setLimit] = useState(gym.dailyQuestionLimit || 10);


        const handleSave = () => {
            onSave(gym._id, name, logo, password, limit);
        };
        
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
                    <h3>Editar Gimnasio</h3>
                    <div className="form-group">
                        <label htmlFor="edit-gym-name">Nombre del Gimnasio</label>
                        <input id="edit-gym-name" type="text" value={name} onChange={e => setName(e.target.value)} />
                    </div>
                     <div className="form-group">
                         <label>Logo (SVG)</label>
                         <div className="logo-upload-wrapper" style={{flexDirection: 'row', alignItems: 'center'}}>
                            <label htmlFor="edit-logo-upload" className="file-input-label">Cambiar Logo</label>
                            <input id="edit-logo-upload" type="file" accept="image/svg+xml" onChange={(e) => handleLogoUpload(e, setLogo)} />
                            <div className="logo-preview">
                                {logo ? <img src={logo} alt="Previsualización del logo" /> : 'SVG'}
                            </div>
                        </div>
                     </div>
                     <div className="form-group">
                        <label htmlFor="edit-gym-password">Nueva Contraseña (opcional)</label>
                        <input id="edit-gym-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Dejar en blanco para no cambiar" />
                    </div>
                     <div className="form-group">
                        <label htmlFor="edit-gym-limit">Límite de preguntas diarias por cliente</label>
                        <input id="edit-gym-limit" type="number" value={limit} onChange={e => setLimit(Number(e.target.value))} min="0" />
                    </div>
                    <div className="modal-actions">
                        <button className="cta-button secondary" onClick={onClose}>Cancelar</button>
                        <button className="cta-button" onClick={handleSave}>Guardar Cambios</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="admin-dashboard">
             <ConfirmationModal
                isOpen={!!deleteConfirmation}
                message={`¿Estás seguro de que querés eliminar el gimnasio "${deleteConfirmation?.name}"? Esta acción no se puede deshacer y borrará a todos sus clientes.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmation(null)}
                confirmText="Sí, Eliminar"
            />
            {editGym && <EditGymModal gym={editGym} onClose={() => setEditGym(null)} onSave={handleUpdateGym} />}
            <header className="main-header">
                <div className="header-title-wrapper">
                    <Logo />
                    <div>
                        <h1>Panel de Súper Administrador</h1>
                        <p>Gestioná las cuentas de los gimnasios y entrenadores.</p>
                    </div>
                </div>
                <button onClick={onLogout} className="logout-button admin-logout">Cerrar Sesión</button>
            </header>

            <div className="add-gym-container">
                <h3>Crear Nuevo Gimnasio / Entrenador</h3>
                <form onSubmit={handleCreateGym} className="add-gym-form">
                    <input type="text" value={newGymName} onChange={e => setNewGymName(e.target.value)} placeholder="Nombre del Gimnasio" required />
                    <input type="text" value={newGymUsername} onChange={e => setNewGymUsername(e.target.value)} placeholder="Usuario (para login)" required />
                    <input type="password" value={newGymPassword} onChange={e => setNewGymPassword(e.target.value)} placeholder="Contraseña" required />
                    <input type="number" value={newGymDailyQuestionLimit} onChange={e => setNewGymDailyQuestionLimit(Number(e.target.value))} placeholder="Límite preguntas IA" title="Límite de preguntas diarias a la IA por cliente" required min="0" />
                     <div className="logo-upload-wrapper">
                         <label htmlFor="logo-upload" className="file-input-label">Subir Logo</label>
                         <input id="logo-upload" type="file" accept="image/svg+xml" onChange={(e) => handleLogoUpload(e, setNewGymLogo)} />
                         <div className="logo-preview">
                            {newGymLogo ? <img src={newGymLogo} alt="Previsualización del logo" /> : 'SVG'}
                         </div>
                     </div>
                    <button type="submit" className="cta-button">Crear Cuenta</button>
                </form>
            </div>

            <div className="gym-list">
                {gyms.length > 0 ? gyms.map(gym => (
                    <div key={gym._id} className="gym-card">
                        <div className="gym-card-header">
                             <div className="gym-card-logo">
                                {gym.logoSvg ? <img src={gym.logoSvg} alt={`${gym.name} logo`} /> : <Logo />}
                             </div>
                             <div className="gym-card-info">
                                <h3>{gym.name}</h3>
                                <p>Usuario: {gym.username}</p>
                                <p>Límite IA: {gym.dailyQuestionLimit ?? 'N/A'} por día</p>
                             </div>
                        </div>
                        <div className="gym-card-actions">
                            <button className="action-btn delete" onClick={() => handleDeleteRequest(gym)}>Eliminar</button>
                            <button className="action-btn edit" onClick={() => setEditGym(gym)}>Editar</button>
                            <button className="cta-button" onClick={() => onManageGym(gym)}>Gestionar</button>
                        </div>
                    </div>
                )) : <p>No hay gimnasios registrados. ¡Creá el primero!</p>}
            </div>
        </div>
    );
};


// --- Componente Principal ---
const App = () => {
    const [view, setView] = useState<'landing' | 'superAdminLogin' | 'gymLogin' | 'clientLogin' | 'superAdminPortal' | 'gymPortal' | 'clientPortal'>('landing');
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loggedInGym, setLoggedInGym] = useState<Gym | null>(null);
    const [loggedInClientDNI, setLoggedInClientDNI] = useState<string | null>(null);
    const [gymToManage, setGymToManage] = useState<Gym | null>(null);

    const ai = useMemo(() => {
        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) {
                console.error("API Key de Google no encontrada. Revisa tu archivo .env y reinicia el servidor.");
                return null;
            }
            return new GoogleGenAI({ apiKey });
        } catch (e) {
            console.error("Error al inicializar GoogleGenAI:", e);
            return null;
        }
    }, []);

    const handleLogout = () => {
        setView('landing');
        setIsSuperAdmin(false);
        setLoggedInGym(null);
        setLoggedInClientDNI(null);
        setGymToManage(null);
    };

    const handleRoleSelect = (role: 'superadmin' | 'gym' | 'client') => {
        if (role === 'superadmin') setView('superAdminLogin');
        if (role === 'gym') setView('gymLogin');
        if (role === 'client') setView('clientLogin');
    };

    const handleSuperAdminLogin = () => {
        setIsSuperAdmin(true);
        setView('superAdminPortal');
    };

    const handleGymLogin = (gym: Gym) => {
        setLoggedInGym(gym);
        setView('gymPortal');
    };

    const handleClientLogin = (dni: string) => {
        setLoggedInClientDNI(dni);
        setView('clientPortal');
    };
    
    const handleManageGym = (gym: Gym) => {
        setGymToManage(gym);
        setView('gymPortal');
    };
    
    const handleBackToSuperAdmin = () => {
        setGymToManage(null);
        setView('superAdminPortal');
    }

    const renderContent = () => {
        switch (view) {
            case 'landing':
                return <LandingPage onSelectRole={handleRoleSelect} />;
            case 'superAdminLogin':
                return <SuperAdminLogin onLogin={handleSuperAdminLogin} onBack={handleLogout} />;
            case 'gymLogin':
                return <GymLogin onLogin={handleGymLogin} onBack={handleLogout} />;
            case 'clientLogin':
                return <ClientLogin onLogin={handleClientLogin} onBack={handleLogout} />;
            case 'superAdminPortal':
                if (isSuperAdmin) {
                    return <SuperAdminPortal onManageGym={handleManageGym} onLogout={handleLogout} />;
                }
                break;
            case 'gymPortal':
                const gymForPortal = gymToManage || loggedInGym;
                if (gymForPortal) {
                     return <GymPortal 
                                gym={gymForPortal} 
                                ai={ai} 
                                onLogout={handleLogout} 
                                onBackToSuperAdmin={isSuperAdmin ? handleBackToSuperAdmin : undefined} 
                            />;
                }
                break;
            case 'clientPortal':
                if (loggedInClientDNI) {
                    return <ClientPortal clientDni={loggedInClientDNI} onLogout={handleLogout} ai={ai} />;
                }
                break;
            default:
                return <LandingPage onSelectRole={handleRoleSelect} />;
        }
        // Fallback or loading state
        return <div className="loading-container"><div className="spinner"></div></div>;
    };
    
    return <>{renderContent()}</>;
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
