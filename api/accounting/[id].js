
import { ObjectId } from 'mongodb';
import clientPromise from '../util/mongodb.js';

export default async function handler(req, res) {
    const client = await clientPromise;
    const db = client.db("scorpiongym");

    const { entity, id } = req.query;

    if (!entity || !['transactions', 'accounts', 'fixed_expenses', 'expense_category_groups'].includes(entity)) {
        return res.status(400).json({ message: 'A valid entity is required' });
    }
    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'A valid ID is required' });
    }

    const collection = db.collection(entity);
    const objectId = new ObjectId(id);

    switch (req.method) {
        case 'PUT':
            try {
                const updateData = req.body;
                delete updateData._id; // Ensure the immutable _id is not part of the update

                const result = await collection.updateOne(
                    { _id: objectId },
                    { $set: updateData }
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: `${entity} not found` });
                }
                res.status(200).json({ success: true });
            } catch (e) {
                console.error(`API /api/accounting/${id} [PUT] for ${entity} Error:`, e);
                res.status(500).json({ error: `Unable to update ${entity}` });
            }
            break;

        case 'DELETE':
            try {
                const result = await collection.deleteOne({ _id: objectId });
                if (result.deletedCount === 0) {
                    return res.status(404).json({ message: `${entity} not found` });
                }
                res.status(200).json({ success: true });
            } catch (e) {
                console.error(`API /api/accounting/${id} [DELETE] for ${entity} Error:`, e);
                res.status(500).json({ error: `Unable to delete ${entity}` });
            }
            break;
        
        default:
            res.setHeader('Allow', ['PUT', 'DELETE']);
            res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
