


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
    Gym
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

    // Find the last occurrence of the matching closing bracket
    const lastIndex = text.lastIndexOf(endChar);

    if (lastIndex === -1 || lastIndex < startIndex) {
        return null; // No matching closing bracket found
    }
    
    // Extract the potential JSON string
    return text.substring(startIndex, lastIndex + 1);
};


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
const Logo = ({ className = '' }: { className?: string }) => (
    <img src="/logo.svg" alt="Scorpion AI Logo" className={`app-logo ${className}`} />
);


// 1. Vista de Selección de Rol (Página de Aterrizaje)
const RoleSelectionView = ({ onSelectRole }: { onSelectRole: (role: 'admin' | 'client') => void }) => {
    return (
        <div className="login-container">
            <header>
                 <Logo />
                 <h1>Scorpion AI</h1>
                 <p>Tu plataforma de entrenamiento inteligente.</p>
            </header>
            <div className="landing-box">
                <h2>Bienvenido</h2>
                <p>¿Cómo querés acceder?</p>
                <div className="role-selection">
                    <button className="cta-button" onClick={() => onSelectRole('admin')}>
                        Acceso Gimnasio / Entrenador
                    </button>
                    <button className="cta-button secondary" onClick={() => onSelectRole('client')}>
                        Acceso Cliente
                    </button>
                </div>
            </div>
        </div>
    );
};


