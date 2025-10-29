

import { ObjectId } from 'mongodb';
import clientPromise from './util/mongodb.js';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("routineTemplates");

  const { gymId } = req.query;

  switch (req.method) {
    case 'GET':
      try {
        if (!gymId) {
          return res.status(400).json({ error: 'Gym ID is required' });
        }
        
        const templates = await collection.find({ gymId }).toArray();
        res.status(200).json(templates);
      } catch (e) {
        console.error("API /api/routine-templates [GET] Error:", e);
        res.status(500).json({ error: 'Unable to fetch routine templates' });
      }
      break;

    case 'POST':
      try {
        const { gymId, templateName, description, routine } = req.body;
        if (!gymId || !templateName || !routine) {
          return res.status(400).json({ message: 'Missing required fields for template' });
        }

        const newTemplate = {
          gymId,
          templateName,
          description: description || '',
          routine,
          createdAt: new Date(),
        };
        
        const result = await collection.insertOne(newTemplate);
        const createdTemplate = { ...newTemplate, _id: result.insertedId };
        res.status(201).json(createdTemplate);
      } catch (e) {
        console.error("API /api/routine-templates [POST] Error:", e);
        res.status(500).json({ error: 'Unable to create routine template' });
      }
      break;
    
    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}