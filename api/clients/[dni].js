

import { ObjectId } from 'mongodb';
import clientPromise from '../util/mongodb.js';
import bcrypt from 'bcryptjs';

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
                    clientData.planType = gym.planType;
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
        const clientExists = await collection.findOne({ dni: dni });
        if (!clientExists) {
            return res.status(404).json({ message: 'Client not found' });
        }

        // Handle specific actions first
        if (dataToUpdate.action) {
            switch (dataToUpdate.action) {
                case 'reset_plan':
                    await collection.updateOne({ dni: dni }, { $set: { planStatus: 'pending', routine: null, dietPlans: [null, null], routineGeneratedDate: null } });
                    return res.status(200).json({ success: true, message: 'Client plan reset successfully.' });
                
                case 'request_password_reset':
                    await collection.updateOne({ dni: dni }, { $set: { passwordResetRequired: true } });
                    return res.status(200).json({ success: true, message: 'Password reset initiated.' });

                case 'set_new_password':
                    if (!dataToUpdate.password || dataToUpdate.password.length < 4) {
                        return res.status(400).json({ message: 'Password is required and must be at least 4 characters.' });
                    }
                    const salt = await bcrypt.genSalt(10);
                    const hashedPassword = await bcrypt.hash(dataToUpdate.password, salt);
                    await collection.updateOne(
                        { dni: dni },
                        { $set: { password: hashedPassword, passwordResetRequired: false, accessCode: null } }
                    );
                    return res.status(200).json({ success: true, message: 'Password updated successfully.' });
                
                // FIX: Add handler for AI usage accounting
                case 'increment_ai_usage':
                    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                    const currentUsage = clientExists.aiUsage;
                    let newCount = 1;

                    if (currentUsage && currentUsage.date === today) {
                        newCount = currentUsage.count + 1;
                    }
                    
                    await collection.updateOne({ dni: dni }, { $set: { aiUsage: { date: today, count: newCount } } });
                    return res.status(200).json({ success: true, message: 'AI usage updated.' });
            }
        }

        // Generic data update for other properties
        delete dataToUpdate._id;
        delete dataToUpdate.dailyQuestionLimit; // Prevent client-side from overwriting
        delete dataToUpdate.action; // Ensure action is not saved
        
        await collection.updateOne(
          { dni: dni },
          { $set: dataToUpdate },
          { upsert: false }
        );

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