


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
const calculateTargetWeight = (height: number): string => {
    if (!height) return 'N/A';
    const heightInMeters = height / 100;
    const lowerBound = 18.5 * (heightInMeters * heightInMeters);
    const upperBound = 24.9 * (heightInMeters * heightInMeters);
    return `${lowerBound.toFixed(1)}kg - ${upperBound.toFixed(1)}kg`;
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

/**
 * Main application component that handles routing and state.
 */
const App: React.FC = () => {
    const [view, setView] = useState<'landing' | 'login' | 'adminDashboard' | 'clientDashboard' | 'clientView' | 'superAdminDashboard'>('landing');
    const [currentClientDni, setCurrentClientDni] = useState<string | null>(null);
    const [currentGym, setCurrentGym] = useState<Gym | null>(null);
    const [impersonatedGym, setImpersonatedGym] = useState<Gym | null>(null);
    const [loginError, setLoginError] = useState<string>('');

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
        if (type === 'client') {
            const isValid = await apiClient.loginClient(id, code!);
            if (isValid) {
                sessionStorage.setItem('loggedInClientDni', id);
                sessionStorage.setItem('userType', 'client');
                setCurrentClientDni(id);
                setView('clientView');
            } else {
                setLoginError('DNI o código de acceso incorrecto.');
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

    const renderView = () => {
        switch (view) {
            case 'landing':
                return <LandingPage onIngresar={() => setView('login')} />;
            case 'login':
                return <LoginPage onLogin={handleLogin} error={loginError} onBack={() => setView('landing')} />;
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
                return <LoginPage onLogin={handleLogin} error={loginError} onBack={() => setView('landing')} />;
        }
    };

    return <>{renderView()}</>;
};

// --- Landing & Login Views ---

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

const LoginPage: React.FC<{ onLogin: (type: 'client' | 'gym', id: string, code?: string) => void; error: string; onBack: () => void; }> = ({ onLogin, error, onBack }) => {
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
                <p>{loginType === 'client' ? 'Ingresa tu DNI y código de acceso.' : 'Ingresa tu usuario y contraseña.'}</p>
                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        placeholder={loginType === 'client' ? 'DNI' : 'Usuario'}
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        required
                    />
                    <input
                        type={loginType === 'client' ? 'text' : 'password'}
                        placeholder={loginType === 'client' ? 'Código de Acceso' : 'Contraseña'}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        required
                    />
                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button">Ingresar</button>
                </form>
            </div>
             <button onClick={onBack} className="back-button simple" style={{ marginTop: '2rem' }}>Volver</button>
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
                <button className="close-button" onClick={onClose} style={{top: '1rem', right: '1rem'}}>&times;</button>
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
    if (requests.length === 0) return null;
    
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
    
    // Sort requests by date, newest first
    const sortedRequests = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const newRequests = sortedRequests.filter(r => r.status === 'new');
    const readRequests = sortedRequests.filter(r => r.status === 'read');
    const resolvedRequests = sortedRequests.filter(r => r.status === 'resolved');

    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div></div>;
    }
    
    return (
        <div className="requests-view animated-fade-in">
             <h2>Bandeja de Entrada de Solicitudes</h2>
             {requests.length === 0 ? (
                <div className="placeholder" style={{marginTop: '2rem'}}>No hay solicitudes pendientes.</div>
             ) : (
                <>
                    <RequestSection title="Nuevas Solicitudes" requests={newRequests} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />
                    <RequestSection title="Solicitudes Leídas" requests={readRequests} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />
                    <RequestSection title="Solicitudes Resueltas" requests={resolvedRequests} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} />
                </>
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
    const [adminView, setAdminView] = useState<'clients' | 'library' | 'requests'>('clients');
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
                                        <p className="client-card-access-code">Acceso: <strong>{client.accessCode}</strong></p>
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
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'routine' | 'diet' | 'progress'>(gym.planType === 'nutrition' ? 'diet' : 'routine');

     const fetchClientData = async () => {
        setIsLoading(true);
        const data = await apiClient.getClientData(dni);
        setClientData(data);
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
    
    const planType = gym.planType || 'full';


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
                    </nav>
                    <div className="results-section">
                       {activeTab === 'routine' && <RoutineGenerator clientData={clientData} setClientData={setClientData} gymId={gym._id} />}
                       {activeTab === 'diet' && <DietPlanGenerator clientData={clientData} setClientData={setClientData} />}
                       {activeTab === 'progress' && <ProgressView clientData={clientData} onDataUpdate={fetchClientData} />}
                    </div>
                </main>
            </div>
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

    const muscleGroups = {
        superior: ['General', 'Pecho', 'Espalda', 'Hombros', 'Brazos (Bíceps y Tríceps)'],
        inferior: ['General', 'Cuádriceps', 'Femorales e Isquiotibiales', 'Glúteos', 'Aductores y Abductores', 'Gemelos y Sóleos']
    };

    useEffect(() => {
        setProfile(clientData.profile);
    }, [clientData.profile]);

    // Reset muscle focus when body focus changes
    useEffect(() => {
        if (profile.bodyFocusArea === 'Full Body') {
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
                        <option value="Full Body">Full Body</option>
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
                    <div className="access-code-display">
                        <span>Código de Acceso del Cliente</span>
                        <strong>{clientData.accessCode}</strong>
                    </div>
                     <button onClick={handleEnableGeneration} className="cta-button secondary enable-generation-button">
                        Habilitar Nueva Generación
                    </button>
                 </>
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

                REGLAS ESTRICTAS PARA TU RESPUESTA:
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
                3.  Selecciona ejercicios EXCLUSIVAMENTE de la lista de ejercicios disponibles proporcionada. No inventes ni incluyas ejercicios que no estén en esa lista.
                4.  Asigna los días de entrenamiento según el número de 'trainingDays' del perfil. Por ejemplo, si son 4 días, crea 4 planes de día.
                5.  La suma de 'durationWeeks' de todas las fases debe ser igual a 'totalDurationWeeks'.
                6.  Aplica 'tecnicaAvanzada' solo si el perfil del cliente lo permite ('useAdvancedTechniques: "Sí"'). Las opciones válidas son: ${advancedTechniqueOptions.filter(o => o.value).map(o => o.value).join(', ')}. Si no se usa, el valor debe ser un string vacío "".
                7.  Si el perfil incluye 'includeAdaptationPhase: "Sí"', la primera fase debe ser de adaptación.
                8.  Si el perfil incluye 'includeDeloadPhase: "Sí"', una de las fases (preferiblemente intermedia o la última) debe ser una "Fase de Descarga" con una notable reducción de volumen e intensidad (ej. reducir series, usar pesos más ligeros) para facilitar la recuperación.
                9.  Ajusta el número de ejercicios por día según la 'trainingIntensity' del perfil: 'Baja' (5-6 ejercicios), 'Moderada' (6-7), 'Alta' (8-10), y 'Extrema' (11-13, mezclando fuerza, hipertrofia y resistencia).
                10. Presta especial atención a 'bodyFocusArea' y 'muscleFocus' para priorizar esos grupos musculares.
            `;
            
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            const text = response.text;
            
            const jsonString = extractJson(text);
            if (!jsonString) {
                throw new Error("La IA no devolvió un JSON válido.");
            }
            const generatedPlan: Routine = JSON.parse(jsonString);

            setCurrentRoutine(generatedPlan);
            setClientData({ ...clientData, routine: generatedPlan, routineGeneratedDate: new Date().toISOString() });
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
                           <ExerciseView exercise={exercise} />
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

const ExerciseView: React.FC<{ exercise: Exercise }> = ({ exercise }) => {
     const techOption = advancedTechniqueOptions.find(opt => opt.value === exercise.tecnicaAvanzada);
    return (
         <>
            <div className="exercise-name-wrapper">
                <span className="exercise-name">{exercise.nombre}</span>
                 {exercise.youtubeLink && (
                    <a href={exercise.youtubeLink} target="_blank" rel="noopener noreferrer" className="video-link" aria-label="Ver video del ejercicio">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10,15.5V8.5L16,12M20,4.4C19.4,4.2 15.7,4 12,4C8.3,4 4.6,4.19 4,4.38C2.44,4.9 2,8.4 2,12C2,15.59 2.44,19.1 4,19.61C4.6,19.81 8.3,20 12,20C15.7,20 19.4,19.81 20,19.61C21.56,19.1 22,15.59 22,12C22,8.4 21.56,4.9 20,4.4Z"></path></svg>
                    </a>
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
            
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
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


// --- Client View ---

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
        const expirationDate = new Date(generatedDate.setDate(generatedDate.getDate() + clientData.routine.totalDurationWeeks * 7));
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
        return <ClientOnboardingView initialClientData={clientData} onOnboardingComplete={fetchClientData} onLogout={onLogout} />;
    }

    return (
        <div className="client-view-container">
            {showChat ? (
                <ChatAssistant 
                    clientData={clientData} 
                    setClientData={setClientData} 
                    onClose={() => setShowChat(false)} 
                />
            ) : (
                <>
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
                </>
            )}
        </div>
    );
};

// --- AI Generation Logic (for Onboarding) ---
const generateRoutineForClient = async (clientData: ClientData, gymId: string): Promise<Routine> => {
    const exerciseLibrary = await apiClient.getExerciseLibrary(gymId);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const enabledExercises = Object.entries(exerciseLibrary).reduce((acc, [group, exercises]) => {
        const enabled = exercises.filter(ex => ex.isEnabled).map(ex => ex.name);
        if (enabled.length > 0) acc[group] = enabled;
        return acc;
    }, {} as Record<string, string[]>);

    const prompt = `
        Por favor, crea un plan de entrenamiento de gimnasio para un cliente con el siguiente perfil:
        - Perfil: ${JSON.stringify(clientData.profile)}
        - Lista de ejercicios disponibles, agrupados por músculo: ${JSON.stringify(enabledExercises)}
        REGLAS ESTRICTAS PARA TU RESPUESTA:
        1. Tu respuesta DEBE ser únicamente un objeto JSON válido, sin ningún texto adicional, formato markdown, o explicaciones.
        2. El JSON debe seguir esta estructura exacta: {"planName": "Nombre", "totalDurationWeeks": 12, "phases": [{"phaseName": "Nombre Fase", "durationWeeks": 4, "routine": {"dias": [{"dia": "Día 1", "grupoMuscular": "Músculos", "ejercicios": [{"nombre": "Ejercicio", "series": "4", "repeticiones": "8-12", "descanso": "60s", "tecnicaAvanzada": ""}], "cardio": "Desc Cardio"}]}}]}
        3. Selecciona ejercicios EXCLUSIVAMENTE de la lista de ejercicios disponibles.
        4. Asigna los días de entrenamiento según 'trainingDays'.
        5. La suma de 'durationWeeks' de las fases debe ser igual a 'totalDurationWeeks'.
        6. Aplica 'tecnicaAvanzada' solo si 'useAdvancedTechniques: "Sí"'. Opciones válidas: ${advancedTechniqueOptions.filter(o => o.value).map(o => o.value).join(', ')}. Si no se usa, debe ser "".
        7. Incluye fases de adaptación y descarga si el perfil lo indica.
        8. Ajusta el número de ejercicios según la 'trainingIntensity'.
        9. Prioriza 'bodyFocusArea' y 'muscleFocus'.
    `;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const jsonString = extractJson(response.text);
    if (!jsonString) throw new Error("La IA no devolvió un JSON de rutina válido.");
    return JSON.parse(jsonString);
};

const generateDietForClient = async (clientData: ClientData): Promise<DietPlan> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `
        Por favor, crea un plan de nutrición para un cliente con el siguiente perfil:
        - Perfil: ${JSON.stringify(clientData.profile)}
        REGLAS ESTRICTAS PARA TU RESPUESTA:
        1. **Idioma:** Tu respuesta DEBE estar en español de Argentina.
        2. Tu respuesta DEBE ser únicamente un objeto JSON válido, sin texto adicional, markdown o explicaciones.
        3. Calcula calorías y macros basándote en el perfil completo del cliente.
        4. El JSON debe seguir esta estructura exacta: {"planTitle": "Título", "summary": {"totalCalories": 2500, "macronutrients": {"proteinGrams": 180, "carbsGrams": 300, "fatGrams": 60}}, "meals": [{"mealName": "Desayuno", "foodItems": [{"food": "Avena", "amount": "80g"}]}], "recommendations": ["Beber 2-3 litros de agua."]}
        5. Distribuye las calorías en 4-6 comidas.
        6. Usa alimentos comunes en Argentina.
    `;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    const jsonString = extractJson(response.text);
    if (!jsonString) throw new Error("La IA no devolvió un JSON de dieta válido.");
    return JSON.parse(jsonString);
};


type GenerationStatus = 'pending' | 'loading' | 'done' | 'error';

const ClientOnboardingView: React.FC<{
    initialClientData: ClientData;
    onOnboardingComplete: () => void;
    onLogout: () => void;
}> = ({ initialClientData, onOnboardingComplete, onLogout }) => {
    const [step, setStep] = useState(initialClientData.termsAccepted ? 'profile' : 'terms');
    const [clientData, setClientData] = useState<ClientData>(initialClientData);
    const [isSaving, setIsSaving] = useState(false);
    
    const [generationState, setGenerationState] = useState<'idle' | 'generating' | 'success' | 'error'>('idle');
    const [generationProgress, setGenerationProgress] = useState({
        routine: 'pending' as GenerationStatus,
        diet1: 'pending' as GenerationStatus,
        diet2: 'pending' as GenerationStatus,
    });
    const [generationError, setGenerationError] = useState('');
    const planType = clientData.planType || 'full';

    const handleAcceptTerms = async () => {
        const success = await apiClient.saveClientData(clientData.dni, { termsAccepted: true });
        if (success) {
            setClientData({ ...clientData, termsAccepted: true });
            setStep('profile');
        } else {
            alert("No se pudieron guardar los términos. Por favor, intente de nuevo.");
        }
    };
    
    const handleGenerateFullPlan = async () => {
        setGenerationState('generating');
        setGenerationError('');
        setGenerationProgress({ routine: 'pending', diet1: 'pending', diet2: 'pending' });

        try {
            if (planType === 'full' || planType === 'routine') {
                setGenerationProgress(prev => ({ ...prev, routine: 'loading' }));
                const routine = await generateRoutineForClient(clientData, clientData.gymId);
                setClientData(prev => ({ ...prev, routine }));
                setGenerationProgress(prev => ({ ...prev, routine: 'done' }));
            }

            if (planType === 'full' || planType === 'nutrition') {
                setGenerationProgress(prev => ({ ...prev, diet1: 'loading' }));
                const diet1 = await generateDietForClient(clientData);
                setClientData(prev => ({ ...prev, dietPlans: [diet1, prev.dietPlans?.[1] ?? null] }));
                setGenerationProgress(prev => ({ ...prev, diet1: 'done' }));
                
                setGenerationProgress(prev => ({ ...prev, diet2: 'loading' }));
                const diet2 = await generateDietForClient(clientData);
                setClientData(prev => ({ ...prev, dietPlans: [prev.dietPlans?.[0] ?? null, diet2] }));
                setGenerationProgress(prev => ({ ...prev, diet2: 'done' }));
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
        if (generationState !== 'success') {
            alert("Por favor, genera tu plan completo antes de comenzar.");
            return;
        }
        setIsSaving(true);
        const finalData: Partial<ClientData> = {
            profile: clientData.profile,
            routine: clientData.routine,
            dietPlans: clientData.dietPlans,
            routineGeneratedDate: new Date().toISOString(),
            planStatus: 'active',
        };

        const success = await apiClient.saveClientData(clientData.dni, finalData);
        if (success) {
            onOnboardingComplete();
        } else {
            alert("Ocurrió un error al guardar tu plan. Por favor, intenta de nuevo.");
        }
        setIsSaving(false);
    };

    if (step === 'terms') {
        return <AgreementView onAccept={handleAcceptTerms} onLogout={onLogout} />;
    }

    return (
        <div className="onboarding-container">
            <header className="onboarding-header">
                <h1>¡Bienvenido a ScorpionGYM AI!</h1>
                <p>Vamos a configurar tu primer plan.</p>
            </header>
            
            <div className="onboarding-section">
                <h2>Paso 1: Completa tu Perfil</h2>
                <ProfileEditor clientData={clientData} setClientData={setClientData} isClientOnboarding />
            </div>
            
            <div className="onboarding-section">
                <h2>Paso 2: Crea tu Plan Integral</h2>
                 {generationState === 'idle' && (
                     <div className="placeholder-action">
                        <p>Cuando tu perfil esté listo, haz clic abajo para que la IA cree tu rutina y planes de nutrición personalizados.</p>
                        <button className="cta-button" onClick={handleGenerateFullPlan}>
                            Generar Mi Plan Completo
                        </button>
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
                    disabled={isSaving || generationState !== 'success'}
                >
                    {isSaving ? "Guardando..." : "Guardar y Empezar mi Plan"}
                </button>
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

// Fix: Add missing RequestModal component definition.
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
                <button className="close-button" onClick={onClose} style={{top: '1rem', right: '1rem'}}>&times;</button>
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

const ClientPortalTabs: React.FC<{ clientData: ClientData, onDataUpdate: () => void }> = ({ clientData, onDataUpdate }) => {
    const planType = clientData.planType || 'full';
    const [activeTab, setActiveTab] = useState<'routine' | 'diet' | 'progress' | 'profile'>(planType === 'nutrition' ? 'diet' : 'routine');
    const [showRequestModal, setShowRequestModal] = useState(false);

    const renderContent = () => {
        switch(activeTab) {
            case 'routine':
                return clientData.routine 
                    ? <ExerciseTracker clientData={clientData} onProgressLogged={onDataUpdate} onRequestChange={() => setShowRequestModal(true)} /> 
                    : <div className="placeholder">Aún no tienes una rutina asignada.</div>;
            case 'diet':
                return clientData.dietPlans && (clientData.dietPlans[0] || clientData.dietPlans[1])
                    ? <ClientDietTabsView dietPlans={clientData.dietPlans} /> 
                    : <div className="placeholder">Aún no tienes un plan de nutrición asignado.</div>;
            case 'progress':
                return <ProgressView clientData={clientData} onDataUpdate={onDataUpdate} />;
            case 'profile':
                 return <ClientProfileView clientData={clientData} />;
            default: return null;
        }
    }

    return (
        <div className="main-content" style={{width: '100%', maxWidth: '800px'}}>
             <nav className="main-tabs-nav">
                {(planType === 'full' || planType === 'routine') &&
                    <button className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>Rutina</button>
                }
                {(planType === 'full' || planType === 'nutrition') &&
                    <button className={`main-tab-button ${activeTab === 'diet' ? 'active' : ''}`} onClick={() => setActiveTab('diet')}>Nutrición</button>
                }
                <button className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>Progreso</button>
                <button className={`main-tab-button ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>Mi Perfil</button>
            </nav>
            <div className="animated-fade-in">
                {renderContent()}
            </div>
             {showRequestModal && (
                <RequestModal 
                    client={clientData} 
                    onClose={() => setShowRequestModal(false)}
                />
            )}
        </div>
    );
}

const ClientDietTabsView: React.FC<{ dietPlans: (DietPlan | null)[] }> = ({ dietPlans }) => {
    const [activePlanIndex, setActivePlanIndex] = useState(0);
    const activePlan = dietPlans[activePlanIndex];

    return (
        <div>
            <div className="view-toggle" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
                <button onClick={() => setActivePlanIndex(0)} className={`view-toggle-button ${activePlanIndex === 0 ? 'active' : ''}`}>Plan 1</button>
                <button onClick={() => setActivePlanIndex(1)} className={`view-toggle-button ${activePlanIndex === 1 ? 'active' : ''}`}>Plan 2</button>
            </div>
            {activePlan ? (
                <ClientDietView dietPlan={activePlan} />
            ) : (
                <div className="placeholder" style={{ marginTop: '2rem' }}>
                    <p>Este plan de nutrición aún no ha sido generado por tu entrenador.</p>
                </div>
            )}
        </div>
    );
};


const ClientDietView: React.FC<{ dietPlan: DietPlan }> = ({ dietPlan }) => (
     <div className="diet-plan-container animated-fade-in">
        <div className="plan-header">
            <h3>{dietPlan.planTitle}</h3>
        </div>
        <div className="diet-summary">
            <div><strong>Calorías</strong><span>{dietPlan.summary.totalCalories} kcal</span></div>
            <div><strong>Proteínas</strong><span>{dietPlan.summary.macronutrients.proteinGrams} g</span></div>
            <div><strong>Carbohidratos</strong><span>{dietPlan.summary.macronutrients.carbsGrams} g</span></div>
            <div><strong>Grasas</strong><span>{dietPlan.summary.macronutrients.fatGrams} g</span></div>
        </div>
        <div className="meals-grid">
            {dietPlan.meals.map(meal => (
                <div key={meal.mealName} className="meal-card">
                    <h4>{meal.mealName}</h4>
                    <ul>{meal.foodItems.map(item => (<li key={item.food}>{item.food} <span>{item.amount}</span></li>))}</ul>
                </div>
            ))}
        </div>
        <div className="recommendations-section">
            <h4>Recomendaciones</h4>
            <ul>{dietPlan.recommendations.map((rec, i) => (<li key={i}>{rec}</li>))}</ul>
        </div>
    </div>
);

const ClientProfileView: React.FC<{ clientData: ClientData }> = ({ clientData }) => {
    const { profile, routine } = clientData;
    const bmi = useMemo(() => calculateBMI(parseFloat(profile.weight), parseFloat(profile.height)), [profile.weight, profile.height]);
    const targetWeight = useMemo(() => calculateTargetWeight(parseFloat(profile.height)), [profile.height]);

    const estimatedFinalWeight = useMemo(() => {
        if (!routine?.totalDurationWeeks || !profile.weight || !profile.goal) {
            return null;
        }

        const currentWeight = parseFloat(profile.weight);
        const durationWeeks = routine.totalDurationWeeks;
        let weightChangePerWeek = 0;

        switch (profile.goal) {
            case 'Pérdida de grasa':
                weightChangePerWeek = -0.5; // kg/week
                break;
            case 'Hipertrofia':
                weightChangePerWeek = 0.25; // kg/week
                break;
            default:
                return null;
        }

        const finalWeight = currentWeight + (weightChangePerWeek * durationWeeks);
        return finalWeight.toFixed(1);

    }, [profile.weight, profile.goal, routine?.totalDurationWeeks]);


    return (
        <div className="client-profile-view animated-fade-in">
            <h2>Mi Perfil</h2>
            <div className="profile-info-grid">
                <div className="info-card">
                    <h3>Información Personal</h3>
                    <ul>
                        <li><strong>Nombre:</strong> <span>{profile.name}</span></li>
                        <li><strong>Edad:</strong> <span>{profile.age} años</span></li>
                        <li><strong>Género:</strong> <span>{profile.gender}</span></li>
                    </ul>
                </div>
                <div className="info-card">
                    <h3>Métricas de Salud</h3>
                    <div className="health-metrics">
                        <div className="metric-item">
                            <span className="metric-label">Peso Actual</span>
                            <span className="metric-value">{profile.weight} kg</span>
                        </div>
                        <div className="metric-item">
                            <span className="metric-label">Altura</span>
                            <span className="metric-value">{profile.height} cm</span>
                        </div>
                         <div className="metric-item">
                            <span className="metric-label">IMC</span>
                            <span className={`metric-value ${bmi.categoryClass}`}>{bmi.value}</span>
                        </div>
                    </div>
                     {targetWeight !== 'N/A' && (
                        <div className="target-weight-info">
                            Peso saludable estimado: <strong>{targetWeight}</strong>
                        </div>
                    )}
                </div>
                <div className="info-card full-width">
                    <h3>Objetivos y Preferencias</h3>
                    <ul>
                         <li><strong>Nivel:</strong> <span>{profile.level}</span></li>
                         <li><strong>Objetivo:</strong> <span>{profile.goal}</span></li>
                         <li><strong>Días de Entrenamiento:</strong> <span>{profile.trainingDays} por semana</span></li>
                         <li><strong>Enfoque Corporal:</strong> <span>{profile.bodyFocusArea}</span></li>
                         {profile.muscleFocus && profile.muscleFocus.toLowerCase() !== 'general' && (
                            <li><strong>Músculo Prioritario:</strong> <span>{profile.muscleFocus}</span></li>
                         )}
                    </ul>
                </div>
            </div>
             {estimatedFinalWeight && (
                <div className="target-weight-info" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                    Peso estimado al finalizar el plan: <strong>{estimatedFinalWeight} kg</strong>
                </div>
            )}
        </div>
    );
};



const AgreementView: React.FC<{ onAccept: () => void; onLogout: () => void }> = ({ onAccept, onLogout }) => {
    const [isChecked, setIsChecked] = useState(false);
    
    const termsText = `
Bienvenido a ScorpionGYM AI.

Al utilizar esta aplicación, usted ("el Cliente") acepta los siguientes términos y condiciones:

1.  **Propósito de la Aplicación:** Esta aplicación utiliza inteligencia artificial para generar rutinas de entrenamiento y planes de nutrición personalizados basados en la información que usted proporciona. Estos planes son sugerencias y no constituyen un consejo médico.

2.  **Consulta Médica:** Antes de comenzar cualquier programa de ejercicios o plan de nutrición, es su responsabilidad consultar con un profesional de la salud (médico, fisioterapeuta, etc.) para asegurarse de que es apto para realizar dichas actividades. Usted asume todos los riesgos de lesiones o problemas de salud que puedan surgir.

3.  **Uso de Datos:** La información de su perfil (edad, peso, objetivos, etc.) será utilizada por la IA para generar sus planes. Nos comprometemos a proteger su privacidad y a no compartir sus datos personales con terceros no autorizados.

4.  **Responsabilidad:** ScorpionGYM y sus entrenadores no se hacen responsables de ninguna lesión, enfermedad o condición médica que pueda resultar del seguimiento de los planes generados por la aplicación. La ejecución correcta de los ejercicios y el seguimiento de la dieta son su responsabilidad.

5.  **Resultados no Garantizados:** Los resultados del entrenamiento y la nutrición varían de persona a persona. No garantizamos resultados específicos. La consistencia, el esfuerzo y otros factores de estilo de vida influyen significativamente en el progreso.

Al marcar la casilla y hacer clic en "Aceptar", usted confirma que ha leído, entendido y aceptado estos términos y condiciones.
    `;

    return (
        <div className="agreement-container">
            <header>
                 <img src="/logo.svg" alt="Scorpion AI Logo" className="app-logo" width="80" height="80"/>
                 <h1>Términos y Condiciones</h1>
            </header>
            <p style={{marginBottom: '1rem'}}>Por favor, lee y acepta los términos para continuar.</p>
            <div className="terms-box">
                <p>{termsText}</p>
            </div>
            <div className="agreement-actions">
                <div className="agreement-checkbox">
                    <input 
                        type="checkbox" 
                        id="terms" 
                        checked={isChecked} 
                        onChange={() => setIsChecked(!isChecked)} 
                    />
                    <label htmlFor="terms">He leído y acepto los términos y condiciones.</label>
                </div>
                <div className="agreement-buttons">
                    <button onClick={onLogout} className="cta-button secondary">Salir</button>
                    <button onClick={onAccept} disabled={!isChecked} className="cta-button">Aceptar y Continuar</button>
                </div>
            </div>
        </div>
    );
};


// --- Client Portal: Routine Tracker ---

const ExerciseTracker: React.FC<{ clientData: ClientData, onProgressLogged: () => void, onRequestChange: () => void }> = ({ clientData, onProgressLogged, onRequestChange }) => {
    const { routine, routineGeneratedDate } = clientData;
    const [activePhaseIndex, setActivePhaseIndex] = useState(0);

    const expirationDateString = useMemo(() => {
        if (!routineGeneratedDate || !routine?.totalDurationWeeks) return null;
        const generated = new Date(routineGeneratedDate);
        const expiration = new Date(generated);
        expiration.setDate(expiration.getDate() + routine.totalDurationWeeks * 7);
        return expiration.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    }, [routineGeneratedDate, routine?.totalDurationWeeks]);


    if (!routine) return null;

    return (
        <div className="plan-container animated-fade-in">
             <div className="plan-header">
                <h2>Mi Rutina: {routine.planName}</h2>
                <p>Duración Total: {routine.totalDurationWeeks} semanas</p>
                {expirationDateString && <p className="expiration-date">Tu plan finaliza el: <strong>{expirationDateString}</strong></p>}
            </div>

            <button onClick={onRequestChange} className="cta-button secondary request-change-button">
                Solicitar Cambio al Entrenador
            </button>
            
            <AccordionPhasesClient
                phases={routine.phases}
                activePhaseIndex={activePhaseIndex}
                setActivePhaseIndex={setActivePhaseIndex}
                clientData={clientData}
                onProgressLogged={onProgressLogged}
            />
        </div>
    );
};

const AccordionPhasesClient: React.FC<{
    phases: Phase[];
    activePhaseIndex: number;
    setActivePhaseIndex: (index: number) => void;
    clientData: ClientData;
    onProgressLogged: () => void;
}> = ({ phases, activePhaseIndex, setActivePhaseIndex, clientData, onProgressLogged }) => {
    
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
                        <PhaseContentClient 
                            phase={phase}
                            clientData={clientData}
                            onProgressLogged={onProgressLogged}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
};

const PhaseContentClient: React.FC<{
    phase: Phase;
    clientData: ClientData;
    onProgressLogged: () => void;
}> = ({ phase, clientData, onProgressLogged }) => {
    const [activeDayIndex, setActiveDayIndex] = useState(0);

    const dayPlan = phase.routine.dias[activeDayIndex];
    if (!dayPlan) return <p>No hay días definidos.</p>;

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
            <div className="day-card">
                 <h3>
                    {dayPlan.dia}: <span className="muscle-group">{dayPlan.grupoMuscular}</span>
                </h3>
                <ul className="exercise-list">
                     {dayPlan.ejercicios.map((exercise, index) => (
                        <li key={index} className="exercise-item">
                            <ExerciseView exercise={exercise} />
                            <ProgressTracker 
                                exerciseName={exercise.nombre} 
                                clientData={clientData} 
                                onProgressLogged={onProgressLogged}
                            />
                        </li>
                    ))}
                </ul>
                {dayPlan.cardio && <p className="cardio-note"><strong>Cardio:</strong> {dayPlan.cardio}</p>}
            </div>
        </div>
    );
};


const ProgressTracker: React.FC<{
    exerciseName: string;
    clientData: ClientData;
    onProgressLogged: () => void;
}> = ({ exerciseName, clientData, onProgressLogged }) => {
    const [weight, setWeight] = useState('');
    const [repetitions, setRepetitions] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    const lastLog = useMemo(() => {
        const logs = clientData.progressLog?.[exerciseName];
        if (logs && logs.length > 0) {
            return logs[logs.length - 1];
        }
        return null;
    }, [clientData.progressLog, exerciseName]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!weight || !repetitions) return;

        setIsSaving(true);
        
        const newLogEntry: ProgressLogEntry = {
            date: new Date().toISOString(),
            weight: parseFloat(weight),
            repetitions: parseInt(repetitions, 10),
        };
        
        const updatedProgressLog = { ...clientData.progressLog };
        if (!updatedProgressLog[exerciseName]) {
            updatedProgressLog[exerciseName] = [];
        }
        updatedProgressLog[exerciseName].push(newLogEntry);
        
        const success = await apiClient.saveClientData(clientData.dni, { progressLog: updatedProgressLog });

        if (success) {
            setIsSaved(true);
            setWeight('');
            setRepetitions('');
            onProgressLogged();
            setTimeout(() => setIsSaved(false), 2000);
        } else {
            alert("Error al guardar el progreso.");
        }
        
        setIsSaving(false);
    };

    return (
        <form onSubmit={handleSubmit} className="exercise-tracking">
            <div>
                <label htmlFor={`weight-${exerciseName}`}>Peso (kg)</label>
                <input
                    id={`weight-${exerciseName}`}
                    type="number"
                    step="0.5"
                    placeholder={lastLog ? `Últ: ${lastLog.weight}` : "e.g., 20.5"}
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    className="form-group input"
                />
            </div>
            <div>
                <label htmlFor={`reps-${exerciseName}`}>Repeticiones</label>
                <input
                    id={`reps-${exerciseName}`}
                    type="number"
                    placeholder={lastLog ? `Últ: ${lastLog.repetitions}` : "e.g., 10"}
                    value={repetitions}
                    onChange={e => setRepetitions(e.target.value)}
                    className="form-group input"
                />
            </div>
            <button type="submit" disabled={isSaving || !weight || !repetitions} className={`cta-button secondary ${isSaved ? 'saved' : ''}`}>
                {isSaving ? <span className="spinner small"></span> : (isSaved ? '✓' : '+')}
            </button>
        </form>
    );
};

const BodyWeightLogger: React.FC<{
    clientData: ClientData;
    onWeightLogged: () => void;
}> = ({ clientData, onWeightLogged }) => {
    const [weight, setWeight] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

    const lastLoggedWeight = clientData.bodyWeightLog?.[clientData.bodyWeightLog.length - 1]?.weight;
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!weight) return;

        setIsSaving(true);
        setSaveStatus('idle');

        const bmiData = calculateBMI(parseFloat(weight), parseFloat(clientData.profile.height));

        const newEntry: BodyWeightEntry = {
            date: new Date().toISOString(),
            weight: parseFloat(weight),
            imc: bmiData.value,
            imcCategoryClass: bmiData.categoryClass
        };

        const updatedLog = [...(clientData.bodyWeightLog || []), newEntry];
        const success = await apiClient.saveClientData(clientData.dni, { bodyWeightLog: updatedLog });

        if (success) {
            setSaveStatus('saved');
            onWeightLogged();
            setWeight('');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            setSaveStatus('error');
        }
        setIsSaving(false);
    };

    const buttonText = () => {
        if (isSaving) return '...';
        if (saveStatus === 'saved') return '¡Guardado!';
        return 'Registrar';
    };

    return (
        <div className="body-weight-logger animated-fade-in">
            <h4>Registro de Peso Corporal</h4>
             {lastLoggedWeight && <p>Último registro: <strong>{lastLoggedWeight} kg</strong></p>}
             {clientData.profile.height && (
                 <div className="bmi-display client-bmi">
                     <span>IMC Actual: <strong>{calculateBMI(lastLoggedWeight || parseFloat(clientData.profile.weight), parseFloat(clientData.profile.height)).value}</strong></span>
                 </div>
             )}
            <form onSubmit={handleSubmit} style={{width: '100%'}}>
                 <div className="input-group">
                    <input
                        type="number"
                        step="0.1"
                        placeholder="Peso en kg"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        required
                        className="form-group input"
                    />
                     <button type="submit" disabled={isSaving} className={`log-button ${saveStatus === 'saved' ? 'saved' : ''}`}>
                        {buttonText()}
                    </button>
                 </div>
                 {saveStatus === 'error' && <p className="error-text">No se pudo guardar.</p>}
            </form>
        </div>
    );
};

// --- Progress View ---

const ProgressView: React.FC<{ clientData: ClientData; onDataUpdate: () => void; }> = ({ clientData, onDataUpdate }) => {
    const planType = clientData.planType || 'full';
    const [activeTab, setActiveTab] = useState<'bodyWeight' | 'lifts'>(planType === 'routine' ? 'lifts' : 'bodyWeight');

    return (
        <div className="progress-view-container">
             <BodyWeightLogger clientData={clientData} onWeightLogged={onDataUpdate} />
            <nav className="progress-tabs-nav">
                {(planType === 'full' || planType === 'nutrition') &&
                    <button className={`progress-tab-button ${activeTab === 'bodyWeight' ? 'active' : ''}`} onClick={() => setActiveTab('bodyWeight')}>Peso Corporal</button>
                }
                {(planType === 'full' || planType === 'routine') &&
                    <button className={`progress-tab-button ${activeTab === 'lifts' ? 'active' : ''}`} onClick={() => setActiveTab('lifts')}>Levantamientos</button>
                }
            </nav>
            <div className="animated-fade-in">
                {activeTab === 'bodyWeight' && <BodyWeightProgress clientData={clientData} />}
                {activeTab === 'lifts' && <LiftProgress clientData={clientData} />}
            </div>
        </div>
    );
};

const BodyWeightProgress: React.FC<{ clientData: ClientData; }> = ({ clientData }) => {
    const log = useMemo(() => [...(clientData.bodyWeightLog || [])].reverse(), [clientData.bodyWeightLog]);

    return (
        <div>
            {(!log || log.length === 0) ? (
                 <div className="placeholder" style={{marginTop: '2rem'}}>No hay registros de peso corporal.</div>
            ) : (
                <div className="progress-list-container">
                    <h3>Historial de Peso</h3>
                    <div className="progress-list">
                         <div className="progress-list-header weight">
                            <span>Fecha</span>
                            <span>Peso (kg)</span>
                            <span>IMC</span>
                        </div>
                        {log.map(entry => (
                            <div key={entry.date} className="progress-list-row weight">
                                <span>{new Date(entry.date).toLocaleDateString()}</span>
                                <span>{entry.weight.toFixed(1)}</span>
                                 <span className={entry.imcCategoryClass}>{entry.imc?.toFixed(1) || 'N/A'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const LiftProgress: React.FC<{ clientData: ClientData }> = ({ clientData }) => {
    const [selectedExercise, setSelectedExercise] = useState<string>('');

    const exerciseOptions = useMemo(() => Object.keys(clientData.progressLog), [clientData.progressLog]);
    
    useEffect(() => {
        if (exerciseOptions.length > 0) {
            setSelectedExercise(exerciseOptions[0]);
        }
    }, [exerciseOptions]);

    const log = useMemo(() => {
        if (!selectedExercise || !clientData.progressLog[selectedExercise]) return [];
        return [...clientData.progressLog[selectedExercise]].reverse();
    }, [selectedExercise, clientData.progressLog]);

    if (exerciseOptions.length === 0) {
        return <div className="placeholder">No hay registros de progreso en ejercicios.</div>
    }

    return (
        <div>
            <select
                className="exercise-select-dropdown"
                value={selectedExercise}
                onChange={e => setSelectedExercise(e.target.value)}
            >
                {exerciseOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            
            <div className="progress-list-container">
                 <h3>Historial de {selectedExercise}</h3>
                 <div className="progress-list">
                     <div className="progress-list-header">
                        <span>Fecha</span>
                        <span>Peso (kg)</span>
                        <span>Repeticiones</span>
                    </div>
                    {log.map(entry => (
                        <div key={entry.date} className="progress-list-row">
                            <span>{new Date(entry.date).toLocaleDateString()}</span>
                            <span>{entry.weight}</span>
                            <span>{entry.repetitions}</span>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
    );
};

// --- Chat Assistant ---
const ChatAssistant: React.FC<{
    clientData: ClientData,
    setClientData: (data: ClientData) => void,
    onClose: () => void,
}> = ({ clientData, setClientData, onClose }) => {
    type Message = {
        role: 'user' | 'model';
        parts: { text: string; image?: { data: string; mimeType: string } }[];
    };
    
    const [chat, setChat] = useState<Chat | null>(null);
    const [history, setHistory] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [error, setError] = useState('');
    const [image, setImage] = useState<{ data: string; mimeType: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    const aiUsage = clientData.aiUsage;
    const dailyLimit = clientData.dailyQuestionLimit ?? 10;
    const questionsAskedToday = useMemo(() => {
        if (!aiUsage) return 0;
        const today = new Date().toISOString().split('T')[0];
        if (aiUsage.date === today) {
            return aiUsage.count;
        }
        return 0;
    }, [aiUsage]);
    const canAskQuestion = questionsAskedToday < dailyLimit;

    useEffect(() => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const chatInstance = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                    systemInstruction: `
                    Eres un asistente de fitness experto para la aplicación ScorpionGYM AI. Tu nombre es "Scorpion AI".
                    El perfil completo del cliente con el que estás chateando es: ${JSON.stringify(clientData.profile)}.
                    La rutina actual del cliente es: ${JSON.stringify(clientData.routine)}.
                    El plan de nutrición actual del cliente es: ${JSON.stringify(clientData.dietPlans)}.

                    Tus responsabilidades y reglas son:
                    1.  **Personalización Extrema:** TODAS tus respuestas deben estar personalizadas según el perfil, rutina y dieta del cliente. Usa su información para dar consejos relevantes. No des respuestas genéricas.
                    2.  **Rol:** Actúa como un entrenador personal motivador, amigable y experto. Usa un tono de apoyo.
                    3.  **Límites:** NO puedes modificar la rutina o el plan de dieta del cliente. Si te piden cambios, debes decirles que contacten a su entrenador humano para cualquier modificación. Tu rol es dar soporte, no alterar el plan.
                    4.  **Temas:** Responde únicamente a preguntas sobre fitness, nutrición, ejecución de ejercicios, motivación y temas relacionados con el entrenamiento. Si te preguntan sobre otros temas (historia, política, etc.), responde amablemente que tu especialidad es el fitness y no puedes contestar a eso.
                    5.  **Seguridad Primero:** Siempre prioriza la seguridad. Si preguntan sobre un ejercicio y sienten dolor, aconséjales parar inmediatamente y consultar a su entrenador o a un profesional de la salud.
                    6.  **Claridad:** Sé claro y conciso en tus respuestas.
                    7.  **Análisis de Imágenes:** Si el usuario sube una imagen, analízala en el contexto de su pregunta. Por ejemplo, si es una foto de comida, puedes estimar calorías o dar una opinión nutricional. Si es una foto de su postura en un ejercicio, puedes ofrecer consejos de técnica (siempre con la advertencia de que no reemplaza a un entrenador).
                `,
            },
        });
        setChat(chatInstance);
        if (history.length === 0) {
                setHistory([{ role: 'model', parts: [{ text: `¡Hola ${clientData.profile.name}! Soy Scorpion AI, tu asistente. ¿En qué puedo ayudarte hoy con tu entrenamiento o nutrición?` }] }]);
        }
    }, [clientData]);
    
     useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history, isThinking]);


    const sendMessage = async () => {
        if (isThinking || (!input.trim() && !image)) return;
        
        if (!canAskQuestion) {
            setError(`Has alcanzado tu límite de ${dailyLimit} preguntas por hoy.`);
            return;
        }

        setIsThinking(true);
        setError('');

        const userMessageParts = [];
        if (input.trim()) {
            userMessageParts.push({ text: input.trim() });
        }
        if (image) {
            userMessageParts.push({ text: "Analiza esta imagen en el contexto de mi pregunta.", image });
        }
        
        const newUserMessage: Message = { role: 'user', parts: userMessageParts };
        setHistory(prev => [...prev, newUserMessage]);
        
        try {
            if (!chat) throw new Error("Chat not initialized.");
            
            const messagePartsForApi: (string | { inlineData: { data: string, mimeType: string } })[] = [];
            if (input.trim()) {
                messagePartsForApi.push(input.trim());
            }
            if (image) {
                messagePartsForApi.push({ inlineData: image });
            }

            const stream = await chat.sendMessageStream({ message: messagePartsForApi });
            
            let responseText = '';
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);

            for await (const chunk of stream) {
                responseText += chunk.text;
                 setHistory(prev => {
                    const newHistory = [...prev];
                    newHistory[newHistory.length - 1] = { role: 'model', parts: [{ text: responseText }] };
                    return newHistory;
                });
            }

            // Update usage count
            const today = new Date().toISOString().split('T')[0];
            const newCount = (aiUsage?.date === today) ? (aiUsage.count + 1) : 1;
            const newUsage = { date: today, count: newCount };
            setClientData({...clientData, aiUsage: newUsage });
            await apiClient.saveClientData(clientData.dni, { aiUsage: newUsage });

        } catch (err) {
            console.error(err);
            setError("Lo siento, ocurrió un error al procesar tu solicitud.");
             setHistory(prev => [...prev, { role: 'model', parts: [{ text: "Lo siento, ocurrió un error al procesar tu solicitud." }] }]);
        } finally {
            setIsThinking(false);
            setInput('');
            setImage(null);
        }
    };
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string).split(',')[1];
                setImage({ data: base64String, mimeType: file.type });
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="chat-fullscreen-container animated-fade-in">
            <div className="main-header" style={{ marginBottom: '1rem', padding: '1rem 1.5rem' }}>
                <div className="header-title-wrapper">
                    <h1>Asistente IA</h1>
                    <p>{questionsAskedToday}/{dailyLimit} preguntas restantes</p>
                </div>
                <button onClick={onClose} className="back-button">Volver</button>
            </div>
            <div className="chat-messages" ref={messagesEndRef}>
                {history.map((msg, index) => (
                    <div key={index} className={`chat-message ${msg.role}`}>
                        <div className="avatar">
                            {msg.role === 'user' ? 'TÚ' : '🦂'}
                        </div>
                        <div className="message-content">
                            {msg.parts.map((part, i) => (
                                    <React.Fragment key={i}>
                                    <p>{part.text}</p>
                                    {part.image && <img src={`data:${part.image.mimeType};base64,${part.image.data}`} alt="Contexto de usuario"/>}
                                </React.Fragment>
                            ))}
                        </div>
                    </div>
                ))}
                {isThinking && (
                    <div className="chat-message model">
                            <div className="avatar">🦂</div>
                            <div className="message-content">
                            <div className="chat-typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="chat-input-area">
                {image && (
                        <div className="chat-image-preview">
                        <img src={`data:${image.mimeType};base64,${image.data}`} alt="Vista previa" />
                        <button className="remove-image-btn" onClick={() => setImage(null)}>&times;</button>
                    </div>
                )}
                {error && <p className="error-text">{error}</p>}
                <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
                    <button type="button" className="chat-action-btn" onClick={() => fileInputRef.current?.click()} aria-label="Adjuntar imagen">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M21.58,16.09L19.82,17.85L18.31,16.34L15.41,19.24L10,13.83L12.08,11.75L14.27,13.94L16.8,11.41L15,9.62L16.09,8.53L18.31,10.75L21.58,7.47L22.29,8.18L19.03,11.45L16.8,9.23L15.38,10.64L14.27,11.75L12.08,13.94L10,11.86L6.73,15.13L2,10.4L2.71,9.69L6,12.97L9.27,9.7L11.35,11.78L13.56,9.56L12.5,8.5L14.27,6.73L16.04,8.5L18.31,6.23L19.23,7.15L16.8,9.58L14.27,12.11L11.75,14.63L10,16.38L15.41,21.79L19.22,18L20.27,19.05L21.28,18.04L22,17.33L21.58,16.09Z" /></svg>
                    </button>
                    <input 
                        type="text" 
                        placeholder={canAskQuestion ? "Escribe tu pregunta..." : "Límite diario alcanzado."}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        disabled={isThinking || !canAskQuestion}
                    />
                        <button type="submit" disabled={isThinking || (!input.trim() && !image) || !canAskQuestion}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" /></svg>
                    </button>
                </form>
            </div>
        </div>
    );
};


// --- Exercise Library ---
const ExerciseLibraryManager: React.FC<{ gymId: string; onBack: () => void }> = ({ gymId, onBack }) => {
    return (
        <div className="admin-dashboard animated-fade-in">
            <div className="main-header">
                <div className="header-title-wrapper">
                    <h1>Biblioteca de Ejercicios</h1>
                </div>
                <button onClick={onBack} className="back-button">Volver al Panel</button>
            </div>
            <div className="library-container">
                <LibraryContent gymId={gymId} />
            </div>
        </div>
    );
};

const LibraryContent: React.FC<{ gymId: string }> = ({ gymId }) => {
    const [library, setLibrary] = useState<ExerciseLibrary>({});
    const [isLoading, setIsLoading] = useState(true);
    const [editingExercise, setEditingExercise] = useState<{ group: string, index: number, name: string, link: string } | null>(null);
    const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

    useEffect(() => {
        fetchLibrary();
    }, [gymId]);

    const fetchLibrary = async () => {
        setIsLoading(true);
        const lib = await apiClient.getExerciseLibrary(gymId);
        setLibrary(lib);
        setIsLoading(false);
    };
    
    const handleSaveChanges = async (newLibrary: ExerciseLibrary) => {
        const success = await apiClient.saveExerciseLibrary(newLibrary, gymId);
        if (success) {
            setLibrary(newLibrary);
        } else {
            alert("Error al guardar la biblioteca.");
        }
    };
    
    const handleAddExercise = (group: string, name: string) => {
        const newLibrary = { ...library };
        if (!newLibrary[group]) {
            newLibrary[group] = [];
        }
        // Check for duplicates
        if (newLibrary[group].some(ex => ex.name.toLowerCase() === name.toLowerCase())) {
            alert(`El ejercicio "${name}" ya existe en el grupo "${group}".`);
            return;
        }
        newLibrary[group].push({ name, isEnabled: true, youtubeLink: '' });
        newLibrary[group].sort((a, b) => a.name.localeCompare(b.name));
        handleSaveChanges(newLibrary);
    };
    
    const handleToggleEnable = (group: string, index: number) => {
        const newLibrary = { ...library };
        newLibrary[group][index].isEnabled = !newLibrary[group][index].isEnabled;
        handleSaveChanges(newLibrary);
    };
    
    const handleUpdateExercise = () => {
        if (!editingExercise) return;
        const { group, index, name, link } = editingExercise;
        const newLibrary = { ...library };
        // Check for duplicates if name changed
        if (newLibrary[group][index].name !== name && newLibrary[group].some((ex, i) => i !== index && ex.name.toLowerCase() === name.toLowerCase())) {
             alert(`El ejercicio "${name}" ya existe en este grupo.`);
             return;
        }
        newLibrary[group][index] = { name, isEnabled: newLibrary[group][index].isEnabled, youtubeLink: link };
        newLibrary[group].sort((a, b) => a.name.localeCompare(b.name));
        handleSaveChanges(newLibrary);
        setEditingExercise(null);
    };

    const handleDeleteExercise = (group: string, index: number) => {
         if (window.confirm(`¿Estás seguro de que quieres eliminar el ejercicio "${library[group][index].name}"?`)) {
            const newLibrary = { ...library };
            newLibrary[group].splice(index, 1);
            handleSaveChanges(newLibrary);
        }
    };

    if (isLoading) {
        return <div className="loading-container"><div className="spinner"></div>Cargando biblioteca...</div>;
    }

    return (
        <div>
            <div className="library-instructions">
                <p>Gestiona los ejercicios disponibles para la IA. Desactiva los que no quieras que se usen en las rutinas o añade nuevos ejercicios a cada grupo muscular.</p>
            </div>
            
             <AddExerciseToLibraryForm library={library} onAddExercise={handleAddExercise} />

            <div className="library-accordion">
                {Object.keys(library).sort().map(group => (
                    <div className="library-accordion-item" key={group}>
                        <button 
                            className={`library-accordion-header ${activeAccordion === group ? 'active' : ''}`}
                            onClick={() => setActiveAccordion(activeAccordion === group ? null : group)}
                        >
                            {group}
                             <span className="icon">+</span>
                        </button>
                        <div className={`library-accordion-content ${activeAccordion === group ? 'open' : ''}`}>
                            <div className="exercise-entry-list">
                                <div className="exercise-entry-header">
                                    <span>Activo</span>
                                    <span>Nombre del Ejercicio</span>
                                    <span>Link de YouTube (Opcional)</span>
                                    <span>Acciones</span>
                                </div>
                                {library[group].map((exercise, index) => {
                                    const isEditingThis = editingExercise?.group === group && editingExercise?.index === index;
                                    return (
                                        <div className="exercise-entry-row" key={index}>
                                             <label className="switch">
                                                <input type="checkbox" checked={exercise.isEnabled} onChange={() => handleToggleEnable(group, index)} />
                                                <span className="slider round"></span>
                                            </label>
                                             <div>
                                                {isEditingThis ? (
                                                     <input 
                                                        type="text" 
                                                        className="editing-input"
                                                        value={editingExercise.name} 
                                                        onChange={(e) => setEditingExercise({...editingExercise, name: e.target.value})} 
                                                    />
                                                ) : (
                                                    <span className="exercise-name-lib">{exercise.name}</span>
                                                )}
                                             </div>
                                             <div>
                                                 {isEditingThis ? (
                                                    <input 
                                                        type="text" 
                                                        className="editing-input"
                                                        value={editingExercise.link} 
                                                        onChange={(e) => setEditingExercise({...editingExercise, link: e.target.value})}
                                                        placeholder="https://youtu.be/..."
                                                    />
                                                ) : (
                                                    <a href={exercise.youtubeLink || '#'} target="_blank" rel="noopener noreferrer" className={`video-link-lib ${!exercise.youtubeLink ? 'disabled' : ''}`}>
                                                        {exercise.youtubeLink ? 'Ver Video' : 'Sin video'}
                                                    </a>
                                                )}
                                             </div>
                                            <div className="exercise-row-actions">
                                                {isEditingThis ? (
                                                    <>
                                                        <button className="action-btn save" onClick={handleUpdateExercise}>Guardar</button>
                                                        <button className="action-btn cancel" onClick={() => setEditingExercise(null)}>Cancelar</button>
                                                    </>
                                                ) : (
                                                     <>
                                                        <button className="action-btn edit" onClick={() => setEditingExercise({ group, index, name: exercise.name, link: exercise.youtubeLink })}>Editar</button>
                                                        <button className="action-btn delete" onClick={() => handleDeleteExercise(group, index)}>Borrar</button>
                                                     </>
                                                )}
                                            </div>
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


// FIX: The component was missing its return statement and JSX content.
const AddExerciseToLibraryForm: React.FC<{ library: ExerciseLibrary, onAddExercise: (group: string, name: string) => void }> = ({ library, onAddExercise }) => {
    const [newExerciseName, setNewExerciseName] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(Object.keys(library)[0] || '');
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newExerciseName.trim() || !selectedGroup) {
            return;
        }
        onAddExercise(selectedGroup, newExerciseName.trim());
        setNewExerciseName('');
    };

    return (
        <form onSubmit={handleSubmit} className="add-exercise-form">
            <h4>Añadir Nuevo Ejercicio</h4>
            <div className="form-group-inline">
                <input
                    type="text"
                    placeholder="Nombre del ejercicio"
                    value={newExerciseName}
                    onChange={e => setNewExerciseName(e.target.value)}
                    required
                />
            </div>
            <div className="form-group-inline">
                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} required>
                    {Object.keys(library).sort().map(group => (
                        <option key={group} value={group}>{group}</option>
                    ))}
                </select>
            </div>
            <div className="form-group-inline">
                <button type="submit" className="cta-button">Añadir</button>
            </div>
        </form>
    );
};

// --- Trainer Request System ---

const RequestsViewAdmin: React.FC<{ gymId: string; onBack: () => void }> = ({ gymId, onBack }) => {
    const [requests, setRequests] = useState<TrainerRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRequests = async () => {
        setIsLoading(true);
        const data = await apiClient.getRequests(gymId);
        setRequests(data);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchRequests();
    }, [gymId]);

    const handleUpdateStatus = async (id: string, status: 'read' | 'resolved') => {
        const success = await apiClient.updateRequestStatus(id, status);
        if (success) fetchRequests();
    };

    const handleDeleteRequest = async (id: string) => {
        if (window.confirm("¿Estás seguro de que quieres eliminar esta solicitud?")) {
            const success = await apiClient.deleteRequest(id);
            if (success) fetchRequests();
        }
    };
    
    // Sort requests by date, newest first
    const sortedRequests = [...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return (
        <div className="admin-dashboard animated-fade-in">
            <div className="main-header">
                <div className="header-title-wrapper">
                    <h1>Bandeja de Entrada</h1>
                </div>
                <button onClick={onBack} className="back-button">Volver al Panel</button>
            </div>
            {isLoading ? (
                 <div className="loading-container"><div className="spinner"></div>Cargando solicitudes...</div>
            ) : requests.length === 0 ? (
                <div className="placeholder">No hay solicitudes pendientes.</div>
            ) : (
                <div className="request-list-container">
                    {sortedRequests.map(req => (
                        <div key={req._id} className={`request-card status-${req.status}`}>
                            <div className="request-card-header">
                                <h4>{req.subject}</h4>
                                <span className="request-date">{new Date(req.createdAt).toLocaleString()}</span>
                            </div>
                            <p className="request-client"><strong>Cliente:</strong> {req.clientName} (DNI: {req.clientId})</p>
                            <p className="request-message">{req.message}</p>
                            <div className="request-card-actions">
                                {req.status === 'new' && <button className="action-btn" onClick={() => handleUpdateStatus(req._id, 'read')}>Marcar como Leído</button>}
                                {req.status === 'read' && <button className="action-btn" onClick={() => handleUpdateStatus(req._id, 'resolved')}>Marcar como Resuelto</button>}
                                <button className="action-btn delete" onClick={() => handleDeleteRequest(req._id)}>Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const root = createRoot(document.getElementById("root")!);
root.render(<App />);