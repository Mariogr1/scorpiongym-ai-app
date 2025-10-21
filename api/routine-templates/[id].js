import { ObjectId } from 'mongodb';
import clientPromise from '../util/mongodb.js';

export default async function handler(req, res) {
  const { id } = req.query;
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("routineTemplates");

  if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Template ID format' });
  }
  const objectId = new ObjectId(id);

  switch (req.method) {
    case 'PUT':
      try {
        const dataToUpdate = req.body;
        delete dataToUpdate._id; // Prevent updating the immutable _id

        const result = await collection.updateOne(
          { _id: objectId },
          { $set: dataToUpdate }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Template not found' });
        }

        res.status(200).json({ success: true });

      } catch (e) {
        console.error(`API /api/routine-templates/${id} [PUT] Error:`, e);
        res.status(500).json({ error: 'Unable to update template' });
      }
      break;

    case 'DELETE':
      try {
        const result = await collection.deleteOne({ _id: objectId });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Template not found' });
        }
        res.status(200).json({ success: true });
      } catch (e) {
        console.error(`API /api/routine-templates/${id} [DELETE] Error:`, e);
        res.status(500).json({ error: 'Unable to delete template' });
      }
      break;

    default:
      res.setHeader('Allow', ['PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
