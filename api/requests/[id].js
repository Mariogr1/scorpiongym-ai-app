
import { ObjectId } from 'mongodb';
import clientPromise from '../../util/mongodb.js';

export default async function handler(req, res) {
  const { id } = req.query;
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("requests");

  if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Request ID format' });
  }
  const objectId = new ObjectId(id);

  switch (req.method) {
    case 'PUT':
      try {
        const { status } = req.body;
        if (!status || !['read', 'resolved'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status provided' });
        }

        const result = await collection.updateOne(
          { _id: objectId },
          { $set: { status } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Request not found' });
        }
        res.status(200).json({ success: true });

      } catch (e) {
        console.error(`API /api/requests/${id} [PUT] Error:`, e);
        res.status(500).json({ error: 'Unable to update request' });
      }
      break;

    case 'DELETE':
      try {
        const result = await collection.deleteOne({ _id: objectId });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Request not found' });
        }
        res.status(200).json({ success: true });
      } catch (e) {
        console.error(`API /api/requests/${id} [DELETE] Error:`, e);
        res.status(500).json({ error: 'Unable to delete request' });
      }
      break;

    default:
      res.setHeader('Allow', ['PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
