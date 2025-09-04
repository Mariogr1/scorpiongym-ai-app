

import clientPromise from './util/mongodb.js';

const DEFAULT_EXERCISE_LIBRARY = {
    "Pecho": [
        { name: "Apertura con mancuernas en banco declinado", isEnabled: true, videoUrl: "" },
        { name: "Apertura en maquina inclinada", isEnabled: true, videoUrl: "" },
        { name: "Aperturas con mancuernas en banco plano", isEnabled: true, videoUrl: "" },
        { name: "Cruce de poleas (crossover)", isEnabled: true, videoUrl: "" },
        { name: "Cruze de poleas alta", isEnabled: true, videoUrl: "" },
        { name: "Cruze de poleas inferior", isEnabled: true, videoUrl: "" },
        { name: "Cruze de poleas medio", isEnabled: true, videoUrl: "" },
        { name: "Flexiones de brazos (Push-ups)", isEnabled: true, videoUrl: "" },
        { name: "Flexiones con agarre cerrado", isEnabled: true, videoUrl: "" },
        { name: "Fondos en paralelas (Dips)", isEnabled: true, videoUrl: "" },
        { name: "Hammer inclinado", isEnabled: true, videoUrl: "" },
        { name: "Hammer plano", isEnabled: true, videoUrl: "" },
        { name: "Peck deck en maquina", isEnabled: true, videoUrl: "" },
        { name: "Peck fly en maquina", isEnabled: true, videoUrl: "" },
        { name: "Press con mancuernas en banco declinado", isEnabled: true, videoUrl: "" },
        { name: "Press de banca declinado con barra", isEnabled: true, videoUrl: "" },
        { name: "Press de banca inclinado con barra", isEnabled: true, videoUrl: "" },
        { name: "Press de banca plano con barra", isEnabled: true, videoUrl: "" },
        { name: "Press de barra unilateral", isEnabled: true, videoUrl: "" },
        { name: "Press de inclinado en smith", isEnabled: true, videoUrl: "" },
        { name: "Press de pecho en smith", isEnabled: true, videoUrl: "" },
        { name: "Press declinado con barra", isEnabled: true, videoUrl: "" },
        { name: "Press en máquina hammer", isEnabled: true, videoUrl: "" },
        { name: "Press inclinado con mancuernas", isEnabled: true, videoUrl: "" }
    ],
    "Espalda": [
        { name: "Banco de espinales", isEnabled: true, videoUrl: "" },
        { name: "buenos dias con barra", isEnabled: true, videoUrl: "" },
        { name: "Dominadas (Pull-ups)", isEnabled: true, videoUrl: "" },
        { name: "Dominadas con agarre cerrado", isEnabled: true, videoUrl: "" },
        { name: "Dorsalera frontal", isEnabled: true, videoUrl: "" },
        { name: "Dorsalera trasnuca", isEnabled: true, videoUrl: "" },
        { name: "Encogimiento de hombros con barra", isEnabled: true, videoUrl: "" },
        { name: "Encogimiento de hombros en smith", isEnabled: true, videoUrl: "" },
        { name: "Jalon a la cara (dorsalera)", isEnabled: true, videoUrl: "" },
        { name: "Jalon a la cara cerrdo (dorsalera)", isEnabled: true, videoUrl: "" },
        { name: "Jalon a la cara supino (dorsalera)", isEnabled: true, videoUrl: "" },
        { name: "Jalon Frontal unilateral con polea ", isEnabled: true, videoUrl: "" },
        { name: "Jalón al pecho (Polea alta)", isEnabled: true, videoUrl: "" },
        { name: "Peso muerto convencional", isEnabled: true, videoUrl: "" },
        { name: "Pull-over con mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Pull-over en polea alta", isEnabled: true, videoUrl: "" },
        { name: "Remo a caballo", isEnabled: true, videoUrl: "" },
        { name: "Remo al menton con barra", isEnabled: true, videoUrl: "" },
        { name: "Remo al menton con mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Remo al menton con smith", isEnabled: true, videoUrl: "" },
        { name: "Remo bajo", isEnabled: true, videoUrl: "" },
        { name: "Remo bajo sentado con agarre ancho", isEnabled: true, videoUrl: "" },
        { name: "Remo con barra (inclinado)", isEnabled: true, videoUrl: "" },
        { name: "Remo con mancuerna a una mano", isEnabled: true, videoUrl: "" },
        { name: "Remo en punta con barra T", isEnabled: true, videoUrl: "" },
        { name: "Remo hammer", isEnabled: true, videoUrl: "" },
        { name: "Remo prono con mancuernas en banco inclinado", isEnabled: true, videoUrl: "" },
        { name: "Remo sentado en polea (agarre estrecho)", isEnabled: true, videoUrl: "" },
        { name: "Remo T unilateral", isEnabled: true, videoUrl: "" },
        { name: "Remo unilateral con barra", isEnabled: true, videoUrl: "" }
    ],
    "Hombros": [
        { name: "Antebrazo con polea", isEnabled: true, videoUrl: "" },
        { name: "Deltoides en polea cruzadas", isEnabled: true, videoUrl: "" },
        { name: "Elevacion posterior con macuernas", isEnabled: true, videoUrl: "" },
        { name: "Elevacion posterior con polea", isEnabled: true, videoUrl: "" },
        { name: "Elevaciones frontales con disco", isEnabled: true, videoUrl: "" },
        { name: "Elevaciones laterales con mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Face pulls en polea", isEnabled: true, videoUrl: "" },
        { name: "Maquina de vuelos laterales de pie", isEnabled: true, videoUrl: "" },
        { name: "Pájaros (Bent-over reverse flyes)", isEnabled: true, videoUrl: "" },
        { name: "Posteriores en maquina de apertura", isEnabled: true, videoUrl: "" },
        { name: "Pres de hombros sentado con barra", isEnabled: true, videoUrl: "" },
        { name: "Press Arnold con mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Press de hombro con mancuerna arodillado unilateral", isEnabled: true, videoUrl: "" },
        { name: "Press de hombros con agarre neutro", isEnabled: true, videoUrl: "" },
        { name: "Press de hombros smith", isEnabled: true, videoUrl: "" },
        { name: "Press en máquina de hombros", isEnabled: true, videoUrl: "" },
        { name: "Press militar con barra (de pie)", isEnabled: true, videoUrl: "" },
        { name: "Press militar sentado con mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Press Nuca con barra", isEnabled: true, videoUrl: "" },
        { name: "Remo al mentón con barra", isEnabled: true, videoUrl: "" },
        { name: "Vuelos frontales", isEnabled: true, videoUrl: "" },
        { name: "Vuelos frontales con barra", isEnabled: true, videoUrl: "" },
        { name: "Vuelos frontales con disco", isEnabled: true, videoUrl: "" },
        { name: "Vuelos frontales con polea", isEnabled: true, videoUrl: "" },
        { name: "Vuelos laterales", isEnabled: true, videoUrl: "" },
        { name: "Vuelos laterales con polea", isEnabled: true, videoUrl: "" },
        { name: "Vuelos laterales sentado", isEnabled: true, videoUrl: "" },
        { name: "Vuelos posteriores", isEnabled: true, videoUrl: "" },
        { name: "Vuelos posteriores en banco inclinado", isEnabled: true, videoUrl: "" }
    ],
    "Cuádriceps": [
        { name: "Estocadas caminadas con barra o mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Estocadas en Ladmine", isEnabled: true, videoUrl: "" },
        { name: "Hack", isEnabled: true, videoUrl: "" },
        { name: "Hach scuat", isEnabled: true, videoUrl: "" },
        { name: "Prensa 45 grados unilateral", isEnabled: true, videoUrl: "" },
        { name: "Prensa basculante", isEnabled: true, videoUrl: "" },
        { name: "Prensa de piernas a 45 grados", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla en belt squat", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla frontal con barra", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla goblet", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla landmine", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla libre con barra", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla pendulo", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla smith", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla sussy", isEnabled: true, videoUrl: "" },
        { name: "Sillon de cuádriceps", isEnabled: true, videoUrl: "" },
        { name: "Sillon de cuadriceps unilateral", isEnabled: true, videoUrl: "" }
    ],
    "Femorales e Isquiotibiales": [
        { name: "Curl femoral en polea", isEnabled: true, videoUrl: "" },
        { name: "Curl femoral tumbado en máquina", isEnabled: true, videoUrl: "" },
        { name: "Femoral sentado", isEnabled: true, videoUrl: "" },
        { name: "Femoral tumbado unilateral", isEnabled: true, videoUrl: "" },
        { name: "Maquina curl femoral unilateral", isEnabled: true, videoUrl: "" },
        { name: "Peso muerto rumano con mancuernas", isEnabled: true, videoUrl: "" }
    ],
    "Glúteos": [
        { name: "Abducción de cadera en máquina", isEnabled: true, videoUrl: "" },
        { name: "ABductor en multicadera", isEnabled: true, videoUrl: "" },
        { name: "Enpuje de caderas con mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Estocada paso atras con mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Estocada trasera con barra", isEnabled: true, videoUrl: "" },
        { name: "Extencion de tronco", isEnabled: true, videoUrl: "" },
        { name: "Extencion de tronco en GHD", isEnabled: true, videoUrl: "" },
        { name: "Hack scuat invertida", isEnabled: true, videoUrl: "" },
        { name: "Hip thrust con barra", isEnabled: true, videoUrl: "" },
        { name: "Hip thrust en maquina", isEnabled: true, videoUrl: "" },
        { name: "Maquina de gluteos horizontal", isEnabled: true, videoUrl: "" },
        { name: "Maquina de gluteos vertical", isEnabled: true, videoUrl: "" },
        { name: "Multicadera para gluteos", isEnabled: true, videoUrl: "" },
        { name: "Patada de glúteo en polea", isEnabled: true, videoUrl: "" },
        { name: "Patada de glueteos diagonal en polea", isEnabled: true, videoUrl: "" },
        { name: "Peso muerto con mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Peso muerto rumano a una pierna con mancuerna unilateral", isEnabled: true, videoUrl: "" },
        { name: "Peso muerto sumo con barra", isEnabled: true, videoUrl: "" },
        { name: "Peso muerto sumo con mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Puente de glúteos con disco o mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla búlgara con mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla sumo belt scuat", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla sumo con mancuernas", isEnabled: true, videoUrl: "" }
    ],
    "Gemelos y Sóleos": [
        { name: "Elevación de talones (gemelos) de pie", isEnabled: true, videoUrl: "" }
    ],
    "Aductores y Abductores": [
        { name: "ABductor en maquina", isEnabled: true, videoUrl: "" },
        { name: "Aductor en maquina", isEnabled: true, videoUrl: "" },
        { name: "Aductor en multicadera", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla cossack con peso", isEnabled: true, videoUrl: "" }
    ],
    "Abdominales": [ 
        { name: "Columpio Rudo", isEnabled: true, videoUrl: "" },
        { name: "Elevacion con peso", isEnabled: true, videoUrl: "" },
        { name: "Elevacion de piernas con giro", isEnabled: true, videoUrl: "" },
        { name: "Elevacion de piernas en posicion supina", isEnabled: true, videoUrl: "" },
        { name: "Elevacion de rodillas en banco plano", isEnabled: true, videoUrl: "" },
        { name: "Elevacion en banco declinado", isEnabled: true, videoUrl: "" },
        { name: "Elevación de piernas colgado", isEnabled: true, videoUrl: "" },
        { name: "Encogimientos (Crunches)", isEnabled: true, videoUrl: "" },
        { name: "Encogimientos doble (Crunches)", isEnabled: true, videoUrl: "" },
        { name: "Encogimientos en polea alta", isEnabled: true, videoUrl: "" },
        { name: "Giro Ruso", isEnabled: true, videoUrl: "" },
        { name: "Giros rusos (Russian twists)", isEnabled: true, videoUrl: "" },
        { name: "Oblicuos (bicicleta)", isEnabled: true, videoUrl: "" },
        { name: "Oblicuos cruzados", isEnabled: true, videoUrl: "" },
        { name: "Oblicuos en colchoneta", isEnabled: true, videoUrl: "" },
        { name: "Patada mariposa", isEnabled: true, videoUrl: "" },
        { name: "Plancha abdominal (Plank)", isEnabled: true, videoUrl: "" },
        { name: "Plancha con rotacion de caderas", isEnabled: true, videoUrl: "" },
        { name: "Plancha lateral", isEnabled: true, videoUrl: "" },
        { name: "Rueda abdominal (Ab wheel rollout)", isEnabled: true, videoUrl: "" },
        { name: "Toque de talon", isEnabled: true, videoUrl: "" }
    ],
    "Brazos (Bíceps y Tríceps)": [
        { name: "Banco scott a disco", isEnabled: true, videoUrl: "" },
        { name: "Crush triceps barra", isEnabled: true, videoUrl: "" },
        { name: "Curl de biceps 21", isEnabled: true, videoUrl: "" },
        { name: "Curl de biceps alterno parado", isEnabled: true, videoUrl: "" },
        { name: "Curl de biceps alrtenado en banco inclinado", isEnabled: true, videoUrl: "" },
        { name: "Curl de biceps con barra romana", isEnabled: true, videoUrl: "" },
        { name: "Curl de biceps con mancuerna unilateral a 45 grados", isEnabled: true, videoUrl: "" },
        { name: "Curl de bíceps con barra recta", isEnabled: true, videoUrl: "" },
        { name: "Curl de bíceps concentrado", isEnabled: true, videoUrl: "" },
        { name: "Curl de biceps en polea", isEnabled: true, videoUrl: "" },
        { name: "Curl de biceps en polea invertido", isEnabled: true, videoUrl: "" },
        { name: "Curl de biceps en polea unilateral", isEnabled: true, videoUrl: "" },
        { name: "Curl de biceps sentado alternado", isEnabled: true, videoUrl: "" },
        { name: "Curl martillo con mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Curl predicador (Scott) con barra Z", isEnabled: true, videoUrl: "" },
        { name: "Extencion de codo en polea unilateral", isEnabled: true, videoUrl: "" },
        { name: "Extensiones de tríceps en polea alta con soga", isEnabled: true, videoUrl: "" },
        { name: "Fondos en maquina", isEnabled: true, videoUrl: "" },
        { name: "Fondos entre bancos", isEnabled: true, videoUrl: "" },
        { name: "Jalon para biceps", isEnabled: true, videoUrl: "" },
        { name: "Patada de tríceps con mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Patada de tríceps con polea", isEnabled: true, videoUrl: "" },
        { name: "Press Frances", isEnabled: true, videoUrl: "" },
        { name: "Press frances sentado", isEnabled: true, videoUrl: "" },
        { name: "Press frances snetado a una mano", isEnabled: true, videoUrl: "" },
        { name: "Press francés con barra Z", isEnabled: true, videoUrl: "" },
        { name: "Triceps trasnuca en polea", isEnabled: true, videoUrl: "" },
        { name: "Triceps trasnuca en polea baja", isEnabled: true, videoUrl: "" }
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