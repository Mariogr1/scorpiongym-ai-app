

import { ObjectId } from 'mongodb';
import clientPromise from './util/mongodb.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const gymsCollection = db.collection("gyms");
  const clientsCollection = db.collection("clients");

  const { id } = req.query;

  switch (req.method) {
    case 'GET':
      try {
        const gyms = await gymsCollection.find(
            { username: { $ne: 'superadmin' } }, 
            { projection: { password: 0 } }
        ).toArray();
        res.status(200).json(gyms);
      } catch (e) {
        console.error("API /api/gyms [GET] Error:", e);
        res.status(500).json({ error: 'Unable to fetch gyms' });
      }
      break;

    case 'POST':
      try {
        const { name, username, password, dailyQuestionLimit, logoSvg, planType } = req.body;
        if (!name || !username || !password) {
          return res.status(400).json({ message: 'Name, username, and password are required' });
        }
        
        const existingUser = await gymsCollection.findOne({ username });
        if (existingUser) {
          return res.status(409).json({ message: 'User with this username already exists' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newGym = {
          name,
          username,
          password: hashedPassword,
          dailyQuestionLimit: Number(dailyQuestionLimit) || 10,
          logoSvg: logoSvg || null,
          planType: planType || 'full',
        };
        
        const result = await gymsCollection.insertOne(newGym);
        res.status(201).json({ success: true, insertedId: result.insertedId });
      } catch (e) {
        console.error("API /api/gyms [POST] Error:", e);
        res.status(500).json({ error: 'Unable to create gym' });
      }
      break;

    case 'PUT':
      try {
        if (!id || !ObjectId.isValid(id)) {
          return res.status(400).json({ message: 'Valid Gym ID is required for PUT' });
        }
        const objectId = new ObjectId(id);

        const { name, password, dailyQuestionLimit, logoSvg, planType } = req.body;
        const updateData = {};
        if (name) updateData.name = name;
        
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password = await bcrypt.hash(password, salt);
        }

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
          return res.status(404).json({ message: 'Gym not found' });
        }

        res.status(200).json({ success: true });

      } catch (e) {
        console.error(`API /api/gyms [PUT] Error for id ${id}:`, e);
        res.status(500).json({ error: 'Unable to update gym' });
      }
      break;

    case 'DELETE':
      if (!id || !ObjectId.isValid(id)) {
          return res.status(400).json({ message: 'Valid Gym ID is required for DELETE' });
      }
      const objectIdToDelete = new ObjectId(id);
      const session = client.startSession();
      try {
        await session.withTransaction(async () => {
          const gymDeleteResult = await gymsCollection.deleteOne({ _id: objectIdToDelete }, { session });
          if (gymDeleteResult.deletedCount === 0) {
             throw new Error('GymNotFound');
          }
          await clientsCollection.deleteMany({ gymId: id }, { session });
          await db.collection("exerciselibrary").deleteOne({ gymId: id }, { session });
        });
        
        res.status(200).json({ success: true });

      } catch (e) {
        if (e.message === 'GymNotFound') {
            res.status(404).json({ message: 'Gym not found' });
        } else {
            console.error(`API /api/gyms [DELETE] Error for id ${id}:`, e);
            res.status(500).json({ error: 'Unable to delete gym and associated data' });
        }
      } finally {
        session.endSession();
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}