import clientPromise from './util/mongodb.js';

export default async function handler(req, res) {
    const client = await clientPromise;
    const db = client.db("scorpiongym");
    const collection = db.collection("fixedExpenses");

    const { gymId } = req.query;

    if (!gymId) {
        return res.status(400).json({ message: 'Gym ID is required' });
    }

    switch (req.method) {
        case 'GET':
            try {
                const data = await collection.find({ gymId }).toArray();
                res.status(200).json(data);
            } catch (e) {
                console.error(`API /api/fixed-expenses [GET] Error:`, e);
                res.status(500).json({ error: `Unable to fetch fixed expenses` });
            }
            break;

        case 'POST':
            try {
                const { description, amount, type } = req.body;
                 if (!description || !amount || !type) {
                    return res.status(400).json({ message: 'Description, amount, and type are required' });
                }
                const newData = { 
                    ...req.body, 
                    gymId, 
                    createdAt: new Date(),
                    lastPaidDate: null
                };
                delete newData._id;

                const result = await collection.insertOne(newData);
                res.status(201).json({ success: true, insertedId: result.insertedId });
            } catch (e) {
                console.error(`API /api/fixed-expenses [POST] Error:`, e);
                res.status(500).json({ error: `Unable to create fixed expense` });
            }
            break;

        default:
            res.setHeader('Allow', ['GET', 'POST']);
            res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
