

declare var process: any;
"use client";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Type, GenerateContentResponse, Chat } from "@google/genai";
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
    <img 
      src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgICA8ZyBmaWxsPSIjZTUwOTE0Ij4KICAgICAgICA8cGF0aCBkPSJNNzkuNjIgNjEuNDhjLTIuNzItMS44My02LjAzLTIuMy05LjI2LTIuNjIgMS43NC0uNzEgMy41MS0xLjkzIDQuOC0zLjU2IDIuNDktMy4xNiAzLjIxLTcuMDkgMi4yLTEwLjg2LS42Ni0yLjQ2LTIuMDYtNC42MS00LjA4LTYuMjEtMy45MS0zLjExLTkuNjQtMy45MS0xNC40OS0yLjQxLTIuNjYuODItMy40MSAzLjM4LTEuNzggNS41NiAxLjM4IDEuODIgMy44MyAyLjY2IDYuMDcgMi4xMyAyLjA1LS40OCAzLjM0LTEuNzUgMy43OC0zLjM5MS0xLjY0LTEuNTctNC4zNi0xLjc2LTYuNTMtLjgtMi41NCAxLjEyLTMuNzMgMy40MS0zLjYzIDUuOTkuMTEgMi45OSAxLjY2IDUuNTYgNC4wNiA3LjA4IDIuMjMgMS40MSIDQuODcgMS44MiA3LjQyIDEuMjUgMi4xMy0uNDggMy40Ny0xLjg0IDQuMDktMy42NC41My0xLjU4LjI3LTMuMi0uNzQtNC4zNC0uOTMtMS4wMi0yLjQ0LTEuMzYtMy44LTEuMDMtMS41NS4zNy0yLjU3IDEuMzItMi43MSAyLjcxLS4yIDItLjcgMy42Ny0xLjk2IDQuOTgtMS4yIDEuMjQtMi43MyAxLjg5LTQuNDEgMi4wNC0yLjcxLjI0LTUuNTgtLjI5LTcuODktMS41NC0xLjkyLTEuMDQtMy40Ny0yLjctNC4zOC00LjY3LS44Ni0xLjg4LTEuMTUtMy45OC0uODYtNS45OS4yOC0xLjkzIDEuMTMtMy43MSAyLjQ4LTUuMTcgMy4zOC0zLjY5IDguODctNS4xMiAxMy42LTQuMDIgMy4xOC43MyA1LjgxIDIuNSAzLjQzIDYuNjMtMS4zMiAyLjMxLTMuODggMi40OC02LjA4IDEuNTMtMS45OC0uODQtMy4xMS0yLjYxLTIuOTYtNC42NS4xNS0yLjA1IDEuNTMtMy42NyAzLjQ2LTQuNDcgMS45OC0uODIgNC4xMy0uOSAzLjYxIDIuMTItLjI5IDEuNzItMS40OSAyLjY5LTMuMDkgMy4xNS0yLjExLjYtNC4wMS0uMDItNS4zNC0xLjM2LTEuODMtMS44Ny0yLjM5LTQuNTQtMS40NS02Ljg1LjkzLTIuMyAyLjk4LTMuOTQgNS4zNC00LjY4IDYuNjUtMi4xIDEzLjg4LS4yNyAxNy45MyA0LjM1IDIuMDggMi4zNiAzLjI2IDUuMzUgMy4xNCAxMC4xNC0xLjggMi4yOS00LjIzIDMuODktNi45OCA0LjU5LTMuMDQuNzctNi4yMS41OS05LjE4LS4xNy0xLjM4LS4zNS0yLjY5LS45MS0zLjgxLTEuNjYtMS4wMi0uNjgtMS44Ny0xLjU2LTIuNDctMi41OC0uNTQtLjkyLS44My0xLjk2LS44NC0yLjk5LS4wMi0xLjIyLjMyLTIuNDEgMS4xOC0zLjI5IDEuNDEtMS40NCAzLjY5LTEuNzkgNS42MS0xLjA3IDEuNjcuNjQgMi42MyAxLjk3IDIuNjEgMy42Mi0uMDMgMi4yNy0xLjc0IDMuOTctMy44OCA0LjM5LTEuMy0uMjYtMi42NC4xNC0zLjg3LS4yOC0xLjkyLS42NS0zLjQ4LTIuMDUtNC4yNC0zLjc4LS41NS0xLjI2LS44My0yLjY2LS44Mi00LjA2IC4wMS0xLjY2LjQ4LTMuMyAxLjQ2LTQuNjggMi4zNC0zLjI5IDYuMzMyLTUuMjQgMTAuMjgtNS4zOHM3LjgzIDEuMzYgMTAuNTcgNC4yYzEuMjcgMS4zMiAyLjExIDIuOTcgMi40MSA0Ljc2LjMzIDIuMDMtLjAyIDQuMS0uOTkgNS45Ni0xLjE0IDIuMTYtMi45NyAzLjg1LTUuMjEgNC44Ny0xLjIuNTctMi40NiAxLjAyLTMuNzggMS4zLTEuODcuNDEtMy43OC40Ny01LjYzLjE2LTEuNTktLjI2LTMuMTYtLjgzLTQuNDgtMS41NGwtLjItLjEyYzIuMzggNi4xNSA1LjgyIDExLjI2IDEwLjExIDE1LjE5IDEuNjIgMS40NyAzLjI5IDIuODkgNS4wOSA0LjE0LjcyLjUxIDEuNSAuODggMi4yOSAxLjI1Ljg5LjQzIDEuODEuNzUgMi43NSAxLjAxIDIuMjQuNjIgNC41Ni44OCA2Ljg2LjgyIDUuMjItLjMzIDkuNDMtNC4yMyAxMC4zLTkuMzkuMy0zLjE4LS40Mi02LjI5LTIuNDEtOC43OS0xLjQ2LTEuODEtMy40Ny0zLjExLTUuNzgtMy43OC0zLjEtLjkxLTYuNC0uNTctOS4yNiAuODktMS40Ny43NiAxLjQ3IDcuMzcgMy4wNiA2LjU4LS45MiAyLjU5LTIuMzYgMi44OC0zLjk0LjQtMi4yMy0uNzEtNC4yNS0yLjYxLTUuMzYtMS4zLTEuMTctMy4wNi0xLjQ3LTQuNjktMS4xOS0xLjkxLjMzLTMuMzkxIDEuNDYtNC4wNyAzLjA1LTEuMTMgMi42MyAxLjMyIDQuOTggMy44NCA0LjQzIDIuMjUtLjQ5IDMuNTktMi40NiAzLjQzLTQuNTYtLjE0LTEuODEtMS40NC0zLjI3LTMuMTUtMy43NC0xLjQxLS4zOS0yLjktLjA3LTQuMTMuNzctMS4yOC44OC0yLjA2IDIuMi0yLjE4IDMuNTktLjEyIDEuNDcuMzggMi45NSAxLjM4IDQuMDIgMS44OCAxLjk3IDQuNzMgMi43IDcuMjEgMS44IDEuNS0uNTQgMi43NC0xLjU2IDMuNDktMi44OCAxLjQyLTIuNTIgMS40MS01LjYtLjAyLTcuOTctMS4zMS0yLjEzLTMuMzQtMy42Ni01LjY2LTQuNDMtMi4xLS42OS00LjMxLS44Mi02LjQ2LS4zNi0xLjg1LjQtMy41NiAxLjMzLTQuODkgMi42NC0xLjg4IDEuODUtMi44NyA0LjMzLTIuNzEgNi44MS4xNyAyLjczIDEuOTEgNS4xMiA0LjM1IDYuMTcgMi40NyAxLjA3IDUuMTguOTIgNy42NC0uNDMgMi41NC0xLjQyIDQuMjktMy42NyA1LjA1LTYuMzYuNTItMS44NC41OS0zLjc3LjIxLTUuNjItLjczLTMuNTgtMy42MS02LjQzLTYuOTgtNy41OS0xLjk1LS42Ni0zLjk4LS44Ny02LjAxLS41OC0zLjA4LjQzLTUuODUgMi4wMS03Ljc3IDQuMjMtMS41IDEuNzUtMi41IDMuOTYtMi44MyA2LjE5LS4zMiAyLjItLjAxIDQuNDggMS4wMSA2LjU0IDEuMjggMi41NiAzLjYyIDQuNDcgNi4zMSA1LjQyIDIuMjkuOCAzLjM1IDEuNTUgMi43NiAzLjQ2LS40MSAxLjMyLTEuNjYgMi4yLTIuOTYgMi4zOS0xLjQyLjIxLTIuODYtLjA4LTQuMTctLjgtMS40MS0uNzgtMi42Ny0xLjkxLTMuNjMtMy4yMy0uOTYtMS4zMi0xLjU5LTIuODUtMS44My00LjQ4LS4xMi0uODItLjEzLTEuNjctLjAzLTIuNTEgMi4wNi0uMDcgNC4xMS0uMjEgNi4xNy0uMjEtMy42Mi0uMDctNy4yMy4xLTEwLjg1LS4xMi01LjcyLS4zNC0xMC4yMi01LjM2LTkuODktMTAuOTMuMi0zLjQ2IDIuMDctNi42NSA0Ljg4LTguOTQgMy4xMS0yLjU0IDYuOTYtMy45MSAxMC45My0zLjkzIDMuNDktLjAyIDYuOTUgMS4wMSAxMC4wMyAyLjk5IDIuMDMgMS4zMSAzLjg2IDIuOTggNS40MSAzLjg3IDEuOTQuMzIgMy45MS4zNiA1LjgzLjE0IDIuNzUtLjMyIDUuMzEtMS4yOCA3LjQ5LTIuNzYgMy4yNy0yLjIzIDUuNDUtNS4zOSA2LjM1LTkuMjYgMS4xMS00Ljc5LS42My05LjU5LTQuMDYtMTMuMTMtMS45OC0yLjA1LTQuNDQtMy41My03LjE1LTQuMzYtNC4wMi0xLjIzLTguMjYtLjc0LTExLjk5IDEuMTYtNC4yOSAyLjE4LTcuNSA1LjUxLTkuMzMgOS45NS0uNzggMS45LTEuMzIgMy45LTEuNTggNS45MS0uMzQgMi41OC0uMDcgNS4yIDEuMDYgNy40Mi42MiAxLjIxIDEuMzYgMi4zMiAyLjIzIDMuMzEgMS45IDEuMTcgMy45NSAxLjc5IDYuMDYgMS44MSAyLjM2LjAxIDQuNjQtLjg2IDYuNDYtMi40MiAxLjQ4LTEuMjcgMi40OS0yLjk0IDIuOTEtNC43MS40MS0xLjc0LjI0LTMuNTQtLjQ0LTUuMTMtMS40MS0zLjI5LTQuNDktNS41LTcuOTItNi4yMy0xLjg0LS4zOS0zLjcyLS4yNC01LjQ1LjQyLTEuOTguNzQtMy42NSAyLjEtNC44OCA3LjAzLS4yOCAxLjEzLS40OCAyLjI4LS42IDMuNDQtLjI3IDIuNDYuMzMgNC45MSAxLjc3IDYuOTcgMS4wMSAxLjQ0IDIuMzUgMi41OCA0LjAxIDMuMjkgMS42NS43MSAzLjQ5IDEuMDYgNS4zMSAxLjAzIDIuMDQtLjA0IDQuMDYtLjc0IDUuNjctMS45NiAxLjI5LTEgMi4zMS0yLjM0IDIuOTItMy44Ny44MS0yLjA1IDEuMDQtNC4yMi42NC02LjM1LS40NC0yLjMzLTEuNjktNC40MS0zLjU4LTUuOTktMi4zNy0yLTUuMzYtMy4wMy04LjQ1LTIuOTYtMi40OS4wNS00Ljg5IDEuMDYtNi43OSAyLjgyLTIuMTIgMS45Ni0zLjQyIDQuNjEtMy43IDcuMzYtLjI1IDIuNC4zNSA0LjgxIDEuNzEgNi44MS45OCAxLjQ1IDIuMjQgMi41MyAzLjcyIDMuMTIgMS45My43OCAzLjk3IDEgNi4wMi41OCAxLjk4LS40IDMuNjUtMS40OSA0Ljc3LTMuMDQgMS42MS0yLjIzIDEuOTQtNS4xIDEuMDItNy41OC0uODMtMi4yNC0yLjc0LTMuODQtNS4wMS00LjUxLTEuOTItLjU4LTMuOTItLjYtNS44MS0uMDctMi4zNy42Ny00LjM2IDIuMTctNS42OCA0LjI0LTEuMDcgMS42OC0xLjY0IDMuNjUtMS4xOCA1Ljk0LjA1LTEuOTQuNDggMy44NyAxLjYyIDUuNTEgMS45MiAyLjc3IDUuMDEgNC4zNyA4LjE4IDQuMzdhIDQuNTIgMS4xOC0xLjc1IDEuODUtMy44NiAxLjkyLTUuOTYuMDUtMS42Mi0uMzMtMy4yNS0uMTctMy40NyAxLjM3LTEuODUgMy41NS0zLjA4IDUuODgtMy41NiAyLjM5LS40OSA0Ljg2LS4xOCA2Ljk2IC44NiAyLjk5IDEuNDggNS4zNSAzLjgyIDYuNjEgNi43MiAxLjQ4IDMuNCAyIDcuMTguODggMTAuODItMS4yIDMuODktMy44OSA3LTcuMTQgOC45MS00LjI3IDIuNS05LjMgMy4wMy0xNC4wOSAxLjUyLTEuOTUtLjYyLTMuODEtMS41NS02LjA0LTIuMjctLjUzLS4xNy0yLjgyLS45OC00LjI3LTEuNjctMS4xNi0uNTUtMS42NC0xLjkxLS45Ni0yLjk3IDEuMzgtMi4xMyA0LjMxLTIuOCA2LjYzLTEuMzIgMi4xNyAxLjM2IDMuMTggMy45MyAyLjA4IDYuMDItMS40NyAyLjc3LTUuMDUgMy42NS03Ljk5IDIuMjMtMy4xMy0xLjUxLTQuMzUtNS4xMS0zLjI2LTguMTIgMS4yMS0zLjMyIDQuOTUtNS4yMyA4LjI2LTQuMzEgMy43MSAxLjA0IDUuNjcgNC41NiA0LjQ5IDcuOTgtMS4xMSAzLjIyLTQuNjEgNS4xOC03Ljg3IDQuMzktMy4zNS0uODItNS41Ni0zLjkyLTQuNzktNy4xOS44MS0zLjQyIDQuMTMtNS43OCA3LjU2LTUuMzIgMy44Mi41IDYuNSAzLjUgNS44MiA3LjI2LS41NCAyLjk1LTMuMjUgNS4wNS02LjEyIDQuODQtMy4wOC0uMjItNS41NC0yLjUyLTUuNTgtNS41NC0uMDQtMi45NCAxLjk4LTUuNDIgNC44MS01LjkzIDMuMjgtLjU5IDYuNTMuODkgOC4wNyAzLjYxIDEuMjEgMi4xMSAxIi8+CiAgICA8L2c+Cjwvc3ZnPg==" 
      alt="ScorpionGYM AI Logo" 
      className={`app-logo ${className}`}
    />
);


