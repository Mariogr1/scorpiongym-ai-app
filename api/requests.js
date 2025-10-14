

import clientPromise from './util/mongodb.js';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("requests");

  switch (req.method) {
    case 'GET':
      try {
        const { gymId, clientId } = req.query;
        
        const query = {};
        if (gymId) {
            query.gymId = gymId;
        }
        if (clientId) {
            query.clientId = clientId;
        }
        
        if (Object.keys(query).length === 0) {
            return res.status(400).json({ error: 'Gym ID or Client ID is required' });
        }
        
        const requests = await collection.find(query).toArray();
        res.status(200).json(requests);
      } catch (e) {
        console.error("API /api/requests [GET] Error:", e);
        res.status(500).json({ error: 'Unable to fetch requests' });
      }
      break;

    case 'POST':
      try {
        const { clientId, clientName, gymId, subject, message } = req.body;
        
        if (!clientId || !gymId || !subject || !message) {
            return res.status(400).json({ message: 'Missing required fields for request' });
        }

        const newRequest = {
            clientId,
            clientName: clientName || 'Cliente sin nombre', // Provide a default
            gymId,
            subject,
            message,
            status: 'new',
            createdAt: new Date(), // Use Date object, MongoDB driver handles it better
        };

        await collection.insertOne(newRequest);
        res.status(201).json({ success: true });

      } catch (e) {
        console.error("API /api/requests [POST] Error:", e);
        res.status(500).json({ error: 'Unable to create request' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}