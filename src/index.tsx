

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
    return `${lowerBound.toFixed(1)}kg - ${upperBound.toFixed(1)}kg`;
};

/**
 * Debounce function to limit the rate at which a function gets called.
 * @param func The function to debounce.
 * @param delay The delay in milliseconds.
 * @returns A debounced version of the function.
 */
const debounce = <F extends (...args: any[]) => any>(func: F, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<F>): void => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
        }, delay);
    };
};

// --- Helper Components ---

const Spinner = ({ small = false }: { small?: boolean }) => (
    <div className={`spinner ${small ? 'small' : ''}`}></div>
);

const ConfirmationModal = ({ message, onConfirm, onCancel }: { message: string, onConfirm: () => void, onCancel: () => void }) => (
    <div className="modal-overlay" onClick={onCancel}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <p>{message}</p>
            <div className="modal-actions">
                <button onClick={onCancel} className="cta-button secondary">Cancelar</button>
                <button onClick={onConfirm} className="cta-button">Confirmar</button>
            </div>
        </div>
    </div>
);

const VideoPlayerModal = ({ videoUrl, onClose }: { videoUrl: string; onClose: () => void; }) => {
    return (
        <div className="video-modal-overlay" onClick={onClose}>
            <div className="video-modal-content" onClick={(e) => e.stopPropagation()}>
                <video src={videoUrl} controls autoPlay playsInline />
                <button className="video-modal-close-btn" onClick={onClose}>&times;</button>
            </div>
        </div>
    );
};

const BMIDisplay = ({ weight, height, isClientView = false }: { weight: number, height: number, isClientView?: boolean }) => {
    const { value: bmi, categoryClass } = calculateBMI(weight, height);
    const categoryText = {
        underweight: 'Bajo Peso',
        normal: 'Normal',
        overweight: 'Sobrepeso',
        obesity: 'Obesidad'
    }[categoryClass] || 'Desconocido';

    if (!bmi) return null;

    return (
        <div className={`bmi-display ${isClientView ? 'client-bmi' : ''}`}>
            <span>IMC: <strong>{bmi}</strong></span>
            <span className={`bmi-category ${categoryClass}`}>{categoryText}</span>
        </div>
    );
};

// --- Main Components ---

/**
 * Client Portal: Displays the training and nutrition plan for the client.
 */
