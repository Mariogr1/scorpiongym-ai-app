import clientPromise from './util/mongodb.js';

const DEFAULT_EXERCISE_LIBRARY = {
    "Pecho": [
        { name: "Press de banca plano con barra", isEnabled: true, youtubeLink: "" },
        { name: "Press inclinado con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Aperturas con mancuernas en banco plano", isEnabled: true, youtubeLink: "" },
        { name: "Fondos en paralelas (Dips)", isEnabled: true, youtubeLink: "" },
        { name: "Press declinado con barra", isEnabled: true, youtubeLink: "" },
        { name: "Cruce de poleas (crossover)", isEnabled: true, youtubeLink: "" },
        { name: "Flexiones de brazos (Push-ups)", isEnabled: true, youtubeLink: "" },
        { name: "Press en máquina hammer", isEnabled: true, youtubeLink: "" }
    ],
    "Espalda": [
        { name: "Dominadas (Pull-ups)", isEnabled: true, youtubeLink: "" },
        { name: "Remo con barra (inclinado)", isEnabled: true, youtubeLink: "" },
        { name: "Jalón al pecho (Polea alta)", isEnabled: true, youtubeLink: "" },
        { name: "Remo en punta con barra T", isEnabled: true, youtubeLink: "" },
        { name: "Remo con mancuerna a una mano", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto convencional", isEnabled: true, youtubeLink: "" },
        { name: "Pull-over con mancuerna", isEnabled: true, youtubeLink: "" },
        { name: "Remo sentado en polea (agarre estrecho)", isEnabled: true, youtubeLink: "" }
    ],
    "Hombros": [
        { name: "Press militar con barra (de pie)", isEnabled: true, youtubeLink: "" },
        { name: "Press Arnold con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Elevaciones laterales con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Elevaciones frontales con disco", isEnabled: true, youtubeLink: "" },
        { name: "Pájaros (Bent-over reverse flyes)", isEnabled: true, youtubeLink: "" },
        { name: "Remo al mentón con barra", isEnabled: true, youtubeLink: "" },
        { name: "Face pulls en polea", isEnabled: true, youtubeLink: "" },
        { name: "Press en máquina de hombros", isEnabled: true, youtubeLink: "" }
    ],
    "Piernas": [
        { name: "Sentadilla libre con barra", isEnabled: true, youtubeLink: "" },
        { name: "Prensa de piernas a 45 grados", isEnabled: true, youtubeLink: "" },
        { name: "Zancadas (lunges) con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Extensiones de cuádriceps en máquina", isEnabled: true, youtubeLink: "" },
        { name: "Curl femoral tumbado en máquina", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto rumano con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Elevación de talones (gemelos) de pie", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla búlgara con mancuernas", isEnabled: true, youtubeLink: "" }
    ],
    "Glúteos": [
        { name: "Hip thrust con barra", isEnabled: true, youtubeLink: "" },
        { name: "Patada de glúteo en polea", isEnabled: true, youtubeLink: "" },
        { name: "Abducción de cadera en máquina", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto sumo con mancuerna", isEnabled: true, youtubeLink: "" },
        { name: "Puente de glúteos con disco", isEnabled: true, youtubeLink: "" }
    ],
    "Brazos (Bíceps y Tríceps)": [
        { name: "Curl de bíceps con barra recta", isEnabled: true, youtubeLink: "" },
        { name: "Press francés con barra Z", isEnabled: true, youtubeLink: "" },
        { name: "Curl martillo con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Extensiones de tríceps en polea alta con soga", isEnabled: true, youtubeLink: "" },
        { name: "Curl de bíceps concentrado", isEnabled: true, youtubeLink: "" },
        { name: "Fondos entre bancos", isEnabled: true, youtubeLink: "" },
        { name: "Curl predicador (Scott) con barra Z", isEnabled: true, youtubeLink: "" },
        { name: "Patada de tríceps con mancuerna", isEnabled: true, youtubeLink: "" }
    ]
};

const LIBRARY_DOC_ID = 'main_library';

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("exerciselibrary");

  switch (req.method) {
    case 'GET':
      try {
        let libraryDoc = await collection.findOne({ _id: LIBRARY_DOC_ID });

        if (!libraryDoc) {
          console.log("No exercise library found, creating default one...");
          const newLibrary = { _id: LIBRARY_DOC_ID, data: DEFAULT_EXERCISE_LIBRARY };
          await collection.insertOne(newLibrary);
          libraryDoc = newLibrary;
        }
        
        res.status(200).json(libraryDoc.data);
      } catch (e) {
        console.error("API /api/library [GET] Error:", e);
        res.status(500).json({ error: 'Unable to fetch exercise library' });
      }
      break;

    case 'POST':
      try {
        const libraryData = req.body;
        if (!libraryData) {
            return res.status(400).json({ message: 'Library data is required' });
        }
        
        await collection.updateOne(
          { _id: LIBRARY_DOC_ID },
          { $set: { data: libraryData } },
          { upsert: true }
        );

        res.status(200).json({ success: true });
      } catch (e) {
        console.error("API /api/library [POST] Error:", e);
        res.status(500).json({ error: 'Unable to save exercise library' });
      }
      break;

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}