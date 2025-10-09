
import { ObjectId } from 'mongodb';
import clientPromise from '../util/mongodb.js';

export default async function handler(req, res) {
  const { id } = req.query;
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("fixed-expenses");

  if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Expense ID format' });
  }
  const objectId = new ObjectId(id);

  switch (req.method) {
    case 'PUT':
      try {
        const { lastPaid } = req.body;
        if (lastPaid === undefined) { // Allow null or string
            return res.status(400).json({ message: 'lastPaid field is required' });
        }

        const result = await collection.updateOne(
          { _id: objectId },
          { $set: { lastPaid } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Expense not found' });
        }
        res.status(200).json({ success: true });

      } catch (e) {
        console.error(`API /api/fixed-expenses/${id} [PUT] Error:`, e);
        res.status(500).json({ error: 'Unable to update expense' });
      }
      break;

    default:
      res.setHeader('Allow', ['PUT']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
