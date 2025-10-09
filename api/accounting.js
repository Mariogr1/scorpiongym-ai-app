
import { ObjectId } from 'mongodb';
import clientPromise from './util/mongodb.js';

export default async function handler(req, res) {
    const client = await clientPromise;
    const db = client.db("scorpiongym");

    const { gymId, entity } = req.query;

    if (!gymId) {
        return res.status(400).json({ message: 'Gym ID is required' });
    }
    if (!entity || !['transactions', 'accounts', 'employees', 'fixed-expenses'].includes(entity)) {
        return res.status(400).json({ message: 'A valid entity is required' });
    }

    const collection = db.collection(entity);

    switch (req.method) {
        case 'GET':
            try {
                const data = await collection.find({ gymId }).toArray();
                res.status(200).json(data);
            } catch (e) {
                console.error(`API /api/accounting [GET] for ${entity} Error:`, e);
                res.status(500).json({ error: `Unable to fetch ${entity}` });
            }
            break;

        case 'POST':
            try {
                const newData = { ...req.body, gymId, createdAt: new Date() };
                delete newData._id; // Ensure we don't try to insert an existing _id

                const result = await collection.insertOne(newData);
                const insertedDoc = { _id: result.insertedId, ...newData };
                res.status(201).json(insertedDoc);
            } catch (e) {
                console.error(`API /api/accounting [POST] for ${entity} Error:`, e);
                res.status(500).json({ error: `Unable to create ${entity}` });
            }
            break;

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