// FIX: Added ChatAssistant component definition to resolve 'Cannot find name' error.
const ChatAssistant = ({ clientData, onClose }: { clientData: ClientData; onClose: () => void; }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [history, setHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const initChat = () => {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const systemInstruction = `Eres un asistente de fitness virtual para un cliente llamado ${clientData.profile.name}.
            Sus datos son: ${JSON.stringify(clientData.profile)}.
            Su rutina es: ${JSON.stringify(clientData.routine)}.
            Su plan de nutrición es: ${JSON.stringify(clientData.dietPlans?.[0])}.
            Responde preguntas sobre su plan, ofrece consejos y motivación. Sé amigable y servicial.
            No respondas a preguntas que no estén relacionadas con fitness, nutrición o su plan actual.
            `;

            const newChat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: { systemInstruction },
            });
            setChat(newChat);
        };
        initChat();
    }, [clientData]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [history]);

    const handleSendMessage = async () => {
        if (!userInput.trim() || !chat || isLoading) return;

        const userMessage = { role: 'user' as const, text: userInput };
        setHistory(prev => [...prev, userMessage]);
        const currentInput = userInput;
        setUserInput('');
        setIsLoading(true);

        try {
            const response = await chat.sendMessage({ message: currentInput });
            const modelMessage = { role: 'model' as const, text: response.text };
            setHistory(prev => [...prev, modelMessage]);
        } catch (error) {
            console.error("Error sending message to AI:", error);
            const errorMessage = { role: 'model' as const, text: 'Lo siento, hubo un error al procesar tu solicitud.' };
            setHistory(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay chat-assistant-overlay">
            <div className="modal-content chat-assistant-modal" onClick={(e) => e.stopPropagation()}>
                <header className="chat-header">
                    <h3>Asistente IA</h3>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </header>
                <div className="chat-history" ref={chatContainerRef}>
                     {history.length === 0 && <div className="chat-message model"><p>¡Hola! ¿Cómo puedo ayudarte con tu plan de entrenamiento o nutrición hoy?</p></div>}
                    {history.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.role}`}>
                            <p>{msg.text}</p>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="chat-message model">
                            <Spinner small />
                        </div>
                    )}
                </div>
                <footer className="chat-input-area">
                    <textarea
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Escribe tu consulta aquí..."
                        rows={1}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                    />
                    <button onClick={handleSendMessage} disabled={isLoading || !userInput.trim()}>Enviar</button>
                </footer>
            </div>
        </div>
    );
};
const ClientPortal = ({ dni, onLogout }: { dni: string, onLogout: () => void }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentView, setCurrentView] = useState<'agreement' | 'onboarding' | 'dashboard'>('agreement');

    useEffect(() => {
        const fetchClientData = async () => {
            try {
                setIsLoading(true);
                const data = await apiClient.getClientData(dni);
                if (data) {
                    setClientData(data);
                    if (!data.termsAccepted) {
                        setCurrentView('agreement');
                    } else if (data.planStatus === 'pending') {
                        setCurrentView('onboarding');
                    } else {
                        setCurrentView('dashboard');
                    }
                } else {
                    setError('No se pudo encontrar la información del cliente. Por favor, contacta a tu entrenador.');
                }
            } catch (err) {
                setError('Ocurrió un error al cargar tus datos.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClientData();
    }, [dni]);

    const handleAcceptTerms = async () => {
        if (clientData) {
            const updatedData = { ...clientData, termsAccepted: true };
            const success = await apiClient.saveClientData(dni, { termsAccepted: true });
            if (success) {
                setClientData(updatedData);
                if (updatedData.planStatus === 'pending') {
                    setCurrentView('onboarding');
                } else {
                    setCurrentView('dashboard');
                }
            } else {
                alert("No se pudo guardar tu aceptación. Inténtalo de nuevo.");
            }
        }
    };
    
    const handlePlanGenerated = (routine: Routine, dietPlans: (DietPlan | null)[]) => {
         if (clientData) {
            const updatedData: ClientData = {
                ...clientData,
                routine,
                dietPlans,
                planStatus: 'active',
                routineGeneratedDate: new Date().toISOString(),
            };
            setClientData(updatedData);
            setCurrentView('dashboard');
        }
    };


    if (isLoading) {
        return <div className="loading-container"><Spinner /></div>;
    }
    if (error) {
        return <div className="error-container">{error}</div>;
    }
    if (!clientData) {
        return <div className="error-container">No hay datos de cliente disponibles.</div>;
    }
    
     if (clientData.planStatus === 'expired' && currentView !== 'onboarding' ) {
        return <ExpiredPlanView onLogout={onLogout} />;
    }


    switch (currentView) {
        case 'agreement':
            return <AgreementView onAccept={handleAcceptTerms} onLogout={onLogout} gymLogo={clientData.gymLogo} />;
        case 'onboarding':
            return <OnboardingView clientData={clientData} setClientData={setClientData} onPlanGenerated={handlePlanGenerated} onLogout={onLogout} />;
        case 'dashboard':
            return <ClientDashboard clientData={clientData} setClientData={setClientData} onLogout={onLogout} />;
        default:
            return null;
    }
};

/**
 * Client Dashboard: The main view for the client after logging in and onboarding.
 */
const ClientDashboard = ({ clientData, setClientData, onLogout }: { clientData: ClientData; setClientData: React.Dispatch<React.SetStateAction<ClientData | null>>; onLogout: () => void }) => {
    const [activeTab, setActiveTab] = useState<'routine' | 'nutrition' | 'progress' | 'profile'>('routine');
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [hasNewRequest, setHasNewRequest] = useState(false);

    const handleRequestChange = () => {
        setHasNewRequest(true); // This could trigger a visual indicator
        setTimeout(() => setHasNewRequest(false), 5000); // Hide indicator after 5s
    };
    
    const planType = clientData.planType || 'full'; // Default to 'full'

    return (
        <div className="client-view-container">
             <header>
                <div className="header-title-wrapper">
                    {clientData.gymLogo && <div className="app-logo" dangerouslySetInnerHTML={{ __html: clientData.gymLogo }} />}
                    <h1>Hola, {clientData.profile.name.split(' ')[0]}</h1>
                </div>
                <div className="client-header-actions">
                     <button className="header-nav-button ai-assistant-button" onClick={() => setIsChatOpen(true)}>
                        Asistente IA
                    </button>
                    <button className="logout-button" onClick={onLogout}>Salir</button>
                </div>
            </header>
            
            <main className="main-content">
                 <nav className="main-tabs-nav">
                    { (planType === 'full' || planType === 'routine') && <button className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>Rutina</button>}
                    { (planType === 'full' || planType === 'nutrition') && <button className={`main-tab-button ${activeTab === 'nutrition' ? 'active' : ''}`} onClick={() => setActiveTab('nutrition')}>Nutrición</button>}
                    <button className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>Progreso</button>
                    <button className={`main-tab-button ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Mi Perfil</button>
                </nav>

                <div className="tab-content">
                    {activeTab === 'routine' && <ClientRoutineView clientData={clientData} setClientData={setClientData} onRequestChange={handleRequestChange} />}
                    {activeTab === 'nutrition' && <DietPlanDisplay clientData={clientData} />}
                    {activeTab === 'progress' && <ProgressView clientData={clientData} setClientData={setClientData} />}
                    {activeTab === 'profile' && <ClientProfileView clientData={clientData} />}
                </div>
            </main>
            {isChatOpen && <ChatAssistant clientData={clientData} onClose={() => setIsChatOpen(false)} />}
        </div>
    );
};

const ClientRoutineView = ({ clientData, setClientData, onRequestChange }: { clientData: ClientData; setClientData: React.Dispatch<React.SetStateAction<ClientData | null>>; onRequestChange: () => void; }) => {
    const routine = clientData.routine;

    const handleLogSubmit = async (exerciseName: string, weight: number, reps: number) => {
        const newLogEntry: ProgressLogEntry = {
            date: new Date().toISOString(),
            weight: weight,
            repetitions: reps,
        };

        const updatedProgressLog = { ...clientData.progressLog };
        if (!updatedProgressLog[exerciseName]) {
            updatedProgressLog[exerciseName] = [];
        }
        updatedProgressLog[exerciseName].push(newLogEntry);

        // Sort entries by date to be sure
        updatedProgressLog[exerciseName].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setClientData(prev => prev ? { ...prev, progressLog: updatedProgressLog } : null);
        await apiClient.saveClientData(clientData.dni, { progressLog: updatedProgressLog });
    };

    if (!routine) {
        return (
            <div className="placeholder">
                <p>Aún no se ha generado una rutina de entrenamiento.</p>
            </div>
        );
    }
    
    // Check for expiration
    const generatedDate = clientData.routineGeneratedDate ? new Date(clientData.routineGeneratedDate) : new Date();
    const expirationDate = new Date(generatedDate);
    expirationDate.setDate(expirationDate.getDate() + (routine.totalDurationWeeks * 7));
    const isExpired = new Date() > expirationDate;

    if (isExpired) {
        return <ExpiredPlanView onLogout={() => { /* Part of parent component */ }} />;
    }

    return (
        <div className="client-routine-view animated-fade-in">
             <div className="plan-header">
                <p className="expiration-date">
                    Este plan es válido hasta el: {expirationDate.toLocaleDateString('es-ES')}
                </p>
            </div>
            <RoutineDisplay routine={routine} progressLog={clientData.progressLog || {}} onLogSubmit={handleLogSubmit} clientPlanType={clientData.planType} />
            <RequestChangeModal clientData={clientData} onRequestChange={onRequestChange} />
        </div>
    );
};

const RequestChangeModal = ({ clientData, onRequestChange }: { clientData: ClientData; onRequestChange: () => void; }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject || !message) {
            setError('Por favor, completa ambos campos.');
            return;
        }
        setError('');
        setIsSending(true);

        const requestData: Omit<TrainerRequest, '_id' | 'status' | 'createdAt'> = {
            clientId: clientData.dni,
            clientName: clientData.profile.name,
            gymId: clientData.gymId,
            subject,
            message,
        };

        const success = await apiClient.createRequest(requestData);

        if (success) {
            setIsSuccess(true);
            onRequestChange(); // Notify parent
            setTimeout(() => {
                setIsOpen(false);
                setIsSuccess(false);
                setSubject('');
                setMessage('');
            }, 3000);
        } else {
            setError('No se pudo enviar la solicitud. Inténtalo de nuevo.');
        }
        setIsSending(false);
    };

    if (!isOpen) {
        return (
            <button className="cta-button secondary request-change-button" onClick={() => setIsOpen(true)}>
                Solicitar un Cambio / Hacer una Consulta
            </button>
        );
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={() => setIsOpen(false)}>&times;</button>
                {isSuccess ? (
                    <div className="success-message">
                        <h3>✅ ¡Solicitud Enviada!</h3>
                        <p>Tu entrenador ha recibido tu mensaje y te responderá pronto.</p>
                    </div>
                ) : (
                    <>
                        <h3>Contactar al Entrenador</h3>
                        <p>Usa este formulario para pedir ajustes en tu plan o para hacer cualquier otra consulta.</p>
                        <form onSubmit={handleSubmit} className="profile-form">
                            <div className="form-group">
                                <label htmlFor="subject">Asunto</label>
                                <input
                                    type="text"
                                    id="subject"
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    placeholder="Ej: Ajuste en día de piernas"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="message">Mensaje</label>
                                <textarea
                                    id="message"
                                    rows={5}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Describe tu consulta aquí..."
                                    required
                                />
                            </div>
                            {error && <p className="error-text">{error}</p>}
                            <div className="modal-actions">
                                <button type="button" className="cta-button secondary" onClick={() => setIsOpen(false)}>Cancelar</button>
                                <button type="submit" className="cta-button" disabled={isSending}>
                                    {isSending ? <Spinner small /> : 'Enviar'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};


const RoutineDisplay = ({ routine, progressLog, onLogSubmit, clientPlanType }: { routine: Routine; progressLog: ProgressLog; onLogSubmit: (exerciseName: string, weight: number, reps: number) => void; clientPlanType?: PlanType }) => {
    const [activePhaseIndex, setActivePhaseIndex] = useState(0);
    const [activeDayIndex, setActiveDayIndex] = useState(0);
    const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

    const currentPhase = routine.phases[activePhaseIndex];
    const currentDay = currentPhase?.routine.dias[activeDayIndex];

    useEffect(() => {
        // Reset day index if the phase changes and the current day index is out of bounds
        if (currentPhase && activeDayIndex >= currentPhase.routine.dias.length) {
            setActiveDayIndex(0);
        }
    }, [activePhaseIndex, currentPhase, activeDayIndex]);

    if (!routine) return null;

    return (
        <div className="plan-container">
            <div className="plan-header">
                <h2>{routine.planName}</h2>
                <p>Duración total: {routine.totalDurationWeeks} semanas</p>
            </div>

            <div className="accordion-phases">
                {routine.phases.map((phase, phaseIdx) => (
                     <div key={phaseIdx} className="accordion-item">
                        <button 
                            className={`accordion-header ${phaseIdx === activePhaseIndex ? 'active' : ''}`} 
                            onClick={() => {
                                setActivePhaseIndex(phaseIdx === activePhaseIndex ? -1 : phaseIdx);
                                if (phaseIdx !== activePhaseIndex) setActiveDayIndex(0);
                            }}
                        >
                            <span>{phase.phaseName} ({phase.durationWeeks} Semanas)</span>
                            <span className="accordion-header-icon">+</span>
                        </button>
                        <div className={`accordion-content ${phaseIdx === activePhaseIndex ? 'open' : ''}`}>
                             {phaseIdx === activePhaseIndex && currentPhase && (
                                <div className="day-tabs-container">
                                    <nav className="day-tabs-nav">
                                        {currentPhase.routine.dias.map((day, index) => (
                                            <button
                                                key={index}
                                                className={`day-tab-button ${index === activeDayIndex ? 'active' : ''}`}
                                                onClick={() => setActiveDayIndex(index)}
                                            >
                                                {day.dia}
                                            </button>
                                        ))}
                                    </nav>
                                    {currentDay && (
                                        <div className="day-card animated-fade-in">
                                            <h3><span className="muscle-group">{currentDay.grupoMuscular}</span></h3>
                                            <ul className="exercise-list">
                                                {currentDay.ejercicios.map((ex, exIndex) => (
                                                    <li key={exIndex} className="exercise-item">
                                                        <ExerciseItemDisplay 
                                                            exercise={ex} 
                                                            lastLog={progressLog[ex.nombre]?.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]}
                                                            onLogSubmit={onLogSubmit}
                                                            onPlayVideo={setActiveVideoUrl}
                                                            clientPlanType={clientPlanType}
                                                        />
                                                    </li>
                                                ))}
                                            </ul>
                                             {currentDay.cardio && currentDay.cardio.toLowerCase() !== 'ninguno' && (
                                                <p className="cardio-note"><strong>Cardio:</strong> {currentDay.cardio}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
             {activeVideoUrl && <VideoPlayerModal videoUrl={activeVideoUrl} onClose={() => setActiveVideoUrl(null)} />}
        </div>
    );
};


const ExerciseItemDisplay = ({ exercise, lastLog, onLogSubmit, onPlayVideo, clientPlanType }: { exercise: Exercise; lastLog?: ProgressLogEntry; onLogSubmit: (exerciseName: string, weight: number, reps: number) => void; onPlayVideo: (url: string) => void; clientPlanType?: PlanType; }) => {
    const [weight, setWeight] = useState(lastLog?.weight || '');
    const [reps, setReps] = useState('');
    const [isSaved, setIsSaved] = useState(false);
    
    const canTrack = clientPlanType === 'full' || clientPlanType === 'routine';

    const handleLog = () => {
        if (weight === '' || reps === '') return;
        onLogSubmit(exercise.nombre, Number(weight), Number(reps));
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000); // Reset after 2 seconds
    };
    
    const techniqueOption = advancedTechniqueOptions.find(opt => opt.value === exercise.tecnicaAvanzada);

    return (
        <div>
            <div className="exercise-name-wrapper">
                <span className="exercise-name">{exercise.nombre}</span>
                {exercise.videoUrl && (
                     <button className="video-play-button" onClick={() => onPlayVideo(exercise.videoUrl)} aria-label={`Ver video de ${exercise.nombre}`}>
                        <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"></path></svg>
                    </button>
                )}
            </div>

            <div className="exercise-details">
                <span><strong>Series:</strong> {exercise.series}</span>
                <span><strong>Repeticiones:</strong> {exercise.repeticiones}</span>
                <span><strong>Descanso:</strong> {exercise.descanso}</span>
            </div>

            {techniqueOption && techniqueOption.value && (
                <div className="advanced-technique">
                    <span><strong>Técnica Avanzada:</strong> {techniqueOption.label}</span>
                    <p>{techniqueOption.description}</p>
                </div>
            )}

            {canTrack && (
                 <div className="exercise-tracking">
                    <div>
                        <label htmlFor={`weight-${exercise.nombre}`}>Peso (kg)</label>
                        <input
                            type="number"
                            id={`weight-${exercise.nombre}`}
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            placeholder={lastLog ? `${lastLog.weight} kg` : 'kg'}
                        />
                    </div>
                    <div>
                        <label htmlFor={`reps-${exercise.nombre}`}>Reps</label>
                        <input
                            type="number"
                            id={`reps-${exercise.nombre}`}
                            value={reps}
                            onChange={(e) => setReps(e.target.value)}
                             placeholder={lastLog ? `${lastLog.repetitions} reps` : 'reps'}
                        />
                    </div>
                     <button onClick={handleLog} className={`cta-button secondary ${isSaved ? 'saved' : ''}`} disabled={isSaved || !weight || !reps}>
                        {isSaved ? '✓' : '+'}
                    </button>
                </div>
            )}
        </div>
    );
};

const DietPlanDisplay = ({ clientData }: { clientData: ClientData }) => {
    const dietPlan = clientData.dietPlans?.[0]; // Assuming we show the first plan for now
    if (!dietPlan) {
        return (
            <div className="placeholder">
                <p>Aún no se ha generado un plan de nutrición.</p>
            </div>
        );
    }
    return (
        <div className="diet-plan-container animated-fade-in">
             <div className="plan-header">
                <h2>{dietPlan.planTitle}</h2>
                <BMIDisplay weight={parseFloat(clientData.profile.weight)} height={parseFloat(clientData.profile.height)} isClientView={true} />
            </div>

            <div className="diet-summary">
                <div><strong>Calorías</strong> <span>{dietPlan.summary.totalCalories} kcal</span></div>
                <div><strong>Proteínas</strong> <span>{dietPlan.summary.macronutrients.proteinGrams} g</span></div>
                <div><strong>Carbohidratos</strong> <span>{dietPlan.summary.macronutrients.carbsGrams} g</span></div>
                <div><strong>Grasas</strong> <span>{dietPlan.summary.macronutrients.fatGrams} g</span></div>
            </div>
            
            <div className="meals-grid">
                {dietPlan.meals.map((meal, index) => (
                    <div key={index} className="meal-card">
                        <h3>{meal.mealName}</h3>
                        <ul>
                            {meal.foodItems.map((item, itemIndex) => (
                                <li key={itemIndex}>
                                    {item.food} <span>{item.amount}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {dietPlan.recommendations && dietPlan.recommendations.length > 0 && (
                <div className="recommendations-section">
                    <h4>Recomendaciones Generales</h4>
                    <ul>
                        {dietPlan.recommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

const ProgressView = ({ clientData, setClientData }: { clientData: ClientData, setClientData: React.Dispatch<React.SetStateAction<ClientData | null>> }) => {
    const [activeTab, setActiveTab] = useState<'bodyWeight' | 'lifts'>('bodyWeight');
    const [newWeight, setNewWeight] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    
    const allExercisesWithLogs = useMemo(() => {
        return Object.keys(clientData.progressLog || {});
    }, [clientData.progressLog]);
    
    const [selectedExercise, setSelectedExercise] = useState<string>(allExercisesWithLogs[0] || '');

    const handleAddWeight = async (e: React.FormEvent) => {
        e.preventDefault();
        const weightValue = parseFloat(newWeight);
        if (!weightValue || weightValue <= 0) return;

        setIsSaving(true);
        
        const { value: imc, categoryClass } = calculateBMI(weightValue, parseFloat(clientData.profile.height));

        const newEntry: BodyWeightEntry = {
            date: new Date().toISOString(),
            weight: weightValue,
            imc: imc,
            imcCategoryClass: categoryClass
        };

        const updatedLog = [...(clientData.bodyWeightLog || []), newEntry];
        updatedLog.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const success = await apiClient.saveClientData(clientData.dni, { bodyWeightLog: updatedLog });
        if (success) {
            setClientData(prev => prev ? { ...prev, bodyWeightLog: updatedLog } : null);
            setNewWeight('');
        } else {
            alert('No se pudo guardar el peso. Inténtalo de nuevo.');
        }
        setIsSaving(false);
    };


    return (
        <div className="progress-view animated-fade-in">
             <nav className="progress-tabs-nav">
                <button className={`progress-tab-button ${activeTab === 'bodyWeight' ? 'active' : ''}`} onClick={() => setActiveTab('bodyWeight')}>Peso Corporal</button>
                <button className={`progress-tab-button ${activeTab === 'lifts' ? 'active' : ''}`} onClick={() => setActiveTab('lifts')}>Levantamientos</button>
            </nav>

            {activeTab === 'bodyWeight' && (
                <div className="progress-section weight-progress">
                    <h3>Registro de Peso Corporal</h3>
                     <form onSubmit={handleAddWeight} className="add-weight-form">
                        <input
                            type="number"
                            step="0.1"
                            value={newWeight}
                            onChange={(e) => setNewWeight(e.target.value)}
                            placeholder="Tu peso en kg"
                            aria-label="Nuevo peso corporal en kg"
                        />
                        <button type="submit" className="cta-button register-button" disabled={isSaving}>
                            {isSaving ? <Spinner small /> : 'Registrar'}
                        </button>
                    </form>
                    
                    <ul className="log-list">
                       {(clientData.bodyWeightLog || []).map(log => (
                           <li key={log.date} className="weight-log">
                               <span>{new Date(log.date).toLocaleDateString('es-ES')}</span>
                               <span>{log.weight} kg</span>
                               {log.imc && <span className={`bmi-category ${log.imcCategoryClass}`}>{log.imc}</span>}
                           </li>
                       ))}
                    </ul>
                </div>
            )}

            {activeTab === 'lifts' && (
                 <div className="progress-section lift-progress">
                    <h3>Progreso por Ejercicio</h3>
                     {allExercisesWithLogs.length > 0 ? (
                         <>
                            <select 
                                className="exercise-select-dropdown"
                                value={selectedExercise} 
                                onChange={(e) => setSelectedExercise(e.target.value)}
                             >
                                {allExercisesWithLogs.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                            </select>

                             <ul className="log-list">
                                 {(clientData.progressLog[selectedExercise] || []).map(log => (
                                     <li key={log.date}>
                                         <span>{new Date(log.date).toLocaleDateString('es-ES')}</span>
                                         <span>{log.weight} kg</span>
                                         <span>{log.repetitions} reps</span>
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
    const heightCm = parseFloat(profile.height);
    const weightKg = parseFloat(profile.weight);
    const healthyRange = calculateHealthyWeightRange(heightCm);
    
    return (
        <div className="client-profile-view animated-fade-in">
            <h2>Mi Perfil</h2>

            <div className="profile-info-grid">
                <div className="info-card full-width">
                    <h3>Métricas de Salud</h3>
                    <div className="health-metrics">
                        <div className="metric-item">
                            <span className="metric-label">Peso Actual</span>
                            <span className="metric-value">{weightKg} kg</span>
                        </div>
                         <div className="metric-item">
                            <span className="metric-label">Altura</span>
                            <span className="metric-value">{heightCm} cm</span>
                        </div>
                        <div className="metric-item">
                            <span className="metric-label">IMC</span>
                             <BMIDisplay weight={weightKg} height={heightCm} />
                        </div>
                         <div className="metric-item">
                            <span className="metric-label">Rango Saludable</span>
                            <span className="metric-value">{healthyRange}</span>
                        </div>
                    </div>
                </div>

                <div className="info-card">
                     <h3>Información Personal</h3>
                     <ul>
                        <li><strong>Nombre:</strong> <span>{profile.name}</span></li>
                        <li><strong>Edad:</strong> <span>{profile.age}</span></li>
                        <li><strong>Género:</strong> <span>{profile.gender}</span></li>
                     </ul>
                </div>
                 <div className="info-card">
                     <h3>Objetivos y Nivel</h3>
                     <ul>
                        <li><strong>Objetivo:</strong> <span>{profile.goal}</span></li>
                        <li><strong>Nivel:</strong> <span>{profile.level}</span></li>
                        <li><strong>Días/Semana:</strong> <span>{profile.trainingDays}</span></li>
                        <li><strong>Intensidad:</strong> <span>{profile.trainingIntensity}</span></li>
                     </ul>
                </div>
            </div>
        </div>
    );
};


/**
 * Agreement View: Shows terms and conditions to the client.
 */
const AgreementView = ({ onAccept, onLogout, gymLogo }: { onAccept: () => void; onLogout: () => void; gymLogo?: string; }) => (
    <div className="agreement-container">
        <header>
             {gymLogo && <div className="app-logo" dangerouslySetInnerHTML={{ __html: gymLogo }} />}
             <h1>Términos y Condiciones</h1>
        </header>
        
        <p>Por favor, lee y acepta los términos para continuar.</p>
        <div className="terms-box">
            <p>
                Este es un texto de ejemplo para los términos y condiciones.

                1.  **Aceptación de Riesgos:** Entiendo que participar en cualquier programa de ejercicio físico conlleva un riesgo inherente de lesión. Acepto asumir toda la responsabilidad por cualquier lesión o daño que pueda sufrir durante mi entrenamiento.

                2.  **Consulta Médica:** Declaro que he consultado a un médico y he sido autorizado para participar en un programa de ejercicio físico. Es mi responsabilidad informar al entrenador de cualquier condición médica preexistente.

                3.  **Uso de la Aplicación:** La rutina y el plan de nutrición generados por ScorpionGYM AI son recomendaciones basadas en la información que he proporcionado. No sustituyen el consejo médico profesional.

                4.  **Confidencialidad:** Mis datos personales serán tratados con confidencialidad y solo se utilizarán para la personalización de mi plan de entrenamiento.
            </p>
        </div>
        <div className="agreement-actions">
            <label className="agreement-checkbox">
                <input type="checkbox" onChange={(e) => (document.getElementById('acceptButton') as HTMLButtonElement).disabled = !e.target.checked} />
                <span>He leído y acepto los términos y condiciones.</span>
            </label>
            <div className="agreement-buttons">
                 <button onClick={onLogout} className="cta-button secondary">Salir</button>
                 <button id="acceptButton" onClick={onAccept} className="cta-button" disabled>Continuar</button>
            </div>
        </div>
    </div>
);


const OnboardingView = ({ clientData, setClientData, onPlanGenerated, onLogout }: { clientData: ClientData; setClientData: React.Dispatch<React.SetStateAction<ClientData | null>>; onPlanGenerated: (routine: Routine, dietPlans: (DietPlan | null)[]) => void; onLogout: () => void; }) => {
    const [profile, setProfile] = useState<Profile>(clientData.profile);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStatus, setGenerationStatus] = useState<'pending' | 'routine' | 'nutrition' | 'done' | 'error'>('pending');
    
    const isProfileComplete = useMemo(() => {
        return profile.name && profile.age && profile.weight && profile.height;
    }, [profile]);

    const handleProfileChange = (field: keyof Profile, value: string) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveAndGenerate = async () => {
        setIsSaving(true);
        // First, save the updated profile
        const profileSaveSuccess = await apiClient.saveClientData(clientData.dni, { profile });
        if (!profileSaveSuccess) {
            alert("Error al guardar el perfil. Por favor, inténtalo de nuevo.");
            setIsSaving(false);
            return;
        }
        
        // Update local state after successful save
        setClientData(prev => prev ? { ...prev, profile } : null);
        setIsSaving(false);
        
        // Then, start the generation process
        setIsGenerating(true);
        try {
            const planType = clientData.planType || 'full';
            let finalRoutine: Routine | null = null;
            let finalDiet: DietPlan | null = null;
            
            if (planType === 'full' || planType === 'routine') {
                setGenerationStatus('routine');
                const generatedRoutine = await generatePlan('routine');
                 if (!generatedRoutine) throw new Error("Routine generation failed");
                 finalRoutine = generatedRoutine;
            }
           
            if (planType === 'full' || planType === 'nutrition') {
                 setGenerationStatus('nutrition');
                 const generatedDiet = await generatePlan('nutrition');
                 if (!generatedDiet) throw new Error("Diet generation failed");
                 finalDiet = generatedDiet;
            }
            
            if (finalRoutine || finalDiet) {
                 const finalData = { 
                    routine: finalRoutine, 
                    dietPlans: [finalDiet, null], // Store in the new array format
                    // FIX: Changed 'active' to 'active' as const to match the specific string literal type required by ClientData.
                    planStatus: 'active' as const,
                    routineGeneratedDate: new Date().toISOString(),
                };
                const finalSaveSuccess = await apiClient.saveClientData(clientData.dni, finalData);

                if (finalSaveSuccess) {
                    setGenerationStatus('done');
                    setTimeout(() => {
                        onPlanGenerated(finalRoutine!, [finalDiet, null]);
                    }, 2000);
                } else {
                     throw new Error("Failed to save the generated plan");
                }
            } else {
                 throw new Error("No plan was generated.");
            }

        } catch (error) {
            console.error("Plan generation failed:", error);
            setGenerationStatus('error');
        }
    };
    
     const generatePlan = async (type: 'routine' | 'nutrition'): Promise<any> => {
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const exerciseLibrary = await apiClient.getExerciseLibrary(clientData.gymId);
            const prompt = buildPrompt(profile, type, null, exerciseLibrary, null, null);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                 config: {
                    responseMimeType: "application/json",
                },
            });
            const jsonText = extractJson(response.text);
            if (!jsonText) {
                console.error("Failed to extract JSON from AI response:", response.text);
                throw new Error("Invalid AI response format");
            }
            return JSON.parse(jsonText);
        } catch (error) {
            console.error(`Error generating ${type} plan:`, error);
            return null;
        }
    };

    if (isGenerating) {
        return (
             <div className="onboarding-container">
                 <div className="onboarding-header">
                    <h1>Estamos creando tu plan...</h1>
                    <p>Esto puede tardar unos momentos. ¡Gracias por tu paciencia!</p>
                </div>
                 <div className="onboarding-section generation-progress-container">
                     <ul className="generation-progress-list">
                         {(clientData.planType === 'full' || clientData.planType === 'routine') && (
                            // FIX: Removed redundant `&& clientData.planType !== 'nutrition'` check which caused a type error.
                             <li className={`progress-item ${generationStatus === 'routine' ? 'loading' : (generationStatus === 'pending' ? 'pending' : (generationStatus === 'error' ? 'error' : 'done'))}`}>
                                <div className="status-icon">
                                    {generationStatus === 'routine' && <Spinner small />}
                                    {/* FIX: Removed redundant `&& clientData.planType !== 'nutrition'` check which caused a type error. */}
                                    {generationStatus !== 'routine' && generationStatus !== 'pending' && (generationStatus === 'error' ? '✕' : '✓')}
                                     {generationStatus === 'pending' && '•'}
                                </div>
                                <span>Creando rutina de entrenamiento</span>
                            </li>
                         )}
                         {(clientData.planType === 'full' || clientData.planType === 'nutrition') && (
                            <li className={`progress-item ${generationStatus === 'nutrition' ? 'loading' : (generationStatus === 'pending' || generationStatus === 'routine' ? 'pending' : (generationStatus === 'error' ? 'error' : 'done'))}`}>
                                <div className="status-icon">
                                    {generationStatus === 'nutrition' && <Spinner small />}
                                     {generationStatus !== 'nutrition' && (generationStatus === 'pending' || generationStatus === 'routine') && '•'}
                                    {generationStatus === 'done' && '✓'}
                                     {generationStatus === 'error' && '✕'}
                                </div>
                                <span>Diseñando plan de nutrición</span>
                            </li>
                         )}
                          <li className={`progress-item ${generationStatus === 'done' ? 'done' : 'pending'}`}>
                            <div className="status-icon">
                                {generationStatus === 'done' ? '✓' : '•'}
                            </div>
                            <span>Finalizando</span>
                        </li>
                     </ul>
                     {generationStatus === 'error' && <p className="error-text" style={{textAlign: 'center', marginTop: '1.5rem'}}>Ocurrió un error. Por favor, contacta a tu entrenador.</p>}
                 </div>
            </div>
        )
    }

    return (
        <div className="onboarding-container">
            <header className="onboarding-header">
                 {clientData.gymLogo && <div className="app-logo" dangerouslySetInnerHTML={{ __html: clientData.gymLogo }} />}
                <h1>¡Bienvenido/a a tu Asistente de Fitness!</h1>
                <p>Completa tu perfil para que podamos generar un plan 100% personalizado para ti.</p>
            </header>

            <main className="onboarding-section">
                <h2>Cuéntanos sobre ti</h2>
                <ProfileForm profile={profile} onProfileChange={handleProfileChange} />
            </main>
            
             <footer className="onboarding-actions">
                <button 
                    className="cta-button" 
                    onClick={handleSaveAndGenerate} 
                    disabled={!isProfileComplete || isSaving}
                >
                    {isSaving ? <Spinner small/> : 'Guardar y Generar Mi Plan'}
                </button>
                 <button className="back-button simple" onClick={onLogout}>Salir</button>
            </footer>
        </div>
    );
};

const ExpiredPlanView = ({ onLogout }: { onLogout: () => void }) => {
    return (
        <div className="client-view-container">
            <div className="expired-view">
                <h2>Tu Plan Ha Expirado</h2>
                <p>Has completado la duración de tu plan de entrenamiento actual. ¡Felicitaciones por tu constancia!</p>
                <p>Por favor, contacta a tu entrenador para solicitar un nuevo plan y continuar con tu progreso.</p>
                <button onClick={onLogout} className="cta-button" style={{marginTop: '2rem'}}>Entendido</button>
            </div>
        </div>
    );
};



/**
 * Admin Dashboard: Main view for the gym owner/coach.
 */
// FIX: Added ExerciseLibraryManager component definition to resolve 'Cannot find name' error.
const ExerciseLibraryManager = ({ gymId }: { gymId: string }) => {
    const [library, setLibrary] = useState<ExerciseLibrary>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchLibrary = async () => {
            setIsLoading(true);
            const lib = await apiClient.getExerciseLibrary(gymId);
            setLibrary(lib);
            setIsLoading(false);
        };
        fetchLibrary();
    }, [gymId]);

    const handleToggle = (group: string, exerciseName: string) => {
        setLibrary(prev => {
            const newLibrary = JSON.parse(JSON.stringify(prev));
            const exercises = newLibrary[group].map((ex: ExerciseDefinition) =>
                ex.name === exerciseName ? { ...ex, isEnabled: !ex.isEnabled } : ex
            );
            newLibrary[group] = exercises;
            return newLibrary;
        });
    };
    
    const handleVideoUrlChange = (group: string, exerciseName: string, newUrl: string) => {
        setLibrary(prev => {
             const newLibrary = JSON.parse(JSON.stringify(prev));
             const exercises = newLibrary[group].map((ex: ExerciseDefinition) =>
                ex.name === exerciseName ? { ...ex, videoUrl: newUrl } : ex
            );
            newLibrary[group] = exercises;
            return newLibrary;
        });
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setError(null);
        const success = await apiClient.saveExerciseLibrary(library, gymId);
        if (!success) {
            setError("No se pudieron guardar los cambios. Inténtalo de nuevo.");
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return <div className="loading-container"><Spinner /></div>;
    }

    return (
        <div className="exercise-library-manager animated-fade-in">
            <div className="library-header">
                <h2>Biblioteca de Ejercicios</h2>
                <div className="library-actions">
                     {error && <p className="error-text" style={{marginRight: '1rem'}}>{error}</p>}
                     <button className="cta-button" onClick={handleSaveChanges} disabled={isSaving}>
                        {isSaving ? <Spinner small /> : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
            <div className="library-instructions">
                <p>Aquí puedes gestionar los ejercicios disponibles para la generación de rutinas. Habilita o deshabilita ejercicios según el equipamiento de tu gimnasio y edita las URLs de los videos de demostración.</p>
            </div>

            <div className="library-grid">
                {Object.entries(library).map(([group, exercises]) => (
                    <div key={group} className="muscle-group-card">
                        <h3>{group}</h3>
                        <ul>
                            {exercises.sort((a,b) => a.name.localeCompare(b.name)).map(ex => (
                                <li key={ex.name} className="exercise-library-item">
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={ex.isEnabled}
                                            onChange={() => handleToggle(group, ex.name)}
                                        />
                                        <span className="slider round"></span>
                                    </label>
                                    <div className="exercise-info">
                                        <span className={`exercise-name ${!ex.isEnabled ? 'disabled' : ''}`}>{ex.name}</span>
                                        <input 
                                            type="text"
                                            className="video-url-input"
                                            placeholder="URL del video"
                                            value={ex.videoUrl}
                                            onChange={(e) => handleVideoUrlChange(group, ex.name, e.target.value)}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};
const AdminDashboard = ({ gym, onLogout }: { gym: Gym; onLogout: () => void }) => {
    const [view, setView] = useState<'clients' | 'library' | 'requests'>('clients');
    const [requests, setRequests] = useState<TrainerRequest[]>([]);
    
    const newRequestCount = useMemo(() => requests.filter(r => r.status === 'new').length, [requests]);

    useEffect(() => {
        if (view === 'requests') {
            fetchRequests();
        }
    }, [view, gym._id]);

    const fetchRequests = async () => {
        const fetchedRequests = await apiClient.getRequests(gym._id);
        setRequests(fetchedRequests);
    };


    return (
         <div className="admin-dashboard">
            <header className="main-header">
                 <div className="header-title-wrapper">
                    {gym.logoSvg && <div className="app-logo" dangerouslySetInnerHTML={{ __html: gym.logoSvg }} />}
                    <h1>{gym.name}</h1>
                </div>
                <nav className="admin-header-nav">
                     <ShareAppModal />
                    <button className="header-nav-button" onClick={() => setView('clients')}>Clientes</button>
                    <button className="header-nav-button" onClick={() => setView('library')}>Ejercicios</button>
                    <button className="header-nav-button" onClick={() => setView('requests')}>
                        Consultas
                        {newRequestCount > 0 && <span className="notification-badge">{newRequestCount}</span>}
                    </button>
                    <button onClick={onLogout} className="logout-button admin-logout">Salir</button>
                </nav>
            </header>

            {view === 'clients' && <ClientManagementView gymId={gym._id} />}
            {view === 'library' && <ExerciseLibraryManager gymId={gym._id}/>}
            {view === 'requests' && <RequestsView requests={requests} onUpdateRequest={fetchRequests} />}
        </div>
    )
};

const ShareAppModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    
    if (!isOpen) {
        return <button className="header-nav-button share-app-button" onClick={() => setIsOpen(true)}>Compartir App</button>;
    }

    const appUrl = window.location.href;

    const QrCode = () => {
        const size = 200;
        const qrContent = appUrl;
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(qrContent)}&qzone=1&format=svg`;
        
        return <img src={qrApiUrl} alt="QR Code para la aplicación" width={size} height={size} />;
    };


    return (
        <div className="modal-overlay">
            <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={() => setIsOpen(false)}>&times;</button>
                 <h3>Comparte el Acceso a la App</h3>
                 <p>Tus clientes pueden escanear este código QR o usar el enlace para acceder a la aplicación e ingresar con su DNI y código de acceso.</p>
                 <div className="qr-code-container">
                    <QrCode />
                 </div>
                 <div className="app-url-display">
                    <a href={appUrl} target="_blank" rel="noopener noreferrer">{appUrl}</a>
                </div>
            </div>
        </div>
    );
};


const RequestsView = ({ requests, onUpdateRequest }: { requests: TrainerRequest[], onUpdateRequest: () => void }) => {
    
    const sortedRequests = useMemo(() => {
        return [...requests].sort((a, b) => {
            const statusOrder = { 'new': 1, 'read': 2, 'resolved': 3 };
            if (statusOrder[a.status] !== statusOrder[b.status]) {
                return statusOrder[a.status] - statusOrder[b.status];
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [requests]);

    const handleUpdateStatus = async (id: string, status: 'read' | 'resolved') => {
        await apiClient.updateRequestStatus(id, status);
        onUpdateRequest();
    };
    
     const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar esta consulta?')) {
            await apiClient.deleteRequest(id);
            onUpdateRequest();
        }
    };


    return (
        <div className="requests-container animated-fade-in">
             <div className="library-instructions">
                <p>Aquí puedes ver las consultas y solicitudes de cambio de tus clientes. Márcalas como leídas o resueltas para mantener el control.</p>
            </div>
            <div className="requests-list">
                {sortedRequests.length === 0 ? (
                    <p>No hay consultas por el momento.</p>
                ) : (
                    sortedRequests.map(req => (
                        <div key={req._id} className={`request-card status-${req.status}`}>
                            <div className="request-card-header">
                                <div className="request-card-info">
                                     <h3>{req.subject}</h3>
                                    <p><strong>{req.clientName}</strong> ({req.clientId})</p>
                                    <span className="request-date">{new Date(req.createdAt).toLocaleString('es-ES')}</span>
                                </div>
                                <div className="request-card-status">
                                    <span className={`status-badge status-${req.status}`}>{req.status}</span>
                                </div>
                            </div>
                             <div className="request-card-body">
                                <p>{req.message}</p>
                            </div>
                            <div className="request-card-actions">
                                {req.status === 'new' && <button className="action-btn" onClick={() => handleUpdateStatus(req._id, 'read')}>Marcar como Leída</button>}
                                {req.status !== 'resolved' && <button className="action-btn save" onClick={() => handleUpdateStatus(req._id, 'resolved')}>Marcar como Resuelta</button>}
                                <button className="action-btn delete" onClick={() => handleDelete(req._id)}>Eliminar</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};


/**
 * Client Management View: Allows admin to add, search, and view clients.
 */
const ClientManagementView = ({ gymId }: { gymId: string }) => {
    const [clients, setClients] = useState<ClientListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedClientDni, setSelectedClientDni] = useState<string | null>(null);

    const fetchClients = async () => {
        try {
            setIsLoading(true);
            const clientList = await apiClient.getClients(gymId);
            setClients(clientList);
        } catch (err) {
            setError('Error al cargar la lista de clientes.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchClients();
    }, [gymId]);

    const handleClientCreated = () => {
        fetchClients(); // Refreshes the client list
    };
    
    const handleBackToList = () => {
        setSelectedClientDni(null);
        fetchClients(); // Refresh list in case status or other info changed
    }

    if (selectedClientDni) {
        return <ClientManagementDetailView dni={selectedClientDni} onBack={handleBackToList} gymId={gymId} />;
    }

    if (isLoading) {
        return <div className="loading-container"><Spinner /></div>;
    }

    if (error) {
        return <div className="error-container">{error}</div>;
    }

    return (
        <div className="client-list-container animated-fade-in">
            <ClientListToolbar onClientCreated={handleClientCreated} gymId={gymId} />
            <ClientList clients={clients} onSelectClient={setSelectedClientDni} onListUpdate={fetchClients} />
        </div>
    );
};

const ClientListToolbar = ({ onClientCreated, gymId }: { onClientCreated: () => void; gymId: string; }) => {
    const [newClientDni, setNewClientDni] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState('');

    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newClientDni.trim()) return;

        setIsAdding(true);
        setError('');
        const { success, message } = await apiClient.createClient(newClientDni.trim(), gymId);
        setIsAdding(false);

        if (success) {
            setNewClientDni('');
            onClientCreated();
        } else {
            setError(message || 'Ocurrió un error inesperado.');
        }
    };

    return (
        <div className="client-management-bar">
            <div className="add-client-form">
                <form onSubmit={handleAddClient}>
                    <input
                        type="text"
                        value={newClientDni}
                        onChange={(e) => setNewClientDni(e.target.value)}
                        placeholder="DNI o ID del nuevo cliente"
                        aria-label="DNI del nuevo cliente"
                    />
                    <button type="submit" className="cta-button" disabled={isAdding}>
                        {isAdding ? <Spinner small/> : 'Agregar Cliente'}
                    </button>
                </form>
                {error && <p className="error-text">{error}</p>}
            </div>
        </div>
    );
};

const ClientList = ({ clients, onSelectClient, onListUpdate }: { clients: ClientListItem[]; onSelectClient: (dni: string) => void; onListUpdate: () => void }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
    const [confirmAction, setConfirmAction] = useState<{ action: 'archive' | 'restore' | 'delete'; onConfirm: () => void } | null>(null);

    const filteredClients = useMemo(() => {
        return clients
            .filter(c => c.status === viewMode)
            .filter(c =>
                c.profile.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.dni.includes(searchTerm)
            );
    }, [clients, searchTerm, viewMode]);

    const handleSelectionChange = (dni: string, isSelected: boolean) => {
        setSelectedClients(prev => {
            const newSelection = new Set(prev);
            if (isSelected) {
                newSelection.add(dni);
            } else {
                newSelection.delete(dni);
            }
            return newSelection;
        });
    };
    
    const toggleSelectAll = () => {
        if (selectedClients.size === filteredClients.length) {
            setSelectedClients(new Set());
        } else {
            setSelectedClients(new Set(filteredClients.map(c => c.dni)));
        }
    };

    const executeAction = async (action: 'archive' | 'restore' | 'delete') => {
        setConfirmAction(null);
        if (selectedClients.size === 0) return;
        
        switch (action) {
            case 'archive':
                await apiClient.updateClientStatus(selectedClients, 'archived');
                break;
            case 'restore':
                await apiClient.updateClientStatus(selectedClients, 'active');
                break;
            case 'delete':
                await apiClient.deleteClients(selectedClients);
                break;
        }
        
        setSelectedClients(new Set());
        setSelectionMode(false);
        onListUpdate();
    };
    
    const handleActionClick = (action: 'archive' | 'restore' | 'delete') => {
        const messages = {
            archive: `¿Estás seguro de que quieres archivar a ${selectedClients.size} cliente(s)? No podrán acceder a la app.`,
            restore: `¿Estás seguro de que quieres restaurar a ${selectedClients.size} cliente(s)? Podrán volver a acceder a la app.`,
            delete: `¡ATENCIÓN! ¿Estás seguro de que quieres eliminar a ${selectedClients.size} cliente(s)? Esta acción es irreversible y borrará todos sus datos.`,
        };
        setConfirmAction({ action, onConfirm: () => executeAction(action) });
    };


    return (
        <div>
            <div className="view-controls">
                <div className="search-client-form">
                     <input
                        type="text"
                        placeholder="Buscar por nombre o DNI..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="view-toggle">
                     <button className={`view-toggle-button ${viewMode === 'active' ? 'active' : ''}`} onClick={() => setViewMode('active')}>Activos</button>
                     <button className={`view-toggle-button ${viewMode === 'archived' ? 'active' : ''}`} onClick={() => setViewMode('archived')}>Archivados</button>
                </div>
                 <div className="selection-controls">
                    <button className="selection-toggle-button" onClick={() => { setSelectionMode(!selectionMode); setSelectedClients(new Set()); }}>
                        {selectionMode ? 'Cancelar Selección' : 'Seleccionar Varios'}
                    </button>
                    {selectionMode && (
                        <>
                         <button className="selection-toggle-button" onClick={toggleSelectAll}>
                            {selectedClients.size === filteredClients.length ? 'Deseleccionar' : 'Sel. Todos'}
                         </button>
                         {viewMode === 'active' ? (
                            <button className="archive-selected-button" disabled={selectedClients.size === 0} onClick={() => handleActionClick('archive')}>Archivar</button>
                         ) : (
                            <button className="restore-selected-button" disabled={selectedClients.size === 0} onClick={() => handleActionClick('restore')}>Restaurar</button>
                         )}
                         <button className="delete-selected-button" disabled={selectedClients.size === 0} onClick={() => handleActionClick('delete')}>Eliminar</button>
                        </>
                    )}
                </div>
            </div>
            
            <div className="client-list">
                {filteredClients.map(client => (
                    <div
                        key={client.dni}
                        className={`client-card ${selectionMode ? 'selection-mode' : ''} ${selectedClients.has(client.dni) ? 'selected' : ''}`}
                        onClick={() => {
                            if (selectionMode) {
                                handleSelectionChange(client.dni, !selectedClients.has(client.dni));
                            } else {
                                onSelectClient(client.dni);
                            }
                        }}
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
                            <div>
                                <h3>{client.profile.name || 'Cliente sin nombre'}</h3>
                                <p>{client.dni}</p>
                            </div>
                             {client.planStatus === 'pending' && <span className="client-status-badge pending">Pendiente</span>}
                        </div>
                        <p>{client.planName}</p>
                        <div className="client-card-access-code">
                             Código de Acceso: <strong>{client.accessCode}</strong>
                        </div>
                    </div>
                ))}
            </div>
             {confirmAction && (
                <ConfirmationModal 
                    message={confirmAction.action === 'delete' 
                        ? `¡ATENCIÓN! ¿Estás seguro de que quieres eliminar a ${selectedClients.size} cliente(s)? Esta acción es irreversible y borrará todos sus datos.`
                        : `¿Estás seguro de que quieres ${confirmAction.action === 'archive' ? 'archivar' : 'restaurar'} a ${selectedClients.size} cliente(s)?`
                    }
                    onConfirm={confirmAction.onConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
        </div>
    );
};


/**
 * Client Management Detail View: Shows full details and plans for a single client.
 */
const ClientManagementDetailView = ({ dni, onBack, gymId }: { dni: string, onBack: () => void; gymId: string; }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'routine' | 'nutrition' | 'progress'>('routine');
    const [isEditingRoutine, setIsEditingRoutine] = useState(false);


    useEffect(() => {
        const fetchClientData = async () => {
            try {
                setIsLoading(true);
                const data = await apiClient.getClientData(dni);
                if (data) {
                    setClientData(data);
                } else {
                    setError('No se pudo encontrar la información del cliente.');
                }
            } catch (err) {
                setError('Ocurrió un error al cargar los datos del cliente.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClientData();
    }, [dni]);
    
    const handleDataUpdate = (updatedData: Partial<ClientData>) => {
        setClientData(prev => prev ? { ...prev, ...updatedData } : null);
    };

    if (isLoading) {
        return <div className="loading-container"><Spinner /></div>;
    }
    if (error) {
        return <div className="error-container">{error} <button onClick={onBack} className="back-button simple">Volver a la lista</button></div>;
    }
    if (!clientData) {
        return <div className="error-container">No hay datos de cliente. <button onClick={onBack} className="back-button simple">Volver a la lista</button></div>;
    }

    return (
        <div className="client-management-view animated-fade-in">
             <header className="main-header">
                <button onClick={onBack} className="back-button">← Volver</button>
            </header>
            <div className="dashboard-grid">
                <aside className="profile-section">
                    <ProfileEditor clientData={clientData} onUpdate={handleDataUpdate} />
                </aside>
                <main className="main-content">
                    <nav className="main-tabs-nav">
                        <button className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>Rutina</button>
                        <button className={`main-tab-button ${activeTab === 'nutrition' ? 'active' : ''}`} onClick={() => setActiveTab('nutrition')}>Nutrición</button>
                        <button className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>Progreso</button>
                    </nav>

                    <div className="tab-content">
                        {activeTab === 'routine' && <PlanGenerator type="routine" clientData={clientData} onUpdate={handleDataUpdate} isEditing={isEditingRoutine} setIsEditing={setIsEditingRoutine} gymId={gymId} />}
                        {activeTab === 'nutrition' && <PlanGenerator type="nutrition" clientData={clientData} onUpdate={handleDataUpdate} isEditing={false} setIsEditing={() => {}} gymId={gymId} />}
                        {activeTab === 'progress' && <div>Vista de progreso en construcción.</div>}
                    </div>
                </main>
            </div>
        </div>
    );
};

const ProfileEditor = ({ clientData, onUpdate }: { clientData: ClientData, onUpdate: (data: Partial<ClientData>) => void }) => {
    const [profile, setProfile] = useState<Profile>(clientData.profile);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    
    const debouncedSave = useMemo(
        () => debounce(async (newProfile: Profile) => {
            setIsSaving(true);
            const success = await apiClient.saveClientData(clientData.dni, { profile: newProfile });
            setIsSaving(false);
            if(success) {
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 2000);
            }
        }, 1000), [clientData.dni]);
        

    const handleChange = (field: keyof Profile, value: string) => {
        const newProfile = { ...profile, [field]: value };
        setProfile(newProfile);
        onUpdate({ profile: newProfile });
        debouncedSave(newProfile);
    };

    const handleEnableGeneration = async () => {
        if(window.confirm('¿Seguro que quieres borrar el plan actual y permitir que se genere uno nuevo? Esta acción no se puede deshacer.')) {
            const success = await apiClient.enablePlanGeneration(clientData.dni);
            if (success) {
                onUpdate({ planStatus: 'pending', routine: null, dietPlans: [null, null] });
                alert('Plan reseteado. El cliente ahora puede generar un nuevo plan desde la app.');
            } else {
                alert('Hubo un error al resetear el plan.');
            }
        }
    };

    return (
        <div>
            <h2>Perfil del Cliente</h2>
            <ProfileForm profile={profile} onProfileChange={handleChange} />
            <div className="actions-bar" style={{ justifyContent: 'flex-end', marginTop: '1rem', marginBottom: 0 }}>
                 <button className={`save-changes-button ${isSaved ? 'saved' : ''}`} disabled>
                    {isSaving ? <Spinner small /> : (isSaved ? '✓ Guardado' : 'Guardado Automático')}
                </button>
            </div>
            <div className="access-code-display">
                <span>Código de Acceso</span>
                <strong>{clientData.accessCode}</strong>
            </div>
            {clientData.planStatus === 'active' && (
                <button onClick={handleEnableGeneration} className="cta-button secondary enable-generation-button">
                    Resetear y Generar Nuevo Plan
                </button>
            )}
             <BMIDisplay weight={parseFloat(profile.weight)} height={parseFloat(profile.height)} />
             {parseFloat(profile.height) > 0 && (
                <div className="target-weight-info">
                    <strong>Peso saludable estimado:</strong> {calculateHealthyWeightRange(parseFloat(profile.height))}
                </div>
             )}
        </div>
    );
};

const ProfileForm = ({ profile, onProfileChange }: { profile: Profile, onProfileChange: (field: keyof Profile, value: string) => void }) => {
    
     const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        onProfileChange(e.target.name as keyof Profile, e.target.value);
    };
    
    return (
        <form className="profile-form">
            <div className="form-group">
                <label htmlFor="name">Nombre Completo</label>
                <input type="text" id="name" name="name" value={profile.name} onChange={handleInputChange} />
            </div>
            <div style={{display: 'flex', gap: '1rem'}}>
                <div className="form-group">
                    <label htmlFor="age">Edad</label>
                    <input type="number" id="age" name="age" value={profile.age} onChange={handleInputChange} />
                </div>
                 <div className="form-group">
                    <label htmlFor="gender">Género</label>
                    <select id="gender" name="gender" value={profile.gender} onChange={handleInputChange}>
                        <option>Masculino</option>
                        <option>Femenino</option>
                        <option>Prefiero no decirlo</option>
                    </select>
                </div>
            </div>
             <div style={{display: 'flex', gap: '1rem'}}>
                <div className="form-group">
                    <label htmlFor="weight">Peso (kg)</label>
                    <input type="number" id="weight" name="weight" value={profile.weight} onChange={handleInputChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="height">Altura (cm)</label>
                    <input type="number" id="height" name="height" value={profile.height} onChange={handleInputChange} />
                </div>
            </div>
            <div className="form-group">
                <label htmlFor="goal">Objetivo Principal</label>
                <select id="goal" name="goal" value={profile.goal} onChange={handleInputChange}>
                    <option>Hipertrofia</option>
                    <option>Pérdida de grasa</option>
                    <option>Mantenimiento</option>
                    <option>Resistencia</option>
                </select>
            </div>
             <div className="form-group">
                <label htmlFor="level">Nivel de Experiencia</label>
                <select id="level" name="level" value={profile.level} onChange={handleInputChange}>
                    <option>Principiante</option>
                    <option>Intermedio</option>
                    <option>Avanzado</option>
                </select>
            </div>
             <div className="form-group">
                <label htmlFor="trainingDays">Días de Entrenamiento por Semana</label>
                <input type="number" id="trainingDays" name="trainingDays" value={profile.trainingDays} min="1" max="7" onChange={handleInputChange} />
            </div>
        </form>
    )
}

const PlanGenerator = ({ type, clientData, onUpdate, isEditing, setIsEditing, gymId }: { type: 'routine' | 'nutrition'; clientData: ClientData; onUpdate: (data: Partial<ClientData>) => void; isEditing: boolean; setIsEditing: (isEditing: boolean) => void; gymId: string; }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [regenInstructions, setRegenInstructions] = useState<string>('');

    const plan = type === 'routine' ? clientData.routine : clientData.dietPlans?.[0];

    const generatePlan = async (typeToGen: 'routine' | 'nutrition', instructions: string | null = null) => {
        setIsLoading(true);
        setError(null);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const exerciseLibrary = await apiClient.getExerciseLibrary(gymId);
            const prompt = buildPrompt(clientData.profile, typeToGen, instructions, exerciseLibrary, clientData.routine, clientData.dietPlans?.[0]);

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                 config: {
                    responseMimeType: "application/json",
                },
            });

            const jsonText = extractJson(response.text);
            if (!jsonText) {
                console.error("Failed to extract JSON from AI response:", response.text);
                throw new Error("Invalid AI response format");
            }
            const generatedPlan = JSON.parse(jsonText);
            
            const dataToSave = typeToGen === 'routine'
                ? { routine: generatedPlan }
                : { dietPlans: [generatedPlan, clientData.dietPlans?.[1] ?? null] };
            
            const success = await apiClient.saveClientData(clientData.dni, dataToSave);
            if (success) {
                onUpdate(dataToSave);
            } else {
                 throw new Error("Failed to save the generated plan");
            }

        } catch (err) {
            console.error(err);
            setError('Hubo un error al generar el plan. Inténtalo de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRoutineUpdate = async (updatedRoutine: Routine) => {
        const success = await apiClient.saveClientData(clientData.dni, { routine: updatedRoutine });
        if (success) {
            onUpdate({ routine: updatedRoutine });
        } else {
            alert("Error al guardar los cambios en la rutina.");
        }
    };

    if (isLoading) {
        return (
            <div className="loading-container">
                <Spinner />
                <p>Generando plan... Esto puede tardar un momento.</p>
            </div>
        );
    }
    
     if (error) {
        return (
            <div className="error-container">
                <p>{error}</p>
                <button onClick={() => generatePlan(type, regenInstructions)} className="cta-button">Reintentar</button>
            </div>
        );
    }

    if (!plan && clientData.planStatus === 'pending') {
         return (
             <div className="placeholder-action">
                <p>El perfil del cliente está completo. Ya puedes generar su primer plan.</p>
                <div className="generation-container">
                    <div className="admin-instructions-box">
                        <label htmlFor="admin-instructions">Instrucciones Adicionales (Opcional)</label>
                        <textarea 
                            id="admin-instructions" 
                            rows={3} 
                            placeholder="Ej: Darle más énfasis a los hombros, evitar sentadillas por una lesión en la rodilla."
                            value={regenInstructions}
                            onChange={(e) => setRegenInstructions(e.target.value)}
                         />
                    </div>
                    <button onClick={() => generatePlan(type, regenInstructions)} className="cta-button" disabled={isLoading}>
                         {isLoading ? <Spinner small /> : `Generar ${type === 'routine' ? 'Rutina' : 'Plan Nutricional'}`}
                    </button>
                </div>
            </div>
        );
    }

    if (!plan) {
         return (
             <div className="placeholder">
                 <p>El perfil del cliente está incompleto. Una vez que lo complete, podrás generar un plan aquí.</p>
            </div>
         );
    }
    
    if (type === 'routine' && clientData.routine) {
        return (
            <div className="results-section">
                <div className="actions-bar">
                    <h3>Rutina Actual</h3>
                    <div>
                        <button className="cta-button secondary" onClick={() => setIsEditing(!isEditing)}>
                           {isEditing ? 'Ver Rutina' : 'Editar Rutina'}
                        </button>
                    </div>
                </div>
                {/* FIX: Passed setIsEditing prop down to RoutinePlanDisplay. */}
                <RoutinePlanDisplay clientData={clientData} onEdit={handleRoutineUpdate} isEditing={isEditing} setIsEditing={setIsEditing} />
                 <div className="regeneration-container">
                    <div className="admin-instructions-box">
                        <label htmlFor="regen-instructions">Instrucciones para Regenerar (Opcional)</label>
                        <textarea 
                            id="regen-instructions" 
                            rows={3} 
                            placeholder="Ej: Hacer la rutina más corta, agregar más ejercicios de espalda."
                            value={regenInstructions}
                            onChange={(e) => setRegenInstructions(e.target.value)}
                         />
                    </div>
                    <button onClick={() => generatePlan('routine', regenInstructions)} className="cta-button regenerate" disabled={isLoading}>
                         {isLoading ? <Spinner small /> : 'Regenerar Rutina'}
                    </button>
                </div>
            </div>
        )
    }
    
    if (type === 'nutrition' && clientData.dietPlans?.[0]) {
         return (
            <div className="results-section">
                 <div className="actions-bar">
                    <h3>Plan Nutricional Actual</h3>
                </div>
                <DietPlanDisplay clientData={clientData} />
                 <div className="regeneration-container">
                    <div className="admin-instructions-box">
                        <label htmlFor="regen-instructions-diet">Instrucciones para Regenerar (Opcional)</label>
                        <textarea 
                            id="regen-instructions-diet" 
                            rows={3} 
                            placeholder="Ej: Agregar más opciones de snacks, plan sin carnes rojas."
                            value={regenInstructions}
                            onChange={(e) => setRegenInstructions(e.target.value)}
                         />
                    </div>
                    <button onClick={() => generatePlan('nutrition', regenInstructions)} className="cta-button regenerate" disabled={isLoading}>
                         {isLoading ? <Spinner small /> : 'Regenerar Plan Nutricional'}
                    </button>
                </div>
            </div>
        )
    }

    return null;
};

const RoutinePlanDisplay = ({ clientData, onEdit, isEditing, setIsEditing }: { clientData: ClientData; onEdit: (routine: Routine) => void; isEditing: boolean; setIsEditing: (isEditing: boolean) => void; }) => {
    const routine = clientData.routine;
    const [activePhaseIndex, setActivePhaseIndex] = useState(0);
    const [activeDayIndex, setActiveDayIndex] = useState(0);
    const [editedRoutine, setEditedRoutine] = useState<Routine | null>(JSON.parse(JSON.stringify(routine))); // Deep copy
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({});
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);

    useEffect(() => {
        const fetchLibrary = async () => {
            setIsLoadingLibrary(true);
            const lib = await apiClient.getExerciseLibrary(clientData.gymId);
            setExerciseLibrary(lib);
            setIsLoadingLibrary(false);
        };
        if (isEditing) {
            fetchLibrary();
        }
    }, [isEditing, clientData.gymId]);

    // This effect ensures the editor reflects the current routine when isEditing is toggled or routine changes.
    useEffect(() => {
        setEditedRoutine(JSON.parse(JSON.stringify(routine)));
    }, [routine, isEditing]);

    const handleEditChange = (phaseIndex: number, dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string) => {
        if (!editedRoutine) return;
        const newRoutine = { ...editedRoutine };
        const exercise = newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios[exerciseIndex];
        (exercise[field] as any) = value;
        setEditedRoutine(newRoutine);
    };
    
    const handleAddExercise = (phaseIndex: number, dayIndex: number) => {
        if (!editedRoutine) return;
        const newRoutine = { ...editedRoutine };
        const newExercise: Exercise = {
            nombre: '',
            series: '3',
            repeticiones: '10-12',
            descanso: '60s',
            tecnicaAvanzada: ''
        };
        newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.push(newExercise);
        setEditedRoutine(newRoutine);
    };
    
    const handleDeleteExercise = (phaseIndex: number, dayIndex: number, exerciseIndex: number) => {
        if (!editedRoutine) return;
        const newRoutine = { ...editedRoutine };
        newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.splice(exerciseIndex, 1);
        setEditedRoutine(newRoutine);
    };

    const handleSaveChanges = () => {
        if (editedRoutine) {
            onEdit(editedRoutine);
            // FIX: Corrected call to setIsEditing, which is now available in props, to resolve 'Cannot find name' error.
            setIsEditing(false); // Assume parent component handles the state
        }
    };


    if (!routine) return null;
    const currentRoutine = isEditing && editedRoutine ? editedRoutine : routine;
    const currentPhase = currentRoutine.phases[activePhaseIndex];
    const currentDay = currentPhase?.routine.dias[activeDayIndex];
    
    if (isEditing && isLoadingLibrary) {
        return <div className="loading-container"><Spinner /> <p>Cargando biblioteca de ejercicios...</p></div>;
    }

    return (
        <div className={`plan-container routine-plan ${isEditing ? 'editable' : ''}`}>
             <div className="accordion-phases">
                {currentRoutine.phases.map((phase, phaseIdx) => (
                     <div key={phaseIdx} className="accordion-item">
                        <button 
                            className={`accordion-header ${phaseIdx === activePhaseIndex ? 'active' : ''}`} 
                            onClick={() => {
                                setActivePhaseIndex(phaseIdx === activePhaseIndex ? -1 : phaseIdx);
                                if(phaseIdx !== activePhaseIndex) setActiveDayIndex(0);
                            }}
                        >
                            <span>{phase.phaseName} ({phase.durationWeeks} Semanas)</span>
                            <span className="accordion-header-icon">+</span>
                        </button>
                         <div className={`accordion-content ${phaseIdx === activePhaseIndex ? 'open' : ''}`}>
                            {phaseIdx === activePhaseIndex && currentPhase && (
                                <div className="day-tabs-container">
                                    <nav className="day-tabs-nav">
                                        {currentPhase.routine.dias.map((day, index) => (
                                            <button
                                                key={index}
                                                className={`day-tab-button ${index === activeDayIndex ? 'active' : ''}`}
                                                onClick={() => setActiveDayIndex(index)}
                                            >
                                                {day.dia}
                                            </button>
                                        ))}
                                    </nav>
                                    {currentDay && (
                                        <div className="day-card animated-fade-in">
                                             <h3>Día {activeDayIndex + 1}: <span className="muscle-group">{currentDay.grupoMuscular}</span></h3>
                                             <ul className="exercise-list">
                                                {currentDay.ejercicios.map((ex, exIndex) => (
                                                    <li key={exIndex} className={`exercise-item ${isEditing ? 'editable' : ''}`}>
                                                        {isEditing ? (
                                                            <ExerciseItemEditor 
                                                                exercise={ex} 
                                                                library={exerciseLibrary}
                                                                onChange={(field, value) => handleEditChange(activePhaseIndex, activeDayIndex, exIndex, field, value)}
                                                                onDelete={() => handleDeleteExercise(activePhaseIndex, activeDayIndex, exIndex)}
                                                            />
                                                        ) : (
                                                            <ExerciseItemDisplay exercise={ex} onLogSubmit={() => {}} onPlayVideo={() => {}} clientPlanType="full" />
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                             {isEditing && (
                                                <div className="add-exercise-action">
                                                    <button className="add-exercise-button" onClick={() => handleAddExercise(activePhaseIndex, activeDayIndex)}>
                                                        + Agregar Ejercicio
                                                    </button>
                                                </div>
                                            )}
                                             {currentDay.cardio && currentDay.cardio.toLowerCase() !== 'ninguno' && !isEditing && (
                                                <p className="cardio-note"><strong>Cardio:</strong> {currentDay.cardio}</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            {isEditing && (
                <div className="actions-bar" style={{ justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button className="cta-button" onClick={handleSaveChanges}>Guardar Cambios</button>
                </div>
            )}
        </div>
    );
};

const ExerciseItemEditor = ({ exercise, library, onChange, onDelete }: { exercise: Exercise; library: ExerciseLibrary, onChange: (field: keyof Exercise, value: string) => void; onDelete: () => void; }) => {
    const muscleGroups = Object.keys(library);
    const allExercises = useMemo(() => {
        return muscleGroups.flatMap(group => 
            library[group]
                .filter(ex => ex.isEnabled)
                .map(ex => ({ ...ex, group }))
        );
    }, [library]);

    return (
        <div className="exercise-item-editor">
            <div className="editor-row editor-row-main">
                 <select 
                    className="exercise-select"
                    value={exercise.nombre}
                    onChange={(e) => onChange('nombre', e.target.value)}
                 >
                    <option value="" disabled>Selecciona un ejercicio</option>
                    {muscleGroups.map(group => (
                        <optgroup label={group} key={group}>
                             {library[group].filter(ex => ex.isEnabled).map(ex => (
                                <option key={ex.name} value={ex.name}>{ex.name}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                <button className="delete-exercise-btn" onClick={onDelete} aria-label="Eliminar ejercicio">&times;</button>
            </div>
             <div className="editor-row">
                 <div className="form-group-inline">
                    <label>Series</label>
                    <input type="text" value={exercise.series} onChange={(e) => onChange('series', e.target.value)} />
                 </div>
                 <div className="form-group-inline">
                    <label>Repeticiones</label>
                    <input type="text" value={exercise.repeticiones} onChange={(e) => onChange('repeticiones', e.target.value)} />
                </div>
                 <div className="form-group-inline">
                    <label>Descanso</label>
                    <input type="text" value={exercise.descanso} onChange={(e) => onChange('descanso', e.target.value)} />
                </div>
            </div>
             <div className="editor-row">
                 <div className="form-group-inline full-width">
                    <label>Técnica Avanzada (Opcional)</label>
                     <select value={exercise.tecnicaAvanzada || ''} onChange={(e) => onChange('tecnicaAvanzada', e.target.value)}>
                        {advancedTechniqueOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
            </div>
        </div>
    );
};

const buildPrompt = (
    profile: Profile,
    type: PlanType,
    customInstructions: string | null,
    exerciseLibrary: ExerciseLibrary,
    existingRoutine: Routine | null,
    existingDiet: DietPlan | null
): string => {
    
    const exerciseLibraryForPrompt = Object.entries(exerciseLibrary).reduce((acc, [group, exercises]) => {
        const enabledExercises = exercises.filter(ex => ex.isEnabled).map(ex => ({ name: ex.name, videoUrl: ex.videoUrl }));
        if (enabledExercises.length > 0) {
            acc[group] = enabledExercises;
        }
        return acc;
    }, {} as Record<string, {name: string, videoUrl: string}[]>);


    let prompt = `
        Eres "Scorpion AI", un experto en fitness y nutrición de clase mundial. Tu tarea es crear planes de entrenamiento y nutrición para clientes de un gimnasio.
        Debes basarte estrictamente en el perfil del cliente, las instrucciones y la lista de ejercicios disponibles.
        La respuesta DEBE ser un único objeto JSON válido, sin texto introductorio, explicaciones adicionales, ni markdown como \`\`\`json.

        **Perfil del Cliente:**
        ${JSON.stringify(profile, null, 2)}

        **Instrucciones Adicionales del Entrenador:** ${customInstructions || 'Ninguna.'}
    `;

    if (type === 'routine' || type === 'full') {
        prompt += `
        **Tarea: Generar Plan de Entrenamiento (Rutina)**

        **Reglas y Formato de Salida para la Rutina:**
        1.  Crea un plan llamado "planName" que sea inspirador y se relacione con el objetivo del cliente (ej: "Operación Hipertrofia", "Proyecto Quema Grasa").
        2.  Calcula "totalDurationWeeks", que es la suma de las duraciones de todas las fases.
        3.  El plan debe estructurarse en "phases". Cada fase es un objeto con "phaseName", "durationWeeks" y "routine".
            -   Si "includeAdaptationPhase" es "Sí", la primera fase debe ser "Fase de Adaptación" de 1 o 2 semanas con menor intensidad.
            -   Si "includeDeloadPhase" es "Sí", la última fase debe ser "Fase de Deload" (descarga) de 1 semana, con volumen y/o intensidad reducida.
            -   El resto del plan debe dividirse en fases lógicas (ej: "Fase 1: Acumulación", "Fase 2: Intensificación").
        4.  Dentro de cada fase, la "routine" contiene una lista de "dias". Cada día es un objeto con:
            -   "dia": En formato "Día 1", "Día 2", etc.
            -   "grupoMuscular": Los principales grupos musculares trabajados (ej: "Pecho y Tríceps", "Piernas (Énfasis Cuádriceps)").
            -   "ejercicios": Una lista de objetos de ejercicio.
            -   "cardio": Una breve descripción del cardio para ese día (ej: "20 min cinta inclinada", "15 min HIIT en bici", o "Ninguno").
        5.  Para cada "ejercicio" en la lista de "ejercicios":
            -   "nombre": DEBE ser uno de los nombres EXACTOS de la lista de ejercicios disponibles que te proporciono. NO inventes ejercicios. Prioriza la variedad entre fases.
            -   "series": Número de series como string (ej: "3", "4").
            -   "repeticiones": Rango de repeticiones como string (ej: "8-12", "15-20").
            -   "descanso": Tiempo de descanso como string (ej: "60s", "90s").
            -   "tecnicaAvanzada" (opcional): Si se usa, debe ser uno de los siguientes valores exactos: 'Drop Set', 'Rest-Pause', 'Myo-reps', 'Excéntricas'. Úsalo solo si el perfil del cliente lo permite ("useAdvancedTechniques": "Sí") y es apropiado para su nivel.
            -   "videoUrl": Incluye la URL del video del ejercicio correspondiente de la biblioteca.

        **Biblioteca de Ejercicios Disponibles (Usa estos nombres y URLs EXACTAMENTE):**
        ${JSON.stringify(exerciseLibraryForPrompt, null, 2)}

        ${existingRoutine ? `
        **Rutina Actual del Cliente (para referencia si se regenera):**
        ${JSON.stringify(existingRoutine, null, 2)}
        Si hay instrucciones para regenerar, úsalas para modificar esta rutina. De lo contrario, crea una variación para evitar la monotonía.
        ` : ''}

        **Ejemplo de Estructura de Salida para Rutina:**
        {
          "planName": "Desarrollo de Fuerza Total",
          "totalDurationWeeks": 9,
          "phases": [
            {
              "phaseName": "Fase de Adaptación",
              "durationWeeks": 1,
              "routine": {
                "dias": [
                  {
                    "dia": "Día 1",
                    "grupoMuscular": "Full Body",
                    "ejercicios": [
                      { "nombre": "Sentadilla Goblet", "series": "3", "repeticiones": "10-12", "descanso": "60s", "videoUrl": "https://example.com/video.mp4" },
                      { "nombre": "Press de Pecho en Banco Plano", "series": "3", "repeticiones": "10-12", "descanso": "60s", "videoUrl": "https://example.com/video.mp4" }
                    ],
                    "cardio": "10 min caminadora"
                  }
                ]
              }
            },
            {
              "phaseName": "Fase 1: Hipertrofia",
              "durationWeeks": 4,
              "routine": { "dias": [ /* ... más días y ejercicios ... */ ] }
            }
          ]
        }
        `;
    }

    if (type === 'nutrition' || type === 'full') {
        prompt += `
        **Tarea: Generar Plan de Nutrición**

        **Reglas y Formato de Salida para Nutrición:**
        1.  El objeto principal debe tener un "planTitle" (ej: "Plan Nutricional para Hipertrofia").
        2.  Debe incluir un objeto "summary" con "totalCalories" (número), y un objeto "macronutrients" con "proteinGrams", "carbsGrams", y "fatGrams" (todos números). Calcula estos valores basándote en el perfil y objetivo del cliente (Harris-Benedict o similar).
        3.  Debe incluir una lista "meals". Cada elemento es un objeto con "mealName" (ej: "Desayuno", "Almuerzo", "Snack") y una lista "foodItems".
        4.  Cada "foodItem" es un objeto con "food" (nombre del alimento, ej: "Pechuga de pollo") y "amount" (cantidad como string, ej: "150g", "1 taza").
        5.  Las comidas deben ser simples, con alimentos comunes en Argentina.
        6.  Debe incluir una lista "recommendations" de 3 a 5 consejos generales (ej: "Beber 2-3 litros de agua al día", "Priorizar el descanso de 7-8 horas").

        ${existingDiet ? `
        **Dieta Actual del Cliente (para referencia si se regenera):**
        ${JSON.stringify(existingDiet, null, 2)}
        Si hay instrucciones para regenerar, úsalas para modificar esta dieta. De lo contrario, crea una variación.
        ` : ''}

        **Ejemplo de Estructura de Salida para Nutrición:**
        {
          "planTitle": "Plan de Definición Muscular",
          "summary": {
            "totalCalories": 2200,
            "macronutrients": { "proteinGrams": 180, "carbsGrams": 200, "fatGrams": 70 }
          },
          "meals": [
            {
              "mealName": "Desayuno",
              "foodItems": [
                { "food": "Avena", "amount": "50g" },
                { "food": "Huevos enteros", "amount": "3 unidades" }
              ]
            }
          ],
          "recommendations": [ "Beber suficiente agua." ]
        }
        `;
    }
    
    // Determine the final structure based on the type
    if (type === 'routine') {
        prompt += "\n\n**Instrucción Final: Genera SOLAMENTE el JSON para la Rutina.**";
    } else if (type === 'nutrition') {
        prompt += "\n\n**Instrucción Final: Genera SOLAMENTE el JSON para el Plan de Nutrición.**";
    } else { // full
         prompt += "\n\n**Instrucción Final: Combina ambos JSON (Rutina y Nutrición) en un único objeto JSON que tenga una clave 'routine' y una clave 'nutrition'.**";
    }


    return prompt;
};



/**
 * Super Admin Dashboard: Main view for the super administrator to manage gyms.
 */
const SuperAdminDashboard = ({ onLogout }: { onLogout: () => void }) => {
    const [gyms, setGyms] = useState<Gym[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingGym, setEditingGym] = useState<Gym | null>(null);

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

    const handleGymDeleted = async (gymId: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar este gimnasio? Se borrarán TODOS sus clientes y datos asociados. Esta acción es irreversible.")) {
            const success = await apiClient.deleteGym(gymId);
            if(success) {
                fetchGyms();
            } else {
                alert("No se pudo eliminar el gimnasio.");
            }
        }
    };
    
    // SuperAdmin password change logic
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    
    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPasswordMessage('Las contraseñas no coinciden.');
            return;
        }
        if (newPassword.length < 4) {
             setPasswordMessage('La contraseña debe tener al menos 4 caracteres.');
            return;
        }
        
        const superAdmin = gyms.find(g => g.username === 'superadmin');
        if (superAdmin) {
            const success = await apiClient.updateGym(superAdmin._id, { password: newPassword });
            if (success) {
                setPasswordMessage('¡Contraseña actualizada con éxito!');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                 setPasswordMessage('Error al actualizar la contraseña.');
            }
             setTimeout(() => setPasswordMessage(''), 3000);
        }
    };


    if (isLoading) {
        return <div className="loading-container"><Spinner /></div>;
    }

    return (
        <div className="admin-dashboard">
             <header className="main-header">
                <div className="header-title-wrapper">
                    <h1>Panel de Super Administrador</h1>
                </div>
                <nav className="admin-header-nav">
                    <button onClick={onLogout} className="logout-button admin-logout">Salir</button>
                </nav>
            </header>
            
            {editingGym ? (
                 <EditGymModal gym={editingGym} onUpdate={handleGymUpdated} onCancel={() => setEditingGym(null)} />
            ) : (
                <AddGymForm onGymCreated={handleGymCreated} />
            )}

            <div className="gym-list">
                {gyms.filter(g => g.username !== 'superadmin').map(gym => (
                    <div key={gym._id} className="gym-card">
                        <div className="gym-card-header">
                            <div className="gym-card-logo">
                                {gym.logoSvg ? <div className="app-logo" dangerouslySetInnerHTML={{ __html: gym.logoSvg }} /> : <span>Sin Logo</span>}
                            </div>
                            <div className="gym-card-info">
                                <h3>{gym.name}</h3>
                                <p>Usuario: {gym.username}</p>
                            </div>
                        </div>
                        <div className="gym-card-actions">
                             <button className="action-btn edit" onClick={() => setEditingGym(gym)}>Editar</button>
                             <button className="action-btn delete" onClick={() => handleGymDeleted(gym._id)}>Eliminar</button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="password-management">
                <h2>Cambiar Contraseña de SuperAdmin</h2>
                 <form onSubmit={handlePasswordChange}>
                     <div className="form-group">
                        <label htmlFor="new-password">Nueva Contraseña</label>
                        <input type="password" id="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                     </div>
                      <div className="form-group">
                        <label htmlFor="confirm-password">Confirmar Contraseña</label>
                        <input type="password" id="confirm-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                     </div>
                     <button type="submit" className="cta-button">Cambiar</button>
                </form>
                {passwordMessage && <p className={passwordMessage.includes('éxito') ? 'success-text' : 'error-text'}>{passwordMessage}</p>}
            </div>

        </div>
    );
};

const AddGymForm = ({ onGymCreated }: { onGymCreated: () => void }) => {
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [dailyQuestionLimit, setDailyQuestionLimit] = useState(10);
    const [logoSvg, setLogoSvg] = useState<string | null>(null);
    const [planType, setPlanType] = useState<PlanType>('full');
    const [isAdding, setIsAdding] = useState(false);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === "image/svg+xml") {
            const reader = new FileReader();
            reader.onload = (e) => {
                const svgContent = e.target?.result as string;
                // Basic validation/sanitization could be added here
                setLogoSvg(svgContent);
            };
            reader.readAsText(file);
        } else {
            alert("Por favor, sube un archivo SVG válido.");
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAdding(true);
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
            alert("Error al crear el gimnasio. El nombre de usuario podría ya existir.");
        }
        setIsAdding(false);
    };

    return (
        <div className="add-gym-container">
            <h3>Agregar Nuevo Gimnasio</h3>
            <form onSubmit={handleSubmit} className="add-gym-form">
                <div className="form-group">
                    <label>Nombre del Gimnasio</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} required />
                </div>
                 <div className="form-group">
                    <label>Usuario (para login)</label>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
                </div>
                 <div className="form-group">
                    <label>Contraseña</label>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                 <div className="form-group">
                    <label>Límite de Consultas IA/día</label>
                    <input type="number" value={dailyQuestionLimit} onChange={e => setDailyQuestionLimit(Number(e.target.value))} required />
                </div>
                 <div className="form-group">
                    <label>Tipo de Plan</label>
                    <select value={planType} onChange={e => setPlanType(e.target.value as PlanType)}>
                        <option value="full">Completo (Rutina + Nutrición)</option>
                        <option value="routine">Solo Rutina</option>
                        <option value="nutrition">Solo Nutrición</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Logo (SVG)</label>
                     <div className="file-input-wrapper">
                         <label htmlFor="logo-upload" className="file-input-label">Seleccionar Archivo</label>
                         <input id="logo-upload" type="file" accept=".svg" onChange={handleFileChange} />
                         <div className="file-input-preview">
                             {logoSvg ? <div dangerouslySetInnerHTML={{ __html: logoSvg }} /> : 'SVG'}
                         </div>
                    </div>
                </div>

                <div className="add-gym-actions">
                     <button type="submit" className="cta-button" disabled={isAdding}>
                        {isAdding ? <Spinner small /> : 'Agregar Gimnasio'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const EditGymModal = ({ gym, onUpdate, onCancel }: { gym: Gym; onUpdate: () => void; onCancel: () => void; }) => {
    const [name, setName] = useState(gym.name);
    const [password, setPassword] = useState('');
    const [dailyQuestionLimit, setDailyQuestionLimit] = useState(gym.dailyQuestionLimit || 10);
    const [logoSvg, setLogoSvg] = useState<string | null>(gym.logoSvg || null);
    const [planType, setPlanType] = useState<PlanType>(gym.planType || 'full');
    const [isSaving, setIsSaving] = useState(false);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type === "image/svg+xml") {
            const reader = new FileReader();
            reader.onload = (e) => setLogoSvg(e.target?.result as string);
            reader.readAsText(file);
        } else if (file) {
            alert("Por favor, sube un archivo SVG válido.");
        }
    };
    
    const handleRemoveLogo = () => {
        setLogoSvg(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        
        const dataToUpdate: { name: string; password?: string, dailyQuestionLimit: number, logoSvg: string | null, planType: PlanType } = { 
            name, 
            dailyQuestionLimit, 
            logoSvg,
            planType
        };
        if (password) {
            dataToUpdate.password = password;
        }

        const success = await apiClient.updateGym(gym._id, dataToUpdate);
        if (success) {
            onUpdate();
        } else {
            alert("Error al actualizar el gimnasio.");
        }
        setIsSaving(false);
    };

    return (
         <div className="modal-overlay">
            <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={onCancel}>&times;</button>
                <h3>Editando: {gym.name}</h3>
                <form onSubmit={handleSubmit} className="profile-form">
                     <div className="form-group">
                        <label>Nombre del Gimnasio</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} required />
                    </div>
                     <div className="form-group">
                        <label>Nueva Contraseña (dejar en blanco para no cambiar)</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label>Límite de Consultas IA/día</label>
                        <input type="number" value={dailyQuestionLimit} onChange={e => setDailyQuestionLimit(Number(e.target.value))} required />
                    </div>
                    <div className="form-group">
                        <label>Tipo de Plan</label>
                        <select value={planType} onChange={e => setPlanType(e.target.value as PlanType)}>
                            <option value="full">Completo (Rutina + Nutrición)</option>
                            <option value="routine">Solo Rutina</option>
                            <option value="nutrition">Solo Nutrición</option>
                        </select>
                    </div>
                     <div className="form-group">
                        <label>Logo (SVG)</label>
                         <div className="file-input-wrapper">
                             <label htmlFor="logo-upload-edit" className="file-input-label">Cambiar</label>
                             <input id="logo-upload-edit" type="file" accept=".svg" onChange={handleFileChange} />
                             {logoSvg && <button type="button" className="action-btn delete" onClick={handleRemoveLogo}>Quitar</button>}
                             <div className="file-input-preview">
                                 {logoSvg ? <div dangerouslySetInnerHTML={{ __html: logoSvg }} /> : 'SVG'}
                             </div>
                        </div>
                    </div>
                    <div className="modal-actions">
                        <button type="button" className="cta-button secondary" onClick={onCancel}>Cancelar</button>
                        <button type="submit" className="cta-button" disabled={isSaving}>
                            {isSaving ? <Spinner small /> : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


/**
 * Login component: Handles both client and gym login.
 */
const Login = ({ onLoginSuccess }: { onLoginSuccess: (user: ClientData | Gym, role: 'client' | 'gym' | 'superadmin') => void }) => {
    const [role, setRole] = useState<'client' | 'gym' | null>(null);
    const [dni, setDni] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleClientLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        // Use apiClient.loginClient which encapsulates the logic
        const loggedIn = await apiClient.loginClient(dni, accessCode);

        if (loggedIn) {
            const clientData = await apiClient.getClientData(dni);
            if(clientData) {
                onLoginSuccess(clientData, 'client');
            } else {
                 setError('No se pudieron cargar los datos del cliente después del login.');
            }
        } else {
            setError('DNI o código de acceso incorrecto, o el cliente está archivado.');
        }
        setIsLoading(false);
    };

    const handleGymLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        const gymData = await apiClient.gymLogin(username, password);

        if (gymData) {
            const role = gymData.username === 'superadmin' ? 'superadmin' : 'gym';
            onLoginSuccess(gymData, role);
        } else {
            setError('Usuario o contraseña incorrectos.');
        }
        setIsLoading(false);
    };

    if (!role) {
        return (
             <div className="login-container landing-view">
                <header>
                    <img src="/logo.svg" alt="ScorpionGYM AI Logo" className="app-logo" />
                    <h1>ScorpionGYM AI</h1>
                    <p className="landing-subtitle">Tu asistente de fitness inteligente.</p>
                </header>
                <div className="landing-actions">
                    <div className="role-selection">
                        <button className="cta-button" onClick={() => setRole('client')}>Soy Cliente</button>
                        <button className="cta-button secondary" onClick={() => setRole('gym')}>Soy Entrenador</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
             <header>
                 <img src="/logo.svg" alt="ScorpionGYM AI Logo" className="app-logo" />
             </header>
            <div className="login-box">
                <h2>{role === 'client' ? 'Acceso Cliente' : 'Acceso Entrenador'}</h2>
                <p>Ingresa tus credenciales para continuar.</p>
                {role === 'client' ? (
                    <form onSubmit={handleClientLogin}>
                        <input type="text" value={dni} onChange={(e) => setDni(e.target.value)} placeholder="Tu DNI o ID" required />
                        <input type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Tu Código de Acceso" required />
                        {error && <p className="error-text">{error}</p>}
                        <button type="submit" className="cta-button" disabled={isLoading}>{isLoading ? <Spinner small /> : "Ingresar"}</button>
                    </form>
                ) : (
                    <form onSubmit={handleGymLogin}>
                        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuario" required />
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña" required />
                        {error && <p className="error-text">{error}</p>}
                        <button type="submit" className="cta-button" disabled={isLoading}>{isLoading ? <Spinner small /> : "Ingresar"}</button>
                    </form>
                )}
                <button className="back-button simple" onClick={() => setRole(null)}>Volver</button>
            </div>
        </div>
    );
};


/**
 * Main App component: Manages authentication state and renders appropriate view.
 */
const App = () => {
    const [session, setSession] = useState<{ user: ClientData | Gym; role: 'client' | 'gym' | 'superadmin' } | null>(null);

    useEffect(() => {
        // Check for saved session
        const savedSession = sessionStorage.getItem('scorpionGymSession');
        if (savedSession) {
            setSession(JSON.parse(savedSession));
        }
    }, []);

    const handleLoginSuccess = (user: ClientData | Gym, role: 'client' | 'gym' | 'superadmin') => {
        const newSession = { user, role };
        setSession(newSession);
        sessionStorage.setItem('scorpionGymSession', JSON.stringify(newSession));
    };

    const handleLogout = () => {
        setSession(null);
        sessionStorage.removeItem('scorpionGymSession');
    };

    if (!session) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    if (session.role === 'client') {
        return <ClientPortal dni={(session.user as ClientData).dni} onLogout={handleLogout} />;
    }

    if (session.role === 'gym') {
         return <AdminDashboard gym={session.user as Gym} onLogout={handleLogout} />;
    }
    
     if (session.role === 'superadmin') {
         return <SuperAdminDashboard onLogout={handleLogout} />;
    }

    return null;
};

// --- RENDER APP ---
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}