
import clientPromise from '../util/mongodb.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const gymsCollection = db.collection("gyms");

  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }
    
    // Ensure superadmin user exists for the first time
    if (username.toLowerCase() === 'superadmin') {
        let superAdminUser = await gymsCollection.findOne({ username: 'superadmin' });
        if (!superAdminUser) {
            console.log("Superadmin user not found, creating one with default password.");
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin', salt);
            const defaultSuperAdmin = {
                name: 'Super Administrador',
                username: 'superadmin',
                password: hashedPassword, // Default password, can be changed from the dashboard
                dailyQuestionLimit: 999
            };
            await gymsCollection.insertOne(defaultSuperAdmin);
        }
    }

    const gym = await gymsCollection.findOne({ username });

    if (!gym) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, gym.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Don't send the password back to the client
    const { password: _, ...gymData } = gym;

    res.status(200).json(gymData);

  } catch (e) {
    console.error("API /api/auth/gym-login [POST] Error:", e);
    res.status(500).json({ error: 'An error occurred during login' });
  }
}