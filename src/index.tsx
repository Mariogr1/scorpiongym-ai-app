
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


    const handleLogin = async (type: 'client' | 'gym', id: string, code?: string) => {
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
                return <ClientView dni={currentClientDni!} onLogout={handleLogout} />;
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
    onLogin: (type: 'client' | 'gym', id: string, code?: string) => void; 
    error: string; 
    message: string;
    onBack: () => void;
    onGoToRegister: () => void;
}> = ({ onLogin, error, message, onBack, onGoToRegister }) => {
    const [loginType, setLoginType] = useState<'client' | 'gym'>('client');
    const [id, setId] = useState('');
    const [code, setCode] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(loginType, id, code);
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
                    />
                    <input
                        type='password'
                        placeholder={loginType === 'client' ? 'Código o Contraseña' : 'Contraseña'}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                    />
                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button">Ingresar</button>
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
                        {gyms.length === 0 ? (
                            <option>Cargando gimnasios...</option>
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
    const [dailyQuestionLimit, setDailyQuestionLimit] = useState(gym.dailyQuestionLimit || 10);
    const [logoSvg, setLogoSvg] = useState<string | null>(gym.logoSvg || null);
    const [planType, setPlanType] = useState<PlanType>(gym.planType || 'full');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const dataToUpdate: { name?: string; password?: string; dailyQuestionLimit?: number; logoSvg?: string | null; planType?: PlanType; } = {
            name: name,
            dailyQuestionLimit: dailyQuestionLimit,
            logoSvg: logoSvg,
            planType: planType,
        };
        if (password) {
            dataToUpdate.password = password;
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
                                <p>{template.description || 'Sin descripción'}</p>
                            </div>
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
    const [adminView, setAdminView] = useState<'clients' | 'library' | 'requests' | 'templates'>('clients');
    const [showQrModal, setShowQrModal] = useState(false);

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

    const renderCurrentView = () => {
        switch(adminView) {
            case 'library':
                return <ExerciseLibraryManager gymId={gym._id} onBack={() => setAdminView('clients')} />;
            case 'requests':
                return <RequestsView requests={requests} onUpdateRequest={fetchRequests} />;
             case 'templates':
                return <RoutineTemplateManager gym={gym} onBack={() => setAdminView('clients')} />;
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
                    <ProfileEditor clientData={clientData} setClientData={setClientData} onDataUpdate={fetchClientData}/>
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
                       {activeTab === 'routine' && <RoutineGenerator clientData={clientData} setClientData={setClientData} gymId={gym._id} />}
                       {activeTab === 'diet' && <DietPlanGenerator clientData={clientData} setClientData={setClientData} />}
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
        <div className="diet-plan animated-fade-in">
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
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const prompt = `
                Por favor, crea un plan de nutrición para un cliente con el siguiente perfil:
                - Perfil: ${JSON.stringify(clientData.profile)}
                
                Instrucciones Adicionales del Entrenador: "${adminInstructions || 'Ninguna'}"

                REGLAS ESTRICTAS PARA TU RESPUESTA:
                1.  **Idioma:** Tu respuesta DEBE estar redactada en español de Argentina. Utiliza vocabulario y expresiones comunes de ese país (ej. "vos" en lugar de "tú", nombres de comidas locales como "bife", "milanesa", etc.).
                2.  Tu respuesta DEBE ser únicamente un objeto JSON válido, sin ningún texto adicional, formato markdown, o explicaciones.
                3.  Calcula las calorías y macronutrientes basándote en el perfil completo del cliente (peso, altura, edad, género, nivel de experiencia, objetivo y MUY IMPORTANTE, su 'activityFactor'). Sé preciso.
                4.  El JSON debe seguir esta estructura exacta:
                    {
                        "planTitle": "Título del Plan (ej: Dieta para Hipertrofia)",
                        "summary": {
                            "totalCalories": 2500,
                            "macronutrients": {
                                "proteinGrams": 180,
                                "carbsGrams": 300,
                                "fatGrams": 60
                            }
                        },
                        "meals": [
                            {
                                "mealName": "Desayuno",
                                "foodItems": [
                                    { "food": "Avena", "amount": "80g" },
                                    { "food": "Huevos enteros", "amount": "3 unidades" }
                                ]
                            }
                        ],
                        "recommendations": [
                            "Beber 2-3 litros de agua al día.",
                            "Evitar bebidas azucaradas."
                        ]
                    }
                5.  Distribuye las calorías y macros en 4-6 comidas a lo largo del día (Desayuno, Media Mañana, Almuerzo, Merienda, Cena, Pre-entreno si es relevante).
                6.  Utiliza alimentos comunes y saludables, considerando la disponibilidad en Argentina.
                7.  Las cantidades deben estar en gramos o unidades claras.
                8.  Las recomendaciones deben ser generales y útiles (hidratación, timing de comidas, etc.).
            `;
            
            const response = await withRetry(() => 
                ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                })
            );
            const text = (response as GenerateContentResponse).text;
            
            const jsonString = extractJson(text);
            if (!jsonString) {
                throw new Error("La IA no devolvió un JSON válido para el plan de nutrición.");
            }
            const generatedPlan: DietPlan = JSON.parse(jsonString);

            const newDietPlans = [...(clientData.dietPlans || [null, null])];
            newDietPlans[planIndex] = generatedPlan;
            
            const dataToUpdate = { ...clientData, dietPlans: newDietPlans };
            setClientData(dataToUpdate);
            await apiClient.saveClientData(clientData.dni, { dietPlans: newDietPlans });

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Ocurrió un error al generar el plan de nutrición.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    if (isGenerating) {
        return <div className="loading-container"><div className="spinner"></div><p>Generando plan de nutrición...</p></div>;
    }
     if (error) {
        return <div className="error-container"><p>{error}</p><button className="cta-button" onClick={() => handleGenerate(activePlanIndex)}>Intentar de Nuevo</button></div>;
    }
    
    const renderPlanContent = (plan: DietPlan | null) => {
        if (!plan) {
            return (
                 <div className="placeholder-action generation-container">
                    <div className="admin-instructions-box">
                        <label htmlFor="admin-instructions-diet">Instrucciones Adicionales (Opcional)</label>
                        <textarea
                            id="admin-instructions-diet"
                            rows={3}
                            value={adminInstructions}
                            onChange={(e) => setAdminInstructions(e.target.value)}
                            placeholder="Ej: Cliente es intolerante a la lactosa. Prefiere no comer carnes rojas."
                        ></textarea>
                    </div>
                    <button className="cta-button" onClick={() => handleGenerate(activePlanIndex)}>
                        Generar Plan de Nutrición con IA
                    </button>
                    <p className="text-secondary">Se creará un plan de nutrición basado en el perfil y objetivo del cliente.</p>
                </div>
            );
        }

        return (
             <div className="diet-plan-container">
                <ClientDietView dietPlan={plan} />
                <div className="regeneration-container">
                    <div className="admin-instructions-box">
                        <label htmlFor="admin-instructions-diet-regen">Instrucciones Adicionales (Opcional)</label>
                        <textarea
                            id="admin-instructions-diet-regen"
                            rows={3}
                            value={adminInstructions}
                            onChange={(e) => setAdminInstructions(e.target.value)}
                            placeholder="Ej: Cliente es intolerante a la lactosa. Prefiere no comer carnes rojas."
                        ></textarea>
                    </div>
                    <button className="cta-button regenerate" onClick={() => handleGenerate(activePlanIndex)} disabled={isGenerating}>
                        Regenerar Plan
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="multi-plan-container">
             <div className="view-toggle" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
                <button onClick={() => setActivePlanIndex(0)} className={`view-toggle-button ${activePlanIndex === 0 ? 'active' : ''}`}>Plan 1</button>
                <button onClick={() => setActivePlanIndex(1)} className={`view-toggle-button ${activePlanIndex === 1 ? 'active' : ''}`}>Plan 2</button>
            </div>
            <div className="animated-fade-in">
                 {renderPlanContent(currentPlan)}
            </div>
        </div>
    );
};

const ProgressView: React.FC<{ clientData: ClientData, onDataUpdate: () => void }> = ({ clientData, onDataUpdate }) => {
    const [activeTab, setActiveTab] = useState<'bodyWeight' | 'exercises'>('bodyWeight');
    const [weight, setWeight] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState('');

    const exercisesWithLogs = useMemo(() => {
        return Object.keys(clientData.progressLog || {}).filter(name => clientData.progressLog[name]?.length > 0);
    }, [clientData.progressLog]);

    useEffect(() => {
        if (exercisesWithLogs.length > 0 && !selectedExercise) {
            setSelectedExercise(exercisesWithLogs[0]);
        }
    }, [exercisesWithLogs, selectedExercise]);
    
    const handleAddBodyWeight = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!weight) return;
        setIsSaving(true);
        const { value: imc, categoryClass } = calculateBMI(parseFloat(weight), parseFloat(clientData.profile.height));
        const newEntry: BodyWeightEntry = {
            date: new Date().toISOString(),
            weight: parseFloat(weight),
            imc,
            imcCategoryClass: categoryClass,
        };
        const newLog = [...(clientData.bodyWeightLog || []), newEntry];
        const success = await apiClient.saveClientData(clientData.dni, { bodyWeightLog: newLog });
        if (success) {
            setWeight('');
            onDataUpdate();
        } else {
            alert('No se pudo guardar el peso corporal.');
        }
        setIsSaving(false);
    };

    const sortedBodyWeightLog = useMemo(() => {
        return [...(clientData.bodyWeightLog || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [clientData.bodyWeightLog]);

    const sortedExerciseLog = useMemo(() => {
        if (!selectedExercise || !clientData.progressLog?.[selectedExercise]) return [];
        return [...clientData.progressLog[selectedExercise]].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [clientData.progressLog, selectedExercise]);


    return (
        <div className="progress-view animated-fade-in">
            <nav className="progress-tabs-nav">
                <button 
                    className={`progress-tab-button ${activeTab === 'bodyWeight' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('bodyWeight')}>
                    Peso Corporal
                </button>
                <button 
                    className={`progress-tab-button ${activeTab === 'exercises' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('exercises')}>
                    Ejercicios
                </button>
            </nav>

            <div className="animated-fade-in">
                {activeTab === 'bodyWeight' && (
                    <div className="progress-section">
                        <form onSubmit={handleAddBodyWeight} className="add-weight-form">
                            <input
                                type="number"
                                step="0.1"
                                placeholder="Peso actual en kg"
                                value={weight}
                                onChange={(e) => setWeight(e.target.value)}
                                required
                            />
                            <button type="submit" className="cta-button register-button" disabled={isSaving}>
                                {isSaving ? 'Guardando...' : 'Registrar'}
                            </button>
                        </form>
                        <h4>Historial de Peso</h4>
                        {sortedBodyWeightLog.length === 0 ? (
                            <p>Aún no hay registros de peso.</p>
                        ) : (
                            <ul className="log-list">
                                {sortedBodyWeightLog.map(entry => (
                                    <li key={entry.date} className="weight-log">
                                        <span>{new Date(entry.date).toLocaleDateString()}</span>
                                        <span><strong>{entry.weight} kg</strong></span>
                                        {entry.imc && <span className={`bmi-category ${entry.imcCategoryClass}`}>IMC: {entry.imc}</span>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {activeTab === 'exercises' && (
                    <div className="progress-section">
                        {exercisesWithLogs.length === 0 ? (
                            <p>Aún no has registrado progreso en ningún ejercicio.</p>
                        ) : (
                            <>
                                <select 
                                    className="exercise-select-dropdown" 
                                    value={selectedExercise} 
                                    onChange={e => setSelectedExercise(e.target.value)}
                                >
                                    {exercisesWithLogs.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                                
                                <h4>Historial de {selectedExercise}</h4>
                                <ul className="log-list">
                                    {sortedExerciseLog.map(log => (
                                        <li key={log.date}>
                                            <span>{new Date(log.date).toLocaleDateString()}</span>
                                            <span><strong>{log.weight} kg</strong></span>
                                            <span><strong>{log.repetitions} reps</strong></span>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};



// --- Client View ---

const ExerciseTracker: React.FC<{
    clientData: ClientData;
    onProgressLogged: () => void;
    onRequestChange: () => void;
    onPlayVideo: (url: string) => void;
}> = ({ clientData, onProgressLogged, onRequestChange, onPlayVideo }) => {
    const [activePhaseIndex, setActivePhaseIndex] = useState(0);
    const [activeDayIndex, setActiveDayIndex] = useState(0);
    const [newLogs, setNewLogs] = useState<Record<string, { weight: string; reps: string }>>({});
    const [isSaving, setIsSaving] = useState<string | null>(null); // Store exercise name being saved
    const exerciseLibrary = useRef<ExerciseLibrary | null>(null);
    
    useEffect(() => {
        const fetchLibrary = async () => {
            exerciseLibrary.current = await apiClient.getExerciseLibrary(clientData.gymId);
        };
        fetchLibrary();
    }, [clientData.gymId]);

    const routine = clientData.routine;
    if (!routine) return null;

    const handleNewLogChange = (exerciseName: string, field: 'weight' | 'reps', value: string) => {
        setNewLogs(prev => ({
            ...prev,
            [exerciseName]: {
                ...(prev[exerciseName] || { weight: '', reps: '' }),
                [field]: value,
            }
        }));
    };

    const handleLogSet = async (exerciseName: string) => {
        const log = newLogs[exerciseName];
        if (!log || !log.weight || !log.reps) {
            alert("Por favor, completa el peso y las repeticiones.");
            return;
        }

        setIsSaving(exerciseName);

        const newEntry: ProgressLogEntry = {
            date: new Date().toISOString(),
            weight: parseFloat(log.weight),
            repetitions: parseInt(log.reps, 10),
        };

        const newProgressLog = { ...(clientData.progressLog || {}) };
        if (!newProgressLog[exerciseName]) {
            newProgressLog[exerciseName] = [];
        }
        newProgressLog[exerciseName].push(newEntry);
        
        const success = await apiClient.saveClientData(clientData.dni, { progressLog: newProgressLog });
        if (success) {
            setNewLogs(prev => ({ ...prev, [exerciseName]: { weight: '', reps: '' } }));
            onProgressLogged(); // This will refetch clientData
        } else {
            alert("No se pudo guardar el progreso.");
        }
        setIsSaving(null);
    };
    
    const findExerciseVideoUrl = (exerciseName: string) => {
        if (!exerciseLibrary.current) return undefined;
        for (const group of Object.values(exerciseLibrary.current)) {
            const exercise = (group as ExerciseDefinition[]).find(ex => ex.name === exerciseName);
            if (exercise) return exercise.videoUrl;
        }
        return undefined;
    };
    
    const togglePhase = (index: number) => {
        setActivePhaseIndex(activePhaseIndex === index ? -1 : index);
    };

    return (
        <div className="exercise-tracker animated-fade-in">
            <div className="plan-header">
                <h2>{routine.planName}</h2>
                {routine.totalDurationWeeks > 0 && <p>Duración Total: {routine.totalDurationWeeks} semanas</p>}
            </div>
            
            <div className="accordion-phases">
                {routine.phases.map((phase, phaseIndex) => (
                    <div key={phaseIndex} className="accordion-item">
                        <button 
                            className={`accordion-header ${activePhaseIndex === phaseIndex ? 'active' : ''}`}
                            onClick={() => togglePhase(phaseIndex)}
                        >
                            <span>{phase.phaseName} (Semanas: {phase.durationWeeks})</span>
                             <span className="accordion-header-icon">+</span>
                        </button>
                        <div className={`accordion-content ${activePhaseIndex === phaseIndex ? 'open' : ''}`}>
                             <nav className="day-tabs-nav">
                                {phase.routine.dias.map((dia, dayIdx) => (
                                    <button
                                        key={dayIdx}
                                        className={`day-tab-button ${activeDayIndex === dayIdx ? 'active' : ''}`}
                                        onClick={() => setActiveDayIndex(dayIdx)}
                                    >
                                        {dia.dia}
                                    </button>
                                ))}
                            </nav>
                            
                            {phase.routine.dias[activeDayIndex] && (
                                <div className="day-card">
                                    <h3>{phase.routine.dias[activeDayIndex].dia}: <span className="muscle-group">{phase.routine.dias[activeDayIndex].grupoMuscular}</span></h3>
                                    <ul className="exercise-list">
                                        {phase.routine.dias[activeDayIndex].ejercicios.map((exercise, exIndex) => {
                                            const lastLog = clientData.progressLog?.[exercise.nombre]?.slice(-1)[0];
                                            const currentNewLog = newLogs[exercise.nombre] || { weight: '', reps: '' };
                                            return (
                                                <li key={exIndex} className="exercise-item-client">
                                                    <ExerciseView exercise={exercise} onPlayVideo={onPlayVideo} videoUrl={findExerciseVideoUrl(exercise.nombre)} />
                                                    <div className="client-log-section">
                                                        <div className="last-log-display">
                                                            <div className="last-log-item">
                                                                <label>Últ. Peso (kg)</label>
                                                                <span>{lastLog?.weight ?? '-'}</span>
                                                            </div>
                                                            <div className="last-log-item">
                                                                <label>Últ. Reps</label>
                                                                <span>{lastLog?.repetitions ?? '-'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="new-log-inputs">
                                                             <input 
                                                                type="number" 
                                                                placeholder="kg" 
                                                                value={currentNewLog.weight} 
                                                                onChange={(e) => handleNewLogChange(exercise.nombre, 'weight', e.target.value)}
                                                                disabled={isSaving === exercise.nombre}
                                                            />
                                                            <input 
                                                                type="number" 
                                                                placeholder="reps" 
                                                                value={currentNewLog.reps}
                                                                onChange={(e) => handleNewLogChange(exercise.nombre, 'reps', e.target.value)}
                                                                disabled={isSaving === exercise.nombre}
                                                            />
                                                            <button className="new-log-btn" onClick={() => handleLogSet(exercise.nombre)} disabled={isSaving === exercise.nombre}>
                                                                {isSaving === exercise.nombre ? <div className="spinner small" style={{borderColor: '#fff', borderTopColor: 'transparent'}}></div> : '+'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                    {phase.routine.dias[activeDayIndex].cardio && <p className="cardio-note"><strong>Cardio:</strong> {phase.routine.dias[activeDayIndex].cardio}</p>}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            <button onClick={onRequestChange} className="cta-button secondary request-change-button">
                ¿Necesitas un cambio? Contacta a tu entrenador
            </button>
        </div>
    );
};

const ClientDietTabsView: React.FC<{ dietPlans: (DietPlan | null)[] }> = ({ dietPlans }) => {
    const [activePlanIndex, setActivePlanIndex] = useState(0);

    const plan1 = dietPlans[0];
    const plan2 = dietPlans[1];

    const currentPlan = activePlanIndex === 0 ? plan1 : plan2;

    return (
        <div className="multi-plan-container animated-fade-in">
            <div className="view-toggle" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
                <button 
                    onClick={() => setActivePlanIndex(0)} 
                    className={`view-toggle-button ${activePlanIndex === 0 ? 'active' : ''}`}
                    disabled={!plan1}
                >
                    Plan 1
                </button>
                <button 
                    onClick={() => setActivePlanIndex(1)} 
                    className={`view-toggle-button ${activePlanIndex === 1 ? 'active' : ''}`}
                    disabled={!plan2}
                >
                    Plan 2
                </button>
            </div>
            <div className="animated-fade-in">
                 {currentPlan ? (
                    <ClientDietView dietPlan={currentPlan} />
                 ) : (
                    <div className="placeholder">Este plan de nutrición no ha sido generado.</div>
                 )}
            </div>
        </div>
    );
};

const ClientProfileView: React.FC<{ clientData: ClientData }> = ({ clientData }) => {
    const { profile } = clientData;
    const bmi = calculateBMI(parseFloat(profile.weight), parseFloat(profile.height));
    const targetWeight = calculateTargetWeight(parseFloat(profile.height));

    return (
        <div className="client-profile-view animated-fade-in">
            <div className="plan-header" style={{textAlign: 'center', marginBottom: '2rem'}}>
                <h2>Mi Perfil</h2>
            </div>

            <div className="profile-card">
                <h3>Información Personal</h3>
                <div className="profile-card-content">
                    <div className="profile-item"><span className="label">Nombre:</span> <span className="value">{profile.name}</span></div>
                    <div className="profile-item"><span className="label">Edad:</span> <span className="value">{profile.age} años</span></div>
                    <div className="profile-item"><span className="label">Género:</span> <span className="value">{profile.gender}</span></div>
                </div>
            </div>

            <div className="profile-card">
                <h3>Métricas de Salud</h3>
                <div className="profile-card-content">
                    <div className="metrics-grid">
                        <div className="metric-item">
                            <span className="label">Peso Actual</span>
                            <span className="value-large">{profile.weight} kg</span>
                        </div>
                        <div className="metric-item">
                            <span className="label">Altura</span>
                            <span className="value-large">{profile.height} cm</span>
                        </div>
                        <div className="metric-item">
                            <span className="label">IMC</span>
                            <span className="value-large">{bmi.value || 'N/A'}</span>
                        </div>
                    </div>
                    <div className="healthy-weight-box">
                        Peso saludable estimado:
                        <strong>{targetWeight}</strong>
                    </div>
                </div>
            </div>
            
            <div className="profile-card">
                <h3>Objetivos y Preferencias</h3>
                 <div className="profile-card-content">
                    <div className="profile-item"><span className="label">Nivel:</span> <span className="value">{profile.level}</span></div>
                    <div className="profile-item"><span className="label">Objetivo:</span> <span className="value">{profile.goal}</span></div>
                    <div className="profile-item"><span className="label">Días de Entrenamiento:</span> <span className="value">{profile.trainingDays} por semana</span></div>
                    <div className="profile-item"><span className="label">Enfoque Corporal:</span> <span className="value">{profile.bodyFocusArea}</span></div>
                </div>
            </div>
        </div>
    );
};

const ClientView: React.FC<{ dni: string; onLogout: () => void }> = ({ dni, onLogout }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showChat, setShowChat] = useState(false);

    const fetchClientData = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        const data = await apiClient.getClientData(dni);
        setClientData(data);
        if (showLoading) setIsLoading(false);
    };

    useEffect(() => {
        fetchClientData();
    }, [dni]);

    const isPlanExpired = () => {
        if (!clientData?.routineGeneratedDate || !clientData?.routine?.totalDurationWeeks) {
            return false; // No hay plan o fecha, no se puede determinar la expiración
        }
        const generatedDate = new Date(clientData.routineGeneratedDate);
        const expirationDate = new Date(generatedDate.setDate(generatedDate.getDate() + (Number(clientData.routine.totalDurationWeeks) * 7)));
        return new Date() > expirationDate;
    };
    
    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div></div>;
    }
    if (!clientData) {
        return <div className="error-container">No se encontraron datos para este cliente.</div>;
    }

    // --- View Routing based on client status ---
    if (clientData.planStatus === 'pending') {
        // This case is now handled by the main App router, directing to PlanSelectionPage
        // but as a fallback, we can show a loading or error state.
        return <div className="loading-container"><div className="spinner"></div>Redirigiendo...</div>;
    }
    
    // Using a portal-like approach for the chat to break out of the main layout constraints
    if (showChat) {
        return (
            <ChatAssistant 
                clientData={clientData} 
                setClientData={setClientData} 
                onClose={() => setShowChat(false)} 
            />
        );
    }


    return (
        <div className="client-view-container">
            <header>
                <h1>Bienvenido, {clientData.profile.name}!</h1>
                <div className="client-header-actions">
                    <button onClick={() => setShowChat(true)} className="header-nav-button ai-assistant-button">Asistente IA</button>
                    <button onClick={onLogout} className="logout-button">Salir</button>
                </div>
            </header>

            {isPlanExpired() ? (
                <div className="expired-view">
                     <h2>Tu plan ha expirado</h2>
                     <p>Tu plan de entrenamiento ha finalizado. Por favor, contacta a tu entrenador para generar una nueva rutina.</p>
                </div>
            ) : (
                <ClientPortalTabs clientData={clientData} onDataUpdate={() => fetchClientData(false)} />
            )}
        </div>
    );
};

const ChatAssistant: React.FC<{
    clientData: ClientData;
    setClientData: React.Dispatch<React.SetStateAction<ClientData | null>>;
    onClose: () => void;
}> = ({ clientData, setClientData, onClose }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string; image?: string }[]>([
        { role: 'model', text: '¡Hola! Soy tu asistente de IA. ¿En qué puedo ayudarte hoy con tu entrenamiento, nutrición o analizando una foto de tu comida?' }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [image, setImage] = useState<{ b64: string; mimeType: string } | null>(null);

    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);
    
    const today = new Date().toISOString().split('T')[0];
    const usage = clientData.aiUsage?.date === today ? clientData.aiUsage.count : 0;
    const limit = clientData.dailyQuestionLimit ?? 5;
    const canAsk = usage < limit;

    useEffect(() => {
        const profileSummary = JSON.stringify(clientData.profile);
        const routineSummary = clientData.routine ? `El cliente está en un plan llamado '${clientData.routine.planName}' con una duración de ${clientData.routine.totalDurationWeeks} semanas.` : "El cliente no tiene una rutina asignada.";
        const dietSummary = clientData.dietPlans?.[0] ? `El cliente tiene un plan de nutrición con un objetivo de ${clientData.dietPlans[0].summary.totalCalories} calorías.` : "El cliente no tiene un plan de nutrición asignado.";

        const systemInstruction = `
            Eres "Scorpion AI", un asistente de fitness virtual experto y motivador. Tu objetivo es ayudar al cliente a alcanzar sus metas de fitness.
            - **Personalidad:** Sé amigable, alentador y profesional.
            - **Contexto del Cliente:** Estás hablando con un cliente cuyo perfil es: ${profileSummary}.
            - **Plan Actual:** ${routineSummary} ${dietSummary}.
            - **Tus Capacidades:** Puedes responder preguntas sobre ejercicios, nutrición, técnicas de entrenamiento, y dar consejos generales de fitness.
            - **Limitaciones:** NO eres un médico. Si te preguntan sobre lesiones, dolor o condiciones médicas, DEBES aconsejarles que consulten a un profesional de la salud y que hablen con su entrenador. No des diagnósticos ni tratamientos médicos.
            - **Respuestas:** Sé conciso y claro. Usa formato markdown para listas o para enfatizar puntos importantes.
        `;
        
        try {
            const newChat = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: { systemInstruction },
            });
            setChat(newChat);
        } catch (e) {
            console.error("Error creating chat session:", e);
            setError("No se pudo iniciar el asistente de IA. Verifica la configuración.");
        }
    }, [ai, clientData]);
    
     useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            setImage({ b64: base64String, mimeType: file.type });
        };
        reader.readAsDataURL(file);
        if(fileInputRef.current) fileInputRef.current.value = ''; // Reset file input
    };
    
    const handleSendMessage = async () => {
        if ((!userInput.trim() && !image) || isLoading || !canAsk) return;

        const userMessageText = userInput;
        const attachedImage = image; // Capture before clearing state
        
        const userMessageForDisplay: { role: 'user'; text: string; image?: string } = {
            role: 'user',
            text: userMessageText,
            image: attachedImage ? `data:${attachedImage.mimeType};base64,${attachedImage.b64}` : undefined
        };
        
        setMessages(prev => [...prev, userMessageForDisplay]);
        setUserInput('');
        setImage(null);
        setIsLoading(true);
        setError('');

        try {
            let responseText = '';

            if (attachedImage) {
                const calorieSystemInstruction = `Eres "Scorpion AI", un asistente de nutrición. Tu única tarea es analizar la imagen de la comida proporcionada y estimar las calorías y macronutrientes (proteínas, carbohidratos, grasas).
                - **Respuesta:** Proporciona una respuesta clara y concisa. Primero, identifica la comida. Luego, da una estimación de las calorías y los macros en gramos.
                - **Formato:** Usa una lista o un párrafo corto. Ejemplo: "Esto parece ser [Comida]. Estimación: Calorías: X, Proteínas: Yg, Carbs: Zg, Grasas: Ag."
                - **Limitación:** No des consejos de salud ni de dieta. Solo analiza la imagen. Si no puedes identificar la comida, dilo claramente.`;

                const parts = [
                    { inlineData: { mimeType: attachedImage.mimeType, data: attachedImage.b64 } },
                    { text: `Analiza esta comida. ${userMessageText}` }
                ];

                const response = await withRetry(() => 
                    ai.models.generateContent({
                        model: 'gemini-2.5-flash',
                        contents: { parts },
                        config: { systemInstruction: calorieSystemInstruction }
                    })
                );
                responseText = (response as GenerateContentResponse).text;
                // Note: This special request does not get added to the main 'chat' history object
                // to keep that conversation's context clean (as a fitness coach).
            } else if (chat) {
                const result = await withRetry(() => 
                    chat.sendMessage({ message: userMessageText })
                );
                responseText = (result as GenerateContentResponse).text;
            } else {
                 throw new Error("Chat not initialized.");
            }

            setMessages(prev => [...prev, { role: 'model', text: responseText }]);

            const newUsage = { date: today, count: usage + 1 };
            const updatedClientData = { ...clientData, aiUsage: newUsage };
            setClientData(updatedClientData);
            await apiClient.saveClientData(clientData.dni, { aiUsage: newUsage });

        } catch (err) {
            console.error(err);
            const errorMessage = "Lo siento, ocurrió un error al procesar tu pregunta. Por favor, inténtalo de nuevo.";
            setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
            setError(err instanceof Error ? err.message : "Error desconocido.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="chat-fullscreen-container">
             <div className="main-header" style={{ padding: '1rem', margin: 0, borderBottom: `1px solid var(--border-color)`, flexShrink: 0 }}>
                <div className="header-title-wrapper">
                    <h1>Asistente IA</h1>
                    <p>Preguntas hoy: {usage}/{limit}</p>
                </div>
                <div className="admin-header-nav">
                    <button onClick={onClose} className="back-button">Cerrar</button>
                </div>
            </div>

            <div className="chat-messages">
                {messages.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.role}`}>
                        <div className="avatar">{msg.role === 'user' ? 'TÚ' : 'AI'}</div>
                        <div className="message-content">
                            {msg.image && <img src={msg.image} alt="Adjunto" />}
                            {msg.text && <p>{msg.text}</p>}
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
                 {image && (
                    <div className="chat-image-preview">
                        <img src={`data:${image.mimeType};base64,${image.b64}`} alt="Preview" />
                        <button className="remove-image-btn" onClick={() => setImage(null)}>&times;</button>
                    </div>
                )}
                {!canAsk ? (
                    <div className="limit-reached-message">
                        Has alcanzado tu límite de preguntas diarias.
                    </div>
                ) : (
                     <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
                         <input type="file" id="image-upload" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} ref={fileInputRef} />
                         <button type="button" className="chat-action-btn" onClick={() => fileInputRef.current?.click()} aria-label="Adjuntar imagen">
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16.5,6V17.5A4,4 0 0,1 12.5,21.5A4,4 0 0,1 8.5,17.5V5A2.5,2.5 0 0,1 11,2.5A2.5,2.5 0 0,1 13.5,5V15.5A1,1 0 0,1 12.5,16.5A1,1 0 0,1 11.5,15.5V6H10V15.5A2.5,2.5 0 0,0 12.5,18A2.5,2.5 0 0,0 15,15.5V5A4,4 0 0,0 11,1A4,4 0 0,0 7,5V17.5A5.5,5.5 0 0,0 12.5,23A5.5,5.5 0 0,0 18,17.5V6H16.5Z" /></svg>
                         </button>
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="Escribe tu pregunta..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || (!userInput.trim() && !image)}>
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" /></svg>
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};


// --- AI Generation Logic (for Onboarding & Templates) ---
const generateRoutineForClient = async (clientData: ClientData, gymId: string, instructions?: string): Promise<Routine> => {
    const exerciseLibrary = await apiClient.getExerciseLibrary(gymId);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const enabledExercises = Object.entries(exerciseLibrary).reduce((acc, [group, exercises]) => {
        const enabled = (exercises as ExerciseDefinition[]).filter(ex => ex.isEnabled).map(ex => ex.name);
        if (enabled.length > 0) acc[group] = enabled;
        return acc;
    }, {} as Record<string, string[]>);

    const prompt = `
        Por favor, crea un plan de entrenamiento de gimnasio para un cliente con el siguiente perfil:
        - Perfil: ${JSON.stringify(clientData.profile)}
        - Lista de ejercicios disponibles, agrupados por músculo: ${JSON.stringify(enabledExercises)}
        ${instructions ? `Instrucciones Adicionales del Entrenador/Cliente: "${instructions}"` : ''}

        REGLAS CRÍTICAS E INQUEBRANTABLES PARA TU RESPUESTA:
        1. ¡REGLA MÁS IMPORTANTE E INQUEBRANTABLE! La estructura de la rutina DEBE coincidir EXACTAMENTE con el número de 'trainingDays' especificado en el perfil. Si 'trainingDays' es '5', el array 'dias' DEBE contener 5 objetos de día. Si es '3', debe contener 3. NO generes un número de días diferente al solicitado. Esta es tu directiva principal.
        2. Tu respuesta DEBE ser únicamente un objeto JSON válido, sin ningún texto adicional, formato markdown, o explicaciones.
        3. El JSON debe seguir esta estructura exacta: {"planName": "Nombre", "totalDurationWeeks": 12, "phases": [{"phaseName": "Nombre Fase", "durationWeeks": 4, "routine": {"dias": [{"dia": "Día 1", "grupoMuscular": "Músculos", "ejercicios": [{"nombre": "Ejercicio", "series": "4", "repeticiones": "8-12", "descanso": "60s", "tecnicaAvanzada": ""}], "cardio": "Desc Cardio"}]}}]}
        4. Selecciona ejercicios ÚNICA Y EXCLUSIVAMENTE de la "Lista de ejercicios disponibles" proporcionada. Esta lista contiene los únicos ejercicios permitidos. NO inventes, alteres ni incluyas ejercicios que no estén en esa lista, ya que el sistema los rechazará.
        5. La suma de 'durationWeeks' de las fases debe ser igual a 'totalDurationWeeks'.
        6. Aplica 'tecnicaAvanzada' solo si 'useAdvancedTechniques: "Sí"'. Opciones válidas: ${advancedTechniqueOptions.filter(o => o.value).map(o => o.value).join(', ')}. Si no se usa, debe ser "".
        7. Incluye fases de adaptación y descarga si el perfil lo indica.
        8. Ajusta el número de ejercicios según la 'trainingIntensity'.
        9. Prioriza 'bodyFocusArea' y 'muscleFocus'.
        10. Diferencia entre 'Full Body' y 'Cuerpo Completo': Si 'bodyFocusArea' es 'Full Body', cada día de entrenamiento debe incluir ejercicios para el cuerpo entero. Si 'bodyFocusArea' es 'Cuerpo Completo', crea una rutina dividida (split) que trabaje diferentes grupos musculares en diferentes días.
    `;
    const response = await withRetry(() => 
        ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt })
    );
    const jsonString = extractJson((response as GenerateContentResponse).text);
    if (!jsonString) throw new Error("La IA no devolvió un JSON de rutina válido.");
    
    const generatedPlan = JSON.parse(jsonString);
    return validateAndCorrectRoutine(generatedPlan, exerciseLibrary);
};

const generateDietForClient = async (clientData: ClientData, instructions?: string): Promise<DietPlan> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
        Por favor, crea un plan de nutrición para un cliente con el siguiente perfil:
        - Perfil: ${JSON.stringify(clientData.profile)}
        ${instructions ? `Instrucciones Adicionales del Cliente: "${instructions}"` : ''}
        REGLAS ESTRICTAS PARA TU RESPUESTA:
        1. **Idioma:** Tu respuesta DEBE estar en español de Argentina.
        2. Tu respuesta DEBE ser únicamente un objeto JSON válido, sin texto adicional, markdown o explicaciones.
        3. Calcula calorías y macros basándote en el perfil completo del cliente.
        4. El JSON debe seguir esta estructura exacta: {"planTitle": "Título", "summary": {"totalCalories": 2500, "macronutrients": {"proteinGrams": 180, "carbsGrams": 300, "fatGrams": 60}}, "meals": [{"mealName": "Desayuno", "foodItems": [{"food": "Avena", "amount": "80g"}]}], "recommendations": ["Beber 2-3 litros de agua."]}
        5. Distribuye las calorías en 4-6 comidas.
        6. Usa alimentos comunes en Argentina.
    `;
    const response = await withRetry(() => 
        ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt })
    );
    const jsonString = extractJson((response as GenerateContentResponse).text);
    if (!jsonString) throw new Error("La IA no devolvió un JSON de dieta válido.");
    return JSON.parse(jsonString);
};


type GenerationStatus = 'pending' | 'loading' | 'done' | 'error';

const ClientOnboardingView: React.FC<{
    dni: string;
    onOnboardingComplete: () => void;
    onBack: () => void;
}> = ({ dni, onOnboardingComplete, onBack }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const [generationState, setGenerationState] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
    const [generationProgress, setGenerationProgress] = useState({
        routine: 'pending' as GenerationStatus,
        diet1: 'pending' as GenerationStatus,
        diet2: 'pending' as GenerationStatus,
    });
    const [generationError, setGenerationError] = useState('');
    const [additionalInstructions, setAdditionalInstructions] = useState('');
    
    useEffect(() => {
        const fetchData = async () => {
            const data = await apiClient.getClientData(dni);
            setClientData(data);
            setIsLoading(false);
        }
        fetchData();
    }, [dni]);


    const isProfileComplete = useMemo(() => {
        if (!clientData) return false;
        const { profile } = clientData;
        return (
            profile.name.trim() !== '' &&
            profile.age.trim() !== '' &&
            profile.weight.trim() !== '' &&
            profile.height.trim() !== '' &&
            profile.trainingDays.trim() !== '' &&
            Number(profile.age) > 0 &&
            Number(profile.weight) > 0 &&
            Number(profile.height) > 0 &&
            Number(profile.trainingDays) > 0
        );
    }, [clientData]);
    
    const handleGenerateFullPlan = async () => {
        if (!clientData) return;
        setGenerationState('generating');
        setGenerationError('');
        setGenerationProgress({ routine: 'pending', diet1: 'pending', diet2: 'pending' });
        const planType = clientData.planType || 'full';

        try {
            if (planType === 'full' || planType === 'routine') {
                setGenerationProgress(prev => ({ ...prev, routine: 'loading' }));
                const routine = await generateRoutineForClient(clientData, clientData.gymId, additionalInstructions);
                setClientData(prev => prev ? ({ ...prev, routine }) : null);
                setGenerationProgress(prev => ({ ...prev, routine: 'done' }));
            }

            if (planType === 'full' || planType === 'nutrition') {
                setGenerationProgress(prev => ({ ...prev, diet1: 'loading', diet2: 'loading' }));
                const [diet1, diet2] = await Promise.all([
                    generateDietForClient(clientData, additionalInstructions),
                    generateDietForClient(clientData, additionalInstructions)
                ]);
                setClientData(prev => prev ? ({ ...prev, dietPlans: [diet1, diet2] }) : null);
                setGenerationProgress(prev => ({ ...prev, diet1: 'done', diet2: 'done' }));
            }

            setGenerationState('success');

        } catch (error) {
            console.error("Plan generation failed:", error);
            setGenerationError(error instanceof Error ? error.message : "Ocurrió un error desconocido.");
            setGenerationState('error');
            setGenerationProgress(prev => {
                const newProgress = {...prev};
                if (newProgress.routine === 'loading') newProgress.routine = 'error';
                if (newProgress.diet1 === 'loading') newProgress.diet1 = 'error';
                if (newProgress.diet2 === 'loading') newProgress.diet2 = 'error';
                return newProgress;
            });
        }
    };

    const handleSaveAndStart = async () => {
        if (generationState !== 'success' || !clientData) {
            alert("Por favor, genera tu plan completo antes de comenzar.");
            return;
        }
        setIsLoading(true);
        const finalData: Partial<ClientData> = {
            profile: clientData.profile,
            routine: clientData.routine,
            dietPlans: clientData.dietPlans,
            routineGeneratedDate: new Date().toISOString(),
            planStatus: 'active',
            termsAccepted: true, // They must have accepted to get here
        };

        const success = await apiClient.saveClientData(clientData.dni, finalData);
        if (success) {
            onOnboardingComplete();
        } else {
            alert("Ocurrió un error al guardar tu plan. Por favor, intenta de nuevo.");
            setIsLoading(false);
        }
    };
    
    if (isLoading || !clientData) {
        return <div className="loading-container"><div className="spinner"></div></div>;
    }

    const planType = clientData.planType || 'full';

    return (
        <div className="onboarding-container">
             <header className="onboarding-header">
                <h1>Crea tu Plan Personalizado</h1>
                <p>Completa tus datos para que la IA genere un plan a tu medida.</p>
            </header>
            
            <div className="onboarding-section">
                <h2>Paso 1: Completa tu Perfil</h2>
                <ProfileEditor clientData={clientData} setClientData={setClientData as React.Dispatch<React.SetStateAction<ClientData>>} isClientOnboarding />
            </div>
            
            <div className="onboarding-section">
                <h2>Paso 2: Genera tu Plan</h2>
                 {generationState === 'idle' && (
                     <div className="onboarding-generation-container">
                        <p>Cuando tu perfil esté listo, la IA creará tu rutina y/o planes de nutrición personalizados.</p>
                        <div className="admin-instructions-box">
                            <label htmlFor="client-instructions-gen">Instrucciones Adicionales para la IA (Opcional)</label>
                            <textarea
                                id="client-instructions-gen"
                                rows={3}
                                value={additionalInstructions}
                                onChange={(e) => setAdditionalInstructions(e.target.value)}
                                placeholder="Ej: Tengo una lesión en la rodilla, evitar sentadillas. No me gusta el pescado."
                            ></textarea>
                        </div>
                        <button className="cta-button" onClick={handleGenerateFullPlan} disabled={!isProfileComplete}>
                            Generar Mi Plan
                        </button>
                        {!isProfileComplete && (
                             <p style={{ color: 'var(--text-secondary-color)', fontSize: '0.9rem', marginTop: '0.5rem', textAlign: 'center' }}>
                                Por favor, completa los campos de nombre, edad, peso, altura y días de entrenamiento para continuar.
                            </p>
                        )}
                    </div>
                )}
                
                {(generationState === 'generating' || generationState === 'error' || generationState === 'success') && (
                     <GenerationProgressIndicator 
                        progress={generationProgress} 
                        error={generationError}
                        onRetry={handleGenerateFullPlan}
                        planType={planType}
                    />
                )}
            </div>
            
             <div className="onboarding-actions">
                <button 
                    className="cta-button" 
                    onClick={handleSaveAndStart} 
                    disabled={isLoading || generationState !== 'success'}
                >
                    {isLoading ? "Guardando..." : "Guardar y Empezar mi Plan"}
                </button>
                 <button onClick={onBack} className="back-button simple">Volver a la selección</button>
            </div>
        </div>
    );
};

const GenerationProgressIndicator: React.FC<{
    progress: { routine: GenerationStatus; diet1: GenerationStatus; diet2: GenerationStatus; };
    error: string;
    onRetry: () => void;
    planType: PlanType;
}> = ({ progress, error, onRetry, planType }) => {
    
    const renderStatusIcon = (status: GenerationStatus) => {
        switch (status) {
            case 'loading': return <div className="spinner small"></div>;
            case 'done': return <span className="status-icon success">✓</span>;
            case 'error': return <span className="status-icon error">✗</span>;
            case 'pending': return <span className="status-icon pending">●</span>;
        }
    };

    return (
        <div className="generation-progress-container">
            <ul className="generation-progress-list">
                {(planType === 'full' || planType === 'routine') && (
                    <li className={`progress-item ${progress.routine}`}>
                        {renderStatusIcon(progress.routine)}
                        <span>Plan de Entrenamiento</span>
                    </li>
                )}
                {(planType === 'full' || planType === 'nutrition') && (
                    <>
                        <li className={`progress-item ${progress.diet1}`}>
                            {renderStatusIcon(progress.diet1)}
                            <span>Plan de Nutrición 1</span>
                        </li>
                        <li className={`progress-item ${progress.diet2}`}>
                            {renderStatusIcon(progress.diet2)}
                            <span>Plan de Nutrición 2</span>
                        </li>
                    </>
                )}
            </ul>
            {error && (
                <div className="error-container" style={{padding: '1rem', marginTop: '1.5rem', minHeight: 'auto'}}>
                    <p style={{margin: '0 0 1rem 0'}}>{error}</p>
                    <button className="cta-button secondary" onClick={onRetry}>Intentar de Nuevo</button>
                </div>
            )}
        </div>
    );
};

const RequestModal: React.FC<{
    client: ClientData;
    onClose: () => void;
}> = ({ client, onClose }) => {
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus('idle');
        
        const requestData = {
            clientId: client.dni,
            clientName: client.profile.name,
            gymId: client.gymId,
            subject,
            message
        };

        const success = await apiClient.createRequest(requestData);
        if (success) {
            setStatus('success');
            setTimeout(() => {
                onClose();
            }, 2000);
        } else {
            setStatus('error');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content edit-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>&times;</button>
                <h3>Contactar al Entrenador</h3>

                {status === 'success' ? (
                    <div className="success-message" style={{textAlign: 'center', padding: '2rem'}}>
                        <p>¡Tu solicitud ha sido enviada con éxito!</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="subject">Asunto</label>
                            <input
                                type="text"
                                id="subject"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Ej: Duda sobre ejercicio, cambiar rutina..."
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
                                placeholder="Describe tu solicitud o pregunta en detalle."
                                required
                            ></textarea>
                        </div>
                        {status === 'error' && <p className="error-text">No se pudo enviar la solicitud. Inténtalo de nuevo.</p>}
                        <div className="modal-actions" style={{marginTop: '1.5rem'}}>
                            <button type="button" className="cta-button secondary" onClick={onClose}>Cancelar</button>
                            <button type="submit" className="cta-button" disabled={isSubmitting}>
                                {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

const ClientExerciseLibraryView: React.FC<{ gymId: string; onPlayVideo: (url: string) => void; }> = ({ gymId, onPlayVideo }) => {
    const [library, setLibrary] = useState<ExerciseLibrary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeGroup, setActiveGroup] = useState<string | null>(null);

    useEffect(() => {
        const fetchLibrary = async () => {
            setIsLoading(true);
            const fetchedLibrary = await apiClient.getExerciseLibrary(gymId);
            setLibrary(fetchedLibrary);
            if (fetchedLibrary && Object.keys(fetchedLibrary).length > 0) {
                setActiveGroup(Object.keys(fetchedLibrary)[0]);
            }
            setIsLoading(false);
        };
        fetchLibrary();
    }, [gymId]);

    const toggleGroup = (group: string) => {
        setActiveGroup(prev => (prev === group ? null : group));
    };

    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div>Cargando biblioteca...</div>;
    }

    if (!library || Object.keys(library).length === 0) {
        return <div className="placeholder">No hay ejercicios en la biblioteca de este gimnasio.</div>;
    }

    return (
        <div className="library-container animated-fade-in" style={{padding: 0, marginTop: 0}}>
            <div className="plan-header" style={{textAlign: 'center'}}>
                <h2>Biblioteca de Ejercicios</h2>
                <p>Explora todos los ejercicios disponibles y mira sus videos de ejecución.</p>
            </div>

            <div className="accordion-phases">
                {Object.entries(library).sort(([groupA], [groupB]) => groupA.localeCompare(groupB)).map(([group, exercises]) => (
                    <div key={group} className="accordion-item">
                        <button
                            className={`accordion-header ${activeGroup === group ? 'active' : ''}`}
                            onClick={() => toggleGroup(group)}
                            aria-expanded={activeGroup === group}
                        >
                            <span>{group}</span>
                            <span className="accordion-header-icon">+</span>
                        </button>
                        <div className={`accordion-content ${activeGroup === group ? 'open' : ''}`}>
                            <ul className="exercise-list">
                                {(exercises as ExerciseDefinition[]).filter(ex => ex.isEnabled).map((exercise) => (
                                    <li key={exercise.name} className="exercise-item">
                                        <div className="exercise-name-wrapper">
                                            <span className="exercise-name">{exercise.name}</span>
                                            {exercise.videoUrl && (
                                                <button onClick={() => onPlayVideo(exercise.videoUrl)} className="video-play-button" aria-label={`Reproducir video de ${exercise.name}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M10,16.5L16,12L10,7.5V16.5Z"></path></svg>
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ClientPortalTabs: React.FC<{ clientData: ClientData, onDataUpdate: () => void }> = ({ clientData, onDataUpdate }) => {
    const planType = clientData.planType || 'full';
    const [activeTab, setActiveTab] = useState<'routine' | 'diet' | 'progress' | 'profile' | 'library'>(planType === 'nutrition' ? 'diet' : 'routine');
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);

    const renderContent = () => {
        switch(activeTab) {
            case 'routine':
                return clientData.routine 
                    ? <ExerciseTracker clientData={clientData} onProgressLogged={onDataUpdate} onRequestChange={() => setShowRequestModal(true)} onPlayVideo={setPlayingVideoUrl} /> 
                    : <div className="placeholder">Aún no tienes una rutina asignada.</div>;
            case 'diet':
                return clientData.dietPlans && (clientData.dietPlans[0] || clientData.dietPlans[1])
                    ? <ClientDietTabsView dietPlans={clientData.dietPlans} /> 
                    : <div className="placeholder">Aún no tienes un plan de nutrición asignado.</div>;
            case 'progress':
                return <ProgressView clientData={clientData} onDataUpdate={onDataUpdate} />;
            case 'library':
                return <ClientExerciseLibraryView gymId={clientData.gymId} onPlayVideo={setPlayingVideoUrl} />;
            case 'profile':
                 return <ClientProfileView clientData={clientData} />;
            default: return null;
        }
    }

    return (
        <div className="main-content">
             <nav className="main-tabs-nav">
                {(planType === 'full' || planType === 'routine') &&
                    <button className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>Rutina</button>
                }
                {(planType === 'full' || planType === 'nutrition') &&
                    <button className={`main-tab-button ${activeTab === 'diet' ? 'active' : ''}`} onClick={() => setActiveTab('diet')}>Nutrición</button>
                }
                <button className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>Progreso</button>
                <button className={`main-tab-button ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>Ejercicios</button>
                <button className={`main-tab-button ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Mi Perfil</button>
            </nav>
            <main className="client-main-content">
                {renderContent()}
                {showRequestModal && <RequestModal client={clientData} onClose={() => setShowRequestModal(false)} />}
                {playingVideoUrl && <VideoPlayerModal videoUrl={playingVideoUrl} onClose={() => setPlayingVideoUrl(null)} />}
            </main>
        </div>
    );
};

const container = document.getElementById("root");
createRoot(container!).render(<App />);
