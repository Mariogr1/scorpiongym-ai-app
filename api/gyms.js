
import clientPromise from './util/mongodb.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const gymsCollection = db.collection("gyms");

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

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