// 1. Modal Genérico
const ConfirmationModal = ({ message, onConfirm, onCancel, confirmText = "Confirmar", cancelText = "Cancelar" }) => (
    <div className="modal-overlay">
        <div className="modal-content">
            <p>{message}</p>
            <div className="modal-actions">
                <button onClick={onCancel} className="cta-button secondary">{cancelText}</button>
                <button onClick={onConfirm} className="cta-button">{confirmText}</button>
            </div>
        </div>
    </div>
);


// 2. Vista de Login
const LoginView = ({ onLogin, onClientLogin }) => {
    const [view, setView] = useState('landing'); // 'landing', 'admin', 'client'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [dni, setDni] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleAdminSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        if (username.toLowerCase() === 'admin' && password === SUPER_ADMIN_PASSWORD) {
            onLogin('super_admin', null);
        } else {
            const gymData = await apiClient.gymLogin(username, password);
            if (gymData) {
                onLogin('gym_admin', gymData);
            } else {
                setError('Usuario o contraseña incorrectos.');
            }
        }
        setIsLoading(false);
    };

    const handleClientSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        const success = await apiClient.loginClient(dni, accessCode);
        if (success) {
            onClientLogin(dni);
        } else {
            setError('DNI o código de acceso incorrectos. Asegurate que tu plan esté activo.');
        }
        setIsLoading(false);
    };

    if (view === 'landing') {
        return (
            <div className="login-container">
                 <header>
                    <Logo className="login-logo" />
                    <h1>ScorpionGYM AI</h1>
                    <p>Tu asistente de entrenamiento personalizado.</p>
                </header>
                <div className="landing-box">
                    <h2>¿Quién sos?</h2>
                    <div className="role-selection">
                        <button className="cta-button" onClick={() => setView('admin')}>Soy Entrenador o Administrador</button>
                        <button className="cta-button secondary" onClick={() => setView('client')}>Soy Cliente</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <header>
                <Logo className="login-logo" />
                <h1>ScorpionGYM AI</h1>
            </header>
            <div className="login-box">
                <h2>{view === 'admin' ? 'Acceso para Entrenadores' : 'Acceso para Clientes'}</h2>
                <p>{view === 'admin' ? 'Ingresá tus credenciales.' : 'Ingresá tu DNI y código de acceso.'}</p>
                {view === 'admin' ? (
                    <form onSubmit={handleAdminSubmit}>
                        <input type="text" placeholder="Usuario" value={username} onChange={e => setUsername(e.target.value)} required />
                        <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required />
                        {error && <p className="error-text">{error}</p>}
                        <button type="submit" className="cta-button" disabled={isLoading}>
                            {isLoading ? <span className="spinner small"></span> : 'Ingresar'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleClientSubmit}>
                        <input type="text" placeholder="DNI (sin puntos)" value={dni} onChange={e => setDni(e.target.value)} required />
                        <input type="text" placeholder="Código de Acceso" value={accessCode} onChange={e => setAccessCode(e.target.value)} required />
                        {error && <p className="error-text">{error}</p>}
                        <button type="submit" className="cta-button" disabled={isLoading}>
                            {isLoading ? <span className="spinner small"></span> : 'Ingresar'}
                        </button>
                    </form>
                )}
                <button className="back-button simple" onClick={() => { setView('landing'); setError(''); }}>Volver</button>
            </div>
        </div>
    );
};