// 2. Vista de Login
const LoginView = ({ onLoginSuccess, userType, onBack }: { 
    onLoginSuccess: (user: Gym | ClientData, type: 'gym' | 'client' | 'superadmin') => void;
    userType: 'admin' | 'client';
    onBack: () => void;
}) => {
    const [identifier, setIdentifier] = useState(''); // DNI or Username
    const [password, setPassword] = useState(''); // Access Code or Password
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (userType === 'admin') {
                const gym = await apiClient.gymLogin(identifier, password);
                if (gym) {
                    if (gym.username === 'superadmin') {
                         onLoginSuccess(gym, 'superadmin');
                    } else {
                        onLoginSuccess(gym, 'gym');
                    }
                } else {
                    setError('Usuario o contraseña incorrectos.');
                }
            } else { // Client login
                const clientData = await apiClient.getClientData(identifier);
                 if (clientData && clientData.accessCode === password && clientData.status === 'active') {
                    onLoginSuccess(clientData, 'client');
                } else if (clientData && clientData.status === 'archived'){
                    setError('Tu cuenta ha sido archivada. Contacta a tu entrenador.');
                }
                else {
                    setError('DNI o código de acceso incorrectos.');
                }
            }
        } catch (err) {
            setError('Ocurrió un error al intentar iniciar sesión.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
             <header>
                <Logo />
                <h1>{userType === 'admin' ? 'Acceso Gimnasio / Entrenador' : 'Acceso de Cliente'}</h1>
             </header>
            <div className="login-box">
                <form onSubmit={handleLogin}>
                    <input
                        type="text"
                        placeholder={userType === 'admin' ? 'Usuario' : 'Tu DNI'}
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        aria-label={userType === 'admin' ? 'Nombre de usuario' : 'DNI'}
                    />
                    <input
                        type="password"
                        placeholder={userType === 'admin' ? 'Contraseña' : 'Código de Acceso'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        aria-label={userType === 'admin' ? 'Contraseña' : 'Código de Acceso'}
                    />
                    {error && <p className="error-text">{error}</p>}
                    <button type="submit" className="cta-button" disabled={isLoading}>
                        {isLoading ? <span className="spinner small"></span> : 'Ingresar'}
                    </button>
                </form>
            </div>
            <button onClick={onBack} className="back-button simple">Volver</button>
        </div>
    );
};


// 3. Super Admin Dashboard
const SuperAdminDashboard = ({ loggedInUser, onLogout, onManageGym }: { 
    loggedInUser: Gym;
    onLogout: () => void;
    onManageGym: (gym: Gym) => void; 
}) => {
    const [gyms, setGyms] = useState<Gym[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    
    // Form state
    const [newGymName, setNewGymName] = useState('');
    const [newGymUsername, setNewGymUsername] = useState('');
    const [newGymPassword, setNewGymPassword] = useState('');
    const [newGymLimit, setNewGymLimit] = useState(10);
    const [newGymLogoSvg, setNewGymLogoSvg] = useState<string | null>(null);

    // Edit Modal state
    const [editingGym, setEditingGym] = useState<Gym | null>(null);
    const [editName, setEditName] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editLimit, setEditLimit] = useState(10);
    const [editLogoSvg, setEditLogoSvg] = useState<string | null>(null);


    // Confirm Modal state
    const [showConfirmModal, setShowConfirmModal] = useState<{
        isOpen: boolean;
        message?: string;
        onConfirm?: () => void;
        onCancel?: () => void;
    }>({ isOpen: false });
    
    // Super admin password state
    const [newSuperAdminPassword, setNewSuperAdminPassword] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    const handleFileRead = async (e: React.ChangeEvent<HTMLInputElement>, setSvgContent: (svg: string | null) => void) => {
        const file = e.target.files?.[0];
        if (file && file.type === 'image/svg+xml') {
            const reader = new FileReader();
            reader.onload = (event) => {
                setSvgContent(event.target?.result as string);
            };
            reader.readAsText(file);
        } else {
            setSvgContent(null);
            if (file) alert("Por favor, sube un archivo .svg válido.");
        }
    };


    const fetchGyms = async () => {
        setIsLoading(true);
        const fetchedGyms = await apiClient.getGyms();
        // Filter out the superadmin user from the list of manageable gyms
        setGyms(fetchedGyms.filter(gym => gym.username !== 'superadmin'));
        setIsLoading(false);
    };

    useEffect(() => {
        fetchGyms();
    }, []);
    
    const handleAddGym = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await apiClient.createGym(newGymName, newGymUsername, newGymPassword, newGymLimit, newGymLogoSvg);
        if (success) {
            setNewGymName('');
            setNewGymUsername('');
            setNewGymPassword('');
            setNewGymLimit(10);
            setNewGymLogoSvg(null);
            setShowAddForm(false);
            fetchGyms(); // Refresh list
        } else {
            alert('Error: No se pudo crear el gimnasio. El nombre de usuario puede que ya exista.');
        }
    };
    
    const openEditModal = (gym: Gym) => {
        setEditingGym(gym);
        setEditName(gym.name);
        setEditPassword(''); // Clear password for security
        setEditLimit(gym.dailyQuestionLimit ?? 10);
        setEditLogoSvg(gym.logoSvg || null);
    };

    const handleUpdateGym = async () => {
        if (!editingGym) return;
        
        const updateData: { name?: string; password?: string, dailyQuestionLimit?: number, logoSvg?: string | null } = {};
        if (editName && editName !== editingGym.name) updateData.name = editName;
        if (editPassword) updateData.password = editPassword;
        if (editLimit !== (editingGym.dailyQuestionLimit ?? 10)) updateData.dailyQuestionLimit = editLimit;
        if (editLogoSvg !== editingGym.logoSvg) updateData.logoSvg = editLogoSvg;


        const success = await apiClient.updateGym(editingGym._id, updateData);
        if (success) {
            setEditingGym(null);
            fetchGyms();
        } else {
            alert('Error: No se pudo actualizar el gimnasio.');
        }
    };
    
    const openDeleteConfirm = (gym: Gym) => {
        setShowConfirmModal({
            isOpen: true,
            message: `¿Estás seguro de que quieres eliminar el gimnasio "${gym.name}"? Esta acción es irreversible y borrará todos los clientes y datos asociados.`,
            onConfirm: () => handleDeleteGym(gym._id),
            onCancel: () => setShowConfirmModal({ isOpen: false }),
        });
    };

    const handleDeleteGym = async (gymId: string) => {
        const success = await apiClient.deleteGym(gymId);
        if (success) {
            fetchGyms();
        } else {
            alert('Error: No se pudo eliminar el gimnasio.');
        }
        setShowConfirmModal({ isOpen: false });
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSuperAdminPassword) return;
        setIsSavingPassword(true);
        const success = await apiClient.updateGym(loggedInUser._id, { password: newSuperAdminPassword });
        if (success) {
            alert('Contraseña de Super Administrador actualizada con éxito.');
            setNewSuperAdminPassword('');
        } else {
            alert('Error al actualizar la contraseña.');
        }
        setIsSavingPassword(false);
    };


    return (
        <div className="admin-dashboard">
            <header className="main-header">
                <div className="header-title-wrapper">
                    <h1>Panel de Super Administrador</h1>
                </div>
                <button onClick={onLogout} className="logout-button">Cerrar Sesión</button>
            </header>
            
            <div className="password-management">
                <h2>Gestionar Contraseña de Administrador</h2>
                 <form onSubmit={handleUpdatePassword}>
                    <div className="form-group">
                        <label htmlFor="super-admin-pass">Nueva Contraseña</label>
                        <input
                            id="super-admin-pass"
                            type="password"
                            value={newSuperAdminPassword}
                            onChange={(e) => setNewSuperAdminPassword(e.target.value)}
                            placeholder="Introduce la nueva contraseña"
                            required
                        />
                    </div>
                    <button type="submit" className="cta-button" disabled={isSavingPassword}>
                        {isSavingPassword ? <span className="spinner small"></span> : 'Guardar'}
                    </button>
                </form>
            </div>

            <hr />
            
            <h2 style={{ marginTop: '2rem' }}>Gestionar Gimnasios</h2>
            {!showAddForm && (
                 <button onClick={() => setShowAddForm(true)} className="cta-button" style={{ marginTop: '1rem' }}>
                    + Agregar Nuevo Gimnasio
                </button>
            )}

            {showAddForm && (
                <div className="add-gym-container">
                    <h3>Nuevo Gimnasio</h3>
                    <form onSubmit={handleAddGym} className="add-gym-form">
                        <div className="form-group">
                             <label htmlFor="gymName">Nombre del Gimnasio</label>
                             <input id="gymName" value={newGymName} onChange={e => setNewGymName(e.target.value)} required />
                        </div>
                        <div className="form-group">
                             <label htmlFor="gymUser">Usuario (para login)</label>
                             <input id="gymUser" value={newGymUsername} onChange={e => setNewGymUsername(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="gymPass">Contraseña</label>
                            <input id="gymPass" type="password" value={newGymPassword} onChange={e => setNewGymPassword(e.target.value)} required />
                        </div>
                         <div className="form-group">
                            <label htmlFor="gymLimit">Límite Preguntas/Día</label>
                            <input id="gymLimit" type="number" value={newGymLimit} onChange={e => setNewGymLimit(Number(e.target.value))} required min="0" />
                        </div>
                         <div className="form-group">
                            <label>Logo (SVG)</label>
                            <div className="file-input-wrapper">
                                <label htmlFor="gymLogo" className="file-input-label">Subir SVG</label>
                                <input id="gymLogo" type="file" accept=".svg, image/svg+xml" onChange={e => handleFileRead(e, setNewGymLogoSvg)} />
                                <div className="file-input-preview">
                                    {newGymLogoSvg ? <div className="svg-logo-wrapper" dangerouslySetInnerHTML={{ __html: newGymLogoSvg }} /> : '...'}
                                </div>
                            </div>
                        </div>
                        <div className="add-gym-actions">
                            <button type="submit" className="cta-button">Crear</button>
                            <button type="button" onClick={() => setShowAddForm(false)} className="cta-button secondary">Cancelar</button>
                        </div>
                    </form>
                </div>
            )}
            
            {isLoading ? (
                <div className="loading-container"><div className="spinner"></div></div>
            ) : (
                <div className="gym-list">
                    {gyms.map(gym => (
                        <div key={gym._id} className="gym-card">
                            <div>
                                <div className="gym-card-header">
                                    <div className="gym-card-logo">
                                      {gym.logoSvg ? 
                                            <div className="svg-logo-wrapper" dangerouslySetInnerHTML={{ __html: gym.logoSvg }} /> :
                                            <Logo />
                                        }
                                    </div>
                                    <div className="gym-card-info">
                                        <h3>{gym.name}</h3>
                                        <p>Usuario: {gym.username}</p>
                                    </div>
                                </div>
                                <p>Límite de preguntas de IA por día: <strong>{gym.dailyQuestionLimit ?? 'N/A'}</strong></p>
                            </div>
                            <div className="gym-card-actions">
                                <button onClick={() => onManageGym(gym)} className="cta-button">
                                    Gestionar Clientes
                                </button>
                                <button className="action-btn edit" onClick={() => openEditModal(gym)}>Editar</button>
                                <button className="action-btn delete" onClick={() => openDeleteConfirm(gym)}>Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editingGym && (
                 <Modal>
                    <div className="modal-content edit-modal">
                        <h3>Editar Gimnasio: {editingGym.name}</h3>
                        <div className="form-group">
                            <label htmlFor="editName">Nombre del Gimnasio</label>
                            <input id="editName" value={editName} onChange={e => setEditName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="editPass">Nueva Contraseña (dejar en blanco para no cambiar)</label>
                            <input id="editPass" type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} />
                        </div>
                         <div className="form-group">
                            <label htmlFor="editLimit">Límite Preguntas/Día</label>
                            <input id="editLimit" type="number" value={editLimit} onChange={e => setEditLimit(Number(e.target.value))} min="0" />
                        </div>
                         <div className="form-group">
                            <label>Logo (SVG)</label>
                            <div className="file-input-wrapper">
                                <label htmlFor="editGymLogo" className="file-input-label">Cambiar Logo</label>
                                <input id="editGymLogo" type="file" accept=".svg, image/svg+xml" onChange={e => handleFileRead(e, setEditLogoSvg)} />
                                <div className="file-input-preview">
                                    {editLogoSvg ? <div className="svg-logo-wrapper" dangerouslySetInnerHTML={{ __html: editLogoSvg }} /> : '...'}
                                </div>
                                 <button onClick={() => setEditLogoSvg(null)} className="action-btn delete" style={{marginLeft: '1rem'}}>Quitar Logo</button>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button onClick={() => setEditingGym(null)} className="cta-button secondary">Cancelar</button>
                            <button onClick={handleUpdateGym} className="cta-button">Guardar Cambios</button>
                        </div>
                    </div>
                </Modal>
            )}

             {showConfirmModal.isOpen && (
                <Modal>
                    <div className="modal-content">
                        <p>{showConfirmModal.message}</p>
                        <div className="modal-actions">
                            <button onClick={showConfirmModal.onCancel} className="cta-button secondary">
                                Cancelar
                            </button>
                            <button onClick={showConfirmModal.onConfirm} className="cta-button">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};


// 4. Panel de Administrador del Gimnasio
const AdminDashboard = ({ loggedInGym, onLogout, onBackToSuperAdmin }: { 
    loggedInGym: Gym;
    onLogout: () => void;
    onBackToSuperAdmin?: () => void;
}) => {
    const [clients, setClients] = useState<ClientListItem[]>([]);
    const [selectedClientDni, setSelectedClientDni] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [newClientDni, setNewClientDni] = useState('');
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [createClientError, setCreateClientError] = useState('');

    // State for multiple selection
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
    
    // State for confirmation modal
    const [showConfirmModal, setShowConfirmModal] = useState<{
        isOpen: boolean;
        message?: string;
        onConfirm?: () => void;
        onCancel?: () => void;
    }>({ isOpen: false });
    
    const [currentView, setCurrentView] = useState<'clients' | 'library'>('clients');
    
    const fetchClients = async () => {
        setIsLoading(true);
        const fetchedClients = await apiClient.getClients(loggedInGym._id);
        setClients(fetchedClients);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchClients();
    }, [loggedInGym]);
    
    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateClientError('');
        if (!newClientDni.trim()) return;
        
        setIsCreatingClient(true);
        const result = await apiClient.createClient(newClientDni.trim(), loggedInGym._id);
        setIsCreatingClient(false);

        if (result.success) {
            setNewClientDni('');
            await fetchClients(); // Refresh the list
        } else {
            setCreateClientError(result.message || 'Error al crear el cliente.');
        }
    };
    
    // Handlers for multiple selection actions
    const handleArchiveSelected = async () => {
        setShowConfirmModal({
            isOpen: true,
            message: `¿Estás seguro de que quieres archivar ${selectedClients.size} cliente(s)?`,
            onConfirm: async () => {
                await apiClient.updateClientStatus(selectedClients, 'archived');
                // Optimistically update the local state instead of refetching
                setClients(prevClients =>
                    prevClients.map(client =>
                        selectedClients.has(client.dni)
                            ? { ...client, status: 'archived' }
                            : client
                    )
                );
                setSelectedClients(new Set());
                setSelectionMode(false);
                setShowConfirmModal({ isOpen: false });
                setViewMode('archived'); // Switch view to see the result
            },
            onCancel: () => setShowConfirmModal({ isOpen: false }),
        });
    };

    const handleRestoreSelected = async () => {
        setShowConfirmModal({
            isOpen: true,
            message: `¿Estás seguro de que quieres restaurar ${selectedClients.size} cliente(s)?`,
            onConfirm: async () => {
                await apiClient.updateClientStatus(selectedClients, 'active');
                // Optimistically update the local state
                setClients(prevClients =>
                    prevClients.map(client =>
                        selectedClients.has(client.dni)
                            ? { ...client, status: 'active' }
                            : client
                    )
                );
                setSelectedClients(new Set());
                setSelectionMode(false);
                setShowConfirmModal({ isOpen: false });
                setViewMode('active'); // Switch view to see the result
            },
            onCancel: () => setShowConfirmModal({ isOpen: false }),
        });
    };

    const handleDeleteSelected = () => {
        setShowConfirmModal({
            isOpen: true,
            message: `¡ACCIÓN IRREVERSIBLE! ¿Estás seguro de que quieres borrar permanentemente ${selectedClients.size} cliente(s)? Todos sus datos se perderán.`,
            onConfirm: async () => {
                await apiClient.deleteClients(selectedClients);
                const updatedClients = clients.filter(c => !selectedClients.has(c.dni));
                setClients(updatedClients);
                setSelectedClients(new Set());
                setSelectionMode(false);
                setShowConfirmModal({ isOpen: false });
            },
            onCancel: () => setShowConfirmModal({ isOpen: false }),
        });
    };
    
    const toggleClientSelection = (dni: string) => {
        if (!selectionMode) return;
        const newSelection = new Set(selectedClients);
        if (newSelection.has(dni)) {
            newSelection.delete(dni);
        } else {
            newSelection.add(dni);
        }
        setSelectedClients(newSelection);
    };


    const filteredClients = useMemo(() => {
        const listToFilter = clients.filter(c => c.status === viewMode);
        if (!searchQuery) {
            return listToFilter;
        }
        return listToFilter.filter(client =>
            (client.profile?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            client.dni.includes(searchQuery)
        );
    }, [clients, viewMode, searchQuery]);


    if (selectedClientDni) {
        return <ClientManagementView
            dni={selectedClientDni}
            onBack={() => {
                setSelectedClientDni(null);
                fetchClients(); // Refetch when going back to the list
            }}
        />;
    }
    
    if (currentView === 'library') {
        return <ExerciseLibraryManager gymId={loggedInGym._id} onBack={() => setCurrentView('clients')} />;
    }

    return (
        <div className="admin-dashboard">
            <header className="main-header">
                <div className="header-title-wrapper">
                    <h1>Clientes de {loggedInGym.name}</h1>
                </div>
                <nav className="admin-header-nav">
                    {onBackToSuperAdmin && (
                        <button onClick={onBackToSuperAdmin} className="back-button">
                           &#8592; Volver a Gimnasios
                        </button>
                    )}
                    <button className="header-nav-button" onClick={() => setCurrentView('library')}>
                        Biblioteca de Ejercicios
                    </button>
                    <button onClick={onLogout} className="logout-button admin-logout">Cerrar Sesión</button>
                </nav>
            </header>
            
            <div className="client-management-bar">
                <div className="add-client-form">
                    <form onSubmit={handleCreateClient}>
                        <input
                            type="text"
                            placeholder="DNI del nuevo cliente"
                            value={newClientDni}
                            onChange={(e) => setNewClientDni(e.target.value)}
                            disabled={isCreatingClient}
                        />
                        <button type="submit" className="cta-button" disabled={isCreatingClient}>
                             {isCreatingClient ? <span className="spinner small"></span> : 'Agregar'}
                        </button>
                    </form>
                    {createClientError && <p className="error-text">{createClientError}</p>}
                </div>
                 <div className="search-client-form">
                    <input
                        type="text"
                        placeholder="Buscar por nombre o DNI..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className="view-controls">
                <div className="view-toggle">
                    <button
                        className={`view-toggle-button ${viewMode === 'active' ? 'active' : ''}`}
                        onClick={() => setViewMode('active')}>
                        Activos
                    </button>
                    <button
                        className={`view-toggle-button ${viewMode === 'archived' ? 'active' : ''}`}
                        onClick={() => setViewMode('archived')}>
                        Archivados
                    </button>
                </div>
                <div className="selection-controls">
                    <button className="selection-toggle-button" onClick={() => setSelectionMode(!selectionMode)}>
                        {selectionMode ? 'Cancelar Selección' : 'Seleccionar Varios'}
                    </button>
                    {selectionMode && (
                        <>
                            {viewMode === 'active' ? (
                                <button
                                    className="archive-selected-button"
                                    onClick={handleArchiveSelected}
                                    disabled={selectedClients.size === 0}>
                                    Archivar Seleccionados
                                </button>
                            ) : (
                                <button
                                    className="restore-selected-button"
                                    onClick={handleRestoreSelected}
                                    disabled={selectedClients.size === 0}>
                                    Restaurar Seleccionados
                                </button>
                            )}
                            {viewMode === 'archived' && (
                               <button
                                    className="delete-selected-button"
                                    onClick={handleDeleteSelected}
                                    disabled={selectedClients.size === 0}>
                                    Borrar Seleccionados
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {isLoading ? (
                <div className="loading-container"><div className="spinner"></div></div>
            ) : (
                <div className="client-list">
                    {filteredClients.length > 0 ? filteredClients.map(client => (
                        <div
                            key={client.dni}
                            className={`client-card ${selectionMode ? 'selection-mode' : ''} ${selectedClients.has(client.dni) ? 'selected' : ''}`}
                            onClick={() => selectionMode ? toggleClientSelection(client.dni) : setSelectedClientDni(client.dni)}
                            role="button"
                            tabIndex={0}
                            aria-label={`Seleccionar cliente ${client.profile.name || client.dni}`}
                        >
                             {selectionMode && (
                                <input
                                    type="checkbox"
                                    className="client-selection-checkbox"
                                    checked={selectedClients.has(client.dni)}
                                    onChange={() => toggleClientSelection(client.dni)}
                                    onClick={(e) => e.stopPropagation()} // Prevent card click from firing too
                                    aria-label={`Marcar a ${client.profile.name || client.dni}`}
                                />
                            )}
                            <h3>{client.profile.name || 'Cliente sin nombre'}</h3>
                            <p>DNI: {client.dni}</p>
                            <p>Plan: {client.planName}</p>
                        </div>
                    )) : (
                        <p>No se encontraron clientes {viewMode === 'archived' ? 'archivados' : 'activos'}.</p>
                    )}
                </div>
            )}

            {showConfirmModal.isOpen && (
                <Modal>
                    <div className="modal-content">
                        <p>{showConfirmModal.message}</p>
                        <div className="modal-actions">
                            <button onClick={showConfirmModal.onCancel} className="cta-button secondary">
                                Cancelar
                            </button>
                            <button onClick={showConfirmModal.onConfirm} className="cta-button">
                                Confirmar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

        </div>
    );
};


// 5. Vista de Gestión de un Cliente Específico
const ClientManagementView = ({ dni, onBack }: { dni: string, onBack: () => void }) => {
    const [clientData, setClientData] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'routine' | 'diet'>('routine');
    
    // Form state and change tracking
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    
    // State for plan generation
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState('');


    const fetchClientData = async () => {
        setIsLoading(true);
        const data = await apiClient.getClientData(dni);
        if (data) {
            setClientData(data);
            setProfile(data.profile);
        } else {
            setError('No se pudo cargar la información del cliente.');
        }
        setIsLoading(false);
        setIsDirty(false);
    };

    useEffect(() => {
        fetchClientData();
    }, [dni]);

    const handleProfileChange = (field: keyof Profile, value: string) => {
        if (profile) {
            const newProfile = { ...profile!, [field]: value };
            // Si se cambia el área corporal principal, se resetea el enfoque muscular específico.
            if (field === 'bodyFocusArea') {
                newProfile.muscleFocus = 'General';
            }
            setProfile(newProfile);
            if (!isDirty) setIsDirty(true);
        }
    };
    
    const handleSaveChanges = async (): Promise<boolean> => {
        if (!profile || !clientData) return false;
        const success = await apiClient.saveClientData(dni, { profile });
        if (success) {
            setClientData(prev => ({ ...prev!, profile }));
            setIsDirty(false);
        } else {
            alert("Error al guardar los cambios del perfil.");
        }
        return success;
    };
    
     const handleRoutineUpdate = (newRoutine: Routine | null, generatedDate: string) => {
        setClientData(prev => prev ? { ...prev, routine: newRoutine, routineGeneratedDate: generatedDate } : null);
    };

    const handleDietUpdate = (newDiet: DietPlan | null) => {
        setClientData(prev => prev ? { ...prev, dietPlan: newDiet } : null);
    };

    const handleGenerateRoutine = async (instructions: string) => {
        setGenerationError('');
        if (isDirty) {
            const saveSuccess = await handleSaveChanges();
            if (!saveSuccess) {
                setGenerationError("No se pudieron guardar los cambios del perfil. La generación fue cancelada.");
                return;
            }
        }

        setIsGenerating(true);
        const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

        try {
            // Use the most up-to-date profile from state
            const currentProfile = profile;
            if (!currentProfile) throw new Error("Client profile is not loaded.");

            const exerciseLibrary = await apiClient.getExerciseLibrary(clientData!.gymId);
            const enabledExercises = Object.entries(exerciseLibrary)
              .flatMap(([group, exercises]) => 
                exercises.filter(ex => ex.isEnabled).map(ex => ({ group, name: ex.name }))
              )
              .map(ex => `${ex.group}: ${ex.name}`)
              .join('; ');

            const prompt = `
                Eres un entrenador personal de élite. Crea un plan de entrenamiento completo y detallado en JSON para el siguiente cliente.
                
                **Datos del Cliente:**
                - Edad: ${currentProfile.age} años
                - Peso: ${currentProfile.weight} kg
                - Altura: ${currentProfile.height} cm
                - Género: ${currentProfile.gender}
                - Nivel: ${currentProfile.level}
                - Objetivo: ${currentProfile.goal}
                - Días de entrenamiento por semana: ${currentProfile.trainingDays}
                - Nivel de actividad diaria: ${currentProfile.activityFactor}
                - ¿Usar técnicas avanzadas?: ${currentProfile.useAdvancedTechniques}
                - Enfoque corporal general: ${currentProfile.bodyFocusArea}
                - Músculo específico a priorizar: ${currentProfile.muscleFocus || 'General'}
                - ¿Incluir fase de adaptación inicial?: ${currentProfile.includeAdaptationPhase}
                - Intensidad deseada: ${currentProfile.trainingIntensity}

                **Instrucciones Adicionales del Entrenador:**
                ${instructions || 'Ninguna'}

                **Reglas y Formato de Salida:**
                1.  **Formato JSON Estricto:** La respuesta DEBE ser un único objeto JSON válido, sin texto antes o después.
                2.  **Volumen de Entrenamiento por Intensidad:** El número total de ejercicios por día DEBE seguir estas reglas ESTRICTAMENTE:
                    -   Intensidad 'Baja': 5 a 6 ejercicios.
                    -   Intensidad 'Moderada': 6 a 7 ejercicios.
                    -   Intensidad 'Alta': 7 a 10 ejercicios.
                    -   Intensidad 'Extrema': 10 a 13 ejercicios.
                3.  **Inteligencia Muscular:**
                    -   Incluso si se prioriza un músculo específico (ej. "Glúteos"), DEBES incluir ejercicios para los otros músculos principales del grupo (ej. cuádriceps, femorales, gemelos) para asegurar un entrenamiento balanceado. El músculo enfocado debe tener un poco más de volumen (más series o un ejercicio extra), pero NUNCA a expensas de un entrenamiento completo del día (ej. un día de pierna SIEMPRE debe tener trabajo de gemelos).
                    -   Si la intensidad es 'Extrema', el plan debe ser una mezcla inteligente de estilos de entrenamiento. Incorpora ejercicios con rangos de repeticiones de fuerza (ej. 3-5 reps), hipertrofia (ej. 8-12 reps) y resistencia (ej. 15-20 reps). Varía los tiempos de descanso de acuerdo a esto.
                4.  **Estructura del Plan:**
                    -   El plan debe tener un "planName" descriptivo (ej. "Plan de Hipertrofia - 4 Días").
                    -   Debe tener "totalDurationWeeks" (número total de semanas).
                    -   Debe contener un array "phases".
                5.  **Fases del Plan:**
                    -   Si se solicitó una fase de adaptación, la primera fase debe ser "Fase de Adaptación". Las siguientes fases deben tener nombres como "Fase de Hipertrofia", "Fase de Fuerza", etc.
                    -   Cada fase debe tener "phaseName", "durationWeeks" (duración en semanas), y un objeto "routine".
                6.  **Rutina de la Fase:**
                    -   La rutina debe contener un array "dias".
                    -   El número de objetos en "dias" DEBE coincidir con los días de entrenamiento por semana del cliente.
                7.  **Días de Entrenamiento:**
                    -   Cada día debe tener un "dia" (ej. "Día 1", "Día 2"), "grupoMuscular" (ej. "Pecho y Tríceps", "Pierna Completa"), un array de "ejercicios" y una recomendación de "cardio".
                    -   El cardio debe ser una string (ej. "25 minutos de cinta a ritmo moderado post-entrenamiento").
                8.  **Ejercicios:**
                    -   Cada ejercicio debe tener "nombre", "series", "repeticiones", y "descanso".
                    -   **IMPORTANTE:** El "nombre" de cada ejercicio DEBE ser seleccionado EXCLUSIVAMENTE de esta lista de ejercicios disponibles: ${enabledExercises}. No inventes ejercicios. Si un grupo muscular necesita un ejercicio no listado, elige la mejor alternativa de la lista.
                    -   Si se usan técnicas avanzadas, añade el campo opcional "tecnicaAvanzada" con el nombre de la técnica (ej. "Drop Set").
                    -   Las series, repeticiones y descanso deben ser strings (ej. "4", "8-12", "60-90 segundos").

                Genera el plan completo siguiendo estas reglas al pie de la letra.
            `;

            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
            const jsonString = extractJson(response.text);
            if (!jsonString) throw new Error("La IA no devolvió un JSON válido.");
            const newRoutine: Routine = JSON.parse(jsonString);

            for (const phase of newRoutine.phases) {
                for (const day of phase.routine.dias) {
                    for (const exercise of day.ejercicios) {
                        const muscleGroup = Object.keys(exerciseLibrary).find(group => exerciseLibrary[group].some(libEx => libEx.name === exercise.nombre));
                        if (muscleGroup) {
                            const libExercise = exerciseLibrary[muscleGroup].find(libEx => libEx.name === exercise.nombre);
                            if (libExercise && libExercise.youtubeLink) exercise.youtubeLink = libExercise.youtubeLink;
                        }
                    }
                }
            }

            const generatedDate = new Date().toISOString();
            const success = await apiClient.saveClientData(dni, { routine: newRoutine, routineGeneratedDate: generatedDate });
            if (success) {
                handleRoutineUpdate(newRoutine, generatedDate);
            } else {
                setGenerationError("La rutina se generó pero no se pudo guardar. Inténtalo de nuevo.");
            }
        } catch (e) {
            console.error(e);
            setGenerationError("Ocurrió un error al generar la rutina. Revisa la consola para más detalles.");
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleGenerateDiet = async (instructions: string) => {
        setGenerationError('');
        if (isDirty) {
            const saveSuccess = await handleSaveChanges();
            if (!saveSuccess) {
                setGenerationError("No se pudieron guardar los cambios del perfil. La generación fue cancelada.");
                return;
            }
        }
        
        setIsGenerating(true);
        const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

        try {
            const currentProfile = profile;
             if (!currentProfile) throw new Error("Client profile is not loaded.");

            const prompt = `
                Eres un nutricionista deportivo de élite. Crea un plan de alimentación detallado en JSON para el siguiente cliente.

                **Datos del Cliente:**
                - Edad: ${currentProfile.age} años
                - Peso: ${currentProfile.weight} kg
                - Altura: ${currentProfile.height} cm
                - Género: ${currentProfile.gender}
                - Nivel de Experiencia: ${currentProfile.level}
                - Objetivo Principal: ${currentProfile.goal}
                - Días de Entrenamiento: ${currentProfile.trainingDays}
                - Nivel de Actividad Diaria (fuera del gimnasio): ${currentProfile.activityFactor}

                **Instrucciones Adicionales del Entrenador:**
                ${instructions || 'Ninguna'}

                **Reglas y Formato de Salida:**
                1.  **Formato JSON Estricto:** La respuesta DEBE ser un único objeto JSON válido, sin texto antes o después.
                2.  **Estructura del Plan:**
                    -   "planTitle": Un título descriptivo (ej. "Plan Nutricional para Hipertrofia").
                    -   "summary": Un objeto con "totalCalories", y un objeto "macronutrients" con "proteinGrams", "carbsGrams", y "fatGrams". Todos deben ser números.
                    -   "meals": Un array de objetos, cada uno representando una comida del día (ej. Desayuno, Almuerzo, Merienda, Cena).
                    -   "recommendations": Un array de strings con 3 a 5 recomendaciones generales (ej. "Beber al menos 3 litros de agua al día.").
                3.  **Estructura de Comidas ("meals"):**
                    -   Cada comida debe tener "mealName" (string) y "foodItems" (un array).
                4.  **Estructura de Alimentos ("foodItems"):**
                    -   Cada item debe tener "food" (string, ej. "Pechuga de pollo a la plancha") y "amount" (string, ej. "200g", "1 taza", "2 unidades").
                5.  **Consideraciones Nutricionales:**
                    -   Calcula las calorías y macros basándote en los datos del cliente, su objetivo y nivel de actividad.
                    -   Proporciona comidas balanceadas y variadas. Usa alimentos comunes y accesibles.
                    -   El plan debe ser coherente con el objetivo (ej. superávit calórico para hipertrofia, déficit para pérdida de grasa).

                Genera el plan completo siguiendo estas reglas al pie de la letra.
            `;
            
             const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: "application/json" } });
             const jsonString = extractJson(response.text);
             if (!jsonString) throw new Error("La IA no devolvió un JSON válido.");
             const newDiet: DietPlan = JSON.parse(jsonString);

             const success = await apiClient.saveClientData(dni, { dietPlan: newDiet });
             if (success) {
                handleDietUpdate(newDiet);
             } else {
                 setGenerationError("La dieta se generó pero no se pudo guardar. Inténtalo de nuevo.");
             }
        } catch (e) {
            console.error(e);
            setGenerationError("Ocurrió un error al generar la dieta. Revisa la consola para más detalles.");
        } finally {
            setIsGenerating(false);
        }
    };


    if (isLoading) return <div className="loading-container"><div className="spinner"></div></div>;
    if (error) return <div className="error-container"><h2>Error</h2><p>{error}</p><button onClick={onBack} className="back-button">Volver</button></div>;
    if (!clientData || !profile) return <div className="error-container"><p>No se encontraron datos del cliente.</p><button onClick={onBack} className="back-button">Volver</button></div>;

    return (
        <div className="animated-fade-in">
             <header className="main-header">
                <div className="header-title-wrapper">
                     <Logo />
                    <div>
                        <h1>{profile.name || 'Gestionar Cliente'}</h1>
                        <p>DNI: {clientData.dni}</p>
                    </div>
                </div>
                <button onClick={onBack} className="back-button">&#8592; Volver a la lista</button>
            </header>
            <div className="dashboard-grid">
                <aside className="profile-section">
                    <h2>Perfil del Cliente</h2>
                    <ProfileForm
                        profile={profile}
                        onProfileChange={handleProfileChange}
                    />
                    <div className="access-code-display">
                        <span>Código de Acceso del Cliente</span>
                        <strong>{clientData.accessCode}</strong>
                    </div>
                </aside>
                <main className="main-content">
                    <nav className="main-tabs-nav">
                        <button
                            className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`}
                            onClick={() => setActiveTab('routine')}>
                            Entrenamiento
                        </button>
                        <button
                            className={`main-tab-button ${activeTab === 'diet' ? 'active' : ''}`}
                            onClick={() => setActiveTab('diet')}>
                            Nutrición
                        </button>
                    </nav>

                    <div className="results-section">
                       {activeTab === 'routine' && (
                           <RoutineManager
                                clientData={clientData}
                                onRoutineUpdate={handleRoutineUpdate}
                                isGenerating={isGenerating}
                                generationError={generationError}
                                onGenerate={handleGenerateRoutine}
                           />
                       )}
                       {activeTab === 'diet' && (
                           <DietManager
                               clientData={clientData}
                               onDietUpdate={handleDietUpdate}
                               isGenerating={isGenerating}
                               generationError={generationError}
                               onGenerate={handleGenerateDiet}
                           />
                       )}
                    </div>
                </main>
            </div>
        </div>
    );
};


// 5a. Formulario de Perfil de Cliente
const ProfileForm = ({ profile, onProfileChange }: {
    profile: Profile;
    onProfileChange: (field: keyof Profile, value: string) => void;
}) => {

    const { bmi, category, categoryClass } = getBmiDetails(parseFloat(profile.weight), parseFloat(profile.height));

    const muscleGroups = {
        'Tren Superior': ['General', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps'],
        'Tren Inferior': ['General', 'Cuádriceps', 'Femorales', 'Glúteos', 'Gemelos', 'Aductores'],
    };

    return (
        <form className="profile-form" onSubmit={(e) => e.preventDefault()}>
            <div className="form-group">
                <label>Nombre</label>
                <input type="text" value={profile.name} onChange={e => onProfileChange('name', e.target.value)} />
            </div>
             <div className="form-group">
                <label>Edad</label>
                <input type="number" value={profile.age} onChange={e => onProfileChange('age', e.target.value)} />
            </div>
            <div className="form-group">
                <label>Peso (kg)</label>
                <input type="number" step="0.1" value={profile.weight} onChange={e => onProfileChange('weight', e.target.value)} />
            </div>
            <div className="form-group">
                <label>Altura (cm)</label>
                <input type="number" value={profile.height} onChange={e => onProfileChange('height', e.target.value)} />
            </div>

            {bmi && (
                <div className="bmi-display">
                    <span>IMC: <strong>{bmi.toFixed(1)}</strong></span>
                    <span className={`bmi-category ${categoryClass}`}>{category}</span>
                </div>
            )}


             <div className="form-group">
                <label>Género</label>
                <select value={profile.gender} onChange={e => onProfileChange('gender', e.target.value)}>
                    <option>Masculino</option>
                    <option>Femenino</option>
                    <option>Prefiero no decirlo</option>
                </select>
            </div>
            <div className="form-group">
                <label>Nivel de Experiencia</label>
                <select value={profile.level} onChange={e => onProfileChange('level', e.target.value)}>
                    <option>Principiante</option>
                    <option>Intermedio</option>
                    <option>Avanzado</option>
                </select>
            </div>
            <div className="form-group">
                <label>Objetivo Principal</label>
                <select value={profile.goal} onChange={e => onProfileChange('goal', e.target.value)}>
                    <option>Hipertrofia</option>
                    <option>Pérdida de grasa</option>
                    <option>Mantenimiento</option>
                    <option>Resistencia</option>
                </select>
            </div>
             <div className="form-group">
                <label>Días de Entrenamiento por Semana</label>
                <input type="number" min="1" max="7" value={profile.trainingDays} onChange={e => onProfileChange('trainingDays', e.target.value)} />
            </div>
            <div className="form-group">
                <label>Nivel de Actividad Diaria</label>
                <select value={profile.activityFactor} onChange={e => onProfileChange('activityFactor', e.target.value)}>
                    <option>Sedentario</option>
                    <option>Ligero</option>
                    <option>Activo</option>
                    <option>Muy Activo</option>
                </select>
            </div>
             <div className="form-group">
                <label>Usar Técnicas Avanzadas</label>
                <select value={profile.useAdvancedTechniques} onChange={e => onProfileChange('useAdvancedTechniques', e.target.value)}>
                    <option>No</option>
                    <option>Sí</option>
                </select>
            </div>
            <div className="form-group">
                <label>Enfoque Corporal General</label>
                <select value={profile.bodyFocusArea} onChange={e => onProfileChange('bodyFocusArea', e.target.value)}>
                    <option>Cuerpo completo</option>
                    <option>Tren Superior</option>
                    <option>Tren Inferior</option>
                </select>
            </div>
            
            {(profile.bodyFocusArea === 'Tren Superior' || profile.bodyFocusArea === 'Tren Inferior') && (
                <div className="form-group">
                    <label>Músculo a Priorizar</label>
                    <select value={profile.muscleFocus} onChange={e => onProfileChange('muscleFocus', e.target.value)}>
                        {muscleGroups[profile.bodyFocusArea as keyof typeof muscleGroups].map(muscle => (
                            <option key={muscle} value={muscle}>{muscle}</option>
                        ))}
                    </select>
                </div>
            )}

             <div className="form-group">
                <label>¿Incluir fase de adaptación?</label>
                <select value={profile.includeAdaptationPhase} onChange={e => onProfileChange('includeAdaptationPhase', e.target.value)}>
                    <option>Sí</option>
                    <option>No</option>
                </select>
            </div>
             <div className="form-group">
                <label>Intensidad del Entrenamiento</label>
                <select value={profile.trainingIntensity} onChange={e => onProfileChange('trainingIntensity', e.target.value)}>
                    <option>Baja</option>
                    <option>Moderada</option>
                    <option>Alta</option>
                    <option>Extrema</option>
                </select>
            </div>
        </form>
    );
};


// 6. Gestor de Rutinas
const RoutineManager = ({ clientData, onRoutineUpdate, isGenerating, generationError, onGenerate }: {
    clientData: ClientData;
    onRoutineUpdate: (routine: Routine | null, generatedDate: string) => void;
    isGenerating: boolean;
    generationError: string;
    onGenerate: (instructions: string) => void;
}) => {
    const [routine, setRoutine] = useState<Routine | null>(clientData.routine);
    const [adminInstructions, setAdminInstructions] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setRoutine(clientData.routine);
    }, [clientData.routine]);
    
    const handleSaveChanges = async () => {
        if (!routine) return;
        setIsSaving(true);
        const success = await apiClient.saveClientData(clientData.dni, { routine });
        if(success) {
            onRoutineUpdate(routine, clientData.routineGeneratedDate || new Date().toISOString());
            setIsEditing(false);
        } else {
            alert("No se pudieron guardar los cambios en la rutina.");
        }
        setIsSaving(false);
    };

    if (isGenerating) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Generando plan de entrenamiento...</p>
                <p>Este proceso puede tardar hasta un minuto.</p>
            </div>
        );
    }
    
    if (generationError) {
        return (
            <div className="error-container">
                <h2>Error</h2>
                <p>{generationError}</p>
                <button onClick={() => onGenerate(adminInstructions)} className="cta-button">Intentar de Nuevo</button>
            </div>
        );
    }

    if (!routine) {
        return (
            <div className="placeholder-action">
                <p>Este cliente aún no tiene un plan de entrenamiento.</p>
                 <div className="generation-container">
                    <div className="admin-instructions-box">
                        <label htmlFor="admin-instructions">Instrucciones Adicionales (Opcional)</label>
                        <textarea
                            id="admin-instructions"
                            rows={3}
                            placeholder="Ej: Tiene una lesión en el hombro derecho, evitar press sobre la cabeza. Priorizar el trabajo de espalda baja."
                            value={adminInstructions}
                            onChange={(e) => setAdminInstructions(e.target.value)}
                        />
                    </div>
                    <button onClick={() => onGenerate(adminInstructions)} className="cta-button" disabled={isGenerating}>
                        Generar Plan con IA
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="plan-container">
            <div className="actions-bar">
                 {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="cta-button secondary">
                        Editar Rutina
                    </button>
                )}
                 {isEditing && (
                    <button onClick={handleSaveChanges} className="save-changes-button" disabled={isSaving}>
                        {isSaving ? <span className="spinner small"></span> : 'Guardar Cambios'}
                    </button>
                )}
            </div>

            <RoutinePlan routine={routine} setRoutine={setRoutine} isEditing={isEditing} gymId={clientData.gymId} />
            
            <div className="regeneration-container">
                 <div className="admin-instructions-box">
                    <label htmlFor="regen-instructions">Instrucciones para regenerar (Opcional)</label>
                    <textarea
                        id="regen-instructions"
                        rows={2}
                        placeholder="Ej: Hacer la rutina más difícil. Cambiar los ejercicios de pierna."
                        value={adminInstructions}
                        onChange={(e) => setAdminInstructions(e.target.value)}
                    />
                </div>
                <button onClick={() => onGenerate(adminInstructions)} className="cta-button regenerate" disabled={isGenerating}>
                    Regenerar Plan Completo con IA
                </button>
            </div>
        </div>
    );
};


// 6a. Componente para Visualizar/Editar el Plan de Rutina
const RoutinePlan = ({ routine, setRoutine, isEditing, gymId } : {
    routine: Routine,
    setRoutine: React.Dispatch<React.SetStateAction<Routine | null>>,
    isEditing: boolean,
    gymId: string
}) => {
    const [activePhaseIndex, setActivePhaseIndex] = useState<number | null>(routine?.phases?.length > 0 ? 0 : null);
    const [activeDayIndex, setActiveDayIndex] = useState(0);
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary | null>(null);

     useEffect(() => {
        const fetchLibrary = async () => {
            const library = await apiClient.getExerciseLibrary(gymId);
            setExerciseLibrary(library);
        };
        if (isEditing) {
            fetchLibrary();
        }
    }, [isEditing, gymId]);

    // Reset day index if phase changes and day index is out of bounds
    useEffect(() => {
        const currentPhase = activePhaseIndex !== null ? routine.phases[activePhaseIndex] : null;
        if (currentPhase && activeDayIndex >= currentPhase.routine.dias.length) {
            setActiveDayIndex(0);
        }
    }, [activePhaseIndex, routine.phases, activeDayIndex]);


    const handleExerciseChange = (phaseIndex: number, dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string) => {
        setRoutine(prevRoutine => {
            if (!prevRoutine) return null;
            const newRoutine = JSON.parse(JSON.stringify(prevRoutine)); // Deep copy
            newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios[exerciseIndex][field] = value;
            return newRoutine;
        });
    };
    
    const handleAddExercise = (phaseIndex: number, dayIndex: number) => {
        setRoutine(prevRoutine => {
            if (!prevRoutine) return null;
            const newRoutine = JSON.parse(JSON.stringify(prevRoutine));
            const newExercise: Exercise = {
                nombre: '',
                series: '3',
                repeticiones: '10-12',
                descanso: '60s'
            };
            // Find a default exercise from library if possible
            if (exerciseLibrary) {
                const firstGroup = Object.keys(exerciseLibrary)[0];
                if (firstGroup && exerciseLibrary[firstGroup].length > 0) {
                    newExercise.nombre = exerciseLibrary[firstGroup][0].name;
                }
            }

            newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.push(newExercise);
            return newRoutine;
        });
    };

    const handleDeleteExercise = (phaseIndex: number, dayIndex: number, exerciseIndex: number) => {
        setRoutine(prevRoutine => {
            if (!prevRoutine) return null;
            const newRoutine = JSON.parse(JSON.stringify(prevRoutine));
            newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.splice(exerciseIndex, 1);
            return newRoutine;
        });
    };
    
    const handleAccordionClick = (index: number) => {
        if (activePhaseIndex === index) {
            setActivePhaseIndex(null); // Close it
        } else {
            setActivePhaseIndex(index); // Open another one
            setActiveDayIndex(0); // Reset day
        }
    };

    if (!routine?.phases?.length) {
        return <p>Este plan de entrenamiento parece estar incompleto.</p>;
    }
    
    // Create a flat list of exercises for the dropdown
    const exerciseOptions = useMemo(() => {
        if (!exerciseLibrary) return [];
        return Object.entries(exerciseLibrary).flatMap(([group, exercises]) => 
            exercises.filter(ex => ex.isEnabled).map(ex => ({
                value: ex.name,
                label: ex.name,
                group: group,
            }))
        );
    }, [exerciseLibrary]);

    return (
        <div className={`routine-plan ${isEditing ? 'editable' : ''}`}>
             <div className="plan-header">
                <h2>{routine.planName}</h2>
                <p>Duración Total: {routine.totalDurationWeeks} semanas</p>
            </div>

            <div className="accordion-phases">
                {routine.phases.map((phase, phaseIndex) => (
                    <div key={phaseIndex} className="accordion-item">
                        <button 
                            className={`accordion-header ${activePhaseIndex === phaseIndex ? 'active' : ''}`}
                            onClick={() => handleAccordionClick(phaseIndex)}
                        >
                            <span>{phase.phaseName} ({phase.durationWeeks} semanas)</span>
                             <span className="accordion-header-icon">+</span>
                        </button>
                        <div className={`accordion-content ${activePhaseIndex === phaseIndex ? 'open' : ''}`}>
                            {activePhaseIndex === phaseIndex && (() => {
                                const activePhase = routine.phases[activePhaseIndex];
                                const activeDay = activePhase?.routine.dias[activeDayIndex];

                                if (!activeDay) return null;

                                return (
                                <>
                                    <nav className="day-tabs-nav">
                                        {phase.routine.dias.map((day, dayIndex) => (
                                            <button
                                                key={dayIndex}
                                                className={`day-tab-button ${activeDayIndex === dayIndex ? 'active' : ''}`}
                                                onClick={() => setActiveDayIndex(dayIndex)}>
                                                {day.dia}
                                            </button>
                                        ))}
                                    </nav>
                                    <div className="day-card">
                                        <h3><span className="muscle-group">{activeDay.grupoMuscular}</span></h3>
                                        <ul className="exercise-list">
                                            {activeDay.ejercicios.map((exercise, exerciseIndex) => (
                                                <li key={exerciseIndex} className={`exercise-item ${isEditing ? 'editable' : ''}`}>
                                                    {isEditing ? (
                                                        <div className="exercise-item-editor">
                                                           <div className="editor-row editor-row-main">
                                                              <select 
                                                                    className="exercise-select"
                                                                    value={exercise.nombre} 
                                                                    onChange={(e) => handleExerciseChange(phaseIndex, activeDayIndex, exerciseIndex, 'nombre', e.target.value)}
                                                                >
                                                                    <option value="" disabled>Selecciona un ejercicio</option>
                                                                    {Object.entries(exerciseLibrary || {}).map(([group, exercises]) => (
                                                                        <optgroup label={group} key={group}>
                                                                            {exercises.filter(e => e.isEnabled).map(ex => (
                                                                                <option key={ex.name} value={ex.name}>{ex.name}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    ))}
                                                                </select>
                                                                <button onClick={() => handleDeleteExercise(phaseIndex, activeDayIndex, exerciseIndex)} className="delete-exercise-btn">-</button>
                                                            </div>
                                                            <div className="editor-row">
                                                                <div className="form-group-inline">
                                                                    <label>Series</label>
                                                                    <input value={exercise.series} onChange={e => handleExerciseChange(phaseIndex, activeDayIndex, exerciseIndex, 'series', e.target.value)} />
                                                                </div>
                                                                 <div className="form-group-inline">
                                                                    <label>Reps</label>
                                                                    <input value={exercise.repeticiones} onChange={e => handleExerciseChange(phaseIndex, activeDayIndex, exerciseIndex, 'repeticiones', e.target.value)} />
                                                                </div>
                                                                 <div className="form-group-inline">
                                                                    <label>Descanso</label>
                                                                    <input value={exercise.descanso} onChange={e => handleExerciseChange(phaseIndex, activeDayIndex, exerciseIndex, 'descanso', e.target.value)} />
                                                                </div>
                                                            </div>
                                                            <div className="editor-row">
                                                                <div className="form-group-inline full-width">
                                                                    <label>Técnica Avanzada (Opcional)</label>
                                                                     <select
                                                                        value={exercise.tecnicaAvanzada || ''}
                                                                        onChange={e => handleExerciseChange(phaseIndex, activeDayIndex, exerciseIndex, 'tecnicaAvanzada', e.target.value)}
                                                                    >
                                                                        {advancedTechniqueOptions.map(opt => (
                                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                         <>
                                                            <div className="exercise-name-wrapper">
                                                                <span className="exercise-name">{exercise.nombre}</span>
                                                                {exercise.youtubeLink && (
                                                                    <a href={exercise.youtubeLink} target="_blank" rel="noopener noreferrer" className="video-link" aria-label={`Ver video de ${exercise.nombre}`}>
                                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"></path></svg>
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <div className="exercise-details">
                                                                <span><strong>Series:</strong> {exercise.series}</span>
                                                                <span><strong>Reps:</strong> {exercise.repeticiones}</span>
                                                                <span><strong>Descanso:</strong> {exercise.descanso}</span>
                                                            </div>
                                                             {exercise.tecnicaAvanzada && (
                                                                <div className="advanced-technique">
                                                                    <span role="img" aria-label="fire">🔥</span>
                                                                    <strong>Técnica Avanzada:</strong> {exercise.tecnicaAvanzada}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                         {isEditing && (
                                            <div className="add-exercise-action">
                                                <button onClick={() => handleAddExercise(phaseIndex, activeDayIndex)} className="add-exercise-button">
                                                    + Añadir Ejercicio
                                                </button>
                                            </div>
                                        )}
                                        {activeDay.cardio && <p className="cardio-note"><strong>Cardio:</strong> {activeDay.cardio}</p>}
                                    </div>
                                </>
                                );
                            })()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


// 7. Gestor de Dieta
const DietManager = ({ clientData, onDietUpdate, isGenerating, generationError, onGenerate }: {
    clientData: ClientData;
    onDietUpdate: (diet: DietPlan | null) => void;
    isGenerating: boolean;
    generationError: string;
    onGenerate: (instructions: string) => void;
}) => {
    const [dietPlan, setDietPlan] = useState<DietPlan | null>(clientData.dietPlan);
    const [adminInstructions, setAdminInstructions] = useState('');

    useEffect(() => {
        setDietPlan(clientData.dietPlan);
    }, [clientData.dietPlan]);


    if (isGenerating) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Generando plan de nutrición...</p>
            </div>
        );
    }

     if (generationError) {
        return (
            <div className="error-container">
                <h2>Error</h2>
                <p>{generationError}</p>
                <button onClick={() => onGenerate(adminInstructions)} className="cta-button">Intentar de Nuevo</button>
            </div>
        );
    }
    
    if (!dietPlan) {
        return (
            <div className="placeholder-action">
                <p>Este cliente aún no tiene un plan de nutrición.</p>
                <div className="generation-container">
                    <div className="admin-instructions-box">
                        <label htmlFor="diet-instructions">Instrucciones Adicionales (Opcional)</label>
                        <textarea
                            id="diet-instructions"
                            rows={3}
                            placeholder="Ej: Es alérgico a los frutos secos. Prefiere no comer carnes rojas. Necesita opciones de comida rápida para el almuerzo."
                            value={adminInstructions}
                            onChange={(e) => setAdminInstructions(e.target.value)}
                        />
                    </div>
                    <button onClick={() => onGenerate(adminInstructions)} className="cta-button" disabled={isGenerating}>
                        Generar Plan de Nutrición con IA
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="diet-plan-container">
            <DietPlanView dietPlan={dietPlan} />
             <div className="regeneration-container">
                 <div className="admin-instructions-box">
                    <label htmlFor="regen-diet-instructions">Instrucciones para regenerar (Opcional)</label>
                    <textarea
                        id="regen-diet-instructions"
                        rows={2}
                        placeholder="Ej: Aumentar las calorías. Agregar más opciones de snacks."
                        value={adminInstructions}
                        onChange={(e) => setAdminInstructions(e.target.value)}
                    />
                </div>
                <button onClick={() => onGenerate(adminInstructions)} className="cta-button regenerate" disabled={isGenerating}>
                    Regenerar Plan de Nutrición
                </button>
            </div>
        </div>
    );
};


// 7a. Componente para Visualizar el Plan de Dieta
const DietPlanView = ({ dietPlan }: { dietPlan: DietPlan }) => {
    return (
        <div className="animated-fade-in">
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

            <div className="recommendations-section">
                <h4>Recomendaciones Generales</h4>
                <ul>
                    {dietPlan.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

// 8. Biblioteca de Ejercicios
const ExerciseLibraryManager = ({ gymId, onBack }: { gymId: string; onBack: () => void; }) => {
    const [library, setLibrary] = useState<ExerciseLibrary>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeAccordion, setActiveAccordion] = useState<string | null>(null);

    // Form state for adding a new exercise
    const [newExerciseName, setNewExerciseName] = useState('');
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('');

    // State for inline editing
    const [editingExercise, setEditingExercise] = useState<{ group: string; index: number } | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingLink, setEditingLink] = useState('');


    const fetchLibrary = async () => {
        setIsLoading(true);
        const lib = await apiClient.getExerciseLibrary(gymId);
        setLibrary(lib);
        if (Object.keys(lib).length > 0) {
            setSelectedMuscleGroup(Object.keys(lib)[0]);
            setActiveAccordion(Object.keys(lib)[0]); // Open first group by default
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchLibrary();
    }, [gymId]);
    
    const handleSaveChanges = async () => {
        setIsLoading(true);
        const success = await apiClient.saveExerciseLibrary(library, gymId);
        if (!success) {
            setError('No se pudo guardar la biblioteca de ejercicios.');
        }
        setIsLoading(false);
    };
    
    const handleAddExercise = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newExerciseName || !selectedMuscleGroup) return;

        const updatedLibrary = { ...library };
        const newExercise: ExerciseDefinition = {
            name: newExerciseName,
            isEnabled: true,
            youtubeLink: ''
        };
        updatedLibrary[selectedMuscleGroup].unshift(newExercise); // Add to top

        setLibrary(updatedLibrary);
        const success = await apiClient.saveExerciseLibrary(updatedLibrary, gymId);
        if (success) {
            setNewExerciseName('');
        } else {
            setError('Error al añadir el ejercicio');
            fetchLibrary(); // Revert optimistic update
        }
    };

    const handleToggleEnable = async (group: string, index: number) => {
        const updatedLibrary = JSON.parse(JSON.stringify(library));
        updatedLibrary[group][index].isEnabled = !updatedLibrary[group][index].isEnabled;
        setLibrary(updatedLibrary);
        await apiClient.saveExerciseLibrary(updatedLibrary, gymId);
    };
    
    const startEditing = (group: string, index: number, exercise: ExerciseDefinition) => {
        setEditingExercise({ group, index });
        setEditingName(exercise.name);
        setEditingLink(exercise.youtubeLink);
    };

    const cancelEditing = () => {
        setEditingExercise(null);
        setEditingName('');
        setEditingLink('');
    };
    
    const saveEdit = async () => {
        if (!editingExercise) return;
        const { group, index } = editingExercise;
        
        const updatedLibrary = JSON.parse(JSON.stringify(library));
        updatedLibrary[group][index].name = editingName;
        updatedLibrary[group][index].youtubeLink = editingLink;

        setLibrary(updatedLibrary);
        await apiClient.saveExerciseLibrary(updatedLibrary, gymId);

        cancelEditing();
    };
    
     const handleDeleteExercise = async (group: string, index: number) => {
        const exerciseName = library[group][index].name;
        if (window.confirm(`¿Estás seguro de que quieres eliminar "${exerciseName}"? Esta acción no se puede deshacer.`)) {
            const updatedLibrary = JSON.parse(JSON.stringify(library));
            updatedLibrary[group].splice(index, 1);
            setLibrary(updatedLibrary);
            await apiClient.saveExerciseLibrary(updatedLibrary, gymId);
        }
    };


    if (isLoading) return <div className="loading-container"><div className="spinner"></div></div>;
    if (error) return <div className="error-container"><p>{error}</p></div>;

    return (
        <div className="library-container">
             <header className="main-header">
                <div className="header-title-wrapper">
                    <h1>Biblioteca de Ejercicios</h1>
                </div>
                <button onClick={onBack} className="back-button">&#8592; Volver a Clientes</button>
            </header>
            
            <div className="library-instructions">
                <p>Aquí puedes gestionar los ejercicios que la IA usará para crear las rutinas. Desactiva los ejercicios que no estén disponibles en tu gimnasio para que no se incluyan en los planes.</p>
            </div>

             <div className="add-exercise-container">
                <div className="add-exercise-form-wrapper">
                     <h3>Añadir Nuevo Ejercicio</h3>
                     <form onSubmit={handleAddExercise} className="add-exercise-form">
                        <select value={selectedMuscleGroup} onChange={e => setSelectedMuscleGroup(e.target.value)}>
                             {Object.keys(library).map(group => <option key={group} value={group}>{group}</option>)}
                        </select>
                        <input
                            type="text"
                            placeholder="Nombre del ejercicio"
                            value={newExerciseName}
                            onChange={e => setNewExerciseName(e.target.value)}
                            required
                        />
                        <button type="submit">Añadir</button>
                    </form>
                </div>
            </div>

            <div className="library-accordion">
                {Object.entries(library).map(([group, exercises]) => (
                     <div key={group} className="library-accordion-item">
                        <button 
                            className={`library-accordion-header ${activeAccordion === group ? 'active' : ''}`}
                            onClick={() => setActiveAccordion(activeAccordion === group ? null : group)}
                        >
                            <span>{group} ({exercises.length})</span>
                            <span className="icon">+</span>
                        </button>
                        <div className={`library-accordion-content ${activeAccordion === group ? 'open' : ''}`}>
                            <div className="exercise-entry-list">
                                 <div className="exercise-entry-header">
                                    <span>Activado</span>
                                    <span>Nombre del Ejercicio</span>
                                    <span>Link de YouTube</span>
                                    <span>Acciones</span>
                                </div>
                                {exercises.map((exercise, index) => (
                                    <div key={index} className="exercise-entry-row">
                                        <label className="switch">
                                            <input type="checkbox" checked={exercise.isEnabled} onChange={() => handleToggleEnable(group, index)} />
                                            <span className="slider round"></span>
                                        </label>
                                        
                                        {editingExercise?.group === group && editingExercise?.index === index ? (
                                             <input 
                                                className="editing-input"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                            />
                                        ) : (
                                            <span className="exercise-name-lib">{exercise.name}</span>
                                        )}
                                        
                                         {editingExercise?.group === group && editingExercise?.index === index ? (
                                             <input 
                                                className="editing-input"
                                                value={editingLink}
                                                onChange={(e) => setEditingLink(e.target.value)}
                                                placeholder="Pega el link aquí"
                                            />
                                        ) : (
                                            <a href={exercise.youtubeLink} target="_blank" rel="noopener noreferrer">{exercise.youtubeLink ? 'Ver Video' : 'Sin video'}</a>
                                        )}
                                        
                                        <div className="exercise-row-actions">
                                             {editingExercise?.group === group && editingExercise?.index === index ? (
                                                <>
                                                    <button onClick={saveEdit} className="action-btn save">Guardar</button>
                                                    <button onClick={cancelEditing} className="action-btn cancel">Cancelar</button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEditing(group, index, exercise)} className="action-btn edit">Editar</button>
                                                    <button onClick={() => handleDeleteExercise(group, index)} className="action-btn delete">Borrar</button>
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

// --- Portal del Cliente ---

// 9. Vista Principal del Cliente
const ClientView = ({ clientData, onLogout }: { clientData: ClientData, onLogout: () => void }) => {
    const [view, setView] = useState<'agreement' | 'dashboard'>('dashboard');
    const [localClientData, setLocalClientData] = useState<ClientData>(clientData);

    useEffect(() => {
        if (!clientData.termsAccepted) {
            setView('agreement');
        } else {
            setView('dashboard');
        }
    }, [clientData.termsAccepted]);

    const handleAcceptTerms = async () => {
        const success = await apiClient.saveClientData(clientData.dni, { termsAccepted: true });
        if (success) {
            setLocalClientData(prev => ({ ...prev, termsAccepted: true }));
            setView('dashboard');
        } else {
            alert("No se pudo guardar la aceptación. Por favor, intenta de nuevo.");
        }
    };
    
    // Check if the plan is expired
    const isPlanExpired = () => {
        if (!localClientData.routine || !localClientData.routineGeneratedDate) {
            return false; // No plan to expire
        }
        const generatedDate = new Date(localClientData.routineGeneratedDate);
        const totalDurationWeeks = localClientData.routine.totalDurationWeeks;
        const expiryDate = new Date(generatedDate.getTime());
        expiryDate.setDate(expiryDate.getDate() + totalDurationWeeks * 7);

        return new Date() > expiryDate;
    };
    
    const handleProgressUpdate = async (updatedLog: ProgressLog, updatedWeightLog: BodyWeightEntry[]) => {
        const success = await apiClient.saveClientData(clientData.dni, {
            progressLog: updatedLog,
            bodyWeightLog: updatedWeightLog
        });
        if (success) {
            setLocalClientData(prev => ({ ...prev, progressLog: updatedLog, bodyWeightLog: updatedWeightLog }));
        }
        // Handle error case if needed
    };

    if (view === 'agreement') {
        return <AgreementView onAccept={handleAcceptTerms} onLogout={onLogout} />;
    }

    return (
        <ClientDashboard 
            clientData={localClientData} 
            onLogout={onLogout}
            isExpired={isPlanExpired()}
            onProgressUpdate={handleProgressUpdate}
        />
    );
};


// 10. Vista del Panel del Cliente
const ClientDashboard = ({ clientData, onLogout, isExpired, onProgressUpdate }: {
    clientData: ClientData;
    onLogout: () => void;
    isExpired: boolean;
    onProgressUpdate: (updatedLog: ProgressLog, updatedWeightLog: BodyWeightEntry[]) => void;
}) => {
    const [activeTab, setActiveTab] = useState<'routine' | 'diet' | 'progress'>('routine');
    const [bodyWeight, setBodyWeight] = useState('');
    const [logStatus, setLogStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [isChatOpen, setIsChatOpen] = useState(false);

    const { bmi, category, categoryClass } = getBmiDetails(
        clientData.bodyWeightLog && clientData.bodyWeightLog.length > 0
            ? clientData.bodyWeightLog[clientData.bodyWeightLog.length - 1].weight
            : parseFloat(clientData.profile.weight),
        parseFloat(clientData.profile.height)
    );
    
    useEffect(() => {
        if (logStatus === 'saved') {
            const timer = setTimeout(() => setLogStatus('idle'), 2000);
            return () => clearTimeout(timer);
        }
    }, [logStatus]);


    const handleLogBodyWeight = async (e: React.FormEvent) => {
        e.preventDefault();
        const weightValue = parseFloat(bodyWeight);
        if (isNaN(weightValue) || weightValue <= 0) return;
        
        setLogStatus('saving');
        const newEntry: BodyWeightEntry = { date: new Date().toISOString(), weight: weightValue };
        const updatedWeightLog = [...(clientData.bodyWeightLog || []), newEntry];
        
        // Save both logs, even if only one changed, to simplify the backend call
        await onProgressUpdate(clientData.progressLog, updatedWeightLog);
        
        setBodyWeight('');
        setLogStatus('saved');
    };
    
    const renderContent = () => {
        if (isExpired && activeTab !== 'progress') {
            return (
                <div className="expired-view">
                    <h2>Tu Plan Ha Expirado</h2>
                    <p>Tu plan de entrenamiento ha finalizado. ¡Felicitaciones por tu progreso! Por favor, contacta a tu entrenador para que te asigne una nueva rutina y plan de nutrición.</p>
                </div>
            );
        }

        switch (activeTab) {
            case 'routine':
                return clientData.routine ?
                    <ClientRoutineView clientData={clientData} onProgressUpdate={onProgressUpdate} /> :
                    <div className="placeholder"><p>Aún no se te ha asignado un plan de entrenamiento. Contacta a tu entrenador.</p></div>;
            case 'diet':
                 return clientData.dietPlan ?
                    <DietPlanView dietPlan={clientData.dietPlan} /> :
                    <div className="placeholder"><p>Aún no se te ha asignado un plan de nutrición. Contacta a tu entrenador.</p></div>;
            case 'progress':
                return <ProgressView clientData={clientData} />;
            default:
                return null;
        }
    };

    return (
         <div className="client-view-container">
            <header className="main-header">
                <div className="header-title-wrapper">
                    <Logo />
                    <div>
                         <h1>Bienvenido, {clientData.profile.name}</h1>
                    </div>
                </div>
                <button onClick={onLogout} className="logout-button">Cerrar Sesión</button>
            </header>
            
             <form onSubmit={handleLogBodyWeight} className="body-weight-logger">
                <label>Registra tu peso corporal de hoy (kg):</label>
                <div className="input-group">
                    <input
                        type="number"
                        step="0.1"
                        placeholder="Ej: 75.5"
                        value={bodyWeight}
                        onChange={(e) => setBodyWeight(e.target.value)}
                        required
                    />
                    <button type="submit" className={`log-button ${logStatus === 'saved' ? 'saved' : ''}`} disabled={logStatus === 'saving'}>
                        {logStatus === 'saved' ? '✓' : 'Registrar'}
                    </button>
                </div>
            </form>
            
            {bmi && (
                <div className="bmi-display client-bmi">
                    <span>IMC Actual: <strong>{bmi.toFixed(1)}</strong></span>
                    <span className={`bmi-category ${categoryClass}`}>{category}</span>
                </div>
            )}
            
            <main className="main-content" style={{width: '100%'}}>
                 <nav className="main-tabs-nav">
                    <button className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>
                        Entrenamiento
                    </button>
                    <button className={`main-tab-button ${activeTab === 'diet' ? 'active' : ''}`} onClick={() => setActiveTab('diet')}>
                        Nutrición
                    </button>
                    <button className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
                        Progreso
                    </button>
                </nav>
                {renderContent()}
            </main>
             <ChatAssistant 
                isOpen={isChatOpen} 
                onClose={() => setIsChatOpen(false)} 
                clientData={clientData} 
            />
            {!isChatOpen && (
                 <button className="chat-fab" onClick={() => setIsChatOpen(true)} aria-label="Abrir asistente de chat">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9.7 12.3c-.39.39-1.02.39-1.41 0L7 11l-1.29 1.29a.996.996 0 01-1.41-1.41L5.59 9.59 4.29 8.29a.996.996 0 111.41-1.41L7 8.17l1.29-1.29a.996.996 0 111.41 1.41L8.41 9.59l1.29 1.29c.39.39.39 1.03 0 1.42zm4.89-4.89L13.3 8.7a.996.996 0 11-1.41-1.41L13.17 6l-1.29-1.29a.996.996 0 111.41-1.41L14.59 4.6l1.29-1.3a.996.996 0 111.41 1.41L15.99 6l1.29 1.29c.39.39.39 1.02 0 1.41zm3.71 3.71c-.39.39-1.02.39-1.41 0L15.7 10.4a.996.996 0 10-1.41 1.41L15.59 13l-1.29 1.29a.996.996 0 101.41 1.41L17 14.41l1.29 1.29c.39.39 1.02.39 1.41 0a.996.996 0 000-1.41L18.41 13l1.29-1.29c.38-.38.38-1.02 0-1.41z"/></svg>
                </button>
            )}
        </div>
    );
};


// 10a. Vista de la Rutina del Cliente
const ClientRoutineView = ({ clientData, onProgressUpdate }: {
    clientData: ClientData;
    onProgressUpdate: (updatedLog: ProgressLog, updatedWeightLog: BodyWeightEntry[]) => void;
}) => {
    const { routine } = clientData;
    const [activePhaseIndex, setActivePhaseIndex] = useState<number | null>(routine?.phases?.length > 0 ? 0 : null);
    const [activeDayIndex, setActiveDayIndex] = useState(0);

    // Reset day index if phase changes and day index is out of bounds
    useEffect(() => {
        const currentPhase = activePhaseIndex !== null && routine ? routine.phases[activePhaseIndex] : null;
        if (currentPhase && activeDayIndex >= currentPhase.routine.dias.length) {
            setActiveDayIndex(0);
        }
    }, [activePhaseIndex, routine, activeDayIndex]);

    const handleAccordionClick = (index: number) => {
        if (activePhaseIndex === index) {
            setActivePhaseIndex(null); // Close it
        } else {
            setActivePhaseIndex(index); // Open another one
            setActiveDayIndex(0); // Reset day
        }
    };

    if (!routine?.phases?.length) return null;

    return (
        <div className="plan-container">
            <div className="plan-header">
                <h2>{routine.planName}</h2>
                <p>Duración Total: {routine.totalDurationWeeks} semanas</p>
            </div>
             <div className="accordion-phases">
                {routine.phases.map((phase, phaseIndex) => (
                    <div key={phaseIndex} className="accordion-item">
                        <button 
                            className={`accordion-header ${activePhaseIndex === phaseIndex ? 'active' : ''}`}
                            onClick={() => handleAccordionClick(phaseIndex)}
                        >
                            <span>{phase.phaseName} ({phase.durationWeeks} semanas)</span>
                            <span className="accordion-header-icon">+</span>
                        </button>
                        <div className={`accordion-content ${activePhaseIndex === phaseIndex ? 'open' : ''}`}>
                             {activePhaseIndex === phaseIndex && (() => {
                                const activePhase = routine.phases[activePhaseIndex];
                                const activeDay = activePhase?.routine.dias[activeDayIndex];

                                if (!activeDay) return null;

                                return (
                                <>
                                    <nav className="day-tabs-nav">
                                        {phase.routine.dias.map((day, dayIndex) => (
                                            <button
                                                key={dayIndex}
                                                className={`day-tab-button ${activeDayIndex === dayIndex ? 'active' : ''}`}
                                                onClick={() => setActiveDayIndex(dayIndex)}>
                                                {day.dia}
                                            </button>
                                        ))}
                                    </nav>
                                    <div className="day-card">
                                        <h3><span className="muscle-group">{activeDay.grupoMuscular}</span></h3>
                                        <ul className="exercise-list">
                                            {activeDay.ejercicios.map((exercise, exerciseIndex) => (
                                                <ExerciseTracker 
                                                    key={`${activeDay.dia}-${exercise.nombre}-${exerciseIndex}`}
                                                    exercise={exercise}
                                                    progressLog={clientData.progressLog}
                                                    onProgressUpdate={(log) => onProgressUpdate(log, clientData.bodyWeightLog || [])}
                                                />
                                            ))}
                                        </ul>
                                         {activeDay.cardio && <p className="cardio-note"><strong>Cardio:</strong> {activeDay.cardio}</p>}
                                    </div>
                                </>
                                );
                            })()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// 10b. Componente para seguimiento de ejercicio individual
const ExerciseTracker = ({ exercise, progressLog, onProgressUpdate }: {
    exercise: Exercise;
    progressLog: ProgressLog;
    onProgressUpdate: (updatedLog: ProgressLog) => void;
}) => {
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    const handleSaveProgress = async (e: React.FormEvent) => {
        e.preventDefault();
        const weightValue = parseFloat(weight);
        const repsValue = parseInt(reps, 10);
        if (isNaN(weightValue) || isNaN(repsValue)) return;
        
        setSaveStatus('saving');

        const newLogEntry: ProgressLogEntry = {
            date: new Date().toISOString(),
            weight: weightValue,
            repetitions: repsValue
        };

        const updatedLog = { ...progressLog };
        if (!updatedLog[exercise.nombre]) {
            updatedLog[exercise.nombre] = [];
        }
        updatedLog[exercise.nombre].push(newLogEntry);

        onProgressUpdate(updatedLog);

        setWeight('');
        setReps('');
        setSaveStatus('saved');
    };

    useEffect(() => {
        if (saveStatus === 'saved') {
            const timer = setTimeout(() => setSaveStatus('idle'), 2000);
            return () => clearTimeout(timer);
        }
    }, [saveStatus]);
    
     const lastLog = progressLog[exercise.nombre]?.[progressLog[exercise.nombre].length - 1];

    return (
        <li className="exercise-item">
            <div className="exercise-name-wrapper">
                <span className="exercise-name">{exercise.nombre}</span>
                {exercise.youtubeLink && (
                    <a href={exercise.youtubeLink} target="_blank" rel="noopener noreferrer" className="video-link" aria-label={`Ver video de ${exercise.nombre}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"></path></svg>
                    </a>
                )}
            </div>
            <div className="exercise-details">
                <span><strong>Series:</strong> {exercise.series}</span>
                <span><strong>Reps:</strong> {exercise.repeticiones}</span>
                <span><strong>Descanso:</strong> {exercise.descanso}</span>
            </div>
            {exercise.tecnicaAvanzada && (
                <div className="advanced-technique">
                    <span role="img" aria-label="fire">🔥</span>
                    <strong>Técnica Avanzada:</strong> {exercise.tecnicaAvanzada}
                </div>
            )}
             <form onSubmit={handleSaveProgress}>
                <div className="exercise-tracking">
                    <div>
                        <label htmlFor={`weight-${exercise.nombre}`}>Peso Usado (kg)</label>
                        <input
                            id={`weight-${exercise.nombre}`}
                            type="number"
                            step="0.5"
                            placeholder={lastLog ? `${lastLog.weight} kg` : '40'}
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor={`reps-${exercise.nombre}`}>Repeticiones Hechas</label>
                        <input
                            id={`reps-${exercise.nombre}`}
                            type="number"
                            placeholder={lastLog ? `${lastLog.repetitions} reps` : '10'}
                            value={reps}
                            onChange={(e) => setReps(e.target.value)}
                            required
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    className={`save-progress-button ${saveStatus === 'saved' ? 'saved' : ''}`}
                    disabled={saveStatus === 'saving'}
                >
                    {saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Progreso'}
                </button>
            </form>
        </li>
    );
};


// 11. Vista de Progreso
const ProgressView = ({ clientData }: { clientData: ClientData }) => {
    const [activeTab, setActiveTab] = useState<'weight' | 'exercises'>('weight');
    const [selectedExercise, setSelectedExercise] = useState('');
    
    const uniqueExercises = Object.keys(clientData.progressLog || {});
    
    useEffect(() => {
        if (uniqueExercises.length > 0) {
            setSelectedExercise(uniqueExercises[0]);
        }
    }, []);

    const selectedExerciseData = clientData.progressLog?.[selectedExercise] || [];
    
    const weightDataWithBmi = useMemo(() => {
        return (clientData.bodyWeightLog || []).map(entry => {
            const { bmi, categoryClass } = getBmiDetails(entry.weight, parseFloat(clientData.profile.height));
            return { ...entry, imc: bmi, imcCategoryClass: categoryClass };
        });
    }, [clientData.bodyWeightLog, clientData.profile.height]);

    return (
        <div className="progress-view-container">
             <nav className="progress-tabs-nav">
                <button className={`progress-tab-button ${activeTab === 'weight' ? 'active' : ''}`} onClick={() => setActiveTab('weight')}>
                    Peso Corporal
                </button>
                <button className={`progress-tab-button ${activeTab === 'exercises' ? 'active' : ''}`} onClick={() => setActiveTab('exercises')}>
                    Ejercicios
                </button>
            </nav>
            
            {activeTab === 'weight' && (
                <div className="animated-fade-in">
                    <h3>Progreso de Peso Corporal e IMC</h3>
                     {weightDataWithBmi.length > 0 ? (
                        <>
                             {/* Placeholder for future chart */}
                            <div className="progress-list-container">
                                <div className="progress-list-header weight">
                                    <span>Fecha</span>
                                    <span>Peso (kg)</span>
                                    <span>IMC</span>
                                </div>
                                <div className="progress-list">
                                    {weightDataWithBmi.slice().reverse().map((entry, index) => (
                                         <div key={index} className="progress-list-row weight">
                                            <span>{new Date(entry.date).toLocaleDateString()}</span>
                                            <span>{entry.weight.toFixed(1)}</span>
                                            <span className={entry.imcCategoryClass}>{entry.imc?.toFixed(1) || 'N/A'}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <p>No hay registros de peso corporal todavía.</p>
                    )}
                </div>
            )}

            {activeTab === 'exercises' && (
                <div className="animated-fade-in">
                    <h3>Progreso por Ejercicio</h3>
                     {uniqueExercises.length > 0 ? (
                        <>
                            <select 
                                value={selectedExercise} 
                                onChange={(e) => setSelectedExercise(e.target.value)}
                                className="exercise-select-dropdown"
                            >
                                {uniqueExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                            </select>

                            {/* Placeholder for future chart */}
                            <div className="progress-list-container">
                                <h3>Registros para: {selectedExercise}</h3>
                                 <div className="progress-list-header">
                                    <span>Fecha</span>
                                    <span>Peso (kg)</span>
                                    <span>Reps</span>
                                </div>
                                 <div className="progress-list">
                                    {selectedExerciseData.slice().reverse().map((entry, index) => (
                                        <div key={index} className="progress-list-row">
                                            <span>{new Date(entry.date).toLocaleDateString()}</span>
                                            <span>{entry.weight}</span>
                                            <span>{entry.repetitions}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <p>Aún no has registrado progreso en ningún ejercicio.</p>
                    )}
                </div>
            )}

        </div>
    );
};


// 12. Vista de Acuerdo/Términos
const AgreementView = ({ onAccept, onLogout }: { onAccept: () => void; onLogout: () => void; }) => {
    const [isChecked, setIsChecked] = useState(false);
    
    const termsText = `
Bienvenido a ScorpionGYM AI.

Al utilizar esta aplicación, aceptas los siguientes términos:

1.  **Consulta Profesional:** Esta aplicación genera rutinas y planes de nutrición basados en la información que proporcionas. Sin embargo, no reemplaza el consejo de un médico, nutricionista o entrenador personal certificado. Consulta siempre a un profesional de la salud antes de comenzar cualquier nuevo programa de ejercicio o dieta.

2.  **Asunción de Riesgo:** El ejercicio físico conlleva riesgos inherentes. Al utilizar las rutinas generadas, asumes toda la responsabilidad por cualquier lesión o problema de salud que pueda ocurrir. Entrena de forma segura, escucha a tu cuerpo y no excedas tus límites.

3.  **Uso de Datos:** Tu información personal (nombre, edad, peso, etc.) se utilizará únicamente para generar tus planes personalizados y no será compartida con terceros.

4.  **No hay Garantías:** Si bien la IA está diseñada para crear planes efectivos, los resultados individuales pueden variar y no están garantizados. El progreso depende de múltiples factores como la consistencia, la dieta, el descanso y la genética.

Presiona "Aceptar y Continuar" para confirmar que has leído y entendido estos términos.
    `;
    
    return (
        <div className="agreement-container">
             <header>
                <Logo />
                <h1>Antes de Empezar</h1>
             </header>
            <p>Por favor, lee y acepta los siguientes términos para continuar.</p>
            <div className="terms-box">
                <p>{termsText}</p>
            </div>
             <div className="agreement-actions">
                <label className="agreement-checkbox">
                    <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => setIsChecked(!isChecked)}
                    />
                    He leído y acepto los términos y condiciones.
                </label>
                <div className="agreement-buttons">
                    <button onClick={onLogout} className="cta-button secondary">Salir</button>
                    <button onClick={onAccept} className="cta-button" disabled={!isChecked}>
                        Aceptar y Continuar
                    </button>
                </div>
            </div>
        </div>
    );
};


// 13. Asistente de Chat del Cliente
const ChatAssistant = ({ isOpen, onClose, clientData }: {
    isOpen: boolean;
    onClose: () => void;
    clientData: ClientData;
}) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<{ role: 'user' | 'model', parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] }[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [image, setImage] = useState<string | null>(null); // base64 string
    const [imageMimeType, setImageMimeType] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isThinking]);
    
     useEffect(() => {
        if (isOpen) {
            const initializeChat = async () => {
                 const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
                 const systemInstruction = `
                    Eres "Scorpion AI", un asistente de fitness amigable y motivador para un cliente de gimnasio.
                    Tu propósito es responder preguntas sobre fitness, nutrición y su plan actual, pero NUNCA debes modificar su plan.
                    Siempre debes negarte a crear o cambiar rutinas o dietas. Dirige al cliente a su entrenador para cualquier cambio.

                    Aquí está la información del cliente y su plan. Úsala para dar respuestas personalizadas:
                    **Perfil del Cliente:**
                    ${JSON.stringify(clientData.profile, null, 2)}

                    **Plan de Entrenamiento Actual:**
                    ${clientData.routine ? JSON.stringify(clientData.routine, null, 2) : "El cliente no tiene una rutina asignada."}

                    **Plan de Nutrición Actual:**
                    ${clientData.dietPlan ? JSON.stringify(clientData.dietPlan, null, 2) : "El cliente no tiene un plan de nutrición asignado."}
                    
                    **Reglas de Interacción:**
                    1.  **Sé Amigable y Positivo:** Usa un tono alentador. Empieza la conversación saludando al cliente por su nombre.
                    2.  **No Modifiques Planes:** Si el cliente pide cambiar su rutina (ej. "dame un ejercicio para pecho" o "¿puedo cambiar las sentadillas?"), di algo como: "¡Claro! Para cualquier cambio en tu rutina, lo mejor es que hables directamente con tu entrenador. Él puede ajustarla perfectamente para ti."
                    3.  **Usa su Información:** Si preguntan "¿cuántas calorías debo comer?", basa tu respuesta en su plan de nutrición si existe. Si preguntan "¿qué me toca hoy?", mira su plan de entrenamiento.
                    4.  **Responde Preguntas Generales:** Puedes responder preguntas generales sobre cómo hacer un ejercicio, qué es una proteína, etc.
                    5.  **Sé Conciso:** Da respuestas claras y al punto.
                    6.  **Manejo de Imágenes:** Si el usuario sube una imagen (ej. de una comida), puedes analizarla. Por ejemplo, si es una hamburguesa, puedes decir: "¡Se ve deliciosa! Una hamburguesa así podría tener aproximadamente X calorías. Recuerda registrar tus comidas y mantenerte dentro de los objetivos de tu plan." Si es una imagen de un ejercicio, puedes ofrecer consejos sobre la forma correcta.
                    7. **Límite de Uso Diario:** El cliente tiene un límite de ${clientData.dailyQuestionLimit || 'un número limitado de'} preguntas por día. Lleva la cuenta internamente. Si alcanzan el límite, infórmales amablemente.
                 `;
                
                const newChat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: { systemInstruction },
                    history: []
                });
                setChat(newChat);
                 // Start with a greeting
                setMessages([{ role: 'model', parts: [{ text: `¡Hola ${clientData.profile.name}! Soy Scorpion AI, tu asistente de fitness. ¿En qué puedo ayudarte hoy?` }] }]);
            };
            initializeChat();
        }
    }, [isOpen, clientData]);


    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() && !image) return;
        if (!chat) return;

        setIsThinking(true);
        
        const userMessageParts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [];
        if (userInput.trim()) {
            userMessageParts.push({ text: userInput.trim() });
        }
        if (image && imageMimeType) {
            userMessageParts.push({ inlineData: { mimeType: imageMimeType, data: image } });
        }

        const newUserMessage = { role: 'user' as const, parts: userMessageParts };
        setMessages(prev => [...prev, newUserMessage]);
        
        const messageToSend = userInput.trim();
        setUserInput('');
        setImage(null);
        setImageMimeType(null);

        try {
            const result = await chat.sendMessageStream({ message: messageToSend });
            
            let accumulatedResponse = "";
            for await (const chunk of result) {
                accumulatedResponse += chunk.text;
                setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage.role === 'model') {
                        const newMessages = [...prev];
                        newMessages[newMessages.length - 1] = { ...lastMessage, parts: [{ text: accumulatedResponse }] };
                        return newMessages;
                    } else {
                        return [...prev, { role: 'model', parts: [{ text: accumulatedResponse }] }];
                    }
                });
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Lo siento, ocurrió un error y no puedo responder en este momento." }] }]);
        } finally {
            setIsThinking(false);
        }
    };
    
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const base64 = await toBase64(file);
            setImage(base64);
            setImageMimeType(file.type);
        }
    };
    
    if (!isOpen) return null;

    return (
         <div className="chat-modal-overlay" onClick={onClose}>
            <div className="chat-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="chat-modal-header">
                    <h3>Asistente Scorpion AI</h3>
                    <button onClick={onClose} className="close-button">&times;</button>
                </div>
                <div className="chat-messages" ref={messagesEndRef}>
                    {messages.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.role}`}>
                            <div className="avatar">
                                {msg.role === 'model' ? '🦂' : clientData.profile.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="message-content">
                                {msg.parts.map((part, partIndex) => {
                                    if ('text' in part) {
                                        return <p key={partIndex}>{part.text}</p>;
                                    }
                                    if ('inlineData' in part) {
                                        return <img key={partIndex} src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} alt="Imagen de usuario" />
                                    }
                                    return null;
                                })}
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
                            <img src={`data:${imageMimeType};base64,${image}`} alt="Vista previa" />
                            <button className="remove-image-btn" onClick={() => setImage(null)}>&times;</button>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage}>
                         <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
                         <button type="button" className="chat-action-btn" onClick={() => fileInputRef.current?.click()} aria-label="Adjuntar imagen">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M21.99 10.99C21.99 5.47 16.52 1 11 1S.01 5.47.01 10.99c0 4.19 2.59 7.82 6.22 9.48.3.59.78 1.09 1.34 1.52l.01.01c.21.16.43.32.67.46.22.14.45.26.69.38.25.13.51.24.78.35.27.11.55.2.83.28.3.08.6.15.91.2.33.05.66.08 1 .09.01 0 .02 0 .03 0h.01c.34 0 .67-.03 1-.09.3-.05.6-.12.9-.2.29-.08.57-.17.84-.28.27-.11.52-.22.77-.35.25-.12.48-.24.7-.38.24-.14.46-.3.67-.46l.01-.01c.56-.43 1.04-.93 1.34-1.52 3.63-1.66 6.22-5.29 6.22-9.48zM9.5 14c-1.38 0-2.5-1.12-2.5-2.5S8.12 9 9.5 9s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zm5 0c-1.38 0-2.5-1.12-2.5-2.5S13.12 9 14.5 9s2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                        </button>
                        <input
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            placeholder="Escribe tu pregunta..."
                            disabled={isThinking}
                        />
                        <button type="submit" disabled={isThinking || (!userInput.trim() && !image)}>
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"></path></svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// --- Componentes Genéricos ---

// Componente Modal Genérico
const Modal = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="modal-overlay">
            {children}
        </div>
    );
};


// Componente Principal de la Aplicación
const App = () => {
    const [loggedInUser, setLoggedInUser] = useState<Gym | ClientData | null>(null);
    const [userType, setUserType] = useState<'gym' | 'client' | 'superadmin' | null>(null);
    const [currentView, setCurrentView] = useState<'role_selection' | 'login' | 'dashboard'>('role_selection');
    const [loginRole, setLoginRole] = useState<'admin' | 'client' | null>(null);
    
     // State for SuperAdmin to manage a specific gym
    const [managedGym, setManagedGym] = useState<Gym | null>(null);
    
    useEffect(() => {
        // Check session storage on load
        const storedUser = sessionStorage.getItem('loggedInUser');
        const storedType = sessionStorage.getItem('userType') as 'gym' | 'client' | 'superadmin' | null;
        if (storedUser && storedType) {
            setLoggedInUser(JSON.parse(storedUser));
            setUserType(storedType);
            setCurrentView('dashboard');
        }
    }, []);

    const handleLoginSuccess = (user: Gym | ClientData, type: 'gym' | 'client' | 'superadmin') => {
        sessionStorage.setItem('loggedInUser', JSON.stringify(user));
        sessionStorage.setItem('userType', type);
        setLoggedInUser(user);
        setUserType(type);
        setCurrentView('dashboard');
    };

    const handleLogout = () => {
        sessionStorage.clear();
        setLoggedInUser(null);
        setUserType(null);
        setLoginRole(null);
        setManagedGym(null);
        setCurrentView('role_selection');
    };
    
    const handleSelectRole = (role: 'admin' | 'client') => {
        setLoginRole(role);
        setCurrentView('login');
    };
    
    const handleBackToRoleSelection = () => {
        setLoginRole(null);
        setCurrentView('role_selection');
    };
    
    const handleManageGym = (gym: Gym) => {
        setManagedGym(gym);
    };

    const handleBackToSuperAdmin = () => {
        setManagedGym(null);
    };


    const renderContent = () => {
        if (currentView === 'dashboard' && loggedInUser && userType) {
            if (userType === 'superadmin') {
                if (managedGym) {
                     return <AdminDashboard loggedInGym={managedGym} onLogout={handleLogout} onBackToSuperAdmin={handleBackToSuperAdmin} />;
                }
                return <SuperAdminDashboard loggedInUser={loggedInUser as Gym} onLogout={handleLogout} onManageGym={handleManageGym}/>;
            }
             if (userType === 'gym') {
                return <AdminDashboard loggedInGym={loggedInUser as Gym} onLogout={handleLogout} />;
            }
            if (userType === 'client') {
                return <ClientView clientData={loggedInUser as ClientData} onLogout={handleLogout} />;
            }
        }
        
        if (currentView === 'login' && loginRole) {
            return <LoginView onLoginSuccess={handleLoginSuccess} userType={loginRole} onBack={handleBackToRoleSelection}/>
        }

        return <RoleSelectionView onSelectRole={handleSelectRole} />;
    };

    return renderContent();
};


const root = createRoot(document.getElementById("root")!);
root.render(<App />);