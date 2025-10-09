import { ObjectId } from 'mongodb';
import clientPromise from '../util/mongodb.js';

export default async function handler(req, res) {
    const { id } = req.query;
    const client = await clientPromise;
    const db = client.db("scorpiongym");
    const fixedExpensesCollection = db.collection("fixedExpenses");
    const transactionsCollection = db.collection("transactions");

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
    }
    const objectId = new ObjectId(id);

    switch (req.method) {
        case 'PUT': // Used for marking as paid
            const session = client.startSession();
            try {
                await session.withTransaction(async () => {
                    const fixedExpense = await fixedExpensesCollection.findOne({ _id: objectId }, { session });

                    if (!fixedExpense) {
                        throw new Error('NotFound');
                    }

                    // 1. Create a new transaction
                    const newTransaction = {
                        gymId: fixedExpense.gymId,
                        type: 'expense',
                        date: new Date().toISOString(),
                        description: `Gasto Fijo: ${fixedExpense.description}`,
                        amount: fixedExpense.amount,
                        category: fixedExpense.type === 'gym' ? 'Gastos Fijos (Gimnasio)' : 'Gastos Fijos (Personales)',
                        paymentMethod: 'Automatico', // Or some other default
                        accountId: 'default', // Placeholder
                        createdAt: new Date(),
                    };
                    await transactionsCollection.insertOne(newTransaction, { session });
                    
                    // 2. Update the fixed expense with the payment date
                    await fixedExpensesCollection.updateOne(
                        { _id: objectId },
                        { $set: { lastPaidDate: new Date() } },
                        { session }
                    );
                });
                res.status(200).json({ success: true });
            } catch (e) {
                 if (e.message === 'NotFound') {
                    res.status(404).json({ message: 'Fixed expense not found' });
                } else {
                    console.error(`API /api/fixed-expenses/${id} [PUT] Error:`, e);
                    res.status(500).json({ error: 'Unable to process payment' });
                }
            } finally {
                session.endSession();
            }
            break;

        case 'DELETE':
            try {
                const result = await fixedExpensesCollection.deleteOne({ _id: objectId });
                if (result.deletedCount === 0) {
                    return res.status(404).json({ message: 'Fixed expense not found' });
                }
                res.status(200).json({ success: true });
            } catch (e) {
                console.error(`API /api/fixed-expenses/${id} [DELETE] Error:`, e);
                res.status(500).json({ error: 'Unable to delete fixed expense' });
            }
            break;

        default:
            res.setHeader('Allow', ['PUT', 'DELETE']);
            res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
