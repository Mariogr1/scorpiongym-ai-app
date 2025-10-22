

import { ObjectId } from 'mongodb';
import clientPromise from './util/mongodb.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("clients");

  const { gymId, dni } = req.query;

  switch (req.method) {
    case 'GET':
      try {
        // --- Get Single Client ---
        if (dni) {
          const clientData = await collection.findOne({ dni: dni });
          if (!clientData) {
            return res.status(404).json({ message: 'Client not found' });
          }

          // Backward compatibility for diet plans
          if (clientData && clientData.dietPlan && !clientData.dietPlans) {
              clientData.dietPlans = [clientData.dietPlan, null];
              delete clientData.dietPlan;
          } else if (clientData && !clientData.dietPlans) {
              clientData.dietPlans = [null, null];
          }

          // Fetch gym's details to attach to client data
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
          return res.status(200).json(clientData);

        // --- Get List of Clients ---
        } else if (gymId) {
          const clients = await collection.find({ gymId }).toArray();
          const clientList = clients.map(c => ({
              dni: c.dni,
              profile: c.profile || {},
              planName: c.routine?.planName || 'Sin plan',
              status: c.status || 'active',
              accessCode: c.accessCode,
              planStatus: c.planStatus || 'pending',
          }));
          return res.status(200).json(clientList);
        } else {
          return res.status(400).json({ error: 'Either DNI or Gym ID is required for GET' });
        }
      } catch (e) {
        console.error("API /api/clients [GET] Error:", e);
        res.status(500).json({ error: 'Unable to fetch client(s)' });
      }
      break;

    // --- Create New Client ---
    case 'POST':
      try {
        const { dni: postDni, gymId: postGymId } = req.body;
        if (!postDni || !postGymId) {
          return res.status(400).json({ message: 'DNI and Gym ID are required' });
        }
        const existingClient = await collection.findOne({ dni: postDni });
        if (existingClient) {
          return res.status(409).json({ message: 'Client with this DNI already exists in the system' });
        }
        
        const newAccessCode = Math.floor(100000 + Math.random() * 900000).toString();
        const newClient = {
            dni: postDni,
            gymId: postGymId,
            accessCode: newAccessCode,
            status: 'active',
            planStatus: 'pending',
            profile: { name: "", age: "", weight: "", height: "", gender: "Prefiero no decirlo", level: "Principiante", goal: "Hipertrofia", trainingDays: "4", activityFactor: "Sedentario", useAdvancedTechniques: "No", bodyFocusArea: "Cuerpo Completo", muscleFocus: "General", includeAdaptationPhase: "Sí", includeDeloadPhase: "No", trainingIntensity: "Moderada" },
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

    // --- Update Client ---
    case 'PUT':
      try {
        if (!dni) {
          return res.status(400).json({ message: 'DNI query parameter is required for update' });
        }
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
        console.error(`API /api/clients [PUT] Error for DNI ${dni}:`, e);
        res.status(500).json({ error: 'Unable to update client data' });
      }
      break;

    // --- Delete Client ---
    case 'DELETE':
      try {
        if (!dni) {
          return res.status(400).json({ message: 'DNI query parameter is required for delete' });
        }
        const result = await collection.deleteOne({ dni: dni });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Client not found' });
        }

        res.status(200).json({ success: true });
      } catch (e) {
        console.error(`API /api/clients [DELETE] Error for DNI ${dni}:`, e);
        res.status(500).json({ error: 'Unable to delete client' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}