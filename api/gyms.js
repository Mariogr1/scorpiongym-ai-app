

import clientPromise from './util/mongodb.js';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const gymsCollection = db.collection("gyms");

  switch (req.method) {
    case 'GET':
      try {
        const gyms = await gymsCollection.find({}, { projection: { password: 0 } }).toArray();
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
        
        const existingGym = await gymsCollection.findOne({ username });
        if (existingGym) {
          return res.status(409).json({ message: 'Gym with this username already exists' });
        }
        
        // In a real production app, password should be hashed.
        const newGym = {
          name,
          username,
          password,
          dailyQuestionLimit: Number(dailyQuestionLimit) || 10, // Default to 10 if not provided or invalid
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

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}