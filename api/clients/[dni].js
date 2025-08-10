import clientPromise from '../util/mongodb.js';

export default async function handler(req, res) {
  const { dni } = req.query;
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("clients");

  switch (req.method) {
    case 'GET':
      try {
        const clientData = await collection.findOne({ dni: dni });
        if (!clientData) {
          return res.status(404).json({ message: 'Client not found' });
        }
        res.status(200).json(clientData);
      } catch (e) {
        console.error(`API /api/clients/${dni} [GET] Error:`, e);
        res.status(500).json({ error: 'Unable to fetch client data' });
      }
      break;

    case 'PUT':
      try {
        const dataToUpdate = req.body;
        delete dataToUpdate._id;
        
        const result = await collection.updateOne(
          { dni: dni },
          { $set: dataToUpdate },
          { upsert: false }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: 'Client not found' });
        }

        res.status(200).json({ success: true });
      } catch (e) {
        console.error(`API /api/clients/${dni} [PUT] Error:`, e);
        res.status(500).json({ error: 'Unable to update client data' });
      }
      break;

    case 'DELETE':
      try {
        const result = await collection.deleteOne({ dni: dni });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: 'Client not found' });
        }

        res.status(200).json({ success: true });
      } catch (e) {
        console.error(`API /api/clients/${dni} [DELETE] Error:`, e);
        res.status(500).json({ error: 'Unable to delete client' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}