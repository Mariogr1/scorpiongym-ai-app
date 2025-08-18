
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
const Logo = () => <img src="/logo.svg" alt="ScorpionGYM AI Logo" className="app-logo" />;


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
            2. NO podés dar consejos médicos. Si te preguntan algo relacionado a una lesión o dolor, tu respuesta DEBE ser: "Para cualquier dolor o posible lesión, es fundamental que lo hables con tu entrenador y consultes a un profesional de la salud. Yo no puedo darte consejos médicos."
            3. NO podés generar rutinas completas nuevas. Si te piden un ejercicio alternativo, podés sugerir uno, pero no reestructurar todo el día.
        - **Formato de Respuesta:** Sé conciso y directo. Usá markdown (negritas, listas) para que sea fácil de leer.`;
        
        try {
            const contents: any = [{
                role: 'user',
                parts: [{ text: currentInput }]
            }];

            if (currentImage) {
                contents[0].parts.unshift({
                    inlineData: {
                        mimeType: currentImage.mimeType,
                        data: currentImage.b64
                    }
                });
            }

            const stream = await ai.models.generateContentStream({
                model: 'gemini-2.5-flash',
                contents,
                 config: { systemInstruction },
            });

            for await (const chunk of stream) {
                modelResponse += chunk.text;
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1].text = modelResponse;
                    return newMessages;
                });
            }
            // Update usage count after a successful response
            const today = new Date().toISOString().split('T')[0];
            const usage = clientData.aiUsage || { date: today, count: 0 };
            const newCount = usage.date === today ? usage.count + 1 : 1;
            onUpdateClientData({ aiUsage: { date: today, count: newCount }});

        } catch (error) {
            console.error("Error generating content:", error);
            modelResponse = 'Hubo un error al procesar tu solicitud. Por favor, intentá de nuevo.';
             setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1].text = modelResponse;
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
                <div className="chat-modal-header">
                    <h3>Asistente Scorpion AI</h3>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="chat-messages">
                    {messages.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.role}`}>
                            <div className="avatar">
                                {msg.role === 'model' ? '🦂' : clientData?.profile.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="message-content">
                                {msg.image && <img src={msg.image} alt="Adjunto" />}
                                <p>{msg.text}</p>
                                {isLoading && index === messages.length -1 && !msg.text && (
                                    <div className="chat-typing-indicator"><span></span><span></span><span></span></div>
                                )}
                            </div>
                        </div>
                    ))}
                     <div ref={messagesEndRef} />
                </div>
                <div className="chat-input-area">
                     {image && (
                        <div className="chat-image-preview">
                            <img src={`data:${image.mimeType};base64,${image.b64}`} alt="Vista previa" />
                            <button className="remove-image-btn" onClick={() => setImage(null)}>&times;</button>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage}>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                        <button type="button" className="chat-action-btn" onClick={() => fileInputRef.current?.click()} title="Adjuntar imagen">
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21.947 9.179a1.001 1.001 0 0 0-.868-.679H4.921L3.093 3.321A1 1 0 0 0 2.16 2H1a1 1 0 0 0 0 2h.84l3.15 7.874-1.35 2.7A1 1 0 0 0 4.5 16h15a1 1 0 0 0 0-2H5.64l.9-1.8 14.157-.001a1 1 0 0 0 .99-.821zM6.141 12l-1.85-4h15.42l-1.35 4H6.141z"/><path d="M10 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm9 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Escribí tu consulta..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || (!input.trim() && !image)}>
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// --- Portal Súper Administrador ---
const SuperAdminPortal = ({ onLogout }: { onLogout: () => void }) => {
    const [gyms, setGyms] = useState<Gym[]>([]);
    const [newGymName, setNewGymName] = useState('');
    const [newGymUser, setNewGymUser] = useState('');
    const [newGymPass, setNewGymPass] = useState('');
    const [newDailyLimit, setNewDailyLimit] = useState(10);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingGym, setEditingGym] = useState<Gym | null>(null);
    const [editedName, setEditedName] = useState('');
    const [editedPassword, setEditedPassword] = useState('');
    const [editedDailyLimit, setEditedDailyLimit] = useState(10);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deletingGymId, setDeletingGymId] = useState<string | null>(null);
    

    const fetchGyms = async () => {
        setIsLoading(true);
        const fetchedGyms = await apiClient.getGyms();
        setGyms(fetchedGyms);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchGyms();
    }, []);

    const handleCreateGym = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!newGymName || !newGymUser || !newGymPass) {
            setError("Todos los campos son obligatorios.");
            return;
        }
        setIsLoading(true);
        const success = await apiClient.createGym(newGymName, newGymUser, newGymPass, newDailyLimit);
        if (success) {
            setNewGymName('');
            setNewGymUser('');
            setNewGymPass('');
            setNewDailyLimit(10);
            await fetchGyms(); // Refresh list
        } else {
            setError("Error al crear el gimnasio. El nombre de usuario puede que ya exista.");
        }
        setIsLoading(false);
    };

    const openEditModal = (gym: Gym) => {
        setEditingGym(gym);
        setEditedName(gym.name);
        setEditedPassword('');
        setEditedDailyLimit(gym.dailyQuestionLimit || 10);
        setIsEditModalOpen(true);
    };
    
    const handleUpdateGym = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingGym) return;
        
        const dataToUpdate: { name?: string; password?: string; dailyQuestionLimit?: number; } = {};
        if (editedName && editedName !== editingGym.name) dataToUpdate.name = editedName;
        if (editedPassword) dataToUpdate.password = editedPassword;
        if (editedDailyLimit !== (editingGym.dailyQuestionLimit || 10)) dataToUpdate.dailyQuestionLimit = editedDailyLimit;

        if (Object.keys(dataToUpdate).length > 0) {
            await apiClient.updateGym(editingGym._id, dataToUpdate);
        }
        
        setIsEditModalOpen(false);
        setEditingGym(null);
        await fetchGyms();
    };

    const openDeleteModal = (gymId: string) => {
        setDeletingGymId(gymId);
        setIsDeleteModalOpen(true);
    };

    const handleDeleteGym = async () => {
        if (!deletingGymId) return;
        await apiClient.deleteGym(deletingGymId);
        setIsDeleteModalOpen(false);
        setDeletingGymId(null);
        await fetchGyms();
    };

    return (
        <div className="admin-dashboard">
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                message="¿Estás seguro de que querés borrar este gimnasio? Se borrarán TODOS los clientes y datos asociados de forma permanente."
                onConfirm={handleDeleteGym}
                onCancel={() => setIsDeleteModalOpen(false)}
                confirmText="Sí, borrar todo"
                cancelText="Cancelar"
            />
            {isEditModalOpen && editingGym && (
                 <div className="modal-overlay">
                    <div className="modal-content edit-modal">
                        <h3>Editar Gimnasio: {(editingGym as Gym).name}</h3>
                        <form onSubmit={handleUpdateGym}>
                            <div className="form-group">
                                <label>Nombre del Gimnasio</label>
                                <input type="text" value={editedName} onChange={e => setEditedName(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Nueva Contraseña (dejar en blanco para no cambiar)</label>
                                <input type="password" value={editedPassword} onChange={e => setEditedPassword(e.target.value)} placeholder="••••••••" />
                            </div>
                            <div className="form-group">
                                <label>Límite de Consultas AI por Día</label>
                                <input type="number" value={editedDailyLimit} onChange={e => setEditedDailyLimit(Number(e.target.value))} min="0" />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="cta-button secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                                <button type="submit" className="cta-button">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <div className="main-header">
                 <div className="header-title-wrapper">
                    <Logo />
                    <div>
                        <h1>Panel de Súper Administrador</h1>
                        <p>Gestión de todos los gimnasios.</p>
                    </div>
                </div>
                <button className="logout-button admin-logout" onClick={onLogout}>Cerrar Sesión</button>
            </div>

            <div className="add-gym-container">
                <h3>Agregar Nuevo Gimnasio</h3>
                 <form className="add-gym-form" onSubmit={handleCreateGym}>
                    <input type="text" value={newGymName} onChange={e => setNewGymName(e.target.value)} placeholder="Nombre del Gimnasio" required />
                    <input type="text" value={newGymUser} onChange={e => setNewGymUser(e.target.value)} placeholder="Usuario (para login)" required />
                    <input type="password" value={newGymPass} onChange={e => setNewGymPass(e.target.value)} placeholder="Contraseña" required />
                    <input type="number" value={newDailyLimit} onChange={e => setNewDailyLimit(Number(e.target.value))} placeholder="Límite AI/día" title="Límite de Consultas AI por Día" min="0" required />
                    <button type="submit" className="cta-button" disabled={isLoading}>
                         {isLoading ? <span className="spinner small" /> : 'Crear Gimnasio'}
                    </button>
                </form>
                {error && <p className="error-text" style={{marginTop: '1rem'}}>{error}</p>}
            </div>

            {isLoading && gyms.length === 0 ? (
                <div className="loading-container"><div className="spinner" /></div>
            ) : (
                <div className="gym-list">
                    {gyms.map(gym => (
                        <div key={gym._id} className="gym-card">
                            <div className="gym-card-header">
                                <div className="gym-card-logo"><Logo /></div>
                                <div className="gym-card-info">
                                    <h3>{gym.name}</h3>
                                </div>
                            </div>
                             <p>Usuario: <strong>{gym.username}</strong><br/>Límite AI: <strong>{gym.dailyQuestionLimit ?? 10}</strong> cons./día</p>
                            <div className="gym-card-actions">
                                <button className="action-btn edit" onClick={() => openEditModal(gym)}>Editar</button>
                                <button className="action-btn delete" onClick={() => openDeleteModal(gym._id)}>Borrar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// --- Portal de Gimnasio / Entrenador ---
const GymPortal = ({ gym, onLogout }: { gym: Gym; onLogout: () => void }) => {
    const [view, setView] = useState<'clients' | 'library'>('clients');
    const [clients, setClients] = useState<ClientListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newClientDni, setNewClientDni] = useState('');
    const [error, setError] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [currentClientDni, setCurrentClientDni] = useState<string | null>(null);

    // Selection state for batch actions
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
    const [activeView, setActiveView] = useState<'active' | 'archived'>('active');

    const fetchClients = async () => {
        setIsLoading(true);
        const clientList = await apiClient.getClients(gym._id);
        setClients(clientList);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchClients();
    }, [gym._id]);

    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!/^\d{7,8}$/.test(newClientDni)) {
            setError('Por favor, ingresá un DNI válido (7 u 8 dígitos).');
            return;
        }
        setIsAdding(true);
        const result = await apiClient.createClient(newClientDni, gym._id);
        if (result.success) {
            setNewClientDni('');
            await fetchClients();
        } else {
            setError(result.message || 'Error al agregar cliente.');
        }
        setIsAdding(false);
    };
    
    const handleSelectClient = (dni: string) => {
        if (!selectionMode) {
            setCurrentClientDni(dni);
        } else {
            const newSelection = new Set(selectedClients);
            if (newSelection.has(dni)) {
                newSelection.delete(dni);
            } else {
                newSelection.add(dni);
            }
            setSelectedClients(newSelection);
        }
    };
    
    const toggleSelectionMode = () => {
        setSelectionMode(!selectionMode);
        setSelectedClients(new Set());
    };
    
    const handleBatchArchive = async () => {
        await apiClient.updateClientStatus(selectedClients, 'archived');
        setSelectedClients(new Set());
        setSelectionMode(false);
        await fetchClients();
    };

    const handleBatchRestore = async () => {
        await apiClient.updateClientStatus(selectedClients, 'active');
        setSelectedClients(new Set());
        setSelectionMode(false);
        await fetchClients();
    };
    
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    
    const openDeleteModal = () => {
        if (selectedClients.size > 0) {
            setIsDeleteModalOpen(true);
        }
    };

    const handleBatchDelete = async () => {
        await apiClient.deleteClients(selectedClients);
        setIsDeleteModalOpen(false);
        setSelectedClients(new Set());
        setSelectionMode(false);
        await fetchClients();
    };


    const filteredClients = useMemo(() => {
        const clientsInView = clients.filter(c => (c.status || 'active') === activeView);
        if (!searchTerm) {
            return clientsInView;
        }
        return clientsInView.filter(c =>
            (c.profile?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.dni.includes(searchTerm)
        );
    }, [clients, searchTerm, activeView]);
    
    const selectAll = () => {
        setSelectedClients(new Set(filteredClients.map(c => c.dni)));
    };
    
    if (currentClientDni) {
        return <ClientManagementPortal dni={currentClientDni} onBack={() => { setCurrentClientDni(null); fetchClients(); }} gymId={gym._id} />;
    }

    return (
        <div className="admin-dashboard">
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                message={`¿Estás seguro de que querés borrar ${selectedClients.size} cliente(s)? Esta acción es permanente e irreversible.`}
                onConfirm={handleBatchDelete}
                onCancel={() => setIsDeleteModalOpen(false)}
                confirmText="Sí, borrar"
                cancelText="Cancelar"
            />
            <div className="main-header">
                 <div className="header-title-wrapper">
                    <Logo />
                    <div>
                        <h1>Panel de {gym.name}</h1>
                        <p>Gestión de clientes y biblioteca.</p>
                    </div>
                </div>
                 <div className="admin-header-nav">
                     <button
                        className={`header-nav-button ${view === 'clients' ? 'active' : ''}`}
                        onClick={() => setView('clients')}
                    >
                        Clientes
                    </button>
                    <button
                        className={`header-nav-button ${view === 'library' ? 'active' : ''}`}
                        onClick={() => setView('library')}
                    >
                        Biblioteca de Ejercicios
                    </button>
                    <button className="logout-button admin-logout" onClick={onLogout}>Cerrar Sesión</button>
                </div>
            </div>

            {view === 'clients' && (
                <>
                <div className="client-management-bar">
                    <div className="add-client-form">
                        <form onSubmit={handleAddClient}>
                            <input
                                type="text"
                                value={newClientDni}
                                onChange={(e) => { setNewClientDni(e.target.value); setError(''); }}
                                placeholder="DNI del nuevo cliente"
                            />
                            <button className="cta-button" type="submit" disabled={isAdding}>
                                {isAdding ? <span className="spinner small" /> : 'Agregar'}
                            </button>
                        </form>
                         {error && <p className="error-text" style={{marginTop: '0.5rem'}}>{error}</p>}
                    </div>
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
                        <button className={`view-toggle-button ${activeView === 'active' ? 'active' : ''}`} onClick={() => setActiveView('active')}>Activos</button>
                        <button className={`view-toggle-button ${activeView === 'archived' ? 'active' : ''}`} onClick={() => setActiveView('archived')}>Archivados</button>
                    </div>
                    <div className="selection-controls">
                        <button className="selection-toggle-button" onClick={toggleSelectionMode}>
                            {selectionMode ? 'Cancelar Selección' : 'Seleccionar Varios'}
                        </button>
                         {selectionMode && (
                             <>
                                <button className="selection-toggle-button" onClick={selectAll}>Todos</button>
                                {activeView === 'active' ? (
                                    <button className="archive-selected-button" disabled={selectedClients.size === 0} onClick={handleBatchArchive}>Archivar</button>
                                ) : (
                                    <button className="restore-selected-button" disabled={selectedClients.size === 0} onClick={handleBatchRestore}>Restaurar</button>
                                )}
                                <button className="delete-selected-button" disabled={selectedClients.size === 0} onClick={openDeleteModal}>Borrar</button>
                             </>
                         )}
                    </div>
                </div>


                {isLoading ? (
                    <div className="loading-container"><div className="spinner" /></div>
                ) : (
                    <div className="client-list">
                        {filteredClients.map(client => (
                            <div
                                key={client.dni}
                                className={`client-card ${selectionMode ? 'selection-mode' : ''} ${selectedClients.has(client.dni) ? 'selected' : ''}`}
                                onClick={() => handleSelectClient(client.dni)}
                            >
                                {selectionMode && (
                                    <input
                                        type="checkbox"
                                        className="client-selection-checkbox"
                                        checked={selectedClients.has(client.dni)}
                                        readOnly
                                    />
                                )}
                                <h3>{client.profile.name || 'Sin Nombre'}</h3>
                                <p>DNI: {client.dni}</p>
                                <p>Plan: {client.planName}</p>
                            </div>
                        ))}
                         {filteredClients.length === 0 && (
                            <p>No se encontraron clientes que coincidan.</p>
                        )}
                    </div>
                )}
                </>
            )}
            
             {view === 'library' && (
                <ExerciseLibraryManager gymId={gym._id} />
            )}

        </div>
    );
};

// --- Library Manager ---
const ExerciseLibraryManager = ({ gymId }: { gymId: string }) => {
    const [library, setLibrary] = useState<ExerciseLibrary>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    // For adding a new exercise
    const [newExerciseName, setNewExerciseName] = useState('');
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('');

    // For editing an exercise
    const [editingExercise, setEditingExercise] = useState<{ group: string, index: number } | null>(null);
    const [editingName, setEditingName] = useState('');
    
    // For accordions
    const [openMuscleGroups, setOpenMuscleGroups] = useState<Set<string>>(new Set());
    

    const muscleGroups = useMemo(() => Object.keys(library).sort(), [library]);

    const fetchLibrary = async () => {
        setIsLoading(true);
        const fetchedLibrary = await apiClient.getExerciseLibrary(gymId);
        setLibrary(fetchedLibrary);
        setSelectedMuscleGroup(Object.keys(fetchedLibrary)[0] || '');
        setIsLoading(false);
    };

    useEffect(() => {
        fetchLibrary();
    }, [gymId]);

    const handleAddExercise = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!newExerciseName.trim() || !selectedMuscleGroup) {
            setError("El nombre y el grupo muscular son requeridos.");
            return;
        }

        const updatedLibrary = { ...library };
        const newExercise: ExerciseDefinition = { name: newExerciseName.trim(), isEnabled: true, youtubeLink: '' };
        
        updatedLibrary[selectedMuscleGroup] = [...updatedLibrary[selectedMuscleGroup], newExercise]
            .sort((a, b) => a.name.localeCompare(b.name));

        setLibrary(updatedLibrary);
        setNewExerciseName('');
        await saveLibrary(updatedLibrary);
    };

    const handleUpdateExercise = (group: string, index: number, field: keyof ExerciseDefinition, value: any) => {
        const updatedLibrary = { ...library };
        updatedLibrary[group][index] = { ...updatedLibrary[group][index], [field]: value };
        setLibrary(updatedLibrary);
    };

    const startEditing = (group: string, index: number) => {
        setEditingExercise({ group, index });
        setEditingName(library[group][index].name);
    };

    const cancelEditing = () => {
        setEditingExercise(null);
        setEditingName('');
    };

    const saveEditing = async (group: string, index: number) => {
        const updatedLibrary = { ...library };
        updatedLibrary[group][index].name = editingName;
        // Re-sort the list after name change
        updatedLibrary[group].sort((a, b) => a.name.localeCompare(b.name));
        setLibrary(updatedLibrary);
        setEditingExercise(null);
        setEditingName('');
        await saveLibrary(updatedLibrary);
    };
    
    const handleDeleteExercise = async (group: string, index: number) => {
        const updatedLibrary = { ...library };
        updatedLibrary[group].splice(index, 1);
        if(updatedLibrary[group].length === 0) {
            delete updatedLibrary[group];
        }
        setLibrary(updatedLibrary);
        await saveLibrary(updatedLibrary);
    };

    const saveLibrary = async (libToSave: ExerciseLibrary) => {
        setIsSaving(true);
        await apiClient.saveExerciseLibrary(libToSave, gymId);
        setIsSaving(false);
    };
    
     const toggleAccordion = (group: string) => {
        const newSet = new Set(openMuscleGroups);
        if (newSet.has(group)) {
            newSet.delete(group);
        } else {
            newSet.add(group);
        }
        setOpenMuscleGroups(newSet);
    };
    
    if (isLoading) {
        return <div className="loading-container"><div className="spinner"/></div>
    }

    return (
        <div className="library-container">
            <div className="library-instructions">
                <p>Gestioná los ejercicios disponibles para la IA. Podés agregar, editar, borrar o desactivar temporalmente cualquier ejercicio. Los cambios se guardarán automáticamente.</p>
            </div>

            <div className="add-exercise-container">
                 <div className="add-exercise-form-wrapper">
                    <h3>Agregar Nuevo Ejercicio</h3>
                    <form className="add-exercise-form" onSubmit={handleAddExercise}>
                        <input
                            type="text"
                            value={newExerciseName}
                            onChange={(e) => setNewExerciseName(e.target.value)}
                            placeholder="Nombre del nuevo ejercicio"
                        />
                        <select
                            value={selectedMuscleGroup}
                            onChange={(e) => setSelectedMuscleGroup(e.target.value)}
                        >
                            {muscleGroups.map(group => (
                                <option key={group} value={group}>{group}</option>
                            ))}
                        </select>
                        <button type="submit" disabled={isSaving}>Agregar</button>
                    </form>
                    {error && <p className="error-text">{error}</p>}
                </div>
                 {isSaving && <div><span className="spinner small"/> Guardando...</div>}
            </div>
            
            <div className="library-accordion">
                {muscleGroups.map(group => (
                    <div key={group} className="library-accordion-item">
                        <button
                            className={`library-accordion-header ${openMuscleGroups.has(group) ? 'active' : ''}`}
                            onClick={() => toggleAccordion(group)}
                        >
                           <span>{group} ({library[group].length})</span>
                           <span className="icon">{openMuscleGroups.has(group) ? '×' : '+'}</span>
                        </button>
                        <div className={`library-accordion-content ${openMuscleGroups.has(group) ? 'open' : ''}`}>
                             <div className="exercise-entry-list">
                                <div className="exercise-entry-header">
                                    <span>Activado</span>
                                    <span>Nombre del Ejercicio</span>
                                    <span>Link de YouTube</span>
                                    <span>Acciones</span>
                                </div>
                                {library[group].map((ex, index) => (
                                    <div key={ex.name + index} className="exercise-entry-row">
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={ex.isEnabled}
                                                onChange={e => {
                                                    handleUpdateExercise(group, index, 'isEnabled', e.target.checked);
                                                    saveLibrary(library);
                                                }}
                                            />
                                            <span className="slider round"></span>
                                        </label>
                                        
                                        {editingExercise?.group === group && editingExercise?.index === index ? (
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={e => setEditingName(e.target.value)}
                                                className="editing-input"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="exercise-name-lib">{ex.name}</span>
                                        )}
                                        
                                        <input
                                            type="text"
                                            className="link-input"
                                            placeholder="URL de YouTube (opcional)"
                                            value={ex.youtubeLink}
                                            onChange={(e) => handleUpdateExercise(group, index, 'youtubeLink', e.target.value)}
                                            onBlur={() => saveLibrary(library)}
                                        />
                                        
                                        <div className="exercise-row-actions">
                                            {editingExercise?.group === group && editingExercise?.index === index ? (
                                                <>
                                                    <button className="action-btn save" onClick={() => saveEditing(group, index)}>Guardar</button>
                                                    <button className="action-btn cancel" onClick={cancelEditing}>Cancelar</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button className="action-btn edit" onClick={() => startEditing(group, index)}>Editar</button>
                                                    <button className="action-btn delete" onClick={() => handleDeleteExercise(group, index)}>Borrar</button>
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


// --- Portal de Gestión de Cliente ---
const ClientManagementPortal = ({ dni, onBack, gymId }: { dni: string; onBack: () => void; gymId: string; }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [initialClientData, setInitialClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
    const [ai, setAi] = useState<GoogleGenAI | null>(null);
    const [currentTab, setCurrentTab] = useState<'routine' | 'diet'>('routine');
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({});
    const [adminInstructions, setAdminInstructions] = useState('');

    useEffect(() => {
        const initialize = async () => {
            setIsLoading(true);
            try {
                const fetchedClientData = await apiClient.getClientData(dni);
                const fetchedLibrary = await apiClient.getExerciseLibrary(gymId);
                if (fetchedClientData) {
                    setClientData(fetchedClientData);
                    setInitialClientData(JSON.parse(JSON.stringify(fetchedClientData)));
                } else {
                    setError('No se pudo encontrar el cliente.');
                }
                setExerciseLibrary(fetchedLibrary);
                
                if (process.env.API_KEY) {
                    setAi(new GoogleGenAI({ apiKey: process.env.API_KEY }));
                } else {
                     setError("La API key de Gemini no está configurada.");
                }

            } catch (err) {
                setError('Error al cargar los datos.');
                console.error(err);
            }
            setIsLoading(false);
        };
        initialize();
    }, [dni, gymId]);

    const handleProfileChange = (field: keyof Profile, value: string) => {
        if (!clientData) return;
        setClientData({
            ...clientData,
            profile: { ...clientData.profile, [field]: value }
        });
    };
    
    // --- Handlers for Routine Editing ---
    const handleExerciseChange = (phaseIdx: number, dayIdx: number, exIdx: number, field: keyof Exercise, value: string) => {
        if (!clientData || !clientData.routine) return;
        const newClientData = JSON.parse(JSON.stringify(clientData));
        newClientData.routine.phases[phaseIdx].routine.dias[dayIdx].ejercicios[exIdx][field] = value;
        setClientData(newClientData);
    };

    const handleAddExercise = (phaseIdx: number, dayIdx: number) => {
        if (!clientData || !clientData.routine) return;
        const newClientData = JSON.parse(JSON.stringify(clientData));
        newClientData.routine.phases[phaseIdx].routine.dias[dayIdx].ejercicios.push({
            nombre: 'Seleccionar ejercicio',
            series: '3',
            repeticiones: '10',
            descanso: '60s',
            tecnicaAvanzada: '',
        });
        setClientData(newClientData);
    };
    
    const handleDeleteExercise = (phaseIdx: number, dayIdx: number, exIdx: number) => {
        if (!clientData || !clientData.routine) return;
        const newClientData = JSON.parse(JSON.stringify(clientData));
        newClientData.routine.phases[phaseIdx].routine.dias[dayIdx].ejercicios.splice(exIdx, 1);
        setClientData(newClientData);
    };


    const bodyFocusOptions = useMemo(() => {
        if (clientData?.profile.bodyFocusArea === 'Tren Superior') {
            return ["Pecho y Espalda", "Hombros y Brazos", "Énfasis en Pecho", "Énfasis en Espalda", "Énfasis en Hombros"];
        }
        if (clientData?.profile.bodyFocusArea === 'Tren Inferior') {
            return ["Glúteos y Femorales", "Cuádriceps y Gemelos", "Énfasis en Glúteos", "Énfasis en Cuádriceps", "Énfasis en Femorales"];
        }
        return [];
    }, [clientData?.profile.bodyFocusArea]);
    
    useEffect(() => {
        if(clientData && clientData.profile.bodyFocusArea !== 'Cuerpo completo' && !bodyFocusOptions.includes(clientData.profile.bodyFocusSpecific)) {
            handleProfileChange('bodyFocusSpecific', bodyFocusOptions[0] || '');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientData?.profile.bodyFocusArea, bodyFocusOptions]);


    const isDataChanged = useMemo(() => {
        return JSON.stringify(clientData) !== JSON.stringify(initialClientData);
    }, [clientData, initialClientData]);

    const handleSaveChanges = async () => {
        if (!clientData || !isDataChanged) return;
        setIsSaving(true);
        // We only need to send the parts that can be changed on this screen
        const dataToSave: Partial<ClientData> = {
            profile: clientData.profile,
            routine: clientData.routine,
            dietPlan: clientData.dietPlan,
        };
        const success = await apiClient.saveClientData(dni, dataToSave);
        if (success) {
            setInitialClientData(JSON.parse(JSON.stringify(clientData))); // Update baseline
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            setError("No se pudieron guardar los cambios.");
        }
        setIsSaving(false);
    };

    const generatePlan = async (type: 'routine' | 'diet') => {
        if (!ai || !clientData) return;

        setIsGenerating(true);
        setError('');

        const { profile } = clientData;
        const enabledExercises = Object.entries(exerciseLibrary).reduce((acc, [group, exercises]) => {
            const enabled = exercises.filter(ex => ex.isEnabled).map(ex => ex.name);
            if (enabled.length > 0) acc[group] = enabled;
            return acc;
        }, {} as Record<string, string[]>);
        
        const baseSystemInstruction = `Sos un entrenador personal de élite creando un plan para un cliente. Tu nombre es Scorpion AI. Usá un tono profesional pero motivador y siempre hablale de "vos" al cliente. El plan debe ser detallado, estructurado y fácil de seguir. NO inventes ejercicios, solo usá los de la lista proporcionada. El plan debe estar en formato JSON.`;
        
        const profileContext = `Aquí está el perfil del cliente para el que estás creando el plan: ${JSON.stringify(profile)}.`;
        
        const exerciseListContext = `Esta es la lista de ejercicios disponibles, agrupados por músculo. DEBES usar únicamente ejercicios de esta lista: ${JSON.stringify(enabledExercises)}.`;

        let specificInstructions = '';
        let responseSchema: any = {};
        
        if (type === 'routine') {
             specificInstructions = `
                Creá un plan de entrenamiento completo.
                - **Estructura del Plan:** El plan debe tener un nombre ("planName"). La duración total en semanas ("totalDurationWeeks") se basa en las fases.
                - **Fases:**
                    - Si "includeAdaptationPhase" es "Sí", la primera fase DEBE ser una "Fase de Adaptación" de 2 semanas.
                    - Las fases subsiguientes ("Fase de Hipertrofia", "Fase de Fuerza", "Fase de Resistencia", etc.) deben durar 4 semanas cada una. El nombre de las fases debe reflejar el objetivo principal ("goal").
                    - **MUY IMPORTANTE:** Al final del plan, DEBES añadir OBLIGATORIAMENTE una fase de 1 semana llamada "Semana de Descarga", con menos volumen (menos series) y menor intensidad.
                - **Estructura de la Rutina Diaria:**
                    - Cada día ("dia") debe tener un "grupoMuscular" principal y el número del día como string (ej: "1", "2").
                    - La cantidad de ejercicios por día debe respetar la "trainingIntensity":
                        - Baja: 4-6 ejercicios.
                        - Moderada: 5-8 ejercicios.
                        - Alta: 7-10 ejercicios.
                        - Extrema: 10-13 ejercicios.
                    - **Series y Repeticiones:** Adapta las series y repeticiones al nivel ("level") y objetivo ("goal") del cliente. Para intensidad "Alta" o "Extrema", DEBES mezclar rangos de repeticiones (ej: series de fuerza 4-6 reps, hipertrofia 8-12 reps, y resistencia 15-20 reps) para un estímulo completo.
                    - **Descanso:** El descanso ("descanso") debe estar en segundos (ej: "60s").
                    - Si "useAdvancedTechniques" es "Sí", incluí una "tecnicaAvanzada" en el último ejercicio del grupo muscular principal de cada día. Usá una de estas opciones: ${advancedTechniqueOptions.filter(o=>o.value).map(o=>`"${o.label}"`).join(', ')}.
                    - El cardio ("cardio") debe ser apropiado para el objetivo (ej: HIIT para pérdida de grasa, LISS para hipertrofia).
            `;
            responseSchema = {
                type: Type.OBJECT,
                properties: {
                    planName: { type: Type.STRING },
                    totalDurationWeeks: { type: Type.NUMBER },
                    phases: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                phaseName: { type: Type.STRING },
                                durationWeeks: { type: Type.NUMBER },
                                routine: {
                                    type: Type.OBJECT,
                                    properties: {
                                        dias: {
                                            type: Type.ARRAY,
                                            items: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    dia: { type: Type.STRING },
                                                    grupoMuscular: { type: Type.STRING },
                                                    ejercicios: {
                                                        type: Type.ARRAY,
                                                        items: {
                                                            type: Type.OBJECT,
                                                            properties: {
                                                                nombre: { type: Type.STRING },
                                                                series: { type: Type.STRING },
                                                                repeticiones: { type: Type.STRING },
                                                                descanso: { type: Type.STRING },
                                                                tecnicaAvanzada: { type: Type.STRING, nullable: true },
                                                            },
                                                        },
                                                    },
                                                    cardio: { type: Type.STRING },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            };
        } else { // diet
             specificInstructions = `
                Creá un plan de nutrición detallado.
                - **Título y Resumen:** El plan debe tener un "planTitle" y un "summary" con el total de calorías ("totalCalories") y macronutrientes en gramos ("proteinGrams", "carbsGrams", "fatGrams"). Las calorías deben ser calculadas con la fórmula de Harris-Benedict y el factor de actividad del cliente.
                - **Comidas:** Estructurá el plan en 5 comidas ("meals"): Desayuno, Media Mañana, Almuerzo, Merienda y Cena.
                - **Alimentos:** Cada comida ("mealName") debe tener una lista de alimentos ("foodItems") con el nombre ("food") y la cantidad ("amount") en gramos o unidades.
                - **Recomendaciones:** Incluí una sección de "recommendations" con 3-5 consejos generales sobre hidratación, timing de nutrientes, etc.
                - **Consideraciones:** Basá las cantidades y tipos de alimentos en el objetivo del cliente (ej: más proteína para hipertrofia, déficit calórico para pérdida de grasa).
            `;
             if (adminInstructions) {
                specificInstructions += `\n- **Instrucciones Adicionales del Entrenador (MUY IMPORTANTE):** El entrenador ha añadido estas notas. DEBES seguirlas al pie de la letra: "${adminInstructions}"`;
            }

            responseSchema = {
                type: Type.OBJECT,
                properties: {
                    planTitle: { type: Type.STRING },
                    summary: {
                        type: Type.OBJECT,
                        properties: {
                            totalCalories: { type: Type.NUMBER },
                            macronutrients: {
                                type: Type.OBJECT,
                                properties: {
                                    proteinGrams: { type: Type.NUMBER },
                                    carbsGrams: { type: Type.NUMBER },
                                    fatGrams: { type: Type.NUMBER },
                                }
                            }
                        }
                    },
                    meals: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                mealName: { type: Type.STRING },
                                foodItems: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            food: { type: Type.STRING },
                                            amount: { type: Type.STRING },
                                        }
                                    }
                                }
                            }
                        }
                    },
                    recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                }
            };
        }

        try {
            const finalSystemInstruction = `${baseSystemInstruction}\n${profileContext}\n${exerciseListContext}\n${specificInstructions}`;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: "Generá el plan solicitado.",
                config: {
                    systemInstruction: finalSystemInstruction,
                    responseMimeType: 'application/json',
                    responseSchema: responseSchema,
                }
            });
            
            const jsonText = response.text.trim();
            const planData = JSON.parse(jsonText);

            const updatedClientData = { ...clientData };
            const updatePayload: Partial<ClientData> = {};

            if (type === 'routine') {
                updatedClientData.routine = planData as Routine;
                updatedClientData.routineGeneratedDate = new Date().toISOString();
                updatePayload.routine = updatedClientData.routine;
                updatePayload.routineGeneratedDate = updatedClientData.routineGeneratedDate;
            } else {
                updatedClientData.dietPlan = planData as DietPlan;
                updatePayload.dietPlan = updatedClientData.dietPlan;
            }
            
            await apiClient.saveClientData(dni, updatePayload);
            setClientData(updatedClientData);
            setInitialClientData(JSON.parse(JSON.stringify(updatedClientData))); // Update baseline after generation

        } catch (error: any) {
            console.error(`Error generating ${type}:`, error);
            setError(`Hubo un error al generar el plan de ${type}. Detalles: ${error.message || 'Error desconocido'}`);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const bmiDetails = useMemo(() => {
        if (!clientData) return null;
        const weight = parseFloat(clientData.profile.weight);
        const height = parseFloat(clientData.profile.height);
        return getBmiDetails(weight, height);
    }, [clientData]);

    if (isLoading) {
        return <div className="loading-container"><div className="spinner" /></div>;
    }

    if (error && !clientData) {
        return <div className="error-container">{error}</div>;
    }
    
    if (!clientData) {
         return <div className="error-container">No se encontraron datos del cliente.</div>;
    }

    return (
        <div className="client-management-dashboard">
            <div className="main-header">
                <div className="header-title-wrapper">
                    <div>
                        <h1>{clientData.profile.name || `Cliente DNI: ${dni}`}</h1>
                        <p>Gestioná el perfil y los planes de entrenamiento.</p>
                    </div>
                </div>
                <button className="back-button" onClick={onBack}>← Volver a la Lista</button>
            </div>
            
            <div className="dashboard-grid">
                <aside className="profile-section">
                    <h2>Perfil del Cliente</h2>
                    <form className="profile-form">
                        <div className="form-group">
                            <label>Nombre</label>
                            <input type="text" value={clientData.profile.name} onChange={e => handleProfileChange('name', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>DNI</label>
                            <input type="text" value={clientData.dni} readOnly />
                        </div>
                        <div className="form-group">
                            <label>Edad</label>
                            <input type="number" value={clientData.profile.age} onChange={e => handleProfileChange('age', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Peso (kg)</label>
                            <input type="number" step="0.1" value={clientData.profile.weight} onChange={e => handleProfileChange('weight', e.target.value)} />
                        </div>
                         <div className="form-group">
                            <label>Altura (cm)</label>
                            <input type="number" value={clientData.profile.height} onChange={e => handleProfileChange('height', e.target.value)} />
                        </div>
                        {bmiDetails && bmiDetails.bmi && (
                             <div className="bmi-display">
                                <span>IMC: <strong>{bmiDetails.bmi.toFixed(1)}</strong></span>
                                <span className={`bmi-category ${bmiDetails.categoryClass}`}>{bmiDetails.category}</span>
                            </div>
                        )}
                         <div className="form-group">
                            <label>Género</label>
                            <select value={clientData.profile.gender} onChange={e => handleProfileChange('gender', e.target.value)}>
                                <option>Masculino</option>
                                <option>Femenino</option>
                                <option>Prefiero no decirlo</option>
                            </select>
                        </div>
                         <div className="form-group">
                            <label>Nivel de Experiencia</label>
                            <select value={clientData.profile.level} onChange={e => handleProfileChange('level', e.target.value)}>
                                <option>Principiante</option>
                                <option>Intermedio</option>
                                <option>Avanzado</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Objetivo Principal</label>
                            <select value={clientData.profile.goal} onChange={e => handleProfileChange('goal', e.target.value)}>
                                <option>Hipertrofia</option>
                                <option>Pérdida de grasa</option>
                                <option>Mantenimiento</option>
                                <option>Resistencia</option>
                            </select>
                        </div>
                         <div className="form-group">
                            <label>Días de Entrenamiento / Semana</label>
                            <input type="number" min="1" max="7" value={clientData.profile.trainingDays} onChange={e => handleProfileChange('trainingDays', e.target.value)} />
                        </div>
                         <div className="form-group">
                            <label>Factor de Actividad Diaria</label>
                            <select value={clientData.profile.activityFactor} onChange={e => handleProfileChange('activityFactor', e.target.value)}>
                                <option>Sedentario</option>
                                <option>Ligero</option>
                                <option>Activo</option>
                                <option>Muy Activo</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Intensidad del Entrenamiento</label>
                            <select value={clientData.profile.trainingIntensity} onChange={e => handleProfileChange('trainingIntensity', e.target.value)}>
                                <option>Baja</option>
                                <option>Moderada</option>
                                <option>Alta</option>
                                <option>Extrema</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Incluir Técnicas Avanzadas</label>
                            <select value={clientData.profile.useAdvancedTechniques} onChange={e => handleProfileChange('useAdvancedTechniques', e.target.value)}>
                                <option>No</option>
                                <option>Sí</option>
                            </select>
                        </div>
                         <div className="form-group">
                            <label>Incluir Fase de Adaptación</label>
                             <select value={clientData.profile.includeAdaptationPhase} onChange={e => handleProfileChange('includeAdaptationPhase', e.target.value)}>
                                <option>Sí</option>
                                <option>No</option>
                            </select>
                        </div>
                         <div className="form-group">
                            <label>Foco Corporal Principal</label>
                            <select value={clientData.profile.bodyFocusArea} onChange={e => handleProfileChange('bodyFocusArea', e.target.value)}>
                                <option>Cuerpo completo</option>
                                <option>Tren Superior</option>
                                <option>Tren Inferior</option>
                            </select>
                        </div>
                        {clientData.profile.bodyFocusArea !== 'Cuerpo completo' && (
                            <div className="form-group">
                                <label>Foco Específico</label>
                                <select value={clientData.profile.bodyFocusSpecific} onChange={e => handleProfileChange('bodyFocusSpecific', e.target.value)}>
                                    {bodyFocusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="access-code-display">
                            <span>Código de Acceso del Cliente</span>
                            <strong>{clientData.accessCode}</strong>
                        </div>
                    </form>
                </aside>
                <main className="main-content">
                    <div className="actions-bar">
                         <button
                            className={`save-changes-button ${saveStatus === 'saved' ? 'saved' : ''}`}
                            onClick={handleSaveChanges}
                            disabled={!isDataChanged || isSaving}
                        >
                            {isSaving ? <><span className="spinner small"/> Guardando...</> : saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Cambios'}
                        </button>
                    </div>

                    <nav className="main-tabs-nav">
                        <button className={`main-tab-button ${currentTab === 'routine' ? 'active' : ''}`} onClick={() => setCurrentTab('routine')}>Rutina</button>
                        <button className={`main-tab-button ${currentTab === 'diet' ? 'active' : ''}`} onClick={() => setCurrentTab('diet')}>Nutrición</button>
                    </nav>

                    <div className="results-section">
                        {error && <div className="error-container" style={{marginBottom: '1rem'}}>{error}</div>}

                        {currentTab === 'routine' && (
                            clientData.routine ?
                            <RoutinePlanViewer 
                                routine={clientData.routine} 
                                library={exerciseLibrary}
                                editable={true}
                                onExerciseChange={handleExerciseChange}
                                onAddExercise={handleAddExercise}
                                onDeleteExercise={handleDeleteExercise}
                             /> :
                            <div className="placeholder-action">
                                <h3>Este cliente aún no tiene una rutina.</h3>
                                <p>Revisá y guardá el perfil, luego generá una nueva rutina personalizada.</p>
                                <button className="cta-button" onClick={() => generatePlan('routine')} disabled={isGenerating}>
                                    {isGenerating ? <><span className="spinner small" /> Generando...</> : 'Generar Rutina con IA'}
                                </button>
                            </div>
                        )}

                        {currentTab === 'diet' && (
                            clientData.dietPlan ?
                            <DietPlanViewer dietPlan={clientData.dietPlan} /> :
                             <div className="placeholder-action">
                                <h3>Este cliente aún no tiene un plan de nutrición.</h3>
                                <div className="admin-instructions-box">
                                     <label htmlFor="adminInstructions">Instrucciones Adicionales (Opcional)</label>
                                     <textarea
                                        id="adminInstructions"
                                        rows={3}
                                        placeholder="Ej: Cliente es intolerante a la lactosa. Prefiere no comer carne roja."
                                        value={adminInstructions}
                                        onChange={e => setAdminInstructions(e.target.value)}
                                     />
                                </div>
                                <button className="cta-button" onClick={() => generatePlan('diet')} disabled={isGenerating}>
                                    {isGenerating ? <><span className="spinner small" /> Generando...</> : 'Generar Plan de Nutrición'}
                                </button>
                            </div>
                        )}
                         
                        {(currentTab === 'routine' && clientData.routine) && (
                             <button className="cta-button regenerate" onClick={() => generatePlan('routine')} disabled={isGenerating}>
                                {isGenerating ? <><span className="spinner small" /> Regenerando...</> : 'Regenerar Rutina'}
                             </button>
                        )}
                        {(currentTab === 'diet' && clientData.dietPlan) && (
                            <>
                             <div className="admin-instructions-box">
                                     <label htmlFor="adminInstructions">Instrucciones Adicionales (Opcional)</label>
                                     <textarea
                                        id="adminInstructions"
                                        rows={3}
                                        placeholder="Ej: Cliente es intolerante a la lactosa. Prefiere no comer carne roja."
                                        value={adminInstructions}
                                        onChange={e => setAdminInstructions(e.target.value)}
                                     />
                                </div>
                                <button className="cta-button regenerate" onClick={() => generatePlan('diet')} disabled={isGenerating}>
                                    {isGenerating ? <><span className="spinner small" /> Regenerando...</> : 'Regenerar Plan de Nutrición'}
                                </button>
                            </>
                        )}
                    </div>

                </main>
            </div>
        </div>
    );
};


// --- Visores de Planes ---
const RoutinePlanViewer = ({ 
    routine, 
    library, 
    editable = false,
    onExerciseChange,
    onAddExercise,
    onDeleteExercise
}: { 
    routine: Routine, 
    library: ExerciseLibrary, 
    editable?: boolean,
    onExerciseChange?: (phaseIdx: number, dayIdx: number, exIdx: number, field: keyof Exercise, value: string) => void,
    onAddExercise?: (phaseIdx: number, dayIdx: number) => void,
    onDeleteExercise?: (phaseIdx: number, dayIdx: number, exIdx: number) => void
}) => {
    const [activePhaseIndex, setActivePhaseIndex] = useState(0);
    const [activeDayIndex, setActiveDayIndex] = useState(0);
    
    const [openPhases, setOpenPhases] = useState<Set<number>>(new Set([0]));

    const allExercises = useMemo(() => {
        return Object.entries(library).map(([group, exercises]) => (
            <optgroup label={group} key={group}>
                {exercises.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
            </optgroup>
        ));
    }, [library]);
    
    const togglePhase = (index: number) => {
        const newSet = new Set(openPhases);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
            setActivePhaseIndex(index);
            setActiveDayIndex(0);
        }
        setOpenPhases(newSet);
    };

    const getYoutubeLink = (exerciseName: string) => {
        for (const group in library) {
            const exercise = library[group].find(ex => ex.name === exerciseName);
            if (exercise && exercise.youtubeLink) {
                return exercise.youtubeLink;
            }
        }
        return null;
    };
    
    if (!routine || !routine.phases || routine.phases.length === 0) {
        return <div className="placeholder">La rutina generada no es válida.</div>;
    }

    const activePhase = routine.phases[activePhaseIndex];
    if (!activePhase || !activePhase.routine || !activePhase.routine.dias) {
        return <div className="placeholder">Fase de rutina no válida.</div>;
    }
    const activeDay = activePhase.routine.dias[activeDayIndex];

    return (
        <div className={`plan-container routine-plan ${editable ? 'editable' : ''}`}>
            <div className="plan-header">
                <h2>{routine.planName}</h2>
                <p>Duración total: {routine.totalDurationWeeks} semanas</p>
            </div>
             <div className="accordion-phases">
                {routine.phases.map((phase, phaseIndex) => (
                    <div key={phaseIndex} className="accordion-item">
                        <button
                            className={`accordion-header ${openPhases.has(phaseIndex) ? 'active' : ''}`}
                            onClick={() => togglePhase(phaseIndex)}
                        >
                            <span>{phase.phaseName} ({phase.durationWeeks} semanas)</span>
                            <span className="accordion-header-icon">{openPhases.has(phaseIndex) ? '×' : '+'}</span>
                        </button>
                        <div className={`accordion-content ${openPhases.has(phaseIndex) ? 'open' : ''}`}>
                            {openPhases.has(phaseIndex) && (
                                <>
                                 <nav className="day-tabs-nav">
                                    {phase.routine.dias.map((day, dayIndex) => (
                                        <button
                                            key={day.dia + dayIndex}
                                            className={`day-tab-button ${activePhaseIndex === phaseIndex && activeDayIndex === dayIndex ? 'active' : ''}`}
                                            onClick={() => {
                                                setActivePhaseIndex(phaseIndex);
                                                setActiveDayIndex(dayIndex);
                                            }}
                                        >
                                            Día {day.dia.replace('Día ', '')}
                                        </button>
                                    ))}
                                </nav>
                                {activePhaseIndex === phaseIndex && activeDay && (
                                    <div className="day-card animated-fade-in">
                                        <h3>Día {activeDay.dia.replace('Día ', '')}: <span className="muscle-group">{activeDay.grupoMuscular}</span></h3>
                                        <ul className="exercise-list">
                                            {activeDay.ejercicios.map((ex, exIndex) => (
                                                <li key={exIndex} className={`exercise-item ${editable ? 'editable' : ''}`}>
                                                    {editable && onExerciseChange && onDeleteExercise ? (
                                                        <div className="exercise-item-editor">
                                                            <div className="editor-row editor-row-main">
                                                                 <select 
                                                                    className="exercise-select"
                                                                    value={ex.nombre}
                                                                    onChange={(e) => onExerciseChange(phaseIndex, activeDayIndex, exIndex, 'nombre', e.target.value)}
                                                                >
                                                                    <option disabled>Seleccionar ejercicio</option>
                                                                    {allExercises}
                                                                </select>
                                                                <button className="delete-exercise-btn" onClick={() => onDeleteExercise(phaseIndex, activeDayIndex, exIndex)}>
                                                                    &times;
                                                                </button>
                                                            </div>
                                                            <div className="editor-row">
                                                                <div className="form-group-inline"><label>Series</label><input type="text" value={ex.series} onChange={e => onExerciseChange(phaseIndex, activeDayIndex, exIndex, 'series', e.target.value)} /></div>
                                                                <div className="form-group-inline"><label>Reps</label><input type="text" value={ex.repeticiones} onChange={e => onExerciseChange(phaseIndex, activeDayIndex, exIndex, 'repeticiones', e.target.value)} /></div>
                                                                <div className="form-group-inline"><label>Descanso</label><input type="text" value={ex.descanso} onChange={e => onExerciseChange(phaseIndex, activeDayIndex, exIndex, 'descanso', e.target.value)} /></div>
                                                            </div>
                                                            <div className="editor-row">
                                                                <div className="form-group-inline full-width">
                                                                    <label>Técnica Avanzada</label>
                                                                     <select value={ex.tecnicaAvanzada || ''} onChange={e => onExerciseChange(phaseIndex, activeDayIndex, exIndex, 'tecnicaAvanzada', e.target.value)}>
                                                                        {advancedTechniqueOptions.map(opt => <option key={opt.label} value={opt.value}>{opt.label}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                         <>
                                                            <div className="exercise-name-wrapper">
                                                                <span className="exercise-name">{ex.nombre}</span>
                                                                {getYoutubeLink(ex.nombre) && (
                                                                    <a href={getYoutubeLink(ex.nombre) || ''} target="_blank" rel="noopener noreferrer" className="video-link" title="Ver video en YouTube">
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 15.274l6-3.774-6-3.774v7.548z"/><path d="M21.583 6.478a2.498 2.498 0 0 0-1.75-1.75C18.253 4.5 12 4.5 12 4.5s-6.253 0-7.833.228a2.498 2.498 0 0 0-1.75 1.75C2.228 8.058 2 12 2 12s.228 3.942.417 5.522a2.498 2.498 0 0 0 1.75 1.75C5.747 19.5 12 19.5 12 19.5s6.253 0 7.833-.228a2.498 2.498 0 0 0 1.75-1.75C21.772 15.942 22 12 22 12s-.228-3.942-.417-5.522zM12 17.5c-5.145 0-6.843-.19-7.5-.373A.5.5 0 0 1 4.127 16.75c-.183-.657-.373-2.355-.373-4.75s.19-4.093.373-4.75a.5.5 0 0 1 .373-.373c.657-.183 2.355-.373 4.75-.373s4.093.19 4.75.373a.5.5 0 0 1 .373.373c.183.657.373 2.355.373 4.75s-.19 4.093-.373 4.75a.5.5 0 0 1-.373.373c-.657.183-2.355.373-4.75-.373z"/></svg>
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <div className="exercise-details">
                                                                <span><strong>Series:</strong> {ex.series}</span>
                                                                <span><strong>Reps:</strong> {ex.repeticiones}</span>
                                                                <span><strong>Descanso:</strong> {ex.descanso}</span>
                                                            </div>
                                                            {ex.tecnicaAvanzada && (
                                                                <div className="advanced-technique">
                                                                    <span role="img" aria-label="fire">🔥</span>
                                                                    <strong>Técnica Avanzada:</strong> {ex.tecnicaAvanzada}
                                                                </div>
                                                            )}
                                                         </>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                         {editable && onAddExercise && (
                                            <div className="add-exercise-action">
                                                <button className="add-exercise-button" onClick={() => onAddExercise(phaseIndex, activeDayIndex)}>
                                                    + Agregar Ejercicio
                                                </button>
                                            </div>
                                        )}
                                        {activeDay.cardio && activeDay.cardio !== "N/A" && (
                                            <div className="cardio-note">
                                                <p><strong>Cardio:</strong> {activeDay.cardio}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const DietPlanViewer = ({ dietPlan }: { dietPlan: DietPlan }) => {
    return (
        <div className="diet-plan-container">
            <div className="plan-header">
                <h2>{dietPlan.planTitle}</h2>
            </div>
            <div className="diet-summary">
                <div>
                    <strong>Calorías Totales</strong>
                    <span>{dietPlan.summary.totalCalories.toLocaleString('es-AR')} kcal</span>
                </div>
                <div>
                    <strong>Proteínas</strong>
                    <span>{dietPlan.summary.macronutrients.proteinGrams} g</span>
                </div>
                <div>
                    <strong>Carbohidratos</strong>
                    <span>{dietPlan.summary.macronutrients.carbsGrams} g</span>
                </div>
                <div>
                    <strong>Grasas</strong>
                    <span>{dietPlan.summary.macronutrients.fatGrams} g</span>
                </div>
            </div>
            <div className="meals-grid">
                {dietPlan.meals.map(meal => (
                    <div key={meal.mealName} className="meal-card">
                        <h3>{meal.mealName}</h3>
                        <ul>
                            {meal.foodItems.map((item, index) => (
                                <li key={index}>
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
                        {dietPlan.recommendations.map((rec, index) => <li key={index}>{rec}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
};

// --- Portal de Cliente ---

const AgreementView = ({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void; }) => {
    const [isChecked, setIsChecked] = useState(false);
    
     const termsText = `
        Bienvenido a ScorpionGYM AI.
        
        Al utilizar esta aplicación, usted ("el Cliente") acepta los siguientes términos y condiciones:
        
        1.  **Propósito de la Aplicación:** Esta aplicación utiliza inteligencia artificial (IA) para generar sugerencias de planes de entrenamiento y nutrición basados en la información que usted proporciona.
        
        2.  **No es Consejo Médico:** Los planes y recomendaciones generados por la IA no constituyen consejo médico profesional, diagnóstico o tratamiento. Son sugerencias basadas en modelos de fitness y nutrición. Siempre consulte a un profesional de la salud calificado antes de comenzar cualquier programa de ejercicio o dieta, especialmente si tiene condiciones médicas preexistentes.
        
        3.  **Supervisión del Entrenador:** La IA es una herramienta para asistir a su entrenador personal. El plan final y cualquier ajuste deben ser siempre revisados, aprobados y supervisados por su entrenador del gimnasio. El entrenador es el responsable final de su programa.
        
        4.  **Riesgo y Responsabilidad:** Usted reconoce que cualquier actividad física conlleva riesgos inherentes. Usted asume toda la responsabilidad por cualquier lesión o problema de salud que pueda surgir del uso de los planes generados. ScorpionGYM, sus desarrolladores y su gimnasio no se hacen responsables de ningún daño directo o indirecto.
        
        5.  **Precisión de la Información:** La efectividad de los planes depende de la precisión de los datos que usted proporciona (peso, altura, objetivos, etc.). Es su responsabilidad mantener esta información actualizada.
        
        6.  **Uso de Datos:** Su información personal y de progreso se almacenará de forma segura y se utilizará únicamente para el propósito de generar y mejorar sus planes de entrenamiento. No se compartirá con terceros sin su consentimiento explícito.
        
        Al marcar la casilla y hacer clic en "Aceptar", usted confirma que ha leído, entendido y aceptado estos términos y condiciones en su totalidad.
    `;

    return (
        <div className="agreement-container">
            <h2>Términos y Condiciones de Uso</h2>
            <p>Por favor, leé atentamente antes de continuar.</p>
            <div className="terms-box">
                <p>{termsText}</p>
            </div>
            <div className="agreement-actions">
                <label className="agreement-checkbox">
                    <input type="checkbox" checked={isChecked} onChange={() => setIsChecked(!isChecked)} />
                    He leído y acepto los términos y condiciones.
                </label>
                <div className="agreement-buttons">
                     <button className="cta-button secondary" onClick={onDecline}>Rechazar</button>
                    <button className="cta-button" disabled={!isChecked} onClick={onAccept}>Aceptar y Continuar</button>
                </div>
            </div>
        </div>
    );
};

const ClientView = ({ dni, onLogout }: { dni: string; onLogout: () => void; }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [currentTab, setCurrentTab] = useState<'routine' | 'diet' | 'progress'>('routine');
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({});
    
     const [isChatOpen, setIsChatOpen] = useState(false);
     const [ai, setAi] = useState<GoogleGenAI | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const data = await apiClient.getClientData(dni);
            if (data) {
                if (!data.termsAccepted) {
                    setClientData(data); // Set data to show agreement screen
                } else {
                    const library = await apiClient.getExerciseLibrary(data.gymId);
                    setExerciseLibrary(library);
                    setClientData(data);
                }
                 if (process.env.API_KEY) {
                    setAi(new GoogleGenAI({ apiKey: process.env.API_KEY }));
                }
            } else {
                setError('No se pudo cargar tu información.');
            }
        } catch (err) {
            setError('Ocurrió un error al conectar con el servidor.');
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [dni]);

    const handleAcceptTerms = async () => {
        if (!clientData) return;
        const success = await apiClient.saveClientData(clientData.dni, { termsAccepted: true });
        if (success) {
            await fetchData(); // Refetch all data now that terms are accepted
        } else {
            setError("No se pudo guardar la aceptación. Por favor, intentalo de nuevo.");
        }
    };
    
    const isPlanExpired = useMemo(() => {
        if (!clientData?.routine || !clientData.routineGeneratedDate) return false;
        
        const generatedDate = new Date(clientData.routineGeneratedDate);
        const totalDurationDays = clientData.routine.totalDurationWeeks * 7;
        const expiryDate = new Date(generatedDate.getTime() + totalDurationDays * 24 * 60 * 60 * 1000);
        
        return new Date() > expiryDate;
    }, [clientData]);

    if (isLoading) {
        return <div className="loading-container"><div className="spinner" /></div>;
    }

    if (error) {
        return <div className="error-container">{error}</div>;
    }
    
    if (!clientData) {
        return (
            <div className="login-container">
                <div className="error-container">No se encontraron tus datos.</div>
                <button className="back-button simple" onClick={onLogout}>← Volver al inicio</button>
            </div>
        );
    }
    
    if (!clientData.termsAccepted) {
        return <AgreementView onAccept={handleAcceptTerms} onDecline={onLogout} />;
    }

    return (
        <div className="client-view-container">
             <ChatAssistantModal 
                isOpen={isChatOpen} 
                onClose={() => setIsChatOpen(false)} 
                ai={ai}
                clientData={clientData}
                onUpdateClientData={async (updates) => {
                    await apiClient.saveClientData(dni, updates);
                    // Optimistically update local state
                    setClientData(prev => prev ? { ...prev, ...updates } : null);
                }}
             />
             <div className="main-header">
                <div className="header-title-wrapper">
                    <h1>Hola, {clientData.profile.name}</h1>
                </div>
                 <button className="logout-button" onClick={onLogout}>Cerrar Sesión</button>
            </div>
            
            {isPlanExpired && (
                <div className="expired-view">
                    <h2>Tu plan ha finalizado</h2>
                    <p>¡Felicitaciones por completar tu rutina! Hablá con tu entrenador para que te genere un nuevo plan de entrenamiento y seguir progresando.</p>
                </div>
            )}
            
            {!isPlanExpired && (!clientData.routine || !clientData.dietPlan) && (
                 <div className="placeholder">
                    <h3>¡Ya casi estamos!</h3>
                    <p>Tu entrenador está preparando tu plan personalizado. Volvé a revisar pronto.</p>
                </div>
            )}
            
            {!isPlanExpired && clientData.routine && clientData.dietPlan && (
                <>
                <nav className="main-tabs-nav">
                    <button className={`main-tab-button ${currentTab === 'routine' ? 'active' : ''}`} onClick={() => setCurrentTab('routine')}>Mi Rutina</button>
                    <button className={`main-tab-button ${currentTab === 'diet' ? 'active' : ''}`} onClick={() => setCurrentTab('diet')}>Mi Nutrición</button>
                    <button className={`main-tab-button ${currentTab === 'progress' ? 'active' : ''}`} onClick={() => setCurrentTab('progress')}>Mi Progreso</button>
                </nav>
                
                {currentTab === 'routine' && <RoutinePlanViewer routine={clientData.routine} library={exerciseLibrary} />}
                {currentTab === 'diet' && <DietPlanViewer dietPlan={clientData.dietPlan} />}
                {currentTab === 'progress' && <ProgressView clientData={clientData} onDataUpdate={fetchData}/>}
                </>
            )}
            
             <button className="chat-fab" onClick={() => setIsChatOpen(true)} title="Asistente Scorpion AI">
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            </button>
        </div>
    );
};


// --- Progress View (Client) ---

const ProgressView = ({ clientData, onDataUpdate }: { clientData: ClientData; onDataUpdate: () => void; }) => {
    const [currentTab, setCurrentTab] = useState<'bodyweight' | 'exercises'>('bodyweight');
    const [newBodyWeight, setNewBodyWeight] = useState(clientData.profile.weight || '');
    const [weightLogStatus, setWeightLogStatus] = useState<'idle' | 'saved'>('idle');

    const handleLogBodyWeight = async () => {
        const weight = parseFloat(newBodyWeight);
        const height = parseFloat(clientData.profile.height);
        if (isNaN(weight) || weight <= 0) {
            alert("Por favor, ingresa un peso válido.");
            return;
        }

        const { bmi, categoryClass } = getBmiDetails(weight, height);

        const newEntry: BodyWeightEntry = {
            date: new Date().toISOString(),
            weight,
            imc: bmi || undefined,
            imcCategoryClass: categoryClass || undefined,
        };

        const updatedLog = [...(clientData.bodyWeightLog || []), newEntry];
        const success = await apiClient.saveClientData(clientData.dni, { bodyWeightLog: updatedLog });

        if (success) {
            setWeightLogStatus('saved');
            onDataUpdate(); // Refetch data in parent
            setTimeout(() => setWeightLogStatus('idle'), 2000);
        } else {
            alert("Hubo un error al guardar tu peso.");
        }
    };
    
    return (
        <div className="progress-view-container animated-fade-in">
             <div className="body-weight-logger">
                 <p>Registrá tu peso corporal de hoy:</p>
                 <div className="input-group">
                    <input
                        type="number"
                        step="0.1"
                        value={newBodyWeight}
                        onChange={e => setNewBodyWeight(e.target.value)}
                        placeholder="Peso en kg"
                    />
                    <button
                        className={`log-button ${weightLogStatus === 'saved' ? 'saved' : ''}`}
                        onClick={handleLogBodyWeight}
                    >
                         {weightLogStatus === 'saved' ? '✔' : 'Registrar'}
                    </button>
                 </div>
            </div>
             <nav className="progress-tabs-nav">
                <button className={`progress-tab-button ${currentTab === 'bodyweight' ? 'active' : ''}`} onClick={() => setCurrentTab('bodyweight')}>Peso Corporal</button>
                <button className={`progress-tab-button ${currentTab === 'exercises' ? 'active' : ''}`} onClick={() => setCurrentTab('exercises')}>Ejercicios</button>
            </nav>
            {currentTab === 'bodyweight' && <BodyWeightProgress clientData={clientData}/>}
            {currentTab === 'exercises' && <ExerciseProgress clientData={clientData}/>}
        </div>
    );
};

// ... (El resto de los componentes de progreso como BodyWeightProgress, ExerciseProgress, los Charts, etc., se mantienen igual)
// NOTE: For brevity in this diff, assume the complex D3 chart components and their helpers
// (BodyWeightProgress, ExerciseProgress, useD3, BarChart) are present and correct as they were.
// If they need changes, they would be included here. Let's re-add them for completeness.

const useD3 = (renderChartFn: (svg: any) => void, dependencies: any[]) => {
    const ref = useRef<SVGSVGElement>(null);
    const d3 = (window as any).d3; // Assuming D3 is loaded globally for simplicity

    useEffect(() => {
        if (ref.current && d3) {
            renderChartFn(d3.select(ref.current));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, dependencies);
    
    return ref;
};

const BodyWeightProgress = ({ clientData }: { clientData: ClientData }) => {
    const log = clientData.bodyWeightLog || [];

    return (
        <div className="animated-fade-in">
            {log.length < 2 ? (
                <p>Necesitás al menos dos registros de peso para ver un gráfico.</p>
            ) : (
                <BodyWeightChart data={log.slice(-10)} />
            )}
             <div className="progress-list-container">
                <h3>Historial de Peso Corporal</h3>
                {log.length > 0 ? (
                     <div className="progress-list">
                        <div className="progress-list-header weight"><span>Fecha</span><span>Peso (kg)</span><span>IMC</span></div>
                        {[...log].reverse().map(entry => (
                            <div key={entry.date} className="progress-list-row weight">
                                <span>{new Date(entry.date).toLocaleDateString('es-AR')}</span>
                                <span>{entry.weight.toFixed(1)}</span>
                                <span className={entry.imcCategoryClass}>{entry.imc?.toFixed(1) ?? 'N/A'}</span>
                            </div>
                        ))}
                     </div>
                ) : <p>Aún no registraste tu peso.</p>}
            </div>
        </div>
    );
};

const BodyWeightChart = ({ data }: { data: BodyWeightEntry[] }) => {
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current || data.length === 0) return;
        
        const d3 = (window as any).d3;
        if (!d3) return;

        const svg = d3.select(ref.current);
        svg.selectAll("*").remove(); // Clear previous chart

        const margin = { top: 40, right: 30, bottom: 40, left: 40 };
        const width = (ref.current as any).parentElement.clientWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const chart = svg
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(data.map(d => new Date(d.date).toLocaleDateString('es-AR')))
            .range([0, width])
            .padding(0.4);

        const y = d3.scaleLinear()
            .domain([d3.min(data, d => d.weight) * 0.9, d3.max(data, d => d.weight) * 1.05])
            .range([height, 0]);

        const y2 = d3.scaleLinear()
            .domain([d3.min(data, d => d.imc ?? 0) * 0.9, d3.max(data, d => d.imc ?? 0) * 1.05])
            .range([height, 0]);
        
        // Tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "chart-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "white")
            .style("border", "solid")
            .style("border-width", "1px")
            .style("border-radius", "5px")
            .style("padding", "10px");


        // Body Weight Bars
        chart.selectAll(".bar-body-weight")
            .data(data)
            .enter().append("rect")
            .attr("class", "bar-body-weight")
            .attr("x", d => x(new Date(d.date).toLocaleDateString('es-AR')))
            .attr("y", d => y(d.weight))
            .attr("width", x.bandwidth() / 2)
            .attr("height", d => height - y(d.weight))
             .on("mouseover", (event: any, d: any) => tooltip.style("visibility", "visible").text(`Peso: ${d.weight.toFixed(1)}kg`))
            .on("mousemove", (event: any) => tooltip.style("top",(event.pageY-10)+"px").style("left",(event.pageX+10)+"px"))
            .on("mouseout", () => tooltip.style("visibility", "hidden"));


        // IMC Bars
        chart.selectAll(".bar-imc")
            .data(data)
            .enter().append("rect")
            .attr("class", d => `bar-imc ${d.imcCategoryClass}`)
            .attr("x", d => x(new Date(d.date).toLocaleDateString('es-AR')) + x.bandwidth() / 2)
            .attr("y", d => y2(d.imc ?? 0))
            .attr("width", x.bandwidth() / 2)
            .attr("height", d => height - y2(d.imc ?? 0))
            .on("mouseover", (event: any, d: any) => tooltip.style("visibility", "visible").text(`IMC: ${d.imc?.toFixed(1)}`))
            .on("mousemove", (event: any) => tooltip.style("top",(event.pageY-10)+"px").style("left",(event.pageX+10)+"px"))
            .on("mouseout", () => tooltip.style("visibility", "hidden"));


        chart.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
        chart.append("g").call(d3.axisLeft(y));
        chart.append("g").attr("transform", `translate(${width}, 0)`).call(d3.axisRight(y2));
        
        return () => { tooltip.remove(); };

    }, [data]);

    return (
        <div className="chart-container body-weight-chart">
            <h4>Evolución del Peso Corporal y IMC</h4>
            <svg ref={ref}></svg>
             <div className="chart-legend">
                <div className="legend-item"><span className="legend-color-box body-weight"></span>Peso (kg)</div>
                <div className="legend-item"><span className="legend-color-box imc"></span>IMC</div>
            </div>
        </div>
    );
};


const ExerciseProgress = ({ clientData }: { clientData: ClientData }) => {
    const allPerformedExercises = useMemo(() => {
        return Object.keys(clientData.progressLog || {});
    }, [clientData.progressLog]);
    
    const [selectedExercise, setSelectedExercise] = useState(allPerformedExercises[0] || '');

    useEffect(() => {
        if (!selectedExercise && allPerformedExercises.length > 0) {
            setSelectedExercise(allPerformedExercises[0]);
        }
    }, [allPerformedExercises, selectedExercise]);
    
    const progressData = clientData.progressLog?.[selectedExercise] || [];

    return (
        <div className="animated-fade-in">
            {allPerformedExercises.length === 0 ? (
                <p>Aún no registraste progreso en ningún ejercicio.</p>
            ) : (
                <>
                <select className="exercise-select-dropdown" value={selectedExercise} onChange={e => setSelectedExercise(e.target.value)}>
                    {allPerformedExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                </select>

                {progressData.length < 2 ? (
                    <p>Necesitás al menos dos registros para este ejercicio para ver el gráfico.</p>
                ) : (
                    <ExerciseChart data={progressData.slice(-10)} />
                )}
                 <div className="progress-list-container">
                    <h3>Historial de: {selectedExercise}</h3>
                    <div className="progress-list">
                        <div className="progress-list-header"><span>Fecha</span><span>Peso (kg)</span><span>Repeticiones</span></div>
                        {[...progressData].reverse().map(entry => (
                            <div key={entry.date} className="progress-list-row">
                                <span>{new Date(entry.date).toLocaleDateString('es-AR')}</span>
                                <span>{entry.weight}</span>
                                <span>{entry.repetitions}</span>
                            </div>
                        ))}
                     </div>
                </div>
                </>
            )}
        </div>
    );
};

const ExerciseChart = ({ data }: { data: ProgressLogEntry[] }) => {
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current || data.length === 0) return;
        
        const d3 = (window as any).d3;
        if (!d3) return;

        const svg = d3.select(ref.current);
        svg.selectAll("*").remove();

        const margin = { top: 40, right: 30, bottom: 40, left: 40 };
        const width = (ref.current as any).parentElement.clientWidth - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const chart = svg
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        const x = d3.scaleBand()
            .domain(data.map(d => new Date(d.date).toLocaleDateString('es-AR')))
            .range([0, width])
            .padding(0.4);

        const yWeight = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.weight) * 1.1])
            .range([height, 0]);

        const yReps = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.repetitions) * 1.1])
            .range([height, 0]);

        const tooltip = d3.select("body").append("div")
            .attr("class", "chart-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background-color", "white")
            .style("border", "solid")
            .style("border-width", "1px")
            .style("border-radius", "5px")
            .style("padding", "10px");


        // Weight Bars
        chart.selectAll(".bar-weight")
            .data(data)
            .enter().append("rect")
            .attr("class", "bar-weight")
            .attr("x", d => x(new Date(d.date).toLocaleDateString('es-AR')))
            .attr("y", d => yWeight(d.weight))
            .attr("width", x.bandwidth() / 2)
            .attr("height", d => height - yWeight(d.weight))
            .on("mouseover", (event: any, d: any) => tooltip.style("visibility", "visible").text(`Peso: ${d.weight}kg`))
            .on("mousemove", (event: any) => tooltip.style("top",(event.pageY-10)+"px").style("left",(event.pageX+10)+"px"))
            .on("mouseout", () => tooltip.style("visibility", "hidden"));

        // Reps Bars
        chart.selectAll(".bar-reps")
            .data(data)
            .enter().append("rect")
            .attr("class", "bar-reps")
            .attr("x", d => x(new Date(d.date).toLocaleDateString('es-AR')) + x.bandwidth() / 2)
            .attr("y", d => yReps(d.repetitions))
            .attr("width", x.bandwidth() / 2)
            .attr("height", d => height - yReps(d.repetitions))
            .on("mouseover", (event: any, d: any) => tooltip.style("visibility", "visible").text(`Reps: ${d.repetitions}`))
            .on("mousemove", (event: any) => tooltip.style("top",(event.pageY-10)+"px").style("left",(event.pageX+10)+"px"))
            .on("mouseout", () => tooltip.style("visibility", "hidden"));


        chart.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
        chart.append("g").call(d3.axisLeft(yWeight));
        chart.append("g").attr("transform", `translate(${width}, 0)`).call(d3.axisRight(yReps));
        
        return () => { tooltip.remove(); };

    }, [data]);

    return (
         <div className="chart-container exercise-progress-chart">
            <h4>Evolución del Rendimiento</h4>
            <svg ref={ref}></svg>
            <div className="chart-legend">
                <div className="legend-item"><span className="legend-color-box weight"></span>Peso (kg)</div>
                <div className="legend-item"><span className="legend-color-box reps"></span>Repeticiones</div>
            </div>
        </div>
    );
};

// --- App Principal ---
const App = () => {
    const [view, setView] = useState<'landing' | 'superadmin_login' | 'gym_login' | 'client_login' | 'superadmin_portal' | 'gym_portal' | 'client_portal'>('landing');
    const [currentGym, setCurrentGym] = useState<Gym | null>(null);
    const [currentClientDni, setCurrentClientDni] = useState<string | null>(null);
    
    const handleRoleSelect = (role: 'superadmin' | 'gym' | 'client') => {
        if (role === 'superadmin') setView('superadmin_login');
        else if (role === 'gym') setView('gym_login');
        else if (role === 'client') setView('client_login');
    };
    
    const handleLogout = () => {
        setCurrentGym(null);
        setCurrentClientDni(null);
        setView('landing');
    };
    
    const handleGymLogin = (gym: Gym) => {
        setCurrentGym(gym);
        setView('gym_portal');
    };
    
    const handleClientLogin = (dni: string) => {
        setCurrentClientDni(dni);
        setView('client_portal');
    };
    
    const renderView = () => {
        switch (view) {
            case 'landing':
                return <LandingPage onSelectRole={handleRoleSelect} />;
            case 'superadmin_login':
                return <SuperAdminLogin onLogin={() => setView('superadmin_portal')} onBack={() => setView('landing')} />;
            case 'gym_login':
                return <GymLogin onLogin={handleGymLogin} onBack={() => setView('landing')} />;
            case 'client_login':
                return <ClientLogin onLogin={handleClientLogin} onBack={() => setView('landing')}/>;
            case 'superadmin_portal':
                return <SuperAdminPortal onLogout={handleLogout}/>;
            case 'gym_portal':
                if (currentGym) return <GymPortal gym={currentGym} onLogout={handleLogout} />;
                break;
            case 'client_portal':
                 if (currentClientDni) return <ClientView dni={currentClientDni} onLogout={handleLogout} />;
                 break;
            default:
                return <LandingPage onSelectRole={handleRoleSelect} />;
        }
    };

    return <>{renderView()}</>;
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
