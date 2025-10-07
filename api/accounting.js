

import { ObjectId } from 'mongodb';
import clientPromise from './util/mongodb.js';

export default async function handler(req, res) {
    const client = await clientPromise;
    const db = client.db("scorpiongym");

    const { gymId, entity, id } = req.query;
    
    // For write operations, gymId might be in the body if not in query (for single-document operations by ID)
    const effectiveGymId = gymId || req.body?.gymId;
    if (req.method !== 'GET' && !effectiveGymId && !id) {
         return res.status(400).json({ message: 'Gym ID or document ID is required for modifications' });
    }
    if (!entity || !['transactions', 'accounts', 'employees', 'balanceSnapshot', 'balanceSnapshots'].includes(entity)) {
        return res.status(400).json({ message: 'A valid entity is required' });
    }
    
    // Special case for balanceSnapshot which is a POST only logical entity
    if (entity === 'balanceSnapshot' && req.method === 'POST') {
         try {
            const { gymId: bodyGymId, accountId, date, totalBalance } = req.body;
            
            const snapshotsCollection = db.collection("balanceSnapshots");
            const transactionsCollection = db.collection("transactions");
            const accountsCollection = db.collection("accounts");
            
            // Find the most recent snapshot for this account *before* the given date
            const previousSnapshot = await snapshotsCollection.findOne(
                { gymId: bodyGymId, accountId, date: { $lt: date } },
                { sort: { date: -1 } }
            );
            
            const previousBalance = previousSnapshot ? previousSnapshot.totalBalance : 0;
            const difference = Number(totalBalance) - previousBalance;
            
            // Only create a transaction if there's a positive income
            if (difference > 0) {
                const account = await accountsCollection.findOne({ _id: new ObjectId(accountId) });
                const transaction = {
                    gymId: bodyGymId,
                    type: 'income',
                    date: date, // Keep date as string YYYY-MM-DD
                    description: `Ingreso del día - ${account ? account.name : 'Cuenta Desconocida'}`,
                    amount: difference,
                    category: 'Balance Diario',
                    paymentMethod: account ? account.name : 'Balance', // For display
                    accountId,
                    createdAt: new Date()
                };
                await transactionsCollection.insertOne(transaction);
            }
            
            // Upsert the new balance snapshot for the given date
            await snapshotsCollection.updateOne(
                { gymId: bodyGymId, accountId, date },
                { $set: { totalBalance: Number(totalBalance) } },
                { upsert: true }
            );

            return res.status(201).json({ success: true, registeredIncome: difference > 0 ? difference : 0 });

        } catch(e) {
            console.error(`API /api/accounting [POST] for balanceSnapshot Error:`, e);
            return res.status(500).json({ error: `Unable to process balance snapshot` });
        }
    }


    const collection = db.collection(entity);

    switch (req.method) {
        case 'GET':
            try {
                 if (!gymId) return res.status(400).json({ message: 'Gym ID is required' });
                const data = await collection.find({ gymId }).toArray();
                res.status(200).json(data);
            } catch (e) {
                console.error(`API /api/accounting [GET] for ${entity} Error:`, e);
                res.status(500).json({ error: `Unable to fetch ${entity}` });
            }
            break;

        case 'POST':
            try {
                const newData = { ...req.body, createdAt: new Date() };
                delete newData._id;
                const result = await collection.insertOne(newData);
                res.status(201).json({ success: true, insertedId: result.insertedId });
            } catch (e) {
                console.error(`API /api/accounting [POST] for ${entity} Error:`, e);
                res.status(500).json({ error: `Unable to create ${entity}` });
            }
            break;
            
        case 'PUT':
            try {
                if (!id || !ObjectId.isValid(id)) {
                    return res.status(400).json({ message: 'A valid document ID is required' });
                }
                const objectId = new ObjectId(id);
                const updateData = req.body;
                delete updateData._id;

                const result = await collection.updateOne({ _id: objectId }, { $set: updateData });
                if (result.matchedCount === 0) {
                    return res.status(404).json({ message: 'Document not found' });
                }
                res.status(200).json({ success: true });
            } catch (e) {
                 console.error(`API /api/accounting [PUT] for ${entity} Error:`, e);
                res.status(500).json({ error: `Unable to update ${entity}` });
            }
            break;
            
        case 'DELETE':
             try {
                if (!id || !ObjectId.isValid(id)) {
                    return res.status(400).json({ message: 'A valid document ID is required' });
                }
                const objectId = new ObjectId(id);
                
                const result = await collection.deleteOne({ _id: objectId });
                if (result.deletedCount === 0) {
                    return res.status(404).json({ message: 'Document not found' });
                }
                res.status(200).json({ success: true });
            } catch (e) {
                 console.error(`API /api/accounting [DELETE] for ${entity} Error:`, e);
                res.status(500).json({ error: `Unable to delete ${entity}` });
            }
            break;

        default:
            res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
            res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}