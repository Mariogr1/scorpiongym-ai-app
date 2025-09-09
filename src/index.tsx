
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
 *