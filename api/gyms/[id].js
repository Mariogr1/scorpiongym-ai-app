


import { ObjectId } from 'mongodb';
import clientPromise from '../util/mongodb.js';

export default async function handler(req, res) {
  const { id } = req.query;
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const gymsCollection = db.collection("gyms");
  const clientsCollection = db.collection("clients");

  if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Gym ID format' });
  }
  const objectId = new ObjectId(id);

  switch (req.method) {
    case 'PUT':
      try {
        const { name, logoSvg, password } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        // Allows setting the logo to null/undefined or a new string
        if (logoSvg !== undefined) updateData.logoSvg = logoSvg;
        
        // In a real production app, password should be hashed.
        // Following project's current convention of storing plaintext.
        if (password) {
            updateData.password = password;
        }

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ message: 'No update data provided.' });
        }

        const result = await gymsCollection.updateOne(
          { _id: objectId },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Gym not found' });
        }

        res.status(200).json({ success: true });

      } catch (e) {
        console.error(`API /api/gyms/${id} [PUT] Error:`, e);
        res.status(500).json({ error: 'Unable to update gym' });
      }
      break;

    case 'DELETE':
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          // Delete the gym
          const gymDeleteResult = await gymsCollection.deleteOne({ _id: objectId }, { session });
          if (gymDeleteResult.deletedCount === 0) {
            throw new Error('GymNotFound');
          }
          
          // Delete all clients and library associated with this gym
          await clientsCollection.deleteMany({ gymId: id }, { session });
          await db.collection("exerciselibrary").deleteOne({ gymId: id }, { session });

        });
        
        res.status(200).json({ success: true });

      } catch (e) {
        if (e.message === 'GymNotFound') {
            res.status(404).json({ message: 'Gym not found' });
        } else {
            console.error(`API /api/gyms/${id} [DELETE] Error:`, e);
            res.status(500).json({ error: 'Unable to delete gym and its data' });
        }
      } finally {
        session.endSession();
      }
      break;

    default:
      res.setHeader('Allow', ['PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}