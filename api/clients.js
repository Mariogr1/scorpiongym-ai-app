

import clientPromise from './util/mongodb.js';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("clients");

  switch (req.method) {
    case 'GET':
      try {
        const { gymId } = req.query;
        if (!gymId) {
            return res.status(400).json({ error: 'Gym ID is required' });
        }
        
        const clients = await collection.find({ gymId }).toArray();
        const clientList = clients.map(c => ({
            dni: c.dni,
            profile: c.profile || {},
            planName: c.routine?.planName || 'Sin plan',
            status: c.status || 'active',
            accessCode: c.accessCode,
            planStatus: c.planStatus || 'pending',
        }));
        res.status(200).json(clientList);
      } catch (e) {
        console.error("API /api/clients [GET] Error:", e);
        res.status(500).json({ error: 'Unable to fetch clients' });
      }
      break;

    case 'POST':
      try {
        const { dni, gymId } = req.body;
        if (!dni || !gymId) {
          return res.status(400).json({ message: 'DNI and Gym ID are required' });
        }
        // DNI should be globally unique to simplify client login
        const existingClient = await collection.findOne({ dni });
        if (existingClient) {
          return res.status(409).json({ message: 'Client with this DNI already exists in the system' });
        }
        
        const newAccessCode = Math.floor(100000 + Math.random() * 900000).toString();
        const newClient = {
            dni,
            gymId,
            accessCode: newAccessCode,
            status: 'active',
            planStatus: 'pending',
            profile: { name: "", age: "", weight: "", height: "", gender: "Prefiero no decirlo", level: "Principiante", goal: "Hipertrofia", trainingDays: "4", activityFactor: "Sedentario", useAdvancedTechniques: "No", bodyFocusArea: "Cuerpo completo", muscleFocus: "General", includeAdaptationPhase: "Sí", includeDeloadPhase: "No", trainingIntensity: "Moderada" },
            routine: null,
            dietPlans: [null, null],
            progressLog: {},
            bodyWeightLog: [],
            termsAccepted: false,
        };
        
        await collection.insertOne(newClient);
        res.status(201).json({ success: true, client: newClient });
      } catch (e) {
        console.error("API /api/clients [POST] Error:", e);
        res.status(500).json({ error: 'Unable to create client' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}