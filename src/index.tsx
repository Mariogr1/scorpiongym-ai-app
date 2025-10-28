





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
    RoutineTemplate,
    DayStructure
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
        group.forEach(ex => {
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
    const [view, setView] = useState<'landing' | 'login' | 'adminDashboard' | 'clientDashboard' | 'clientView' | 'superAdminDashboard' | 'clientRegistration' | 'clientPasswordReset'>('landing');
    const [currentClientDni, setCurrentClientDni] = useState<string | null>(null);
    const [currentGym, setCurrentGym] = useState<Gym | null>(null);
    const [impersonatedGym, setImpersonatedGym] = useState<Gym | null>(null);
    const [loginError, setLoginError] = useState<string>('');
    const [loginMessage, setLoginMessage] = useState('');


    useEffect(() => {
        // Check session storage to maintain login state
        const loggedInClient = sessionStorage.getItem('loggedInClientDni');
        const loggedInGym = sessionStorage.getItem('loggedInGym');
        const loggedInUserType = sessionStorage.getItem('userType');

        if (loggedInClient) {
            setCurrentClientDni(loggedInClient);
            setView('clientView');
        } else if (loggedInGym) {
            const gymData = JSON.parse(loggedInGym);
            setCurrentGym(gymData);
            if (gymData.username === 'superadmin') {
                setView('superAdminDashboard');
            } else {
                setView('adminDashboard');
            }
        }
    }, []);

    const handleLogin = async (type: 'client' | 'gym', id: string, code?: string) => {
        setLoginError('');
        setLoginMessage('');
        if (type === 'client') {
            const loginResult = await apiClient.loginClient(id, code!);
            if (loginResult.success) {
                sessionStorage.setItem('loggedInClientDni', id);
                sessionStorage.setItem('userType', 'client');
                setCurrentClientDni(id);
                if (loginResult.resetRequired) {
                    setView('clientPasswordReset');
                } else {
                    setView('clientView');
                }
            } else {
                setLoginError('DNI o código de acceso/contraseña incorrecto.');
            }
        } else { // type === 'gym'
             const gymData = await apiClient.gymLogin(id, code!);
             if (gymData) {
                 sessionStorage.setItem('loggedInGym', JSON.stringify(gymData));
                 sessionStorage.setItem('userType', 'gym');
                 setCurrentGym(gymData);
                 if (gymData.username === 'superadmin') {
                    setView('superAdminDashboard');
                 } else {
                    setView('adminDashboard');
                 }
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
    
    const handleRegisterAndLogin = async (dni: string, code: string) => {
        // After registration, log the user in.
        handleLogin('client', dni, code);
    };

    const renderView = () => {
        switch (view) {
            case 'landing':
                return <LandingPage onIngresar={() => setView('login')} />;
            case 'login':
                return <LoginPage onLogin={handleLogin} error={loginError} message={loginMessage} onBack={() => setView('landing')} onGoToRegister={() => setView('clientRegistration')} />;
            case 'clientRegistration':
                return <ClientRegistrationPage onRegister={handleRegisterAndLogin} onBack={() => setView('login')} />;
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
    onRegister: (dni: string, code: string) => void;
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
            // Automatically log in the user after successful registration
            onRegister(dni, password);
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
                        style={{
                            width: '100%',
                            padding: '0.8rem 1rem',
                            backgroundColor: 'var(--background-color)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            color: 'var(--text-color)',
                            fontSize: '1rem'
                        }}
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

// --- Super Admin View ---

// FIX: Added missing ConfirmationModal component.
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
                    {/* FIX: Cast the string value from the select event to the PlanType union type to satisfy the state setter's type requirement. */}
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

// FIX: Added missing RequestsView and RequestSection components.
const RequestSection: React.FC<{
    title: string;
    requests: TrainerRequest[];
    onUpdateStatus: (id: string, status: 'read' | 'resolved') => void;
    onDelete: (id: string) => void;
}> = ({ title, requests, onUpdateStatus, onDelete }) => {
    if (requests.length === 0) {
        return <div className="placeholder" style={{ marginTop: '2rem' }}>No hay solicitudes en esta categoría.</div>;
    }
    
    return (
        <div className="request-section">
            <h3>{title} ({requests.length})</h3>
            <div className="request-list">
                {requests.map(req => (
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
                            {group} ({exercises.length})
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
                                {exercises.map((ex, index) => {
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

const AIGeneratedTemplateForm: React.FC<{
    onGenerationSuccess: (data: Partial<RoutineTemplate>) => void;
    gymId: string;
}> = ({ onGenerationSuccess, gymId }) => {
    const [params, setParams] = useState({
        templateName: '',
        description: '',
        trainingDays: 4,
        goal: 'Hipertrofia',
        level: 'Intermedio',
        bodyFocusArea: 'Cuerpo Completo',
        useAdvancedTechniques: 'No',
        includeAdaptationPhase: 'Sí',
        includeDeloadPhase: 'No',
        instructions: ''
    });
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (field: keyof typeof params, value: string | number) => {
        setParams(prev => ({ ...prev, [field]: value }));
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsGenerating(true);
        setError('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const library = await apiClient.getExerciseLibrary(gymId);
            const enabledExercises = Object.entries(library).reduce((acc, [group, exercises]) => {
                const enabled = exercises.filter(ex => ex.isEnabled).map(ex => ex.name);
                if (enabled.length > 0) acc[group] = enabled;
                return acc;
            }, {} as Record<string, string[]>);

            const prompt = `
                Por favor, crea una ESTRUCTURA de plantilla de rutina de gimnasio basada en los siguientes parámetros.
                Parámetros:
                - Nombre de la Plantilla: "${params.templateName}"
                - Descripción: "${params.description}"
                - Días de entrenamiento por semana: ${params.trainingDays}
                - Objetivo Principal: ${params.goal}
                - Nivel de Experiencia: ${params.level}
                - Enfoque Corporal: ${params.bodyFocusArea}
                - Usar Técnicas Avanzadas: ${params.useAdvancedTechniques}
                - Incluir Fase de Adaptación: ${params.includeAdaptationPhase}
                - Incluir Fase de Descarga: ${params.includeDeloadPhase}
                - Instrucciones Adicionales del Entrenador: "${params.instructions || 'Ninguna'}"
                - Lista de ejercicios disponibles (para referencia de qué músculos existen): ${JSON.stringify(Object.keys(library))}
                
                REGLAS CRÍTICAS PARA TU RESPUESTA:
                1.  Tu respuesta DEBE ser únicamente un objeto JSON válido, sin ningún texto adicional, formato markdown, o explicaciones.
                2.  El JSON debe seguir esta estructura exacta:
                    {
                      "templateName": "${params.templateName}",
                      "description": "Una descripción breve y atractiva para la plantilla.",
                      "trainingDays": ${params.trainingDays},
                      "structure": [
                        {
                          "dia": "Día 1",
                          "grupoMuscular": "Músculos Principales del Día"
                        },
                        {
                          "dia": "Día 2",
                          "grupoMuscular": "Músculos Principales del Día"
                        }
                      ]
                    }
                3.  ¡REGLA MÁS IMPORTANTE! La longitud del array "structure" DEBE ser exactamente igual al número de "trainingDays".
                4.  Asigna los "grupoMuscular" de forma lógica y coherente según los parámetros. Por ejemplo, si el enfoque es 'Tren Inferior' para 4 días, la división debería reflejar eso (ej: 'Cuádriceps', 'Femorales y Glúteos', 'Cuádriceps', 'Femorales y Glúteos').
                5.  El valor de "grupoMuscular" debe ser un string conciso, como "Pecho y Tríceps" o "Espalda y Bíceps". No incluyas ejercicios, solo los nombres de los grupos musculares.
                6.  Diferencia entre 'Full Body' y 'Cuerpo Completo':
                    - Si 'bodyFocusArea' es 'Full Body', el grupo muscular para cada día debe ser "Cuerpo Entero".
                    - Si 'bodyFocusArea' es 'Cuerpo Completo', crea una rutina dividida (split) que trabaje diferentes grupos musculares en diferentes días.
            `;

            const response = await withRetry(() =>
                ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                })
            );

            const jsonString = extractJson(response.text);
            if (!jsonString) {
                throw new Error("La IA no devolvió un JSON válido.");
            }
            const generatedData: Partial<RoutineTemplate> = JSON.parse(jsonString);

            // Validate the received structure
            if (!generatedData.structure || generatedData.structure.length !== params.trainingDays) {
                throw new Error(`La IA devolvió una estructura con ${generatedData.structure?.length || 0} días en lugar de los ${params.trainingDays} solicitados.`);
            }

            onGenerationSuccess(generatedData);

        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Ocurrió un error al generar la plantilla.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    return (
        <div className="add-gym-container" style={{padding: 0, border: 'none', background: 'transparent'}}>
            <h3 style={{padding: '0 2rem'}}>Generar Plantilla con IA</h3>
             <form onSubmit={handleGenerate} className="add-gym-form" style={{background: 'var(--background-color)', borderRadius: '12px'}}>
                <div className="form-group">
                    <label>Nombre de la Plantilla</label>
                    <input type="text" value={params.templateName} onChange={e => handleChange('templateName', e.target.value)} required placeholder="Ej: Hipertrofia 4 Días" />
                </div>
                <div className="form-group">
                    <label>Días de Entrenamiento</label>
                    <input type="number" min="1" max="7" value={params.trainingDays} onChange={e => handleChange('trainingDays', Number(e.target.value))} required />
                </div>
                <div className="form-group">
                    <label>Objetivo Principal</label>
                    <select value={params.goal} onChange={e => handleChange('goal', e.target.value)}>
                        <option value="Hipertrofia">Hipertrofia</option>
                        <option value="Pérdida de grasa">Pérdida de grasa</option>
                        <option value="Mantenimiento">Mantenimiento</option>
                        <option value="Resistencia">Resistencia</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Nivel de Experiencia</label>
                    <select value={params.level} onChange={e => handleChange('level', e.target.value)}>
                        <option value="Principiante">Principiante</option>
                        <option value="Intermedio">Intermedio</option>
                        <option value="Avanzado">Avanzado</option>
                    </select>
                </div>
                <div className="form-group">
                    <label>Enfoque Corporal</label>
                     <select value={params.bodyFocusArea} onChange={e => handleChange('bodyFocusArea', e.target.value)}>
                        <option value="Cuerpo Completo">Cuerpo Completo (Rutina Dividida)</option>
                        <option value="Full Body">Full Body (Cuerpo Entero por Sesión)</option>
                        <option value="Tren Superior">Tren Superior</option>
                        <option value="Tren Inferior">Tren Inferior</option>
                    </select>
                </div>
                <div className="form-group" style={{gridColumn: '1 / -1'}}>
                    <label>Instrucciones Adicionales para la IA</label>
                    <textarea value={params.instructions} onChange={e => handleChange('instructions', e.target.value)} rows={3} placeholder="Ej: Crear una rutina Push/Pull/Legs. Priorizar hombros y espalda." />
                </div>
                {error && <p className="error-text" style={{gridColumn: '1 / -1'}}>{error}</p>}
                <div className="add-gym-actions" style={{gridColumn: '1 / -1'}}>
                    <button type="submit" className="cta-button" disabled={isGenerating || !params.templateName}>
                        {isGenerating ? <><span className="spinner small"/> Generando...</> : 'Generar y Revisar'}
                    </button>
                </div>
            </form>
        </div>
    );
};

// FIX: Added missing EditTemplateModal component definition.
const EditTemplateModal: React.FC<{ template: RoutineTemplate; onClose: () => void; onTemplateUpdated: () => void; }> = ({ template, onClose, onTemplateUpdated }) => {
    const [templateName, setTemplateName] = useState(template.templateName);
    const [description, setDescription] = useState(template.description);
    const [trainingDays, setTrainingDays] = useState(template.trainingDays);
    const [structure, setStructure] = useState<DayStructure[]>(template.structure);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setStructure(currentStructure => {
            const newLength = Number(trainingDays) || 0;
            const oldLength = currentStructure.length;
            if (newLength > oldLength) {
                return [
                    ...currentStructure.slice(0, oldLength),
                    ...Array.from({ length: newLength - oldLength }, (_, i) => ({
                        dia: `Día ${oldLength + i + 1}`,
                        grupoMuscular: '',
                    }))
                ];
            }
            return currentStructure.slice(0, newLength);
        });
    }, [trainingDays]);

    const handleStructureChange = (index: number, value: string) => {
        const updatedStructure = [...structure];
        updatedStructure[index].grupoMuscular = value;
        setStructure(updatedStructure);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const dataToUpdate: Partial<RoutineTemplate> = {
            templateName,
            description,
            trainingDays,
            structure: structure.filter(s => s.grupoMuscular.trim() !== ''),
        };

        if (dataToUpdate.structure?.length !== trainingDays) {
            alert("Por favor, completa los grupos musculares para todos los días.");
            setIsSubmitting(false);
            return;
        }

        const success = await apiClient.updateRoutineTemplate(template._id, dataToUpdate);
        if (success) {
            onTemplateUpdated();
        } else {
            alert("Error al actualizar la plantilla.");
        }
        setIsSubmitting(false);
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content edit-modal">
                <button className="close-button" onClick={onClose}>&times;</button>
                <h3>Editando: {template.templateName}</h3>
                <form onSubmit={handleSubmit} className="add-gym-form">
                    <div className="form-group">
                        <label>Nombre de la Plantilla</label>
                        <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label>Descripción</label>
                        <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="(Opcional)" />
                    </div>
                    <div className="form-group">
                        <label>Días de Entrenamiento</label>
                        <input type="number" min="1" max="7" value={trainingDays} onChange={(e) => setTrainingDays(Number(e.target.value))} required />
                    </div>
                    {structure.map((day, index) => (
                        <div className="form-group" key={index}>
                            <label>Grupo Muscular {day.dia}</label>
                            <input type="text" value={day.grupoMuscular} onChange={(e) => handleStructureChange(index, e.target.value)} required placeholder="Ej: Pecho y Tríceps" />
                        </div>
                    ))}
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

const RoutineTemplateManager: React.FC<{ gymId: string; onBack: () => void; }> = ({ gymId, onBack }) => {
    const [templates, setTemplates] = useState<RoutineTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingTemplate, setEditingTemplate] = useState<RoutineTemplate | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<RoutineTemplate | null>(null);
    const [mode, setMode] = useState<'manual' | 'ai'>('manual');

    // Form state for new template
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newTrainingDays, setNewTrainingDays] = useState(4);
    const [newStructure, setNewStructure] = useState<DayStructure[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setNewStructure(currentStructure => {
            const newLength = Number(newTrainingDays) || 0;
            const oldLength = currentStructure.length;
            if (newLength > oldLength) {
                return [
                    ...currentStructure.slice(0, oldLength),
                    ...Array.from({ length: newLength - oldLength }, (_, i) => ({
                        dia: `Día ${oldLength + i + 1}`,
                        grupoMuscular: '',
                    }))
                ];
            }
            return currentStructure.slice(0, newLength);
        });
    }, [newTrainingDays]);
    
    const handleNewStructureChange = (index: number, value: string) => {
        const updatedStructure = [...newStructure];
        updatedStructure[index].grupoMuscular = value;
        setNewStructure(updatedStructure);
    };

    const fetchTemplates = async () => {
        setIsLoading(true);
        const fetchedTemplates = await apiClient.getRoutineTemplates(gymId);
        setTemplates(fetchedTemplates);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchTemplates();
    }, [gymId]);

    const handleCreateTemplate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const templateData = {
            gymId,
            templateName: newTemplateName,
            description: newDescription,
            trainingDays: newTrainingDays,
            structure: newStructure.filter(s => s.grupoMuscular.trim() !== ''),
        };
        if (templateData.structure.length !== newTrainingDays) {
            alert("Por favor, completa los grupos musculares para todos los días.");
            setIsSubmitting(false);
            return;
        }

        const newTemplate = await apiClient.createRoutineTemplate(templateData);
        if (newTemplate) {
            setNewTemplateName('');
            setNewDescription('');
            setNewTrainingDays(4);
            fetchTemplates();
        } else {
            alert('Error al crear la plantilla.');
        }
        setIsSubmitting(false);
    };

    const handleDelete = async () => {
        if (!showDeleteConfirm) return;
        const success = await apiClient.deleteRoutineTemplate(showDeleteConfirm._id);
        if (success) {
            setShowDeleteConfirm(null);
            fetchTemplates();
        } else {
            alert('Error al eliminar la plantilla.');
        }
    };
    
    const handleAIGenerationSuccess = (data: Partial<RoutineTemplate>) => {
        setNewTemplateName(data.templateName || '');
        setNewDescription(data.description || '');
        setNewTrainingDays(data.trainingDays || 4);
        setNewStructure(data.structure || []);
        setMode('manual'); // Switch to manual mode to show the populated form for review
    };

    return (
        <div className="library-container animated-fade-in">
            <div className="main-header" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Plantillas de Rutina</h2>
                 <button onClick={onBack} className="back-button" style={{marginRight: '1rem'}}>Volver</button>
            </div>
            <div className="library-instructions">
                <p>Crea plantillas de rutina para que tus clientes puedan seleccionarlas al registrarse. Puedes crearlas manualmente o usar la IA para generar una estructura base.</p>
            </div>

            <div className="view-toggle" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
                <button className={`view-toggle-button ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>Crear Manual</button>
                <button className={`view-toggle-button ${mode === 'ai' ? 'active' : ''}`} onClick={() => setMode('ai')}>Generar con IA</button>
            </div>

            {mode === 'manual' && (
                <div className="add-gym-container animated-fade-in" style={{padding: 0, marginTop: '2rem'}}>
                    <h3>Crear Nueva Plantilla Manual</h3>
                    <form onSubmit={handleCreateTemplate} className="add-gym-form">
                         <div className="form-group">
                            <label>Nombre de la Plantilla</label>
                            <input type="text" value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} required placeholder="Ej: Hipertrofia 4 Días" />
                        </div>
                         <div className="form-group">
                            <label>Descripción</label>
                            <input type="text" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="(Opcional) Ej: Enfocada en ganancia muscular" />
                        </div>
                         <div className="form-group">
                            <label>Días de Entrenamiento</label>
                            <input type="number" min="1" max="7" value={newTrainingDays} onChange={(e) => setNewTrainingDays(Number(e.target.value))} required />
                        </div>

                        {newStructure.map((day, index) => (
                            <div className="form-group" key={index}>
                                <label>Grupo Muscular {day.dia}</label>
                                <input type="text" value={day.grupoMuscular} onChange={(e) => handleNewStructureChange(index, e.target.value)} required placeholder="Ej: Pecho y Tríceps" />
                            </div>
                        ))}
                        
                        <div className="add-gym-actions" style={{ gridColumn: '1 / -1' }}>
                            <button type="submit" className="cta-button" disabled={isSubmitting}>
                                {isSubmitting ? 'Creando...' : 'Crear Plantilla'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {mode === 'ai' && (
                <AIGeneratedTemplateForm gymId={gymId} onGenerationSuccess={handleAIGenerationSuccess} />
            )}


            {isLoading ? (
                <div className="loading-container"><div className="spinner"></div>Cargando plantillas...</div>
            ) : (
                <div className="template-list-container">
                    <h3>Plantillas Existentes</h3>
                    {templates.length === 0 ? (
                        <p className="placeholder">No has creado ninguna plantilla todavía.</p>
                    ) : (
                        templates.map(template => (
                            <div key={template._id} className="template-list-item">
                                <div className="template-info">
                                    <h4>{template.templateName}</h4>
                                    <p>{template.description || 'Sin descripción'}</p>
                                    <div className="template-structure">
                                        {template.structure.map(day => (
                                            <span key={day.dia} className="structure-tag">{day.dia}: {day.grupoMuscular}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="template-actions">
                                    <button className="action-btn edit" onClick={() => setEditingTemplate(template)}>Editar</button>
                                    <button className="action-btn delete" onClick={() => setShowDeleteConfirm(template)}>Eliminar</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {editingTemplate && (
                <EditTemplateModal 
                    template={editingTemplate} 
                    onClose={() => setEditingTemplate(null)} 
                    onTemplateUpdated={() => {
                        setEditingTemplate(null);
                        fetchTemplates();
                    }} 
                />
            )}

            {showDeleteConfirm && (
                <ConfirmationModal
                    message={`¿Seguro que quieres eliminar la plantilla "${showDeleteConfirm.templateName}"?`}
                    onConfirm={handleDelete}
                    onCancel={() => setShowDeleteConfirm(null)}
                    confirmText="Eliminar"
                    confirmClass="delete"
                />
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
                return <RoutineTemplateManager gymId={gym._id} onBack={() => setAdminView('clients')} />;
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
                     <button className="header-nav-button" onClick={() => setAdminView('requests')}>
                        Bandeja de Entrada
                        {newRequestCount > 0 && <span className="notification-badge">{newRequestCount}</span>}
                    </button>
                    <button className="header-nav-button" onClick={() => setAdminView('library')}>Biblioteca</button>
                    <button className="header-nav-button" onClick={() => setAdminView('templates')}>Plantillas</button>
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
    setClientData: (data: ClientData) => void; 
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
        setProfile(prev => ({ ...prev, [field]: value }));
        setClientData({ ...clientData, profile: { ...profile, [field]: value } }); // Update parent immediately for generators
        if (!isClientOnboarding) {
            setIsModified(true);
            setSaveStatus('idle');
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const success = await apiClient.saveClientData(clientData.dni, { profile });
        if (success) {
            setClientData({ ...clientData, profile });
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
                    <input type="number" min="1" max="7" value={profile.trainingDays} onChange={e => handleChange('trainingDays', e.target.value)} />
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

const RoutineGenerator: React.FC<{ clientData: ClientData; setClientData: (data: ClientData) => void; gymId: string; isClientOnboarding?: boolean }> = ({ clientData, setClientData, gymId, isClientOnboarding = false }) => {
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
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const enabledExercises = Object.entries(exerciseLibrary).reduce((acc, [group, exercises]) => {
                const enabled = exercises.filter(ex => ex.isEnabled).map(ex => ex.name);
                if (enabled.length > 0) {
                    acc[group] = enabled;
                }
                return acc;
            }, {} as Record<string, string[]>);


            const prompt = `
                Por favor, crea un plan de entrenamiento de gimnasio para un cliente con el siguiente perfil:
                - Perfil: ${JSON.stringify(clientData.profile)}
                - Lista de ejercicios disponibles, agrupados por músculo: ${JSON.stringify(enabledExercises)}
                
                ${!isClientOnboarding ? `Instrucciones Adicionales del Entrenador: "${adminInstructions || 'Ninguna'}"` : ''}

                REGLAS CRÍTICAS E INQUEBRANTABLES PARA TU RESPUESTA:
                1.  Tu respuesta DEBE ser únicamente un objeto JSON válido, sin ningún texto adicional, formato markdown, o explicaciones.
                2.  El JSON debe seguir esta estructura exacta:
                    {
                      "planName": "Nombre del Plan (ej: Hipertrofia Intensa)",
                      "totalDurationWeeks": 12, // Duración total en semanas
                      "phases": [
                        {
                          "phaseName": "Nombre de la Fase (ej: Adaptación y Fuerza)",
                          "durationWeeks": 4,
                          "routine": {
                            "dias": [
                              {
                                "dia": "Día 1",
                                "grupoMuscular": "Músculos Principales del Día",
                                "ejercicios": [
                                  {
                                    "nombre": "Nombre del Ejercicio",
                                    "series": "Número de series (ej: '4')",
                                    "repeticiones": "Rango de reps (ej: '8-12')",
                                    "descanso": "Tiempo en segundos (ej: '60s')",
                                    "tecnicaAvanzada": "Nombre de la técnica si aplica (ej: 'Drop Set') o '' si no aplica",
                                  }
                                ],
                                "cardio": "Descripción del cardio (ej: '30 min en cinta a 120-140ppm') o '' si no aplica"
                              }
                            ]
                          }
                        }
                      ]
                    }
                3.  ¡REGLA MÁS IMPORTANTE! Selecciona ejercicios EXCLUSIVAMENTE de la "Lista de ejercicios disponibles" proporcionada. NO inventes, alteres ni incluyas ejercicios que no estén en esa lista. Si un ejercicio no está en la lista, no puedes usarlo. El incumplimiento de esta regla hará que tu respuesta sea rechazada.
                4.  Asigna los días de entrenamiento según el número de 'trainingDays' del perfil. Por ejemplo, si son 4 días, crea 4 planes de día.
                5.  La suma de 'durationWeeks' de todas las fases debe ser igual a 'totalDurationWeeks'.
                6.  Aplica 'tecnicaAvanzada' solo si el perfil del cliente lo permite ('useAdvancedTechniques: "Sí"'). Las opciones válidas son: ${advancedTechniqueOptions.filter(o => o.value).map(o => o.value).join(', ')}. Si no se usa, el valor debe ser un string vacío "".
                7.  Si el perfil incluye 'includeAdaptationPhase: "Sí"', la primera fase debe ser de adaptación.
                8.  Si el perfil incluye 'includeDeloadPhase: "Sí"', una de las fases (preferiblemente intermedia o la última) debe ser una "Fase de Descarga" con una notable reducción de volumen e intensidad (ej. reducir series, usar pesos más ligeros) para facilitar la recuperación.
                9.  Ajusta el número de ejercicios por día según la 'trainingIntensity' del perfil: 'Baja' (5-6 ejercicios), 'Moderada' (6-7), 'Alta' (8-10), y 'Extrema' (11-13, mezclando fuerza, hipertrofia y resistencia).
                10. Presta especial atención a 'bodyFocusArea' y 'muscleFocus' para priorizar esos grupos musculares, siguiendo la lógica de la regla 11.
                11. Diferencia entre 'Full Body' y 'Cuerpo Completo':
                    - Si 'bodyFocusArea' es 'Full Body', cada día de entrenamiento debe incluir ejercicios para el cuerpo entero (tren superior e inferior).
                    - Si 'bodyFocusArea' es 'Cuerpo Completo', crea una rutina dividida (split) que trabaje diferentes grupos musculares en diferentes días, asegurando que todos los músculos principales se entrenen a lo largo de la semana. Por ejemplo: Día 1 Pecho/Tríceps, Día 2 Espalda/Bíceps, etc. Esta es una rutina 'normal' y balanceada.
            `;
            
            const response: GenerateContentResponse = await withRetry(() => 
                ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                })
            );
            const text = response.text;
            
            const jsonString = extractJson(text);
            if (!jsonString) {
                throw new Error("La IA no devolvió un JSON válido.");
            }
            const generatedPlan: Routine = JSON.parse(jsonString);
            
            // Validate and correct any "hallucinated" exercises before saving or displaying.
            const correctedPlan = validateAndCorrectRoutine(generatedPlan, exerciseLibrary);

            setCurrentRoutine(correctedPlan);
            setClientData({ ...clientData, routine: correctedPlan, routineGeneratedDate: new Date().toISOString() });
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
                {!isClientOnboarding && (
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
                )}
                <button className="cta-button" onClick={() => handleGenerate(false)}>
                    Generar Rutina con IA
                </button>
                <p className="text-secondary">Se creará una rutina de entrenamiento basada en el perfil.</p>
            </div>
        );
    }
    
    // Don't show editing UI for client onboarding
     if (isClientOnboarding) {
        return (
             <div className="plan-container">
                <RoutinePlan 
                    routine={currentRoutine} 
                    isEditing={false}
                    onRoutineChange={setCurrentRoutine}
                    exerciseLibrary={exerciseLibrary}
                />
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
                            {exercises.map(ex => (
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

// FIX: Added missing ClientDietView component to display diet plans.
const ClientDietView: React.FC<{ dietPlan: DietPlan }> = ({ dietPlan }) => {
    if (!dietPlan) {
        return <p>No se ha generado un plan de nutrición.</p>;
    }

    return (
        <div className="client-diet-view animated-fade-in">
            <header className="plan-header">
                <h2>{dietPlan.planTitle}</h2>
                <div className="diet-summary-grid">
                    <div className="summary-item">
                        <span>Calorías Totales</span>
                        <strong>{dietPlan.summary.totalCalories} kcal</strong>
                    </div>
                    <div className="summary-item">
                        <span>Proteínas</span>
                        <strong>{dietPlan.summary.macronutrients.proteinGrams} g</strong>
                    </div>
                    <div className="summary-item">
                        <span>Carbohidratos</span>
                        <strong>{dietPlan.summary.macronutrients.carbsGrams} g</strong>
                    </div>
                    <div className="summary-item">
                        <span>Grasas</span>
                        <strong>{dietPlan.summary.macronutrients.fatGrams} g</strong>
                    </div>
                </div>
            </header>

            <div className="meals-container">
                {dietPlan.meals.map((meal, index) => (
                    <div key={index} className="meal-card">
                        <h3>{meal.mealName}</h3>
                        <ul className="food-item-list">
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

            <div className="recommendations-section">
                <h3>Recomendaciones</h3>
                <ul>
                    {dietPlan.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const DietPlanGenerator: React.FC<{ clientData: ClientData; setClientData: (data: ClientData) => void; isClientOnboarding?: boolean }> = ({ clientData, setClientData, isClientOnboarding = false }) => {
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
                
                ${!isClientOnboarding ? `Instrucciones Adicionales del Entrenador: "${adminInstructions || 'Ninguna'}"` : ''}

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
            
            const response: GenerateContentResponse = await withRetry(() => 
                ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                })
            );
            const text = response.text;
            
            const jsonString = extractJson(text);
            if (!jsonString) {
                throw new Error("La IA no devolvió un JSON válido para el plan de nutrición.");
            }
            const generatedPlan: DietPlan = JSON.parse(jsonString);

            const newDietPlans = [...(clientData.dietPlans || [null, null])];
            newDietPlans[planIndex] = generatedPlan;
            
            const dataToUpdate = { ...clientData, dietPlans: newDietPlans };
            setClientData(dataToUpdate);

            if (!isClientOnboarding) {
                 await apiClient.saveClientData(clientData.dni, { dietPlans: newDietPlans });
            }
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
                    {!isClientOnboarding && (
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
                    )}
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

                {!isClientOnboarding && (
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
                )}
            </div>
        );
    };

    return (
        <div className="multi-plan-container">
             {!isClientOnboarding && (
                <div className="view-toggle" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
                    <button onClick={() => setActivePlanIndex(0)} className={`view-toggle-button ${activePlanIndex === 0 ? 'active' : ''}`}>Plan 1</button>
                    <button onClick={() => setActivePlanIndex(1)} className={`view-toggle-button ${activePlanIndex === 1 ? 'active' : ''}`}>Plan 2</button>
                </div>
            )}
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
// FIX: Added missing components for the client view to function.
const AIChatModal: React.FC<{
    clientData: ClientData;
    onClose: () => void;
    onUsageUpdate: () => void;
}> = ({ clientData, onClose, onUsageUpdate }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [history, setHistory] = useState<{ role: 'user' | 'model'; text: string }[]>([]);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const systemInstruction = `
            Eres Scorpion AI, un asistente de fitness experto. 
            Tu propósito es responder preguntas del cliente sobre su plan de entrenamiento y nutrición.
            Sé conciso, motivador y basá tus respuestas en la información del cliente.
            No des consejos médicos.
            El perfil del cliente es: ${JSON.stringify(clientData.profile)}.
            Su rutina es: ${JSON.stringify(clientData.routine)}.
            Su plan de dieta es: ${JSON.stringify(clientData.dietPlans)}.
        `;
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chatSession = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: systemInstruction,
            },
        });
        setChat(chatSession);
    }, [clientData]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [history]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !chat || isLoading) return;

        const userMessage = message;
        setMessage('');
        setHistory(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsLoading(true);

        try {
            const result = await chat.sendMessage({ message: userMessage });
            const responseText = result.text;
            setHistory(prev => [...prev, { role: 'model', text: responseText }]);
            // @ts-ignore
            await apiClient.saveClientData(clientData.dni, { action: 'increment_ai_usage' });
            onUsageUpdate();

        } catch (error) {
            console.error(error);
            setHistory(prev => [...prev, { role: 'model', text: 'Lo siento, no pude procesar tu solicitud en este momento.' }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const remainingQuestions = (clientData.dailyQuestionLimit || 0) - (clientData.aiUsage?.count || 0);

    return (
         <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content chat-modal" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>&times;</button>
                <h3>Consultar a Scorpion AI</h3>
                <p>Preguntas restantes hoy: <strong>{remainingQuestions > 0 ? remainingQuestions : 0}</strong></p>
                <div className="chat-history" ref={chatContainerRef}>
                    {history.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.role}`}>
                            <p>{msg.text}</p>
                        </div>
                    ))}
                    {isLoading && <div className="chat-message model"><span className="spinner small"></span></div>}
                </div>
                <form onSubmit={handleSendMessage} className="chat-input-form">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={remainingQuestions > 0 ? "Escribe tu consulta..." : "Límite de preguntas alcanzado."}
                        disabled={isLoading || remainingQuestions <= 0}
                    />
                    <button type="submit" disabled={isLoading || !message.trim() || remainingQuestions <= 0}>Enviar</button>
                </form>
            </div>
        </div>
    );
};

const ClientMessageCenter: React.FC<{ 
    clientData: ClientData;
    initialRequests: TrainerRequest[];
    onNewRequest: () => void;
}> = ({ clientData, initialRequests, onNewRequest }) => {
    const [requests, setRequests] = useState(initialRequests);
    const [showForm, setShowForm] = useState(false);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        const success = await apiClient.createRequest({
            clientId: clientData.dni,
            clientName: clientData.profile.name,
            gymId: clientData.gymId,
            subject,
            message,
        });
        if (success) {
            setShowForm(false);
            setSubject('');
            setMessage('');
            onNewRequest(); // This will trigger a refetch in parent
        } else {
            alert("No se pudo enviar tu mensaje. Inténtalo de nuevo.");
        }
        setIsSending(false);
    };

    const sortedRequests = useMemo(() => {
        return [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [requests]);
    
    useEffect(() => {
        setRequests(initialRequests);
    }, [initialRequests]);
    
    return (
        <div className="request-list animated-fade-in">
            <button className="cta-button" onClick={() => setShowForm(!showForm)}>
                {showForm ? 'Cancelar' : 'Enviar Mensaje al Entrenador'}
            </button>
            
            {showForm && (
                <form onSubmit={handleSubmit} className="add-gym-form" style={{ marginTop: '2rem' }}>
                    <div className="form-group">
                        <label>Asunto</label>
                        <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{gridColumn: '1 / -1'}}>
                        <label>Mensaje</label>
                        <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} required />
                    </div>
                     <div className="add-gym-actions" style={{gridColumn: '1 / -1'}}>
                        <button type="submit" className="cta-button" disabled={isSending}>
                            {isSending ? 'Enviando...' : 'Enviar Mensaje'}
                        </button>
                    </div>
                </form>
            )}

            <h3 style={{marginTop: '2rem'}}>Historial de Mensajes</h3>
             {sortedRequests.length === 0 ? (
                <p className="placeholder">No has enviado ningún mensaje.</p>
             ) : (
                sortedRequests.map(req => (
                    <div key={req._id} className={`request-card status-${req.status}`}>
                        <div className="request-card-header">
                            <h4>{req.subject}</h4>
                            <span className="request-date">{new Date(req.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="request-message">{req.message}</p>
                    </div>
                ))
            )}
        </div>
    );
};

const ClientDashboardView: React.FC<{ 
    clientData: ClientData;
    gym: Gym;
    onDataUpdate: () => void;
}> = ({ clientData, gym, onDataUpdate }) => {
    const [activeTab, setActiveTab] = useState<'routine' | 'diet' | 'progress' | 'messages'>('routine');
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({});
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
    const [requests, setRequests] = useState<TrainerRequest[]>([]);
    const [showVideoModal, setShowVideoModal] = useState<string | null>(null);

    useEffect(() => {
        const fetchExtraData = async () => {
            setIsLoadingLibrary(true);
            const [library, clientRequests] = await Promise.all([
                apiClient.getExerciseLibrary(clientData.gymId),
                apiClient.getRequestsByClient(clientData.dni)
            ]);
            setExerciseLibrary(library);
            setRequests(clientRequests);
            setIsLoadingLibrary(false);
        };
        fetchExtraData();

        if (clientData.planType === 'nutrition' && activeTab === 'routine') {
            setActiveTab('diet');
        }
    }, [clientData]);
    
    const findExerciseVideoUrl = (exerciseName: string): string | undefined => {
        for (const group in exerciseLibrary) {
            const exercise = exerciseLibrary[group].find(ex => ex.name === exerciseName);
            if (exercise && exercise.videoUrl) {
                return exercise.videoUrl;
            }
        }
        return undefined;
    };
    
    const handleAddProgress = async (exerciseName: string, weight: number, repetitions: number) => {
        const newEntry: ProgressLogEntry = {
            date: new Date().toISOString(),
            weight,
            repetitions,
        };
        
        const newProgressLog = { ...(clientData.progressLog || {}) };
        if (!newProgressLog[exerciseName]) {
            newProgressLog[exerciseName] = [];
        }
        newProgressLog[exerciseName].push(newEntry);
        
        const success = await apiClient.saveClientData(clientData.dni, { progressLog: newProgressLog });
        if (success) {
            onDataUpdate();
        } else {
            alert("No se pudo guardar el progreso.");
        }
    };
    
    const ClientExerciseView: React.FC<{ 
        exercise: Exercise;
    }> = ({ exercise }) => {
        const [showLogForm, setShowLogForm] = useState(false);
        const [weight, setWeight] = useState('');
        const [reps, setReps] = useState('');
        const [isSaving, setIsSaving] = useState(false);
        
        const videoUrl = findExerciseVideoUrl(exercise.nombre);
        
        const handleLogSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            setIsSaving(true);
            await handleAddProgress(exercise.nombre, Number(weight), Number(reps));
            setIsSaving(false);
            setShowLogForm(false);
            setWeight('');
            setReps('');
        };
        
        return (
            <div className="client-exercise-view">
                 <ExerciseView exercise={exercise} onPlayVideo={setShowVideoModal} videoUrl={videoUrl} />
                 <button className="log-progress-btn" onClick={() => setShowLogForm(!showLogForm)}>
                    {showLogForm ? 'Cancelar' : 'Registrar Progreso'}
                 </button>
                 {showLogForm && (
                    <form onSubmit={handleLogSubmit} className="log-progress-form animated-fade-in">
                        <input type="number" placeholder="Peso (kg)" value={weight} onChange={e => setWeight(e.target.value)} required />
                        <input type="number" placeholder="Reps" value={reps} onChange={e => setReps(e.target.value)} required />
                        <button type="submit" disabled={isSaving}>{isSaving ? '...' : 'Guardar'}</button>
                    </form>
                 )}
            </div>
        );
    };

    const planType = clientData.planType || 'full';

    const renderTabContent = () => {
        if (isLoadingLibrary) {
            return <div className="loading-container"><div className="spinner"></div></div>;
        }
        switch (activeTab) {
            case 'routine':
                return clientData.routine ? (
                    <div className="client-routine-view">
                        {clientData.routine.phases.map((phase, pIdx) => (
                            <div key={pIdx} className="client-phase-section">
                                <h3>{phase.phaseName} ({phase.durationWeeks} semanas)</h3>
                                {phase.routine.dias.map((day, dIdx) => (
                                    <div key={dIdx} className="client-day-card">
                                        <h4>{day.dia}: {day.grupoMuscular}</h4>
                                        <ul className="exercise-list">
                                            {day.ejercicios.map((ex, eIdx) => (
                                                <li key={eIdx} className="exercise-item">
                                                    <ClientExerciseView exercise={ex} />
                                                </li>
                                            ))}
                                        </ul>
                                        {day.cardio && <p className="cardio-note"><strong>Cardio:</strong> {day.cardio}</p>}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ) : <div className="placeholder">No tienes una rutina asignada.</div>;
            case 'diet':
                return clientData.dietPlans?.[0] ? 
                    <ClientDietView dietPlan={clientData.dietPlans[0]} /> : 
                    <div className="placeholder">No tienes un plan de nutrición asignado.</div>;
            case 'progress':
                return <ProgressView clientData={clientData} onDataUpdate={onDataUpdate} />;
            case 'messages':
                return <ClientMessageCenter clientData={clientData} initialRequests={requests} onNewRequest={onDataUpdate} />;
            default: return null;
        }
    };
    
    return (
        <div className="client-dashboard-content">
            <nav className="main-tabs-nav">
                {(planType === 'full' || planType === 'routine') &&
                    <button className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>Rutina</button>
                }
                {(planType === 'full' || planType === 'nutrition') &&
                    <button className={`main-tab-button ${activeTab === 'diet' ? 'active' : ''}`} onClick={() => setActiveTab('diet')}>Nutrición</button>
                }
                <button className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>Progreso</button>
                <button className={`main-tab-button ${activeTab === 'messages' ? 'active' : ''}`} onClick={() => setActiveTab('messages')}>Mensajes</button>
            </nav>
            <div className="results-section">
                {renderTabContent()}
            </div>
             {showVideoModal && <VideoPlayerModal videoUrl={showVideoModal} onClose={() => setShowVideoModal(null)} />}
        </div>
    );
};

const ClientOnboardingView: React.FC<{
    clientData: ClientData;
    setClientData: (data: ClientData) => void;
    onPlanGenerated: () => void;
    gymId: string;
}> = ({ clientData, setClientData, onPlanGenerated, gymId }) => {
    const [step, setStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleProfileSave = async () => {
        setIsSaving(true);
        setError('');
        const success = await apiClient.saveClientData(clientData.dni, { profile: clientData.profile });
        if (success) {
            setStep(2);
        } else {
            setError('No se pudo guardar tu perfil. Inténtalo de nuevo.');
        }
        setIsSaving(false);
    };
    
    const handleFinalizeOnboarding = async () => {
        setIsSaving(true);
        const success = await apiClient.saveClientData(clientData.dni, { 
            routine: clientData.routine,
            dietPlans: clientData.dietPlans,
            planStatus: 'active',
            termsAccepted: true,
            routineGeneratedDate: new Date().toISOString()
        });
        if (success) {
            onPlanGenerated();
        } else {
             setError('No se pudo finalizar la configuración. Por favor, intenta de nuevo.');
        }
        setIsSaving(false);
    };

    const planType = clientData.planType || 'full';
    const routineDone = !!clientData.routine;
    const dietDone = !!clientData.dietPlans?.[0];

    const canProceedToFinalize = 
        (planType === 'full' && routineDone && dietDone) ||
        (planType === 'routine' && routineDone) ||
        (planType === 'nutrition' && dietDone);
        
    return (
        <div className="onboarding-container">
            {step === 1 && (
                <div className="onboarding-step animated-fade-in">
                    <h2>¡Bienvenido/a! Primero, completa tu perfil</h2>
                    <p>Esta información es crucial para que la IA cree un plan adaptado a vos.</p>
                    <div className="profile-onboarding-wrapper">
                         <ProfileEditor clientData={clientData} setClientData={setClientData} isClientOnboarding={true} />
                    </div>
                    <button onClick={handleProfileSave} disabled={isSaving} className="cta-button" style={{marginTop: '2rem'}}>
                        {isSaving ? 'Guardando...' : 'Guardar y Continuar'}
                    </button>
                    {error && <p className="error-text">{error}</p>}
                </div>
            )}
            {step === 2 && (
                <div className="onboarding-step animated-fade-in">
                     <h2>Paso 2: Generá tu plan inicial</h2>
                     <p>La IA utilizará tu perfil para crear un plan de entrenamiento y/o nutrición personalizado. Podrás ajustarlo más tarde si es necesario.</p>
                     
                     {(planType === 'full' || planType === 'routine') && (
                         <div className="generator-wrapper">
                            <h3>Tu Rutina</h3>
                             {clientData.routine ? (
                                 <div className="plan-generated-success">
                                    <p>✅ ¡Tu rutina ha sido generada!</p>
                                    <RoutinePlan routine={clientData.routine} isEditing={false} onRoutineChange={() => {}} exerciseLibrary={{}}/>
                                 </div>
                             ) : (
                                 <RoutineGenerator clientData={clientData} setClientData={setClientData} gymId={gymId} isClientOnboarding={true} />
                             )}
                         </div>
                     )}
                     
                     {(planType === 'full' || planType === 'nutrition') && (
                         <div className="generator-wrapper">
                             <h3>Tu Plan de Nutrición</h3>
                              {clientData.dietPlans && clientData.dietPlans[0] ? (
                                <div className="plan-generated-success">
                                    <p>✅ ¡Tu plan de nutrición ha sido generado!</p>
                                    <ClientDietView dietPlan={clientData.dietPlans[0]} />
                                </div>
                             ) : (
                                 <DietPlanGenerator clientData={clientData} setClientData={setClientData} isClientOnboarding={true} />
                             )}
                         </div>
                     )}
                     
                     <button onClick={handleFinalizeOnboarding} disabled={isSaving || !canProceedToFinalize} className="cta-button" style={{marginTop: '2rem'}}>
                        {isSaving ? 'Finalizando...' : '¡Comenzar a Entrenar!'}
                    </button>
                    {!canProceedToFinalize && <p className="text-secondary" style={{textAlign: 'center', marginTop: '1rem'}}>Por favor, genera todas las partes de tu plan para continuar.</p>}
                    {error && <p className="error-text">{error}</p>}
                </div>
            )}
        </div>
    );
};

const ClientView: React.FC<{ dni: string; onLogout: () => void }> = ({ dni, onLogout }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showChat, setShowChat] = useState(false);
    const [gym, setGym] = useState<Gym | null>(null);

    const fetchClientData = async (showLoading = true) => {
        if (showLoading) setIsLoading(true);
        const data = await apiClient.getClientData(dni);
        setClientData(data);
        if (data?.gymId) {
            const allGyms = await apiClient.getGyms();
            setGym(allGyms.find(g => g._id === data.gymId) || null);
        }
        if (showLoading) setIsLoading(false);
    };

    useEffect(() => {
        fetchClientData();
    }, [dni]);

    const isPlanExpired = () => {
        if (!clientData?.routineGeneratedDate || !clientData?.routine?.totalDurationWeeks) return false;
        const generatedDate = new Date(clientData.routineGeneratedDate);
        const expirationDate = new Date(generatedDate);
        expirationDate.setDate(generatedDate.getDate() + (clientData.routine.totalDurationWeeks * 7));
        return new Date() > expirationDate;
    };
    
    const handlePlanGenerated = () => {
        fetchClientData(false);
    };

    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div>Cargando tu plan...</div>;
    }

    if (!clientData || !gym) {
        return <div className="error-container">No se pudieron cargar tus datos. Por favor, contacta a tu entrenador.</div>;
    }
    
    const needsOnboarding = clientData.planStatus === 'pending';
    const planExpired = isPlanExpired();
    const planIsActive = clientData.planStatus === 'active' && !planExpired;

    const renderContent = () => {
        if (needsOnboarding) {
            return <ClientOnboardingView clientData={clientData} setClientData={setClientData} onPlanGenerated={handlePlanGenerated} gymId={gym!._id} />;
        }
        if (planExpired) {
             return (
                <div className="placeholder-action generation-container" style={{padding: '2rem'}}>
                    <h2>Tu Plan Ha Expirado</h2>
                    <p>Tu plan de entrenamiento ha finalizado. Por favor, contacta a tu entrenador para solicitar uno nuevo.</p>
                </div>
            );
        }
        if (planIsActive) {
            return <ClientDashboardView clientData={clientData} gym={gym} onDataUpdate={() => fetchClientData(false)} />;
        }
        return <div className="placeholder">Por favor, contacta a tu entrenador para que te asigne un plan.</div>;
    };


    return (
        <div className="client-dashboard-view">
             <div className="main-header">
                <div className="header-title-wrapper">
                    {gym.logoSvg && <div className="app-logo"><SvgImage svgString={gym.logoSvg} altText={`${gym.name} logo`} /></div>}
                     <div>
                        <h1>{gym.name}</h1>
                        <p>Bienvenido/a, {clientData.profile.name || 'Cliente'}</p>
                    </div>
                </div>
                 <div className="admin-header-nav">
                    {planIsActive && clientData.dailyQuestionLimit && clientData.dailyQuestionLimit > 0 && (
                        <button className="header-nav-button chat-button" onClick={() => setShowChat(true)}>
                            Consultar a IA
                        </button>
                    )}
                    <button onClick={onLogout} className="logout-button admin-logout">Cerrar Sesión</button>
                 </div>
            </div>
            <main className="client-main-content">
                {renderContent()}
            </main>
            {showChat && (
                <AIChatModal 
                    clientData={clientData}
                    onClose={() => setShowChat(false)}
                    onUsageUpdate={() => fetchClientData(false)}
                />
            )}
        </div>
    );
};


// --- Main App Initialization ---
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );
}
