
import { ObjectId } from 'mongodb';
import clientPromise from './util/mongodb.js';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("requests");

  const { id, gymId, clientId } = req.query;

  if (id) {
    // Logic from former [id].js
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid Request ID format' });
    }
    const objectId = new ObjectId(id);
  
    switch (req.method) {
      case 'PUT':
        try {
          const { status } = req.body;
          if (!status || !['read', 'resolved'].includes(status)) {
              return res.status(400).json({ message: 'Invalid status provided' });
          }
  
          const result = await collection.updateOne(
            { _id: objectId },
            { $set: { status } }
          );
  
          if (result.matchedCount === 0) {
            return res.status(404).json({ message: 'Request not found' });
          }
          res.status(200).json({ success: true });
  
        } catch (e) {
          console.error(`API /api/requests/${id} [PUT] Error:`, e);
          res.status(500).json({ error: 'Unable to update request' });
        }
        break;
  
      case 'DELETE':
        try {
          const result = await collection.deleteOne({ _id: objectId });
          if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'Request not found' });
          }
          res.status(200).json({ success: true });
        } catch (e) {
          console.error(`API /api/requests/${id} [DELETE] Error:`, e);
          res.status(500).json({ error: 'Unable to delete request' });
        }
        break;
  
      default:
        res.setHeader('Allow', ['PUT', 'DELETE']);
        res.status(405).end(`Method ${req.method} Not Allowed for request ID`);
    }
  } else {
    // Logic from original requests.js
    switch (req.method) {
        case 'GET':
          try {
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
                clientName: clientName || 'Cliente sin nombre',
                gymId,
                subject,
                message,
                status: 'new',
                createdAt: new Date(),
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
}
