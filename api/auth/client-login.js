
import clientPromise from '../util/mongodb.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { dni, code } = req.body;
  if (!dni || !code) {
    return res.status(400).json({ message: 'DNI and code/password are required' });
  }

  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("clients");

  try {
    const clientData = await collection.findOne({ dni });

    if (!clientData || clientData.status === 'archived') {
      return res.status(401).json({ message: 'Invalid credentials or inactive user.' });
    }

    let isValid = false;
    // Check if user has a password (self-registered)
    if (clientData.password) {
      isValid = await bcrypt.compare(code, clientData.password);
    } else {
      // Fallback to accessCode for trainer-created users
      isValid = clientData.accessCode === code;
    }

    if (isValid) {
      res.status(200).json({ success: true });
    } else {
      res.status(401).json({ message: 'Invalid credentials.' });
    }

  } catch (e) {
    console.error("API /api/auth/client-login [POST] Error:", e);
    res.status(500).json({ error: 'An error occurred during login' });
  }
}
