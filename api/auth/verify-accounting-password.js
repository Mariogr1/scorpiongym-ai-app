
import { ObjectId } from 'mongodb';
import clientPromise from '../util/mongodb.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { gymId, password } = req.body;
  if (!gymId || !password) {
    return res.status(400).json({ message: 'Gym ID and password are required' });
  }
  
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const gymsCollection = db.collection("gyms");
  
  if (!ObjectId.isValid(gymId)) {
      return res.status(400).json({ message: 'Invalid Gym ID format' });
  }
  const objectId = new ObjectId(gymId);

  try {
    const gym = await gymsCollection.findOne({ _id: objectId });

    if (!gym || !gym.accountingPassword) {
      // Return 401 for security; avoids confirming if a gym or password exists.
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, gym.accountingPassword);

    if (passwordMatch) {
      res.status(200).json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error("API /api/auth/verify-accounting-password [POST] Error:", error);
    res.status(500).json({ error: 'An internal error occurred' });
  }
}