// 3. Vista de Súper Administrador
const SuperAdminDashboard = ({ onLogout }) => {
    const [gyms, setGyms] = useState<Gym[]>([]);
    const [newGymName, setNewGymName] = useState('');
    const [newGymUsername, setNewGymUsername] = useState('');
    const [newGymPassword, setNewGymPassword] = useState('');
    const [newGymLimit, setNewGymLimit] = useState(10);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State for editing a gym
    const [editingGym, setEditingGym] = useState<Gym | null>(null);
    const [editName, setEditName] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editLimit, setEditLimit] = useState(10);

    // State for deleting a gym
    const [deletingGym, setDeletingGym] = useState<Gym | null>(null);


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
        setIsSubmitting(true);
        const success = await apiClient.createGym(newGymName, newGymUsername, newGymPassword, newGymLimit);
        if (success) {
            setNewGymName('');
            setNewGymUsername('');
            setNewGymPassword('');
            setNewGymLimit(10);
            await fetchGyms();
        } else {
            alert('Error al crear el gimnasio. El nombre de usuario ya podría existir.');
        }
        setIsSubmitting(false);
    };
    
    const handleEditGym = (gym: Gym) => {
        setEditingGym(gym);
        setEditName(gym.name);
        setEditLimit(gym.dailyQuestionLimit || 10);
        setEditPassword('');
    };
    
    const handleUpdateGym = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingGym) return;
        
        const updateData: { name?: string; password?: string, dailyQuestionLimit?: number } = {};
        if (editName && editName !== editingGym.name) {
            updateData.name = editName;
        }
        if (editPassword) { // Only include password if a new one is typed
            updateData.password = editPassword;
        }
        if (editLimit !== editingGym.dailyQuestionLimit){
            updateData.dailyQuestionLimit = editLimit;
        }

        if (Object.keys(updateData).length > 0) {
            const success = await apiClient.updateGym(editingGym._id, updateData);
            if (success) {
                await fetchGyms();
            } else {
                alert('Error al actualizar el gimnasio.');
            }
        }
        setEditingGym(null);
    };

    const handleDeleteGym = async () => {
        if (!deletingGym) return;
        const success = await apiClient.deleteGym(deletingGym._id);
        if (success) {
            setGyms(gyms.filter(g => g._id !== deletingGym._id));
        } else {
            alert('Error al eliminar el gimnasio.');
        }
        setDeletingGym(null);
    };


    return (
        <div className="admin-dashboard">
            {deletingGym && (
                <ConfirmationModal
                    message={`¿Estás seguro de que querés eliminar "${deletingGym.name}"? Esta acción es irreversible y borrará TODOS los clientes y datos asociados.`}
                    onConfirm={handleDeleteGym}
                    onCancel={() => setDeletingGym(null)}
                    confirmText="Sí, eliminar"
                />
            )}
             {editingGym && (
                <div className="modal-overlay">
                    <div className="modal-content edit-modal">
                        <h3>Editar Gimnasio: {editingGym.name}</h3>
                        <form onSubmit={handleUpdateGym}>
                            <div className="form-group">
                                <label htmlFor="edit-gym-name">Nombre del Gimnasio</label>
                                <input id="edit-gym-name" type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-gym-password">Nueva Contraseña (dejar en blanco para no cambiar)</label>
                                <input id="edit-gym-password" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="••••••••" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-gym-limit">Límite de Preguntas Diarias por Cliente</label>
                                <input id="edit-gym-limit" type="number" min="0" value={editLimit} onChange={(e) => setEditLimit(Number(e.target.value))} required />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="cta-button secondary" onClick={() => setEditingGym(null)}>Cancelar</button>
                                <button type="submit" className="cta-button">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <div className="main-header">
                <div className="header-title-wrapper">
                    <h1>Panel de Super Admin</h1>
                </div>
                <button onClick={onLogout} className="logout-button admin-logout">Cerrar Sesión</button>
            </div>
            
            <div className="add-gym-container">
                <h3>Crear Nuevo Gimnasio</h3>
                <form onSubmit={handleCreateGym} className="add-gym-form">
                    <input type="text" placeholder="Nombre del Gimnasio" value={newGymName} onChange={e => setNewGymName(e.target.value)} required />
                    <input type="text" placeholder="Usuario (para login)" value={newGymUsername} onChange={e => setNewGymUsername(e.target.value)} required />
                    <input type="password" placeholder="Contraseña" value={newGymPassword} onChange={e => setNewGymPassword(e.target.value)} required />
                    <input type="number" min="0" placeholder="Límite Preguntas" value={newGymLimit} onChange={e => setNewGymLimit(Number(e.target.value))} required />
                    <button type="submit" className="cta-button" disabled={isSubmitting}>
                        {isSubmitting ? <span className="spinner small"></span> : 'Crear Gimnasio'}
                    </button>
                </form>
            </div>

            {isLoading ? <div className="loading-container"><span className="spinner"></span></div> : (
                <div className="gym-list">
                    {gyms.map(gym => (
                        <div key={gym._id} className="gym-card">
                            <div>
                                <div className="gym-card-header">
                                    <div className="gym-card-logo">
                                       <Logo />
                                    </div>
                                    <div className="gym-card-info">
                                        <h3>{gym.name}</h3>
                                        <p>Usuario: <strong>{gym.username}</strong></p>
                                    </div>
                                </div>
                                <p>Límite de preguntas por cliente: <strong>{gym.dailyQuestionLimit}</strong></p>
                            </div>
                            <div className="gym-card-actions">
                                <button onClick={() => handleEditGym(gym)} className="action-btn edit">Editar</button>
                                <button onClick={() => setDeletingGym(gym)} className="action-btn delete">Eliminar</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// 4. Vista de Administrador de Gimnasio
const AdminDashboard = ({ gym, onLogout, onManageClient, onShowLibrary }) => {
    const [clients, setClients] = useState<ClientListItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newDni, setNewDni] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // State for view toggle and selection
    const [view, setView] = useState<'active' | 'archived'>('active');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
    const [modalAction, setModalAction] = useState<{ type: 'archive' | 'restore' | 'delete', onConfirm: () => void } | null>(null);

    const fetchClients = async () => {
        setIsLoading(true);
        const fetchedClients = await apiClient.getClients(gym._id);
        setClients(fetchedClients);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchClients();
    }, [gym._id]);

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDni) return;
        setIsSubmitting(true);
        const result = await apiClient.createClient(newDni, gym._id);
        if (result.success) {
            setNewDni('');
            await fetchClients();
        } else {
            alert(result.message || 'Error al crear el cliente.');
        }
        setIsSubmitting(false);
    };
    
    const toggleClientSelection = (dni: string) => {
        const newSelection = new Set(selectedClients);
        if (newSelection.has(dni)) {
            newSelection.delete(dni);
        } else {
            newSelection.add(dni);
        }
        setSelectedClients(newSelection);
    };
    
    const handleBulkAction = async (action: 'archive' | 'restore' | 'delete') => {
        let newStatus: 'active' | 'archived' | undefined;
        if (action === 'archive') newStatus = 'archived';
        if (action === 'restore') newStatus = 'active';

        if (newStatus) {
            await apiClient.updateClientStatus(selectedClients, newStatus);
        } else if (action === 'delete') {
            await apiClient.deleteClients(selectedClients);
        }
        
        // Reset selection and fetch updated list
        setSelectedClients(new Set());
        setIsSelectionMode(false);
        setModalAction(null);
        await fetchClients();
    };

    const confirmAction = (type: 'archive' | 'restore' | 'delete') => {
        setModalAction({ type, onConfirm: () => handleBulkAction(type) });
    };

    const filteredClients = useMemo(() => {
        return clients
            .filter(c => c.status === view)
            .filter(c => 
                (c.profile.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.dni.includes(searchTerm)
            );
    }, [clients, view, searchTerm]);

    return (
        <div className="admin-dashboard">
            {modalAction && (
                <ConfirmationModal
                    message={
                        modalAction.type === 'delete' ? `¿Estás seguro de que querés eliminar ${selectedClients.size} cliente(s)? Esta acción es irreversible.` :
                        `¿Estás seguro de que querés ${modalAction.type === 'archive' ? 'archivar' : 'restaurar'} ${selectedClients.size} cliente(s)?`
                    }
                    onConfirm={modalAction.onConfirm}
                    onCancel={() => setModalAction(null)}
                    confirmText={modalAction.type === 'delete' ? 'Sí, eliminar' : 'Confirmar'}
                />
            )}
            <div className="main-header">
                <div className="header-title-wrapper">
                    <h1>{gym.name}</h1>
                </div>
                <nav className="admin-header-nav">
                    <button className="header-nav-button" onClick={onShowLibrary}>Biblioteca de Ejercicios</button>
                    <button onClick={onLogout} className="logout-button admin-logout">Cerrar Sesión</button>
                </nav>
            </div>
            
             <div className="client-management-bar">
                <div className="add-client-form">
                    <form onSubmit={handleCreateClient}>
                        <input
                            type="text"
                            placeholder="DNI del nuevo cliente"
                            value={newDni}
                            onChange={(e) => setNewDni(e.target.value.replace(/\D/g, ''))}
                            required
                        />
                        <button type="submit" className="cta-button" disabled={isSubmitting}>
                            {isSubmitting ? <span className="spinner small"></span> : 'Agregar'}
                        </button>
                    </form>
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
                    <button className={`view-toggle-button ${view === 'active' ? 'active' : ''}`} onClick={() => setView('active')}>Activos</button>
                    <button className={`view-toggle-button ${view === 'archived' ? 'active' : ''}`} onClick={() => setView('archived')}>Archivados</button>
                </div>

                <div className="selection-controls">
                     <button className="selection-toggle-button" onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedClients(new Set()); }}>
                        {isSelectionMode ? 'Cancelar Selección' : 'Seleccionar Varios'}
                    </button>
                    {isSelectionMode && (
                        <>
                            {view === 'active' && <button className="archive-selected-button" disabled={selectedClients.size === 0} onClick={() => confirmAction('archive')}>Archivar</button>}
                            {view === 'archived' && <button className="restore-selected-button" disabled={selectedClients.size === 0} onClick={() => confirmAction('restore')}>Restaurar</button>}
                            <button className="delete-selected-button" disabled={selectedClients.size === 0} onClick={() => confirmAction('delete')}>Eliminar</button>
                        </>
                    )}
                </div>
            </div>

            {isLoading ? <div className="loading-container"><span className="spinner"></span></div> : (
                <div className="client-list">
                    {filteredClients.map(client => (
                        <div
                            key={client.dni}
                            className={`client-card ${isSelectionMode ? 'selection-mode' : ''} ${selectedClients.has(client.dni) ? 'selected' : ''}`}
                            onClick={() => isSelectionMode ? toggleClientSelection(client.dni) : onManageClient(client.dni)}
                        >
                             {isSelectionMode && (
                                <input
                                    type="checkbox"
                                    className="client-selection-checkbox"
                                    checked={selectedClients.has(client.dni)}
                                    onChange={() => toggleClientSelection(client.dni)}
                                    onClick={(e) => e.stopPropagation()} // Prevent card click when clicking checkbox
                                />
                            )}
                            <h3>{client.profile.name || `Cliente ${client.dni}`}</h3>
                            <p>DNI: {client.dni}</p>
                            <p>Plan Actual: {client.planName}</p>
                        </div>
                    ))}
                    {filteredClients.length === 0 && <p>No se encontraron clientes que coincidan.</p>}
                </div>
            )}
        </div>
    );
};


// 5. Vista de Gestión de Cliente (el corazón de la app para el admin)
const ClientManagement = ({ clientDni, onBack, gymId }) => {
    const [client, setClient] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [loadingMessage, setLoadingMessage] = useState('Cargando datos del cliente...');
    const [activeTab, setActiveTab] = useState('routine');
    const [hasChanges, setHasChanges] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [adminInstructions, setAdminInstructions] = useState('');
    const [exerciseLibrary, setExerciseLibrary] = useState<ExerciseLibrary>({});

    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);
    
    const fetchClientData = async () => {
        setIsLoading(true);
        const data = await apiClient.getClientData(clientDni);
        setClient(data);
        setIsLoading(false);
    };
    
    const fetchExerciseLibrary = async () => {
        const library = await apiClient.getExerciseLibrary(gymId);
        setExerciseLibrary(library);
    };

    useEffect(() => {
        fetchClientData();
        fetchExerciseLibrary();
    }, [clientDni, gymId]);

    const handleProfileChange = (field: keyof Profile, value: any) => {
        if (!client) return;
        setClient({
            ...client,
            profile: {
                ...client.profile,
                [field]: value,
            },
        });
        setHasChanges(true);
    };
    
    const handleSaveChanges = async () => {
        if (!client) return;
        setSaveStatus('saving');
        // We only save the parts that can be changed here
        const dataToSave: Partial<ClientData> = {
            profile: client.profile,
            routine: client.routine,
            dietPlan: client.dietPlan,
            // We don't save progressLog or other data from this view
        };
        const success = await apiClient.saveClientData(client.dni, dataToSave);
        if (success) {
            setHasChanges(false);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            alert('Error al guardar los cambios.');
            setSaveStatus('idle');
        }
    };
    
    // --- Lógica de Generación de IA ---
    const generatePlan = async (isRegeneration = false, customInstructions = "") => {
        if (!client || !ai) return;

        // Validation check
        const requiredFields: (keyof Profile)[] = ['name', 'age', 'weight', 'height', 'gender', 'level', 'goal', 'trainingDays'];
        const missingFields = requiredFields.filter(field => !client.profile[field]);
        if (missingFields.length > 0) {
            setError(`Por favor, completá los siguientes campos del perfil antes de generar una rutina: ${missingFields.join(', ')}.`);
            return;
        }

        setIsLoading(true);
        setError('');
        setLoadingMessage('Generando el plan de entrenamiento...');

        const availableExercises = Object.entries(exerciseLibrary)
            .map(([group, exercises]) => {
                const enabled = exercises.filter(ex => ex.isEnabled).map(ex => ex.name);
                return enabled.length > 0 ? `* ${group}: ${enabled.join(', ')}` : null;
            })
            .filter(Boolean)
            .join('\n');
            
        const prompt = `
            SOS UN EXPERTO EN FITNESS Y NUTRICIÓN.
            ROL: Tenés que crear un plan de entrenamiento detallado y profesional para un cliente de gimnasio.
            
            DATOS DEL CLIENTE:
            - Nombre: ${client.profile.name}
            - Edad: ${client.profile.age} años
            - Peso: ${client.profile.weight} kg
            - Altura: ${client.profile.height} cm
            - Género: ${client.profile.gender}
            - Nivel de Experiencia: ${client.profile.level}
            - Objetivo Principal: ${client.profile.goal}
            - Días de entrenamiento por semana: ${client.profile.trainingDays}
            - Intensidad de entrenamiento deseada: ${client.profile.trainingIntensity}
            - ¿Incluir técnicas avanzadas?: ${client.profile.useAdvancedTechniques}
            - Área de enfoque corporal: ${client.profile.bodyFocusArea}
            - Grupos musculares específicos a enfocar (si los hay): ${client.profile.bodyFocusSpecific || "Ninguno en particular"}
            - ¿Incluir fase de adaptación inicial?: ${client.profile.includeAdaptationPhase}

            EJERCICIOS DISPONIBLES (USÁ ESTOS EJERCICIOS EXCLUSIVAMENTE):
            ${availableExercises}

            INSTRUCCIONES ESPECÍFICAS ADICIONALES DEL ENTRENADOR:
            ${customInstructions || "Ninguna."}
            
            TAREA:
            Generá un plan de entrenamiento completo en formato JSON. Seguí la estructura del schema provisto de forma ESTRICTA.
            
            REGLAS IMPORTANTES:
            1.  **ESTRUCTURA Y FASES**: Si el cliente es principiante o se indicó una fase de adaptación, la primera fase DEBE llamarse "Fase de Adaptación". Las fases deben ser lógicas (ej. Adaptación, Hipertrofia, Fuerza). La duración total debe ser de 8 a 16 semanas.
            2.  **SELECCIÓN DE EJERCICIOS**: Usá SOLAMENTE los ejercicios de la lista "EJERCICIOS DISPONIBLES". NO inventes ejercicios. Distribuí los ejercicios de forma lógica según los días y grupos musculares.
            3.  **SERIES Y REPETICIONES**: Adaptá las series y repeticiones al nivel y objetivo del cliente. Para hipertrofia, usá rangos de 6-12 reps. Para resistencia, 15-20. Para principiantes, empezá con menos series.
            4.  **DESCANSO**: Tiempos de descanso lógicos. Hipertrofia: 60-90s. Fuerza: 2-3 min.
            5.  **TÉCNICAS AVANZADAS**: Si se solicitó, incluí UNA técnica avanzada por grupo muscular principal en algunos ejercicios. Usá las opciones: ${advancedTechniqueOptions.filter(o => o.value).map(o => o.label).join(', ')}. Especificá la técnica en el campo 'tecnicaAvanzada'.
            6.  **CARDIO**: Incluí una recomendación de cardio al final de cada día, adaptada al objetivo (ej. 20-30 min de cardio moderado para pérdida de grasa).
            7.  **SALIDA JSON**: El resultado final DEBE ser ÚNICAMENTE el objeto JSON, sin texto adicional antes o después.
        `;

        const schema = {
            type: Type.OBJECT,
            properties: {
                planName: { type: Type.STRING, description: "Nombre del plan, ej: 'Plan de Hipertrofia para [Nombre]'" },
                totalDurationWeeks: { type: Type.INTEGER, description: "Duración total del plan en semanas (8-16)" },
                phases: {
                    type: Type.ARRAY,
                    description: "Array de las fases del entrenamiento",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            phaseName: { type: Type.STRING, description: "Nombre de la fase (ej: 'Fase de Adaptación', 'Fase 1: Hipertrofia')" },
                            durationWeeks: { type: Type.INTEGER, description: "Duración de esta fase en semanas" },
                            routine: {
                                type: Type.OBJECT,
                                properties: {
                                    dias: {
                                        type: Type.ARRAY,
                                        description: "Array con los días de entrenamiento de la semana.",
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                dia: { type: Type.STRING, description: "Día de la semana (ej: 'Día 1', 'Día 2')" },
                                                grupoMuscular: { type: Type.STRING, description: "Grupo muscular principal trabajado (ej: 'Pecho y Tríceps')" },
                                                ejercicios: {
                                                    type: Type.ARRAY,
                                                    items: {
                                                        type: Type.OBJECT,
                                                        properties: {
                                                            nombre: { type: Type.STRING, description: "Nombre del ejercicio exacto de la lista provista" },
                                                            series: { type: Type.STRING, description: "Número de series (ej: '4')" },
                                                            repeticiones: { type: Type.STRING, description: "Rango de repeticiones (ej: '8-12')" },
                                                            descanso: { type: Type.STRING, description: "Tiempo de descanso (ej: '60s')" },
                                                            tecnicaAvanzada: { type: Type.STRING, description: "Opcional. Técnica avanzada a aplicar." }
                                                        }
                                                    }
                                                },
                                                cardio: { type: Type.STRING, description: "Recomendación de cardio (ej: '25 min cinta')." }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            });

            const rawResponseText = response.text;
             if (!rawResponseText || rawResponseText.trim() === '') {
                throw new Error("La respuesta de la IA está vacía. Por favor, verificá la configuración y la API key.");
            }

            const jsonString = extractJson(rawResponseText);
            if (!jsonString) {
                console.error("RESPUESTA COMPLETA DE LA IA (NO SE ENCONTRÓ JSON):", rawResponseText);
                throw new Error("La respuesta de la IA no contenía un formato JSON reconocible. Revisá la consola para ver la respuesta completa.");
            }

            try {
                const generatedPlan: Routine = JSON.parse(jsonString);

                // Augment exercises with youtube links from the library
                generatedPlan.phases.forEach(phase => {
                    phase.routine.dias.forEach(dia => {
                        dia.ejercicios.forEach(ejercicio => {
                            for (const group of Object.keys(exerciseLibrary)) {
                                const foundEx = exerciseLibrary[group].find(libEx => libEx.name === ejercicio.nombre);
                                if (foundEx && foundEx.youtubeLink) {
                                    ejercicio.youtubeLink = foundEx.youtubeLink;
                                    break;
                                }
                            }
                        });
                    });
                });

                if (!generatedPlan.planName || !Array.isArray(generatedPlan.phases)) {
                     console.error("El JSON analizado no tiene la estructura de rutina esperada. JSON analizado:", generatedPlan);
                     console.error("RESPUESTA COMPLETA ORIGINAL DE LA IA:", rawResponseText);
                     throw new Error("La estructura de la rutina generada por la IA es inválida.");
                }

                setClient(prev => prev ? { ...prev, routine: generatedPlan, routineGeneratedDate: new Date().toISOString() } : null);
                setHasChanges(true);
                setSaveStatus('idle'); // Enable saving the new plan
            } catch (parseError) {
                console.error("ERROR AL ANALIZAR EL JSON EXTRAÍDO. JSON INTENTADO:", jsonString);
                console.error("RESPUESTA COMPLETA ORIGINAL DE LA IA:", rawResponseText);
                throw new Error("Hubo un problema al procesar la respuesta de la IA. El formato del plan es incorrecto. Revisa la consola para más detalles.");
            }

        } catch (error) {
            console.error("Error detallado al generar el plan de entrenamiento:", error);
            setError(`Ocurrió un error al generar el plan. Por favor, intentá de nuevo. Detalles: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const generateDiet = async (isRegeneration = false, customInstructions = "") => {
        if (!client || !ai) return;
        
        const requiredFields: (keyof Profile)[] = ['age', 'weight', 'height', 'gender', 'activityFactor', 'goal'];
        const missingFields = requiredFields.filter(field => !client.profile[field]);
        if (missingFields.length > 0) {
            setError(`Por favor, completá los siguientes campos del perfil antes de generar una dieta: ${missingFields.join(', ')}.`);
            return;
        }

        setIsLoading(true);
        setError('');
        setLoadingMessage('Generando el plan de nutrición...');
        
        const prompt = `
            SOS UN NUTRICIONISTA DEPORTIVO EXPERTO.
            ROL: Tenés que crear un plan de alimentación detallado y profesional para un cliente de gimnasio.
            
            DATOS DEL CLIENTE:
            - Edad: ${client.profile.age} años
            - Peso: ${client.profile.weight} kg
            - Altura: ${client.profile.height} cm
            - Género: ${client.profile.gender}
            - Factor de Actividad Física: ${client.profile.activityFactor} (${client.profile.activityFactor === 'Sedentario' ? 'poco o ningún ejercicio' : client.profile.activityFactor === 'Ligero' ? 'ejercicio ligero 1-3 días/sem' : client.profile.activityFactor === 'Activo' ? 'ejercicio moderado 3-5 días/sem' : 'ejercicio intenso 6-7 días/sem'})
            - Objetivo Principal: ${client.profile.goal}
            
            INSTRUCCIONES ESPECÍFICAS ADICIONALES DEL ENTRENADOR:
            ${customInstructions || "Ninguna."}

            TAREA:
            Generá un plan de nutrición completo en formato JSON. Seguí la estructura del schema provisto de forma ESTRICTA.
            
            REGLAS IMPORTANTES:
            1.  **CÁLCULO DE CALORÍAS Y MACROS**: Calculá las calorías de mantenimiento usando una fórmula estándar (como Mifflin-St Jeor) y ajustalas según el objetivo:
                - Pérdida de grasa: Déficit de 300-500 kcal.
                - Hipertrofia: Superávit de 300-500 kcal.
                - Mantenimiento: Calorías de mantenimiento.
                Distribuí los macronutrientes de forma adecuada (ej. Proteínas: 1.6-2.2g por kg de peso corporal).
            2.  **COMIDAS**: Creá 4 o 5 comidas (Desayuno, Almuerzo, Merienda, Cena, y opcionalmente una colación).
            3.  **ALIMENTOS**: Usá alimentos comunes y saludables. Proporcioná cantidades en gramos, unidades o medidas caseras (ej. "1 taza", "2 cucharadas"). Sé específico.
            4.  **RECOMENDACIONES**: Incluí 3-5 recomendaciones generales (ej. "Beber 2-3 litros de agua al día", "Limitar el consumo de alimentos procesados").
            5.  **SALIDA JSON**: El resultado final DEBE ser ÚNICAMENTE el objeto JSON, sin texto adicional antes o después.
        `;

        const schema = {
             type: Type.OBJECT,
             properties: {
                planTitle: { type: Type.STRING, description: "Título del plan, ej: 'Plan de Nutrición para Hipertrofia'" },
                summary: {
                    type: Type.OBJECT,
                    properties: {
                        totalCalories: { type: Type.INTEGER, description: "Calorías totales diarias del plan" },
                        macronutrients: {
                            type: Type.OBJECT,
                            properties: {
                                proteinGrams: { type: Type.INTEGER, description: "Gramos de proteína totales" },
                                carbsGrams: { type: Type.INTEGER, description: "Gramos de carbohidratos totales" },
                                fatGrams: { type: Type.INTEGER, description: "Gramos de grasa totales" }
                            }
                        }
                    }
                },
                meals: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            mealName: { type: Type.STRING, description: "Nombre de la comida (ej: 'Desayuno')" },
                            foodItems: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        food: { type: Type.STRING, description: "Nombre del alimento" },
                                        amount: { type: Type.STRING, description: "Cantidad (ej: '150g', '1 taza', '2 unidades')" }
                                    }
                                }
                            }
                        }
                    }
                },
                recommendations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Lista de recomendaciones generales de nutrición."
                }
             }
        };

        try {
            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: schema
                }
            });

            const rawResponseText = response.text;
            if (!rawResponseText || rawResponseText.trim() === '') {
                throw new Error("La respuesta de la IA está vacía. Por favor, verificá la configuración y la API key.");
            }

            const jsonString = extractJson(rawResponseText);
            if (!jsonString) {
                console.error("RESPUESTA COMPLETA DE LA IA (NO SE ENCONTRÓ JSON):", rawResponseText);
                throw new Error("La respuesta de la IA no contenía un formato JSON reconocible. Revisá la consola para ver la respuesta completa.");
            }

            try {
                const generatedDiet: DietPlan = JSON.parse(jsonString);

                if (!generatedDiet.planTitle || !generatedDiet.summary || !Array.isArray(generatedDiet.meals)) {
                    console.error("El JSON analizado no tiene la estructura de dieta esperada. JSON analizado:", generatedDiet);
                    console.error("RESPUESTA COMPLETA ORIGINAL DE LA IA:", rawResponseText);
                    throw new Error("La estructura del plan de dieta generada por la IA es inválida.");
                }

                setClient(prev => prev ? { ...prev, dietPlan: generatedDiet } : null);
                setHasChanges(true);
                setSaveStatus('idle');
            } catch (parseError) {
                console.error("ERROR AL ANALIZAR EL JSON EXTRAÍDO. JSON INTENTADO:", jsonString);
                console.error("RESPUESTA COMPLETA ORIGINAL DE LA IA:", rawResponseText);
                throw new Error("Hubo un problema al procesar la respuesta de la IA. El formato de la dieta es incorrecto. Revisa la consola para más detalles.");
            }
        } catch (error) {
            console.error("Error detallado al generar el plan de dieta:", error);
            setError(`Ocurrió un error al generar el plan de dieta. Detalles: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    // --- Lógica de Edición de Rutina ---
    const handleRoutineChange = (phaseIndex: number, dayIndex: number, exerciseIndex: number, field: keyof Exercise, value: string) => {
        if (!client || !client.routine) return;
        const newRoutine = JSON.parse(JSON.stringify(client.routine)); // Deep copy to avoid state mutation issues
        const exercise = newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios[exerciseIndex];
        
        exercise[field] = value;

        if (field === 'nombre') {
            let link = '';
            for (const group in exerciseLibrary) {
                const found = exerciseLibrary[group].find(ex => ex.name === value);
                if (found && found.youtubeLink) {
                    link = found.youtubeLink;
                    break;
                }
            }
            exercise.youtubeLink = link;
        }

        setClient({ ...client, routine: newRoutine });
        setHasChanges(true);
    };
    
    const handleAddExercise = (phaseIndex: number, dayIndex: number) => {
        if (!client || !client.routine) return;
        const newRoutine = { ...client.routine };
        const newExercise: Exercise = { nombre: '', series: '3', repeticiones: '10', descanso: '60s' };
        newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.push(newExercise);
        setClient({ ...client, routine: newRoutine });
        setHasChanges(true);
    };
    
    const handleDeleteExercise = (phaseIndex: number, dayIndex: number, exerciseIndex: number) => {
        if (!client || !client.routine) return;
        const newRoutine = { ...client.routine };
        newRoutine.phases[phaseIndex].routine.dias[dayIndex].ejercicios.splice(exerciseIndex, 1);
        setClient({ ...client, routine: newRoutine });
        setHasChanges(true);
    };


    if (isLoading && !client) {
        return <div className="loading-container"><span className="spinner"></span><p>{loadingMessage}</p></div>;
    }

    if (!client) {
        return <div className="error-container">No se pudieron cargar los datos del cliente. <button onClick={onBack}>Volver</button></div>;
    }
    
    const { bmi, category: bmiCategory, categoryClass: bmiCategoryClass } = getBmiDetails(parseFloat(client.profile.weight), parseFloat(client.profile.height));

    const renderPlanContent = () => {
        if (isLoading) {
             return <div className="loading-container"><span className="spinner"></span><p>{loadingMessage}</p></div>;
        }
        if (error) {
            return (
                <div className="error-container">
                    <p>{error}</p>
                    <button className="cta-button" onClick={() => setError('')}>Entendido</button>
                </div>
            );
        }

        if (activeTab === 'routine') {
            return client.routine ? 
                <EditableRoutineView 
                    routine={client.routine} 
                    exerciseLibrary={exerciseLibrary}
                    onRoutineChange={handleRoutineChange}
                    onAddExercise={handleAddExercise}
                    onDeleteExercise={handleDeleteExercise}
                    onRegenerate={() => generatePlan(true, adminInstructions)}
                    customInstructions={adminInstructions}
                    onCustomInstructionsChange={setAdminInstructions}
                /> : 
                <div className="placeholder-action">
                    <p>Este cliente aún no tiene un plan de entrenamiento.</p>
                    <div className="generation-container">
                        <div className="admin-instructions-box">
                            <label htmlFor="admin-instructions-rutina">Instrucciones Adicionales (Opcional)</label>
                            <textarea
                                id="admin-instructions-rutina"
                                value={adminInstructions}
                                onChange={(e) => setAdminInstructions(e.target.value)}
                                rows={3}
                                placeholder="Ej: No incluir sentadillas por una lesión en la rodilla. Priorizar el trabajo de espalda alta."
                            ></textarea>
                        </div>
                        <button className="cta-button" onClick={() => generatePlan(false, adminInstructions)}>
                            Generar Plan de Entrenamiento con IA
                        </button>
                    </div>
                </div>;
        }

        if (activeTab === 'diet') {
            return client.dietPlan ? 
                <DietPlanView 
                    dietPlan={client.dietPlan} 
                    onRegenerate={() => generateDiet(true, adminInstructions)}
                    customInstructions={adminInstructions}
                    onCustomInstructionsChange={setAdminInstructions}
                /> : 
                <div className="placeholder-action">
                    <p>Este cliente aún no tiene un plan de nutrición.</p>
                    <div className="generation-container">
                        <div className="admin-instructions-box">
                            <label htmlFor="admin-instructions-dieta">Instrucciones Adicionales (Opcional)</label>
                            <textarea
                                id="admin-instructions-dieta"
                                value={adminInstructions}
                                onChange={(e) => setAdminInstructions(e.target.value)}
                                rows={3}
                                placeholder="Ej: Es vegano. Tiene alergia a los frutos secos. No le gusta el pescado."
                            ></textarea>
                        </div>
                        <button className="cta-button" onClick={() => generateDiet(false, adminInstructions)}>
                            Generar Plan de Nutrición con IA
                        </button>
                    </div>
                </div>;
        }
        
        if (activeTab === 'progress') {
            return <ProgressView client={client} />;
        }
        
        return null;
    };

    return (
        <div className="animated-fade-in">
            <div className="main-header">
                <button onClick={onBack} className="back-button">← Volver al listado</button>
            </div>
            <div className="dashboard-grid">
                <aside className="profile-section">
                    <h2>Perfil del Cliente</h2>
                    <form className="profile-form">
                         <div className="form-group">
                            <label>Nombre</label>
                            <input type="text" value={client.profile.name} onChange={e => handleProfileChange('name', e.target.value)} />
                        </div>
                         <div className="form-group">
                            <label>Edad</label>
                            <input type="number" value={client.profile.age} onChange={e => handleProfileChange('age', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Peso (kg)</label>
                            <input type="number" value={client.profile.weight} onChange={e => handleProfileChange('weight', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Altura (cm)</label>
                            <input type="number" value={client.profile.height} onChange={e => handleProfileChange('height', e.target.value)} />
                        </div>
                         {bmi && (
                            <div className="bmi-display">
                                <span>IMC: <strong>{bmi.toFixed(1)}</strong></span>
                                <span className={`bmi-category ${bmiCategoryClass}`}>{bmiCategory}</span>
                            </div>
                        )}
                        <div className="form-group">
                            <label>Género</label>
                            <select value={client.profile.gender} onChange={e => handleProfileChange('gender', e.target.value)}>
                                <option>Masculino</option>
                                <option>Femenino</option>
                                <option>Prefiero no decirlo</option>
                            </select>
                        </div>
                         <div className="form-group">
                            <label>Nivel de Experiencia</label>
                            <select value={client.profile.level} onChange={e => handleProfileChange('level', e.target.value)}>
                                <option>Principiante</option>
                                <option>Intermedio</option>
                                <option>Avanzado</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Objetivo Principal</label>
                             <select value={client.profile.goal} onChange={e => handleProfileChange('goal', e.target.value)}>
                                <option>Hipertrofia</option>
                                <option>Pérdida de grasa</option>
                                <option>Mantenimiento</option>
                                <option>Resistencia</option>
                            </select>
                        </div>
                         <div className="form-group">
                            <label>Días de Entrenamiento / Semana</label>
                            <input type="number" min="1" max="7" value={client.profile.trainingDays} onChange={e => handleProfileChange('trainingDays', e.target.value)} />
                        </div>
                         <div className="form-group">
                            <label>Factor de Actividad</label>
                             <select value={client.profile.activityFactor} onChange={e => handleProfileChange('activityFactor', e.target.value)}>
                                <option>Sedentario</option>
                                <option>Ligero</option>
                                <option>Activo</option>
                                <option>Muy Activo</option>
                            </select>
                        </div>
                         <div className="form-group">
                            <label>Intensidad del Entrenamiento</label>
                             <select value={client.profile.trainingIntensity} onChange={e => handleProfileChange('trainingIntensity', e.target.value)}>
                                <option>Baja</option>
                                <option>Moderada</option>
                                <option>Alta</option>
                                <option>Extrema</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Área de Enfoque Corporal</label>
                             <select value={client.profile.bodyFocusArea} onChange={e => handleProfileChange('bodyFocusArea', e.target.value)}>
                                <option>Cuerpo completo</option>
                                <option>Tren Superior</option>
                                <option>Tren Inferior</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Enfoque Específico (opcional)</label>
                            <input type="text" placeholder="Ej: Hombros y glúteos" value={client.profile.bodyFocusSpecific} onChange={e => handleProfileChange('bodyFocusSpecific', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>¿Usar Técnicas Avanzadas?</label>
                            <select value={client.profile.useAdvancedTechniques} onChange={e => handleProfileChange('useAdvancedTechniques', e.target.value)}>
                                <option>No</option>
                                <option>Sí</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>¿Incluir Fase de Adaptación?</label>
                            <select value={client.profile.includeAdaptationPhase} onChange={e => handleProfileChange('includeAdaptationPhase', e.target.value)}>
                                <option>Sí</option>
                                <option>No</option>
                            </select>
                        </div>
                        <div className="access-code-display">
                            <span>Código de Acceso del Cliente</span>
                            <strong>{client.accessCode}</strong>
                        </div>
                    </form>
                </aside>
                <main className="main-content">
                    <div className="actions-bar">
                        <h2>Planes y Progreso</h2>
                        <button 
                            className={`save-changes-button ${saveStatus === 'saved' ? 'saved' : ''}`}
                            onClick={handleSaveChanges} 
                            disabled={!hasChanges || saveStatus === 'saving'}>
                            {saveStatus === 'saving' ? <span className="spinner small"></span> : saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Cambios'}
                        </button>
                    </div>
                     <nav className="main-tabs-nav">
                        <button className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>Entrenamiento</button>
                        <button className={`main-tab-button ${activeTab === 'diet' ? 'active' : ''}`} onClick={() => setActiveTab('diet')}>Nutrición</button>
                        <button className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>Progreso</button>
                    </nav>
                    <div className="results-section">
                        {renderPlanContent()}
                    </div>
                </main>
            </div>
        </div>
    );
};

const AccordionItem = ({ title, children, isOpen, onClick }) => {
    return (
        <div className="accordion-item">
            <button className={`accordion-header ${isOpen ? 'active' : ''}`} onClick={onClick}>
                <span>{title}</span>
                <span className="accordion-header-icon">+</span>
            </button>
            <div className={`accordion-content ${isOpen ? 'open' : ''}`}>
                {children}
            </div>
        </div>
    );
};


const EditableRoutineView = ({ routine, exerciseLibrary, onRoutineChange, onAddExercise, onDeleteExercise, onRegenerate, customInstructions, onCustomInstructionsChange }) => {
    const [activePhaseIndex, setActivePhaseIndex] = useState(0);
    const [activeDayIndex, setActiveDayIndex] = useState(0);

    const handlePhaseClick = (index) => {
        setActivePhaseIndex(index);
        setActiveDayIndex(0); // Reset day when changing phase
    };
    
    const allExercises = useMemo(() => {
        return Object.values(exerciseLibrary).flat().map(ex => ex.name).sort();
    }, [exerciseLibrary]);

    const currentPhase = routine.phases[activePhaseIndex];
    if (!currentPhase) return <p>Fase no encontrada.</p>;
    
    const currentDay = currentPhase.routine.dias[activeDayIndex];

    return (
        <div className="plan-container routine-plan editable">
            <div className="plan-header">
                <h2>{routine.planName}</h2>
                <p>Duración total: {routine.totalDurationWeeks} semanas</p>
            </div>

            <div className="accordion-phases">
                {routine.phases.map((phase, phaseIndex) => (
                     <AccordionItem
                        key={phaseIndex}
                        title={`${phase.phaseName} (${phase.durationWeeks} semanas)`}
                        isOpen={activePhaseIndex === phaseIndex}
                        onClick={() => handlePhaseClick(phaseIndex)}
                    >
                        {activePhaseIndex === phaseIndex && (
                            <>
                                <nav className="day-tabs-nav">
                                    {phase.routine.dias.map((day, dayIndex) => (
                                        <button 
                                            key={dayIndex}
                                            className={`day-tab-button ${activeDayIndex === dayIndex ? 'active' : ''}`}
                                            onClick={() => setActiveDayIndex(dayIndex)}
                                        >
                                            {day.dia}
                                        </button>
                                    ))}
                                </nav>

                                {currentDay && (
                                    <div className="day-card animated-fade-in">
                                        <h3>Grupo Muscular: <span className="muscle-group">{currentDay.grupoMuscular}</span></h3>
                                        <ul className="exercise-list">
                                            {currentDay.ejercicios.map((exercise, exIndex) => (
                                                <li key={exIndex} className="exercise-item editable">
                                                    <div className="exercise-item-editor">
                                                        <div className="editor-row editor-row-main">
                                                            <select
                                                                className="exercise-select"
                                                                value={exercise.nombre}
                                                                onChange={(e) => onRoutineChange(phaseIndex, activeDayIndex, exIndex, 'nombre', e.target.value)}
                                                            >
                                                                <option value="">-- Seleccionar Ejercicio --</option>
                                                                {allExercises.map(name => <option key={name} value={name}>{name}</option>)}
                                                            </select>
                                                             <button className="delete-exercise-btn" title="Eliminar ejercicio" onClick={() => onDeleteExercise(phaseIndex, activeDayIndex, exIndex)}>×</button>
                                                        </div>
                                                        <div className="editor-row">
                                                            <div className="form-group-inline">
                                                                <label>Series</label>
                                                                <input type="text" value={exercise.series} onChange={(e) => onRoutineChange(phaseIndex, activeDayIndex, exIndex, 'series', e.target.value)} />
                                                            </div>
                                                            <div className="form-group-inline">
                                                                <label>Reps</label>
                                                                <input type="text" value={exercise.repeticiones} onChange={(e) => onRoutineChange(phaseIndex, activeDayIndex, exIndex, 'repeticiones', e.target.value)} />
                                                            </div>
                                                            <div className="form-group-inline">
                                                                <label>Descanso</label>
                                                                <input type="text" value={exercise.descanso} onChange={(e) => onRoutineChange(phaseIndex, activeDayIndex, exIndex, 'descanso', e.target.value)} />
                                                            </div>
                                                        </div>
                                                        <div className="editor-row">
                                                             <div className="form-group-inline full-width">
                                                                <label>Técnica Avanzada (Opcional)</label>
                                                                <select value={exercise.tecnicaAvanzada || ''} onChange={(e) => onRoutineChange(phaseIndex, activeDayIndex, exIndex, 'tecnicaAvanzada', e.target.value)}>
                                                                    {advancedTechniqueOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                         <div className="add-exercise-action">
                                            <button className="add-exercise-button" onClick={() => onAddExercise(phaseIndex, activeDayIndex)}>+ Agregar Ejercicio</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </AccordionItem>
                ))}
            </div>
             <div className="regeneration-container">
                 <div className="admin-instructions-box">
                    <label htmlFor="admin-instructions-regenerate-rutina">Instrucciones para Regenerar (Opcional)</label>
                    <textarea
                        id="admin-instructions-regenerate-rutina"
                        value={customInstructions}
                        onChange={(e) => onCustomInstructionsChange(e.target.value)}
                        rows={3}
                        placeholder="Ej: La rutina es muy difícil, bajar la intensidad. Enfocar más en piernas."
                    ></textarea>
                </div>
                <button className="cta-button regenerate" onClick={onRegenerate}>
                    Regenerar Plan de Entrenamiento con IA
                </button>
            </div>
        </div>
    );
};


const DietPlanView = ({ dietPlan, onRegenerate, customInstructions, onCustomInstructionsChange }) => {
    return (
        <div className="diet-plan-container animated-fade-in">
            <div className="plan-header">
                <h2>{dietPlan.planTitle}</h2>
            </div>
            <div className="diet-summary">
                <div>
                    <strong>Calorías</strong>
                    <span>{dietPlan.summary.totalCalories}</span>
                </div>
                <div>
                    <strong>Proteínas</strong>
                    <span>{dietPlan.summary.macronutrients.proteinGrams}g</span>
                </div>
                <div>
                    <strong>Carbohidratos</strong>
                    <span>{dietPlan.summary.macronutrients.carbsGrams}g</span>
                </div>
                <div>
                    <strong>Grasas</strong>
                    <span>{dietPlan.summary.macronutrients.fatGrams}g</span>
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
             <div className="regeneration-container">
                 <div className="admin-instructions-box">
                    <label htmlFor="admin-instructions-regenerate-dieta">Instrucciones para Regenerar (Opcional)</label>
                    <textarea
                        id="admin-instructions-regenerate-dieta"
                        value={customInstructions}
                        onChange={(e) => onCustomInstructionsChange(e.target.value)}
                        rows={3}
                        placeholder="Ej: Menos carbohidratos, más proteínas. Agregar opciones de comida más económicas."
                    ></textarea>
                </div>
                <button className="cta-button regenerate" onClick={onRegenerate}>
                    Regenerar Plan de Nutrición con IA
                </button>
            </div>
        </div>
    );
};

const ProgressView = ({ client }: { client: ClientData }) => {
    const [activeTab, setActiveTab] = useState('weight'); // 'weight' or 'exercise'
    const [selectedExercise, setSelectedExercise] = useState<string>('');
    
    const allExercisesInPlans = useMemo(() => {
        if (!client.routine) return [];
        const exerciseSet = new Set<string>();
        client.routine.phases.forEach(phase => {
            phase.routine.dias.forEach(dia => {
                dia.ejercicios.forEach(ex => exerciseSet.add(ex.nombre));
            });
        });
        return Array.from(exerciseSet).sort();
    }, [client.routine]);
    
     useEffect(() => {
        if (allExercisesInPlans.length > 0) {
            setSelectedExercise(allExercisesInPlans[0]);
        }
    }, [allExercisesInPlans]);
    
    const renderContent = () => {
        if (activeTab === 'weight') {
            const bodyWeightLog = client.bodyWeightLog || [];
             if (bodyWeightLog.length === 0) {
                return <p>El cliente aún no ha registrado ninguna entrada de peso corporal.</p>;
            }
            return (
                <div className="progress-list-container">
                    <h3>Historial de Peso Corporal</h3>
                    <div className="progress-list">
                         <div className="progress-list-header weight">
                            <span>Fecha</span>
                            <span>Peso (kg)</span>
                            <span>IMC</span>
                        </div>
                        {bodyWeightLog.slice().reverse().map(entry => (
                            <div key={entry.date} className="progress-list-row weight">
                                <span>{new Date(entry.date).toLocaleDateString()}</span>
                                <span>{entry.weight.toFixed(1)}</span>
                                <span className={entry.imcCategoryClass}>{entry.imc?.toFixed(1) ?? 'N/A'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        
        if (activeTab === 'exercise') {
            if (allExercisesInPlans.length === 0) {
                return <p>El cliente no tiene un plan de entrenamiento con ejercicios para registrar progreso.</p>
            }
            
            const exerciseLog = client.progressLog?.[selectedExercise] || [];
            
            return (
                <div>
                     <select 
                        className="exercise-select-dropdown"
                        value={selectedExercise} 
                        onChange={e => setSelectedExercise(e.target.value)}>
                        {allExercisesInPlans.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                    </select>
                    {exerciseLog.length > 0 ? (
                        <div className="progress-list-container">
                            <h3>Historial de: {selectedExercise}</h3>
                            <div className="progress-list">
                                <div className="progress-list-header">
                                    <span>Fecha</span>
                                    <span>Peso (kg)</span>
                                    <span>Repeticiones</span>
                                </div>
                                {exerciseLog.slice().reverse().map(log => (
                                    <div key={log.date} className="progress-list-row">
                                        <span>{new Date(log.date).toLocaleDateString()}</span>
                                        <span>{log.weight}</span>
                                        <span>{log.repetitions}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p>No hay registros para este ejercicio todavía.</p>
                    )}
                </div>
            )
        }
    };
    
    return (
        <div className="progress-view-container animated-fade-in">
            <nav className="progress-tabs-nav">
                <button className={`progress-tab-button ${activeTab === 'weight' ? 'active' : ''}`} onClick={() => setActiveTab('weight')}>Peso Corporal</button>
                <button className={`progress-tab-button ${activeTab === 'exercise' ? 'active' : ''}`} onClick={() => setActiveTab('exercise')}>Ejercicios</button>
            </nav>
            {renderContent()}
        </div>
    );
};


// 6. Vista de Biblioteca de Ejercicios
const ExerciseLibraryManager = ({ onBack, gymId }) => {
    const [library, setLibrary] = useState<ExerciseLibrary>({});
    const [isLoading, setIsLoading] = useState(true);
    const [hasChanges, setHasChanges] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // For adding a new exercise
    const [newExerciseName, setNewExerciseName] = useState('');
    const [selectedMuscleGroup, setSelectedMuscleGroup] = useState('');

    // For editing an exercise
    const [editingExercise, setEditingExercise] = useState<{ group: string, index: number } | null>(null);
    const [editingName, setEditingName] = useState('');
    
    // For accordion
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);

    const muscleGroups = useMemo(() => Object.keys(library).sort(), [library]);

    useEffect(() => {
        const fetchLibrary = async () => {
            setIsLoading(true);
            const data = await apiClient.getExerciseLibrary(gymId);
            // Ensure all expected muscle groups exist, even if empty
            const allGroups = new Set([
                "Pecho", "Espalda", "Hombros", "Cuádriceps", "Femorales e Isquiotibiales", 
                "Glúteos", "Gemelos y Sóleos", "Aductores y Abductores", 
                "Abdominales", "Brazos (Bíceps y Tríceps)"
            ]);
            Object.keys(data).forEach(group => allGroups.add(group));
            const fullLibrary: ExerciseLibrary = {};
            Array.from(allGroups).sort().forEach(group => {
                fullLibrary[group] = data[group] || [];
            });

            setLibrary(fullLibrary);
            if (Array.from(allGroups).length > 0) {
                setSelectedMuscleGroup(Array.from(allGroups).sort()[0]);
                setOpenAccordion(Array.from(allGroups).sort()[0]);
            }
            setIsLoading(false);
        };
        fetchLibrary();
    }, [gymId]);

    const handleSaveChanges = async () => {
        setSaveStatus('saving');
        const success = await apiClient.saveExerciseLibrary(library, gymId);
        if (success) {
            setHasChanges(false);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } else {
            alert('Error al guardar la biblioteca de ejercicios.');
            setSaveStatus('idle');
        }
    };
    
    const handleAddExercise = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newExerciseName || !selectedMuscleGroup) return;

        const newExercise: ExerciseDefinition = {
            name: newExerciseName,
            isEnabled: true,
            youtubeLink: ''
        };

        const newLibrary = { ...library };
        // Ensure the group exists
        if (!newLibrary[selectedMuscleGroup]) {
            newLibrary[selectedMuscleGroup] = [];
        }
        newLibrary[selectedMuscleGroup].push(newExercise);
        
        // Sort exercises within the group alphabetically
        newLibrary[selectedMuscleGroup].sort((a: ExerciseDefinition, b: ExerciseDefinition) => a.name.localeCompare(b.name));
        
        setLibrary(newLibrary);
        setNewExerciseName('');
        setHasChanges(true);
    };

    const handleToggleExercise = (group: string, index: number) => {
        const newLibrary = { ...library };
        newLibrary[group][index].isEnabled = !newLibrary[group][index].isEnabled;
        setLibrary(newLibrary);
        setHasChanges(true);
    };
    
    const handleLinkChange = (group: string, index: number, link: string) => {
        const newLibrary = { ...library };
        newLibrary[group][index].youtubeLink = link;
        setLibrary(newLibrary);
        setHasChanges(true);
    };
    
    const handleStartEditing = (group: string, index: number, name: string) => {
        setEditingExercise({ group, index });
        setEditingName(name);
    };

    const handleCancelEditing = () => {
        setEditingExercise(null);
        setEditingName('');
    };

    const handleUpdateExerciseName = () => {
        if (!editingExercise || !editingName) return;
        const { group, index } = editingExercise;
        const newLibrary = { ...library };
        newLibrary[group][index].name = editingName;
        // Re-sort the group
        newLibrary[group].sort((a: ExerciseDefinition, b: ExerciseDefinition) => a.name.localeCompare(b.name));
        setLibrary(newLibrary);
        setHasChanges(true);
        handleCancelEditing();
    };
    
    const handleDeleteExercise = (group: string, index: number) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar el ejercicio "${library[group][index].name}"?`)) {
            const newLibrary = { ...library };
            newLibrary[group].splice(index, 1);
            setLibrary(newLibrary);
            setHasChanges(true);
        }
    };
    
    const toggleAccordion = (groupName: string) => {
        setOpenAccordion(openAccordion === groupName ? null : groupName);
    };


    if (isLoading) {
        return <div className="loading-container"><span className="spinner"></span></div>;
    }
    
    return (
        <div className="library-container animated-fade-in">
             <div className="main-header">
                <div className="header-title-wrapper">
                    <button onClick={onBack} className="back-button">← Volver</button>
                    <h1>Biblioteca de Ejercicios</h1>
                </div>
            </div>
            
            <div className="library-instructions">
                <p>Aquí podés gestionar los ejercicios disponibles para la IA. Activá o desactivá ejercicios para que aparezcan en las rutinas generadas. Podés agregar nuevos ejercicios y editar los existentes.</p>
            </div>
            
            <div className="add-exercise-container">
                 <div className="add-exercise-form-wrapper">
                    <h3>Agregar Nuevo Ejercicio</h3>
                    <form onSubmit={handleAddExercise} className="add-exercise-form">
                        <input
                            type="text"
                            placeholder="Nombre del ejercicio"
                            value={newExerciseName}
                            onChange={(e) => setNewExerciseName(e.target.value)}
                            required
                        />
                        <select
                            value={selectedMuscleGroup}
                            onChange={(e) => setSelectedMuscleGroup(e.target.value)}
                            required
                        >
                            {muscleGroups.map(group => (
                                <option key={group} value={group}>{group}</option>
                            ))}
                        </select>
                        <button type="submit" disabled={!newExerciseName || !selectedMuscleGroup}>Agregar</button>
                    </form>
                </div>
                 <button 
                    className={`save-changes-button ${saveStatus === 'saved' ? 'saved' : ''}`}
                    onClick={handleSaveChanges} 
                    disabled={!hasChanges || saveStatus === 'saving'}>
                    {saveStatus === 'saving' ? <span className="spinner small"></span> : saveStatus === 'saved' ? '¡Guardado!' : 'Guardar Cambios'}
                </button>
            </div>

            <div className="library-accordion">
                {muscleGroups.map(group => (
                    <div className="library-accordion-item" key={group}>
                        <button className={`library-accordion-header ${openAccordion === group ? 'active' : ''}`} onClick={() => toggleAccordion(group)}>
                            {group} ({library[group].filter(ex => ex.isEnabled).length} / {library[group].length} activos)
                            <span className="icon">+</span>
                        </button>
                         <div className={`library-accordion-content ${openAccordion === group ? 'open' : ''}`}>
                             <div className="exercise-entry-list">
                                 <div className="exercise-entry-header">
                                    <span>Activado</span>
                                    <span>Nombre del Ejercicio</span>
                                    <span>Link de YouTube (Opcional)</span>
                                    <span>Acciones</span>
                                </div>
                                {library[group].map((exercise, index) => (
                                    <div key={index} className="exercise-entry-row">
                                        <label className="switch" title={exercise.isEnabled ? "Desactivar" : "Activar"}>
                                            <input type="checkbox" checked={exercise.isEnabled} onChange={() => handleToggleExercise(group, index)} />
                                            <span className="slider round"></span>
                                        </label>
                                        
                                        {editingExercise?.group === group && editingExercise?.index === index ? (
                                             <input
                                                type="text"
                                                className="editing-input"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="exercise-name-lib">{exercise.name}</span>
                                        )}
                                        
                                        <input 
                                            type="text" 
                                            className="link-input"
                                            placeholder="Pegar link de YouTube..."
                                            value={exercise.youtubeLink} 
                                            onChange={(e) => handleLinkChange(group, index, e.target.value)} />
                                            
                                        <div className="exercise-row-actions">
                                            {editingExercise?.group === group && editingExercise?.index === index ? (
                                                <>
                                                    <button className="action-btn save" onClick={handleUpdateExerciseName}>Guardar</button>
                                                    <button className="action-btn cancel" onClick={handleCancelEditing}>Cancelar</button>
                                                </>
                                            ) : (
                                                 <>
                                                    <button className="action-btn edit" onClick={() => handleStartEditing(group, index, exercise.name)}>Editar</button>
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


// 7. Vista del Cliente
const ClientView = ({ dni, onLogout }) => {
    const [client, setClient] = useState<ClientData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<'agreement' | 'dashboard'>('dashboard');
    const [activeTab, setActiveTab] = useState('routine'); // 'routine', 'diet', 'progress'
    const [newWeight, setNewWeight] = useState<string>('');
    const [isSavingWeight, setIsSavingWeight] = useState(false);
    
    // States for chat assistant
    const [isChatOpen, setIsChatOpen] = useState(false);
    
    const fetchClientData = async () => {
        setIsLoading(true);
        const data = await apiClient.getClientData(dni);
        setClient(data);
        if (data && !data.termsAccepted) {
            setView('agreement');
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchClientData();
    }, [dni]);
    
    const handleAcceptTerms = async () => {
        if (!client) return;
        const success = await apiClient.saveClientData(client.dni, { termsAccepted: true });
        if (success) {
            setClient({ ...client, termsAccepted: true });
            setView('dashboard');
        } else {
            alert("Hubo un error al guardar. Por favor, intentá de nuevo.");
        }
    };
    
     const handleLogWeight = async () => {
        if (!client || !newWeight || parseFloat(newWeight) <= 0) return;
        setIsSavingWeight(true);
        const weightValue = parseFloat(newWeight);
        const heightValue = parseFloat(client.profile.height);
        const { bmi, categoryClass } = getBmiDetails(weightValue, heightValue);
        
        const newEntry: BodyWeightEntry = {
            date: new Date().toISOString(),
            weight: weightValue,
            imc: bmi ?? undefined,
            imcCategoryClass: categoryClass
        };
        
        const updatedLog = [...(client.bodyWeightLog || []), newEntry];
        
        const success = await apiClient.saveClientData(client.dni, { bodyWeightLog: updatedLog });
        if (success) {
            setClient(prev => prev ? { ...prev, bodyWeightLog: updatedLog } : null);
            setNewWeight('');
        } else {
            alert("Error al guardar el peso.");
        }
        setIsSavingWeight(false);
    };
    
    const isPlanExpired = () => {
        if (!client?.routineGeneratedDate || !client?.routine?.totalDurationWeeks) {
            return false; // Can't determine expiration
        }
        const generatedDate = new Date(client.routineGeneratedDate);
        const expiryDate = new Date(generatedDate);
        expiryDate.setDate(expiryDate.getDate() + client.routine.totalDurationWeeks * 7);
        return new Date() > expiryDate;
    };


    if (isLoading) {
        return <div className="loading-container"><span className="spinner"></span></div>;
    }

    if (!client) {
        return <div className="error-container">No se pudo cargar tu información.</div>;
    }
    
    if (view === 'agreement') {
        return <AgreementView onAccept={handleAcceptTerms} onLogout={onLogout} />;
    }
    
     if (isPlanExpired()) {
        return (
            <div className="client-view-container">
                 <header>
                    <h1>Hola, {client.profile.name}!</h1>
                </header>
                <div className="expired-view">
                    <h2>Tu plan de entrenamiento ha finalizado</h2>
                    <p>¡Felicitaciones por completar tu rutina! Contactá a tu entrenador para que te asigne un nuevo plan y continúes progresando.</p>
                </div>
                 <button onClick={onLogout} className="logout-button" style={{marginTop: '2rem'}}>Cerrar Sesión</button>
            </div>
        )
    }

    return (
        <div className="client-view-container">
            {isChatOpen && client && <ChatAssistant client={client} onClose={() => setIsChatOpen(false)} />}
            <header>
                <h1>Hola, {client.profile.name}!</h1>
                 {client.profile.weight && client.profile.height && (
                     <div className="bmi-display client-bmi">
                        <span>Peso: <strong>{client.profile.weight} kg</strong></span>
                        {(() => {
                            const { bmi, category, categoryClass } = getBmiDetails(parseFloat(client.profile.weight), parseFloat(client.profile.height));
                            return bmi ? (
                                <>
                                    <span>IMC: <strong>{bmi.toFixed(1)}</strong></span>
                                    <span className={`bmi-category ${categoryClass}`}>{category}</span>
                                </>
                            ) : null;
                        })()}
                    </div>
                )}
                <div className="body-weight-logger">
                    <label>Registrar peso corporal de hoy (kg):</label>
                    <div className="input-group">
                        <input 
                            type="number" 
                            step="0.1" 
                            placeholder="Ej: 75.5"
                            value={newWeight}
                            onChange={e => setNewWeight(e.target.value)}
                         />
                        <button className="log-button" onClick={handleLogWeight} disabled={isSavingWeight}>
                            {isSavingWeight ? <span className="spinner small"></span> : 'Guardar'}
                        </button>
                    </div>
                </div>
            </header>

            <div className="main-content">
                <nav className="main-tabs-nav">
                    <button className={`main-tab-button ${activeTab === 'routine' ? 'active' : ''}`} onClick={() => setActiveTab('routine')}>Entrenamiento</button>
                    <button className={`main-tab-button ${activeTab === 'diet' ? 'active' : ''}`} onClick={() => setActiveTab('diet')}>Nutrición</button>
                    <button className={`main-tab-button ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>Mi Progreso</button>
                </nav>

                {activeTab === 'routine' && (client.routine ? <ClientRoutineView client={client} /> : <p className="placeholder">Aún no tenés un plan de entrenamiento asignado. ¡Pedile a tu entrenador que te genere uno!</p>)}
                {activeTab === 'diet' && (client.dietPlan ? <ClientDietView dietPlan={client.dietPlan} /> : <p className="placeholder">Aún no tenés un plan de nutrición asignado.</p>)}
                {activeTab === 'progress' && <ProgressView client={client} />}
            </div>
             <button onClick={onLogout} className="logout-button" style={{marginTop: '2rem'}}>Cerrar Sesión</button>
            <button className="chat-fab" onClick={() => setIsChatOpen(true)} title="Asistente de IA">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 10H12V8H14V10M14 16H12V12H14V16M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" /></svg>
            </button>
        </div>
    );
};


const ClientRoutineView = ({ client }: { client: ClientData }) => {
    const { routine, progressLog, profile } = client;
    const [activePhaseIndex, setActivePhaseIndex] = useState(0);
    const [activeDayIndex, setActiveDayIndex] = useState(0);
    const [progress, setProgress] = useState<Record<string, { weight: string, repetitions: string }>>({});
    const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
    
     const handleProgressChange = (exerciseName: string, field: 'weight' | 'repetitions', value: string) => {
        setProgress(prev => ({
            ...prev,
            [exerciseName]: {
                ...prev[exerciseName],
                [field]: value,
            }
        }));
    };
    
    const handleSaveProgress = async (exerciseName: string) => {
        const entry = progress[exerciseName];
        if (!entry || !entry.weight || !entry.repetitions) {
            alert("Por favor, ingresá peso y repeticiones.");
            return;
        }

        setSaveStatus(prev => ({ ...prev, [exerciseName]: 'saving' }));

        const newLogEntry: ProgressLogEntry = {
            date: new Date().toISOString(),
            weight: parseFloat(entry.weight),
            repetitions: parseInt(entry.repetitions, 10),
        };

        const updatedLog = { ...(progressLog || {}) };
        if (!updatedLog[exerciseName]) {
            updatedLog[exerciseName] = [];
        }
        updatedLog[exerciseName].push(newLogEntry);

        const success = await apiClient.saveClientData(client.dni, { progressLog: updatedLog });

        if (success) {
            setSaveStatus(prev => ({ ...prev, [exerciseName]: 'saved' }));
            setTimeout(() => setSaveStatus(prev => ({ ...prev, [exerciseName]: 'idle' })), 2000);
            // Optionally clear inputs after save
            // setProgress(prev => ({ ...prev, [exerciseName]: { weight: '', repetitions: '' }}));
        } else {
            alert("Error al guardar el progreso.");
            setSaveStatus(prev => ({ ...prev, [exerciseName]: 'idle' }));
        }
    };
    
    if(!routine) return null;
    
    const currentPhase = routine.phases[activePhaseIndex];
    if (!currentPhase) return <p>Fase no encontrada.</p>;
    const currentDay = currentPhase.routine.dias[activeDayIndex];

    return (
        <div className="plan-container">
            <div className="plan-header">
                <h2>{routine.planName}</h2>
            </div>
            <div className="accordion-phases">
                 {routine.phases.map((phase, phaseIndex) => (
                     <AccordionItem
                        key={phaseIndex}
                        title={`${phase.phaseName} (${phase.durationWeeks} semanas)`}
                        isOpen={activePhaseIndex === phaseIndex}
                        onClick={() => { setActivePhaseIndex(phaseIndex); setActiveDayIndex(0);}}
                     >
                        {activePhaseIndex === phaseIndex && (
                            <>
                                <nav className="day-tabs-nav">
                                    {phase.routine.dias.map((day, dayIndex) => (
                                        <button 
                                            key={dayIndex}
                                            className={`day-tab-button ${activeDayIndex === dayIndex ? 'active' : ''}`}
                                            onClick={() => setActiveDayIndex(dayIndex)}
                                        >
                                            {day.dia}
                                        </button>
                                    ))}
                                </nav>
                                {currentDay && (
                                     <div className="day-card animated-fade-in">
                                         <h3><span className="muscle-group">{currentDay.grupoMuscular}</span></h3>
                                          <ul className="exercise-list">
                                            {currentDay.ejercicios.map((ex, index) => (
                                                <li key={index} className="exercise-item">
                                                    <div className="exercise-name-wrapper">
                                                        <span className="exercise-name">{ex.nombre}</span>
                                                        {ex.youtubeLink && (
                                                            <a href={ex.youtubeLink} target="_blank" rel="noopener noreferrer" className="video-link" title="Ver video del ejercicio">
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10,15L15.19,12L10,9V15M21.56,7.17C21.69,7.64 21.78,8.27 21.84,9.07C21.91,9.87 21.94,10.56 21.94,11.16L22,12C22,14.19 21.84,15.8 21.56,16.83C21.31,17.73 20.73,18.31 19.83,18.56C19.36,18.69 18.73,18.78 17.93,18.84C17.13,18.91 16.44,18.94 15.84,18.94L15,19C12.81,19 11.2,18.84 10.17,18.56C9.27,18.31 8.69,17.73 8.44,16.83C8.31,16.36 8.22,15.73 8.16,14.93C8.09,14.13 8.06,13.44 8.06,12.84L8,12C8,9.81 8.16,8.2 8.44,7.17C8.69,6.27 9.27,5.69 10.17,5.44C10.64,5.31 11.27,5.22 12.07,5.16C12.87,5.09 13.56,5.06 14.16,5.06L15,5C17.19,5 18.8,5.16 19.83,5.44C20.73,5.69 21.31,6.27 21.56,7.17Z" /></svg>
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
                                                    <div className="exercise-tracking">
                                                        <div>
                                                            <label htmlFor={`weight-${index}`}>Peso (kg)</label>
                                                            <input
                                                                id={`weight-${index}`}
                                                                type="number"
                                                                placeholder="0"
                                                                value={progress[ex.nombre]?.weight || ''}
                                                                onChange={e => handleProgressChange(ex.nombre, 'weight', e.target.value)}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label htmlFor={`reps-${index}`}>Reps</label>
                                                            <input
                                                                id={`reps-${index}`}
                                                                type="number"
                                                                placeholder="0"
                                                                value={progress[ex.nombre]?.repetitions || ''}
                                                                onChange={e => handleProgressChange(ex.nombre, 'repetitions', e.target.value)}
                                                            />
                                                        </div>
                                                         <button 
                                                            className={`save-progress-button ${saveStatus[ex.nombre] === 'saved' ? 'saved' : ''}`}
                                                            onClick={() => handleSaveProgress(ex.nombre)}
                                                            disabled={saveStatus[ex.nombre] === 'saving'}
                                                        >
                                                            {saveStatus[ex.nombre] === 'saving' ? '...' : saveStatus[ex.nombre] === 'saved' ? '✓' : '+'}
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                         </ul>
                                         {currentDay.cardio && currentDay.cardio.toLowerCase() !== 'ninguno' && (
                                            <div className="cardio-note">
                                                <p><strong>Cardio:</strong> {currentDay.cardio}</p>
                                            </div>
                                        )}
                                     </div>
                                )}
                            </>
                        )}
                     </AccordionItem>
                ))}
            </div>
        </div>
    );
};

const ClientDietView = ({ dietPlan }: { dietPlan: DietPlan }) => {
    return (
        <div className="diet-plan-container animated-fade-in">
             <div className="plan-header">
                <h2>{dietPlan.planTitle}</h2>
            </div>
            <div className="diet-summary">
                <div><strong>Calorías</strong><span>{dietPlan.summary.totalCalories}</span></div>
                <div><strong>Proteínas</strong><span>{dietPlan.summary.macronutrients.proteinGrams}g</span></div>
                <div><strong>Carbs</strong><span>{dietPlan.summary.macronutrients.carbsGrams}g</span></div>
                <div><strong>Grasas</strong><span>{dietPlan.summary.macronutrients.fatGrams}g</span></div>
            </div>

            <div className="meals-grid">
                {dietPlan.meals.map((meal, index) => (
                    <div key={index} className="meal-card">
                        <h3>{meal.mealName}</h3>
                        <ul>
                            {meal.foodItems.map((item, itemIndex) => (
                                <li key={itemIndex}>{item.food} <span>{item.amount}</span></li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
            
             <div className="recommendations-section">
                <h4>Recomendaciones</h4>
                <ul>
                    {dietPlan.recommendations.map((rec, index) => <li key={index}>{rec}</li>)}
                </ul>
            </div>
        </div>
    );
};


const AgreementView = ({ onAccept, onLogout }) => {
    const [isChecked, setIsChecked] = useState(false);
    
    const termsText = `
        Bienvenido a ScorpionGYM AI.

        Al usar esta aplicación, aceptás los siguientes términos:

        1.  **Propósito de la App**: Esta aplicación utiliza inteligencia artificial para generar sugerencias de planes de entrenamiento y nutrición basados en la información que proporcionás. Estos planes son una guía y no reemplazan el consejo de un profesional médico o un entrenador personal certificado.

        2.  **Consulta Profesional**: Antes de comenzar cualquier programa de entrenamiento o dieta, es fundamental que consultes con un médico para asegurarte de que sos apto para realizar actividad física y seguir el plan nutricional. Si sentís dolor, mareos o cualquier malestar, detené el ejercicio inmediatamente y buscá ayuda profesional.

        3.  **Responsabilidad**: El uso de los planes generados por esta aplicación es bajo tu propio riesgo. Ni el gimnasio ni los desarrolladores de la aplicación se hacen responsables por lesiones, problemas de salud o cualquier otro inconveniente que pueda surgir del uso de la información proporcionada.

        4.  **Personalización**: Los planes son generados por una IA y, aunque están basados en tus datos, pueden no ser perfectos. Es importante que uses tu propio juicio y escuches a tu cuerpo. Tu entrenador puede y debe ajustar el plan según tu progreso y feedback.

        5.  **Confidencialidad de Datos**: Tus datos personales y de perfil se utilizan únicamente para generar tus planes y no serán compartidos con terceros sin tu consentimiento.
    `;
    
    return (
         <div className="agreement-container animated-fade-in">
             <h2>Términos y Condiciones de Uso</h2>
             <p>Por favor, leé y aceptá los siguientes términos antes de continuar.</p>
             <div className="terms-box">
                <p>{termsText}</p>
             </div>
             <div className="agreement-actions">
                <label className="agreement-checkbox">
                    <input type="checkbox" checked={isChecked} onChange={() => setIsChecked(!isChecked)} />
                    He leído y acepto los términos y condiciones.
                </label>
                <div className="agreement-buttons">
                    <button className="cta-button secondary" onClick={onLogout}>Salir</button>
                    <button className="cta-button" disabled={!isChecked} onClick={onAccept}>Aceptar y Continuar</button>
                </div>
             </div>
        </div>
    );
};

// --- Chat Assistant Component ---
type Message = {
  role: 'user' | 'model';
  parts: { text: string, imageData?: string }[];
};

const ChatAssistant = ({ client, onClose }: { client: ClientData; onClose: () => void; }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [image, setImage] = useState<File | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [questionCount, setQuestionCount] = useState(0);
    const [dailyLimit, setDailyLimit] = useState(10);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialization Effect
    useEffect(() => {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const systemInstruction = `
            SOS un asistente de IA para un cliente de gimnasio llamado ${client.profile.name}.
            Tu nombre es "Scorpion AI".
            Tu propósito es responder preguntas sobre fitness, nutrición y el plan de entrenamiento del cliente.
            Sé amigable, motivador y claro. NO des consejos médicos. Si te preguntan algo médico, decí "Como IA, no puedo dar consejos médicos. Por favor, consultá a un profesional."
            
            Aquí está el plan de entrenamiento actual del cliente para tu referencia:
            ${JSON.stringify(client.routine, null, 2)}

            Aquí está su plan de nutrición para tu referencia:
            ${JSON.stringify(client.dietPlan, null, 2)}
        `;

        const chatSession = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: { systemInstruction },
        });

        setChat(chatSession);
        
        // Load AI usage data
        const usage = client.aiUsage;
        const today = new Date().toISOString().split('T')[0];
        if (usage && usage.date === today) {
            setQuestionCount(usage.count);
        }
        setDailyLimit(client.dailyQuestionLimit || 10);

        // Initial greeting
        setMessages([{
            role: 'model',
            parts: [{ text: `¡Hola, ${client.profile.name}! Soy Scorpion AI, tu asistente personal. ¿En qué puedo ayudarte hoy con tu entrenamiento o nutrición?` }]
        }]);
    }, [client]);

    // Scroll to bottom effect
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);
    
    // Image to Base64 effect
    useEffect(() => {
        if (image) {
            toBase64(image).then(setImageBase64);
        } else {
            setImageBase64(null);
        }
    }, [image]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() && !image || isLoading || !chat) return;

        if (questionCount >= dailyLimit) {
            alert("Has alcanzado el límite de preguntas diarias a la IA. Por favor, contactá a tu entrenador.");
            return;
        }

        const userMessage: Message = { role: 'user', parts: [] };
        if (input.trim()) {
            userMessage.parts.push({ text: input });
        }
        if (imageBase64) {
            userMessage.parts.push({ text: 'Aquí hay una imagen.', imageData: `data:image/jpeg;base64,${imageBase64}` });
        }

        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        const currentImageBase64 = imageBase64;
        setInput('');
        setImage(null);
        setIsLoading(true);
        
        try {
            const contentParts: any[] = [];
            if(currentInput.trim()){
                 contentParts.push({ text: currentInput });
            }
            if (currentImageBase64 && image) {
                contentParts.push({ inlineData: { data: currentImageBase64, mimeType: image.type } });
            }

            const response = await chat.sendMessageStream({ 
                message: contentParts
            });
            
            let accumulatedResponse = "";
            for await (const chunk of response) {
                accumulatedResponse += chunk.text;
                setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage.role === 'model') {
                        const updatedMessages = [...prev.slice(0, -1)];
                        lastMessage.parts[0].text = accumulatedResponse;
                        return [...updatedMessages, lastMessage];
                    } else {
                        return [...prev, { role: 'model', parts: [{ text: accumulatedResponse }] }];
                    }
                });
            }

            // Update usage count after a successful response
            const newCount = questionCount + 1;
            setQuestionCount(newCount);
            const today = new Date().toISOString().split('T')[0];
            await apiClient.saveClientData(client.dni, { aiUsage: { date: today, count: newCount } });

        } catch (error) {
            console.error("Error sending message to AI:", error);
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: "Lo siento, ocurrió un error al procesar tu pregunta. Por favor, intentá de nuevo." }] }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setImage(e.target.files[0]);
        }
    };
    

    return (
         <div className="chat-modal-overlay">
            <div className="chat-modal-content">
                <div className="chat-modal-header">
                    <h3>Asistente IA</h3>
                     <p>{questionCount} / {dailyLimit} preguntas</p>
                    <button className="close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="chat-messages">
                    {messages.map((msg, index) => (
                        <div key={index} className={`chat-message ${msg.role}`}>
                            <div className="avatar">{msg.role === 'model' ? 'AI' : client.profile.name.substring(0, 2)}</div>
                            <div className="message-content">
                                {msg.parts.map((part, pIndex) => (
                                    <React.Fragment key={pIndex}>
                                        {part.imageData && <img src={part.imageData} alt="User upload" />}
                                        {part.text && <p>{part.text}</p>}
                                    </React.Fragment>
                                ))}
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
                    {imageBase64 && (
                        <div className="chat-image-preview">
                            <img src={`data:image/jpeg;base64,${imageBase64}`} alt="Preview" />
                             <button className="remove-image-btn" onClick={() => setImage(null)}>&times;</button>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage}>
                         <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />
                         <button type="button" className="chat-action-btn" onClick={() => fileInputRef.current?.click()} title="Adjuntar imagen">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20,4H4A2,2 0 0,0 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6A2,2 0 0,0 20,4M20,18H4V6H20V18M13.2,11L11.2,13.5L9.7,11.5L6,16H18L13.2,11Z" /></svg>
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Escribí tu pregunta..."
                            disabled={isLoading}
                        />
                        <button type="submit" disabled={isLoading || (!input.trim() && !image)}>
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" /></svg>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}



// --- Componente Principal ---
const App = () => {
    const [userType, setUserType] = useState<'logged_out' | 'super_admin' | 'gym_admin' | 'client'>('logged_out');
    const [currentGym, setCurrentGym] = useState<Gym | null>(null);
    const [currentClientDni, setCurrentClientDni] = useState<string | null>(null);
    const [view, setView] = useState<'dashboard' | 'client_management' | 'library'>('dashboard');

    const handleLogin = (type: 'super_admin' | 'gym_admin', gymData: Gym | null) => {
        setUserType(type);
        if (type === 'gym_admin' && gymData) {
            setCurrentGym(gymData);
        }
    };
    
    const handleClientLogin = (dni: string) => {
        setUserType('client');
        setCurrentClientDni(dni);
    };

    const handleLogout = () => {
        setUserType('logged_out');
        setCurrentGym(null);
        setCurrentClientDni(null);
        setView('dashboard');
    };
    
    const handleManageClient = (dni: string) => {
        setCurrentClientDni(dni);
        setView('client_management');
    };
    
    const handleBackToDashboard = () => {
        setCurrentClientDni(null);
        setView('dashboard');
    };
    
    const handleShowLibrary = () => {
        setView('library');
    };


    if (userType === 'logged_out') {
        return <LoginView onLogin={handleLogin} onClientLogin={handleClientLogin} />;
    }
    
    if (userType === 'super_admin') {
        return <SuperAdminDashboard onLogout={handleLogout} />;
    }
    
    if (userType === 'gym_admin' && currentGym) {
        if (view === 'client_management' && currentClientDni) {
            return <ClientManagement clientDni={currentClientDni} onBack={handleBackToDashboard} gymId={currentGym._id} />;
        }
        if (view === 'library') {
            return <ExerciseLibraryManager onBack={handleBackToDashboard} gymId={currentGym._id} />;
        }
        return <AdminDashboard gym={currentGym} onLogout={handleLogout} onManageClient={handleManageClient} onShowLibrary={handleShowLibrary} />;
    }
    
    if (userType === 'client' && currentClientDni) {
        return <ClientView dni={currentClientDni} onLogout={handleLogout} />;
    }

    return <div>Error: Estado de la aplicación inválido.</div>;
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);