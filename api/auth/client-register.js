

import clientPromise from '../util/mongodb.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("clients");

  try {
    const { dni, name, password, gymId } = req.body;
    if (!dni || !name || !password || !gymId) {
      return res.status(400).json({ message: 'DNI, name, password, and Gym ID are required' });
    }

    // Check if client already exists
    const existingClient = await collection.findOne({ dni });
    if (existingClient) {
      return res.status(409).json({ message: 'A client with this DNI already exists.' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newClient = {
        dni,
        gymId,
        password: hashedPassword,
        accessCode: null, // Self-registered users don't have an access code
        status: 'active',
        planStatus: 'pending',
        profile: { 
            name: name, 
            age: "", 
            weight: "", 
            height: "", 
            gender: "Prefiero no decirlo", 
            level: "Principiante", 
            goal: "Hipertrofia", 
            trainingDays: "4", 
            activityFactor: "Sedentario", 
            useAdvancedTechniques: "No", 
            bodyFocusArea: "Cuerpo Completo", 
            muscleFocus: "General", 
            includeAdaptationPhase: "Sí", 
            includeDeloadPhase: "No", 
            trainingIntensity: "Moderada" 
        },
        routine: null,
        dietPlans: [null, null],
        progressLog: {},
        bodyWeightLog: [],
        termsAccepted: false,
    };
    
    await collection.insertOne(newClient);
    res.status(201).json({ success: true });
  } catch (e) {
    console.error("API /api/auth/client-register [POST] Error:", e);
    res.status(500).json({ error: 'Unable to create client' });
  }
}