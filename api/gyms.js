
import { ObjectId } from 'mongodb';
import clientPromise from './util/mongodb.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const gymsCollection = db.collection("gyms");

  const { id } = req.query;

  if (id) {
    // Logic from former gyms/[id].js
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid User ID format' });
    }
    const objectId = new ObjectId(id);
    const clientsCollection = db.collection("clients"); // Needed for DELETE

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
              const userToDelete = await gymsCollection.findOne({ _id: objectId }, { session });
              if (!userToDelete) {
                 throw new Error('UserNotFound');
              }
    
              const userDeleteResult = await gymsCollection.deleteOne({ _id: objectId }, { session });
              if (userDeleteResult.deletedCount === 0) {
                throw new Error('UserNotFound');
              }
              
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
          res.status(405).end(`Method ${req.method} Not Allowed for user ID`);
      }
  } else {
    // Logic from original gyms.js
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
            const { name, username, password, dailyQuestionLimit, logoSvg, planType, role, associatedGymId } = req.body;
            if (!name || !username || !password || !role) {
              return res.status(400).json({ message: 'Name, username, password, and role are required' });
            }
            
            const existingUser = await gymsCollection.findOne({ username });
            if (existingUser) {
              return res.status(409).json({ message: 'User with this username already exists' });
            }
            
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
    
            const newUser = {
              name,
              username,
              password: hashedPassword,
              role,
              dailyQuestionLimit: role === 'trainer' ? (Number(dailyQuestionLimit) || 10) : undefined,
              logoSvg: role === 'trainer' ? (logoSvg || null) : undefined,
              planType: role === 'trainer' ? (planType || 'full') : undefined,
              associatedGymId: role === 'accountant' ? associatedGymId : undefined,
            };
            
            const result = await gymsCollection.insertOne(newUser);
            res.status(201).json({ success: true, insertedId: result.insertedId });
          } catch (e) {
            console.error("API /api/gyms [POST] Error:", e);
            res.status(500).json({ error: 'Unable to create user' });
          }
          break;
    
        default:
          res.setHeader('Allow', ['GET', 'POST']);
          res.status(405).end(`Method ${req.method} Not Allowed`);
      }
  }
}
