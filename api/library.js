

import clientPromise from './util/mongodb.js';

const DEFAULT_EXERCISE_LIBRARY = {
    "Pecho": [
        { name: "Apertura con mancuernas en banco declinado", isEnabled: true, youtubeLink: "" },
        { name: "Apertura en maquina inclinada", isEnabled: true, youtubeLink: "" },
        { name: "Aperturas con mancuernas en banco plano", isEnabled: true, youtubeLink: "" },
        { name: "Cruce de poleas (crossover)", isEnabled: true, youtubeLink: "" },
        { name: "Cruze de poleas alta", isEnabled: true, youtubeLink: "" },
        { name: "Cruze de poleas inferior", isEnabled: true, youtubeLink: "" },
        { name: "Cruze de poleas medio", isEnabled: true, youtubeLink: "" },
        { name: "Flexiones de brazos (Push-ups)", isEnabled: true, youtubeLink: "" },
        { name: "Flexiones con agarre cerrado", isEnabled: true, youtubeLink: "" },
        { name: "Fondos en paralelas (Dips)", isEnabled: true, youtubeLink: "" },
        { name: "Hammer inclinado", isEnabled: true, youtubeLink: "" },
        { name: "Hammer plano", isEnabled: true, youtubeLink: "" },
        { name: "Peck deck en maquina", isEnabled: true, youtubeLink: "" },
        { name: "Peck fly en maquina", isEnabled: true, youtubeLink: "" },
        { name: "Press con mancuernas en banco declinado", isEnabled: true, youtubeLink: "" },
        { name: "Press de banca declinado con barra", isEnabled: true, youtubeLink: "" },
        { name: "Press de banca inclinado con barra", isEnabled: true, youtubeLink: "" },
        { name: "Press de banca plano con barra", isEnabled: true, youtubeLink: "" },
        { name: "Press de barra unilateral", isEnabled: true, youtubeLink: "" },
        { name: "Press de inclinado en smith", isEnabled: true, youtubeLink: "" },
        { name: "Press de pecho en smith", isEnabled: true, youtubeLink: "" },
        { name: "Press declinado con barra", isEnabled: true, youtubeLink: "" },
        { name: "Press en máquina hammer", isEnabled: true, youtubeLink: "" },
        { name: "Press inclinado con mancuernas", isEnabled: true, youtubeLink: "" }
    ],
    "Espalda": [
        { name: "Banco de espinales", isEnabled: true, youtubeLink: "" },
        { name: "buenos dias con barra", isEnabled: true, youtubeLink: "" },
        { name: "Dominadas (Pull-ups)", isEnabled: true, youtubeLink: "" },
        { name: "Dominadas con agarre cerrado", isEnabled: true, youtubeLink: "" },
        { name: "Dorsalera frontal", isEnabled: true, youtubeLink: "" },
        { name: "Dorsalera trasnuca", isEnabled: true, youtubeLink: "" },
        { name: "Encogimiento de hombros con barra", isEnabled: true, youtubeLink: "" },
        { name: "Encogimiento de hombros en smith", isEnabled: true, youtubeLink: "" },
        { name: "Jalon a la cara (dorsalera)", isEnabled: true, youtubeLink: "" },
        { name: "Jalon a la cara cerrdo (dorsalera)", isEnabled: true, youtubeLink: "" },
        { name: "Jalon a la cara supino (dorsalera)", isEnabled: true, youtubeLink: "" },
        { name: "Jalon Frontal unilateral con polea ", isEnabled: true, youtubeLink: "" },
        { name: "Jalón al pecho (Polea alta)", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto convencional", isEnabled: true, youtubeLink: "" },
        { name: "Pull-over con mancuerna", isEnabled: true, youtubeLink: "" },
        { name: "Pull-over en polea alta", isEnabled: true, youtubeLink: "" },
        { name: "Remo a caballo", isEnabled: true, youtubeLink: "" },
        { name: "Remo al menton con barra", isEnabled: true, youtubeLink: "" },
        { name: "Remo al menton con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Remo al menton con smith", isEnabled: true, youtubeLink: "" },
        { name: "Remo bajo", isEnabled: true, youtubeLink: "" },
        { name: "Remo bajo sentado con agarre ancho", isEnabled: true, youtubeLink: "" },
        { name: "Remo con barra (inclinado)", isEnabled: true, youtubeLink: "" },
        { name: "Remo con mancuerna a una mano", isEnabled: true, youtubeLink: "" },
        { name: "Remo en punta con barra T", isEnabled: true, youtubeLink: "" },
        { name: "Remo hammer", isEnabled: true, youtubeLink: "" },
        { name: "Remo prono con mancuernas en banco inclinado", isEnabled: true, youtubeLink: "" },
        { name: "Remo sentado en polea (agarre estrecho)", isEnabled: true, youtubeLink: "" },
        { name: "Remo T unilateral", isEnabled: true, youtubeLink: "" },
        { name: "Remo unilateral con barra", isEnabled: true, youtubeLink: "" }
    ],
    "Hombros": [
        { name: "Antebrazo con polea", isEnabled: true, youtubeLink: "" },
        { name: "Deltoides en polea cruzadas", isEnabled: true, youtubeLink: "" },
        { name: "Elevacion posterior con macuernas", isEnabled: true, youtubeLink: "" },
        { name: "Elevacion posterior con polea", isEnabled: true, youtubeLink: "" },
        { name: "Elevaciones frontales con disco", isEnabled: true, youtubeLink: "" },
        { name: "Elevaciones laterales con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Face pulls en polea", isEnabled: true, youtubeLink: "" },
        { name: "Maquina de vuelos laterales de pie", isEnabled: true, youtubeLink: "" },
        { name: "Pájaros (Bent-over reverse flyes)", isEnabled: true, youtubeLink: "" },
        { name: "Posteriores en maquina de apertura", isEnabled: true, youtubeLink: "" },
        { name: "Pres de hombros sentado con barra", isEnabled: true, youtubeLink: "" },
        { name: "Press Arnold con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Press de hombro con mancuerna arodillado unilateral", isEnabled: true, youtubeLink: "" },
        { name: "Press de hombros con agarre neutro", isEnabled: true, youtubeLink: "" },
        { name: "Press de hombros smith", isEnabled: true, youtubeLink: "" },
        { name: "Press en máquina de hombros", isEnabled: true, youtubeLink: "" },
        { name: "Press militar con barra (de pie)", isEnabled: true, youtubeLink: "" },
        { name: "Press militar sentado con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Press Nuca con barra", isEnabled: true, youtubeLink: "" },
        { name: "Remo al mentón con barra", isEnabled: true, youtubeLink: "" },
        { name: "Vuelos frontales", isEnabled: true, youtubeLink: "" },
        { name: "Vuelos frontales con barra", isEnabled: true, youtubeLink: "" },
        { name: "Vuelos frontales con disco", isEnabled: true, youtubeLink: "" },
        { name: "Vuelos frontales con polea", isEnabled: true, youtubeLink: "" },
        { name: "Vuelos laterales", isEnabled: true, youtubeLink: "" },
        { name: "Vuelos laterales con polea", isEnabled: true, youtubeLink: "" },
        { name: "Vuelos laterales sentado", isEnabled: true, youtubeLink: "" },
        { name: "Vuelos posteriores", isEnabled: true, youtubeLink: "" },
        { name: "Vuelos posteriores en banco inclinado", isEnabled: true, youtubeLink: "" }
    ],
    "Cuádriceps": [
        { name: "Estocadas caminadas con barra o mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Estocadas en Ladmine", isEnabled: true, youtubeLink: "" },
        { name: "Hack", isEnabled: true, youtubeLink: "" },
        { name: "Hach scuat", isEnabled: true, youtubeLink: "" },
        { name: "Prensa 45 grados unilateral", isEnabled: true, youtubeLink: "" },
        { name: "Prensa basculante", isEnabled: true, youtubeLink: "" },
        { name: "Prensa de piernas a 45 grados", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla en belt squat", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla frontal con barra", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla goblet", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla landmine", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla libre con barra", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla pendulo", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla smith", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla sussy", isEnabled: true, youtubeLink: "" },
        { name: "Sillon de cuádriceps", isEnabled: true, youtubeLink: "" },
        { name: "Sillon de cuadriceps unilateral", isEnabled: true, youtubeLink: "" }
    ],
    "Femorales e Isquiotibiales": [
        { name: "Curl femoral en polea", isEnabled: true, youtubeLink: "" },
        { name: "Curl femoral tumbado en máquina", isEnabled: true, youtubeLink: "" },
        { name: "Femoral sentado", isEnabled: true, youtubeLink: "" },
        { name: "Femoral tumbado unilateral", isEnabled: true, youtubeLink: "" },
        { name: "Maquina curl femoral unilateral", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto rumano con mancuernas", isEnabled: true, youtubeLink: "" }
    ],
    "Glúteos": [
        { name: "Abducción de cadera en máquina", isEnabled: true, youtubeLink: "" },
        { name: "ABductor en multicadera", isEnabled: true, youtubeLink: "" },
        { name: "Enpuje de caderas con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Estocada paso atras con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Estocada trasera con barra", isEnabled: true, youtubeLink: "" },
        { name: "Extencion de tronco", isEnabled: true, youtubeLink: "" },
        { name: "Extencion de tronco en GHD", isEnabled: true, youtubeLink: "" },
        { name: "Hack scuat invertida", isEnabled: true, youtubeLink: "" },
        { name: "Hip thrust con barra", isEnabled: true, youtubeLink: "" },
        { name: "Hip thrust en maquina", isEnabled: true, youtubeLink: "" },
        { name: "Maquina de gluteos horizontal", isEnabled: true, youtubeLink: "" },
        { name: "Maquina de gluteos vertical", isEnabled: true, youtubeLink: "" },
        { name: "Multicadera para gluteos", isEnabled: true, youtubeLink: "" },
        { name: "Patada de glúteo en polea", isEnabled: true, youtubeLink: "" },
        { name: "Patada de glueteos diagonal en polea", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto rumano a una pierna con mancuerna unilateral", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto sumo con barra", isEnabled: true, youtubeLink: "" },
        { name: "Peso muerto sumo con mancuerna", isEnabled: true, youtubeLink: "" },
        { name: "Puente de glúteos con disco o mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla búlgara con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla sumo belt scuat", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla sumo con mancuernas", isEnabled: true, youtubeLink: "" }
    ],
    "Gemelos y Sóleos": [
        { name: "Elevación de talones (gemelos) de pie", isEnabled: true, youtubeLink: "" },
        { name: "Elevación de talones (gemelos) de sentado", isEnabled: true, youtubeLink: "" },
        { name: "Extencion de gemelos en prensa", isEnabled: true, youtubeLink: "" }
    ],
    "Aductores y Abductores": [
        { name: "ABductor en maquina", isEnabled: true, youtubeLink: "" },
        { name: "Aductor en maquina", isEnabled: true, youtubeLink: "" },
        { name: "Aductor en multicadera", isEnabled: true, youtubeLink: "" },
        { name: "Sentadilla cossack con peso", isEnabled: true, youtubeLink: "" }
    ],
    "Abdominales": [ 
        { name: "Columpio Rudo", isEnabled: true, youtubeLink: "" },
        { name: "Elevacion con peso", isEnabled: true, youtubeLink: "" },
        { name: "Elevacion de piernas con giro", isEnabled: true, youtubeLink: "" },
        { name: "Elevacion de piernas en posicion supina", isEnabled: true, youtubeLink: "" },
        { name: "Elevacion de rodillas en banco plano", isEnabled: true, youtubeLink: "" },
        { name: "Elevacion en banco declinado", isEnabled: true, youtubeLink: "" },
        { name: "Elevación de piernas colgado", isEnabled: true, youtubeLink: "" },
        { name: "Encogimientos (Crunches)", isEnabled: true, youtubeLink: "" },
        { name: "Encogimientos doble (Crunches)", isEnabled: true, youtubeLink: "" },
        { name: "Encogimientos en polea alta", isEnabled: true, youtubeLink: "" },
        { name: "Giro Ruso", isEnabled: true, youtubeLink: "" },
        { name: "Giros rusos (Russian twists)", isEnabled: true, youtubeLink: "" },
        { name: "Oblicuos (bicicleta)", isEnabled: true, youtubeLink: "" },
        { name: "Oblicuos cruzados", isEnabled: true, youtubeLink: "" },
        { name: "Oblicuos en colchoneta", isEnabled: true, youtubeLink: "" },
        { name: "Patada mariposa", isEnabled: true, youtubeLink: "" },
        { name: "Plancha abdominal (Plank)", isEnabled: true, youtubeLink: "" },
        { name: "Plancha con rotacion de caderas", isEnabled: true, youtubeLink: "" },
        { name: "Plancha lateral", isEnabled: true, youtubeLink: "" },
        { name: "Rueda abdominal (Ab wheel rollout)", isEnabled: true, youtubeLink: "" },
        { name: "Toque de talon", isEnabled: true, youtubeLink: "" }
    ],
    "Brazos (Bíceps y Tríceps)": [
        { name: "Banco scott a disco", isEnabled: true, youtubeLink: "" },
        { name: "Crush triceps barra", isEnabled: true, youtubeLink: "" },
        { name: "Curl de biceps 21", isEnabled: true, youtubeLink: "" },
        { name: "Curl de biceps alterno parado", isEnabled: true, youtubeLink: "" },
        { name: "Curl de biceps alrtenado en banco inclinado", isEnabled: true, youtubeLink: "" },
        { name: "Curl de biceps con barra romana", isEnabled: true, youtubeLink: "" },
        { name: "Curl de biceps con mancuerna unilateral a 45 grados", isEnabled: true, youtubeLink: "" },
        { name: "Curl de bíceps con barra recta", isEnabled: true, youtubeLink: "" },
        { name: "Curl de bíceps concentrado", isEnabled: true, youtubeLink: "" },
        { name: "Curl de biceps en polea", isEnabled: true, youtubeLink: "" },
        { name: "Curl de biceps en polea invertido", isEnabled: true, youtubeLink: "" },
        { name: "Curl de biceps en polea unilateral", isEnabled: true, youtubeLink: "" },
        { name: "Curl de biceps sentado alternado", isEnabled: true, youtubeLink: "" },
        { name: "Curl martillo con mancuernas", isEnabled: true, youtubeLink: "" },
        { name: "Curl predicador (Scott) con barra Z", isEnabled: true, youtubeLink: "" },
        { name: "Extencion de codo en polea unilateral", isEnabled: true, youtubeLink: "" },
        { name: "Extensiones de tríceps en polea alta con soga", isEnabled: true, youtubeLink: "" },
        { name: "Fondos en maquina", isEnabled: true, youtubeLink: "" },
        { name: "Fondos entre bancos", isEnabled: true, youtubeLink: "" },
        { name: "Jalon para biceps", isEnabled: true, youtubeLink: "" },
        { name: "Patada de tríceps con mancuerna", isEnabled: true, youtubeLink: "" },
        { name: "Patada de tríceps con polea", isEnabled: true, youtubeLink: "" },
        { name: "Press Frances", isEnabled: true, youtubeLink: "" },
        { name: "Press frances sentado", isEnabled: true, youtubeLink: "" },
        { name: "Press frances snetado a una mano", isEnabled: true, youtubeLink: "" },
        { name: "Press francés con barra Z", isEnabled: true, youtubeLink: "" },
        { name: "Triceps trasnuca en polea", isEnabled: true, youtubeLink: "" },
        { name: "Triceps trasnuca en polea baja", isEnabled: true, youtubeLink: "" }
    ]
};

export default async function handler(req, res) {
  const client = await clientPromise;
  const db = client.db("scorpiongym");
  const collection = db.collection("exerciselibrary");
  const { gymId } = req.query;

  if (!gymId) {
    return res.status(400).json({ message: 'Gym ID is required' });
  }

  switch (req.method) {
    case 'GET':
      try {
        let libraryDoc = await collection.findOne({ gymId: gymId });

        if (!libraryDoc) {
          console.log(`No exercise library found for gym ${gymId}, creating default one...`);
          const newLibrary = { gymId: gymId, data: DEFAULT_EXERCISE_LIBRARY };
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
          { gymId: gymId },
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