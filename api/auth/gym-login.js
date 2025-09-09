
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
    
    // Use a case-insensitive regex for all username lookups
    const userQuery = { username: { $regex: new RegExp(`^${username}$`, 'i') } };

    // Special handling for superadmin to ensure it exists and is correct
    if (username.toLowerCase() === 'superadmin') {
        const superAdminQuery = { username: { $regex: /^superadmin$/i } };
        let superAdminUser = await gymsCollection.findOne(superAdminQuery);

        if (!superAdminUser) {
            // If user doesn't exist, create it with a hashed password.
            console.log("Superadmin user not found, creating one with default password.");
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin', salt);
            const defaultSuperAdmin = {
                name: 'Super Administrador',
                username: 'superadmin', // Store in a canonical lowercase form
                password: hashedPassword,
                dailyQuestionLimit: 999,
                planType: 'full',
                logoSvg: null,
            };
            await gymsCollection.insertOne(defaultSuperAdmin);
        } else if (!superAdminUser.password.startsWith('$2')) {
            // If user exists but password is NOT hashed, update it.
            console.log("Superadmin password is not hashed. Updating to a hashed password.");
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin', salt);
            await gymsCollection.updateOne(
                { _id: superAdminUser._id },
                { $set: { password: hashedPassword } }
            );
        }
    }

    const gym = await gymsCollection.findOne(userQuery);

    if (!gym) {
      // Keep the error message generic for security reasons
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