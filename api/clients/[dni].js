import { ObjectId } from 'mongodb';
import clientPromise from '../util/mongodb.js';

export default async function handler(req, res) {
  const { dni } = req.query;
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("clients");

  switch (req.method) {
    case 'GET':
      try {
        const clientData = await collection.findOne({ dni: dni });
        if (!clientData) {
          return res.status(404).json({ message: 'Client not found' });
        }

        // --- Backward compatibility for diet plans ---
        if (clientData && clientData.dietPlan && !clientData.dietPlans) {
            clientData.dietPlans = [clientData.dietPlan, null];
            delete clientData.dietPlan; // Clean up old field
        } else if (clientData && !clientData.dietPlans) {
            // Ensure new clients or clients without any plan have the correct structure
            clientData.dietPlans = [null, null];
        }


        // Fetch gym's dailyQuestionLimit and attach it to the client data
        if (clientData.gymId) {
            try {
                const gymsCollection = db.collection("gyms");
                const gymObjectId = new ObjectId(clientData.gymId);
                const gym = await gymsCollection.findOne({ _id: gymObjectId });
                if (gym) {
                    clientData.dailyQuestionLimit = gym.dailyQuestionLimit;
                }
            } catch (e) {
                 console.error(`Could not fetch gym details for client ${dni}:`, e);
            }
        }

        res.status(200).json(clientData);
      } catch (e) {
        console.error(`API /api/clients/${dni} [GET] Error:`, e);
        res.status(500).json({ error: 'Unable to fetch client data' });
      }
      break;

    case 'PUT':
      try {
        const dataToUpdate = req.body;

        // Special action to reset plan generation for a client
        if (dataToUpdate.action === 'reset_plan') {
            const result = await collection.updateOne(
              { dni: dni },
              { $set: { planStatus: 'pending', routine: null, dietPlans: [null, null], routineGeneratedDate: null } }
            );
            if (result.matchedCount === 0) {
              return res.status(404).json({ message: 'Client not found' });
            }
            return res.status(200).json({ success: true, message: 'Client plan reset successfully.' });
        }


        delete dataToUpdate._id;
        // Prevent client-side from overwriting the limit
        delete dataToUpdate.dailyQuestionLimit;
        
        const result = await collection.updateOne(
          { dni: dni },
          { $set: dataToUpdate },
          { upsert: false }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Client not found' });
        }

        res.status(200).json({ success: true });
      } catch (e) {
        console.error(`API /api/clients/${dni} [PUT] Error:`, e);
        res.status(500).json({ error: 'Unable to update client data' });
      }
      break;

    case 'DELETE':
      try {
        const result = await collection.deleteOne({ dni: dni });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Client not found' });
        }

        res.status(200).json({ success: true });
      } catch (e) {
        console.error(`API /api/clients/${dni} [DELETE] Error:`, e);
        res.status(500).json({ error: 'Unable to delete client' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}