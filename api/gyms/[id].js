




import { ObjectId } from 'mongodb';
import clientPromise from '../util/mongodb.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const { id } = req.query;
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const gymsCollection = db.collection("gyms");
  const clientsCollection = db.collection("clients");

  if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid User ID format' });
  }
  const objectId = new ObjectId(id);

  switch (req.method) {
    case 'PUT':
      try {
        const { name, password, dailyQuestionLimit, logoSvg, planType } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

        // Only update these fields if they are provided (for trainers)
        if (dailyQuestionLimit !== undefined) {
            updateData.dailyQuestionLimit = Number(dailyQuestionLimit);
        }
        if (logoSvg !== undefined) {
            updateData.logoSvg = logoSvg;
        }
        if (planType) {
            updateData.planType = planType;
        }

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ message: 'No update data provided.' });
        }

        const result = await gymsCollection.updateOne(
          { _id: objectId },
          { $set: updateData }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ success: true });

      } catch (e) {
        console.error(`API /api/gyms/${id} [PUT] Error:`, e);
        res.status(500).json({ error: 'Unable to update user' });
      }
      break;

    case 'DELETE':
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          // Find the user to check its role
          const userToDelete = await gymsCollection.findOne({ _id: objectId }, { session });
          if (!userToDelete) {
             throw new Error('UserNotFound');
          }

          // Delete the user
          const userDeleteResult = await gymsCollection.deleteOne({ _id: objectId }, { session });
          if (userDeleteResult.deletedCount === 0) {
            throw new Error('UserNotFound');
          }
          
          // If the user was a trainer, delete associated clients and library
          if (userToDelete.role === 'trainer') {
            await clientsCollection.deleteMany({ gymId: id }, { session });
            await db.collection("exerciselibrary").deleteOne({ gymId: id }, { session });
          }
        });
        
        res.status(200).json({ success: true });

      } catch (e) {
        if (e.message === 'UserNotFound') {
            res.status(404).json({ message: 'User not found' });
        } else {
            console.error(`API /api/gyms/${id} [DELETE] Error:`, e);
            res.status(500).json({ error: 'Unable to delete user and their data' });
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