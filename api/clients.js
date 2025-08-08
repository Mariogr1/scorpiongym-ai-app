import clientPromise from './util/mongodb.js';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("clients");

  switch (req.method) {
    case 'GET':
      try {
        const clients = await collection.find({}).toArray();
        const clientList = clients.map(c => ({
            dni: c.dni,
            profile: c.profile || {},
            planName: c.routine?.planName || 'Sin plan',
            status: c.status || 'active',
        }));
        res.status(200).json(clientList);
      } catch (e) {
        res.status(500).json({ error: 'Unable to fetch clients' });
      }
      break;

    case 'POST':
      try {
        const { dni } = req.body;
        if (!dni) {
          return res.status(400).json({ message: 'DNI is required' });
        }
        const existingClient = await collection.findOne({ dni });
        if (existingClient) {
          return res.status(409).json({ message: 'Client with this DNI already exists' });
        }
        
        const newAccessCode = Math.floor(100000 + Math.random() * 900000).toString();
        const newClient = {
            dni,
            accessCode: newAccessCode,
            status: 'active',
            profile: { name: "", age: "", weight: "", height: "", gender: "Prefiero no decirlo", level: "Principiante", goal: "Hipertrofia", trainingDays: "4", activityFactor: "Sedentario", useAdvancedTechniques: "No", bodyFocusArea: "Cuerpo completo", bodyFocusSpecific: "", includeAdaptationPhase: "Sí", trainingIntensity: "Moderada" },
            routine: null,
            dietPlan: null,
            progressLog: {},
            bodyWeightLog: [],
            termsAccepted: false,
        };
        
        await collection.insertOne(newClient);
        res.status(201).json({ success: true, client: newClient });
      } catch (e) {
        res.status(500).json({ error: 'Unable to create client' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
