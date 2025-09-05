

import clientPromise from './util/mongodb.js';

const DEFAULT_EXERCISE_LIBRARY = {
    "Pecho": [
        { name: "Apertura con Banda", isEnabled: true, videoUrl: "" },
        { name: "Apertura con Mancuernas en Banco Declinado", isEnabled: true, videoUrl: "" },
        { name: "Apertura con Mancuernas en Banco Inclinado", isEnabled: true, videoUrl: "" },
        { name: "Apertura con Mancuernas en Banco Plano", isEnabled: true, videoUrl: "" },
        { name: "Apertura en Máquina", isEnabled: true, videoUrl: "" },
        { name: "Apertura en Máquina Inclinada", isEnabled: true, videoUrl: "" },
        { name: "Banco Hammer", isEnabled: true, videoUrl: "" },
        { name: "Cruce en Polea Alta", isEnabled: true, videoUrl: "" },
        { name: "Cruce en Polea Inferior", isEnabled: true, videoUrl: "" },
        { name: "Cruce en Polea Medio", isEnabled: true, videoUrl: "" },
        { name: "Empuje en Press de Banca con Mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Flexiones (Push Up)", isEnabled: true, videoUrl: "" },
        { name: "Flexiones con Agarre Cerrado", isEnabled: true, videoUrl: "" },
        { name: "Flexiones con Liberación de Manos", isEnabled: true, videoUrl: "" },
        { name: "Flexiones en Paralela", isEnabled: true, videoUrl: "" },
        { name: "Hammer Declinado", isEnabled: true, videoUrl: "" },
        { name: "Hammer Inclinado Sentado", isEnabled: true, videoUrl: "" },
        { name: "Máquina Press de Pecho", isEnabled: true, videoUrl: "" },
        { name: "Peck Deck Cerrado (Mariposa)", isEnabled: true, videoUrl: "" },
        { name: "Press con Mancuernas en Banco Declinado", isEnabled: true, videoUrl: "" },
        { name: "Press con Mancuernas en Banco Inclinado", isEnabled: true, videoUrl: "" },
        { name: "Press con Mancuernas en Banco Plano", isEnabled: true, videoUrl: "" },
        { name: "Press de Pecho Acostado en el Piso", isEnabled: true, videoUrl: "" },
        { name: "Press de Pecho Declinado", isEnabled: true, videoUrl: "" },
        { name: "Press de Pecho en Banco Plano", isEnabled: true, videoUrl: "" },
        { name: "Press de Pecho en Smith", isEnabled: true, videoUrl: "" },
        { name: "Press de Pecho Inclinado", isEnabled: true, videoUrl: "" },
        { name: "Press de Pecho Inclinado en Smith", isEnabled: true, videoUrl: "" },
        { name: "Press de Pecho Vertical", isEnabled: true, videoUrl: "" },
        { name: "Press de Pecho Vertical con Disco", isEnabled: true, videoUrl: "" },
        { name: "Press Hammer Declinado", isEnabled: true, videoUrl: "" },
        { name: "Press Hammer Inclinado", isEnabled: true, videoUrl: "" },
        { name: "Press Hammer Plano", isEnabled: true, videoUrl: "" },
        { name: "Push Up con Palmada (Clap)", isEnabled: true, videoUrl: "" },
        { name: "Push Up Diamante", isEnabled: true, videoUrl: "" },
        { name: "Push Up Lateral", isEnabled: true, videoUrl: "" }
    ],
    "Espalda": [
        { name: "Banco de Espinales", isEnabled: true, videoUrl: "" },
        { name: "Dominadas", isEnabled: true, videoUrl: "" },
        { name: "Dominadas Abiertas", isEnabled: true, videoUrl: "" },
        { name: "Dominadas Asistidas", isEnabled: true, videoUrl: "" },
        { name: "Dominadas Cerradas", isEnabled: true, videoUrl: "" },
        { name: "Dorsalera Fija Tracción Vertical", isEnabled: true, videoUrl: "" },
        { name: "Dorsalera Fija Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Dorsalera Frontal", isEnabled: true, videoUrl: "" },
        { name: "Dorsalera Tras Nuca", isEnabled: true, videoUrl: "" },
        { name: "Encogimiento de Hombros con Barra", isEnabled: true, videoUrl: "" },
        { name: "Encogimiento de Hombros con Mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Encogimiento de Hombros en Máquina", isEnabled: true, videoUrl: "" },
        { name: "Encogimiento de Hombros en Shrug", isEnabled: true, videoUrl: "" },
        { name: "Giro Oblicuo con Barra en Tierra", isEnabled: true, videoUrl: "" },
        { name: "Good Morning con Barra", isEnabled: true, videoUrl: "" },
        { name: "Jalón a la Cara Supino", isEnabled: true, videoUrl: "" },
        { name: "Jalón Abierto en Polea", isEnabled: true, videoUrl: "" },
        { name: "Jalón al Pecho (Dorsalera)", isEnabled: true, videoUrl: "" },
        { name: "Jalón Dorsal en Polea", isEnabled: true, videoUrl: "" },
        { name: "Jalón Frontal (a la cara)", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Pullover", isEnabled: true, videoUrl: "" },
        { name: "Máquina Lumbar", isEnabled: true, videoUrl: "" },
        { name: "Postura de Superman Sostenido", isEnabled: true, videoUrl: "" },
        { name: "Posteriores Pull Face", isEnabled: true, videoUrl: "" },
        { name: "Pullover en Polea Alta", isEnabled: true, videoUrl: "" },
        { name: "Remo a Caballo", isEnabled: true, videoUrl: "" },
        { name: "Remo a Caballo con Barra", isEnabled: true, videoUrl: "" },
        { name: "Remo al Mentón con Barra", isEnabled: true, videoUrl: "" },
        { name: "Remo al Mentón con Mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Remo al Mentón con Polea", isEnabled: true, videoUrl: "" },
        { name: "Remo al Mentón en Smith", isEnabled: true, videoUrl: "" },
        { name: "Remo Bajo", isEnabled: true, videoUrl: "" },
        { name: "Remo con Banda", isEnabled: true, videoUrl: "" },
        { name: "Remo con Barra", isEnabled: true, videoUrl: "" },
        { name: "Remo con Mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Remo de Pie con Polea Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Remo en T Agarre Cerrado", isEnabled: true, videoUrl: "" },
        { name: "Remo Gorilla", isEnabled: true, videoUrl: "" },
        { name: "Remo Hammer Bajo", isEnabled: true, videoUrl: "" },
        { name: "Remo Invertido en Smith", isEnabled: true, videoUrl: "" },
        { name: "Remo Landmine Agarre Cerrado", isEnabled: true, videoUrl: "" },
        { name: "Remo Prono con Mancuernas en Banco Inclinado", isEnabled: true, videoUrl: "" },
        { name: "Remo Prono con Mancuernas en Banco Plano", isEnabled: true, videoUrl: "" },
        { name: "Remo Renegado con Flexión", isEnabled: true, videoUrl: "" },
        { name: "Remo Sentado Agarre Abierto", isEnabled: true, videoUrl: "" },
        { name: "Remo Sentado con Agarre Cerrado", isEnabled: true, videoUrl: "" },
        { name: "Remo Shrug", isEnabled: true, videoUrl: "" },
        { name: "Remo T Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Remo Vertical con Barra", isEnabled: true, videoUrl: "" },
        { name: "Rotación de Cintura", isEnabled: true, videoUrl: "" },
        { name: "Simulador de Remo", isEnabled: true, videoUrl: "" }
    ],
    "Hombros": [
        { name: "Antebrazo con Polea", isEnabled: true, videoUrl: "" },
        { name: "Arnold Press Sentado", isEnabled: true, videoUrl: "" },
        { name: "Banco Press de Hombro", isEnabled: true, videoUrl: "" },
        { name: "Deltoides en Polea Cruzada", isEnabled: true, videoUrl: "" },
        { name: "Elevación Posterior con Mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Elevación Posterior con Polea Baja", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Vuelos Laterales", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Vuelos Laterales de Pie", isEnabled: true, videoUrl: "" },
        { name: "Posteriores en Máquina de Apertura", isEnabled: true, videoUrl: "" },
        { name: "Press de Hombros", isEnabled: true, videoUrl: "" },
        { name: "Press de Hombros Agarre Neutro", isEnabled: true, videoUrl: "" },
        { name: "Press de Hombros con Barra", isEnabled: true, videoUrl: "" },
        { name: "Press de Hombros con Mancuernas Arrodillado Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Press de Hombros en Smith", isEnabled: true, videoUrl: "" },
        { name: "Press de Hombros Inclinado", isEnabled: true, videoUrl: "" },
        { name: "Press de Hombros Sentado con Barra", isEnabled: true, videoUrl: "" },
        { name: "Press de Hombros Sentado con Mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Press Militar Sentado con Mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Press Trasnuca con Barra", isEnabled: true, videoUrl: "" },
        { name: "Vuelos Frontales Alternados", isEnabled: true, videoUrl: "" },
        { name: "Vuelos Frontales con Barra", isEnabled: true, videoUrl: "" },
        { name: "Vuelos Frontales con Discos", isEnabled: true, videoUrl: "" },
        { name: "Vuelos Frontales con Polea", isEnabled: true, videoUrl: "" },
        { name: "Vuelos Laterales", isEnabled: true, videoUrl: "" },
        { name: "Vuelos Laterales con Polea", isEnabled: true, videoUrl: "" },
        { name: "Vuelos Laterales Sentado", isEnabled: true, videoUrl: "" },
        { name: "Vuelos Posteriores", isEnabled: true, videoUrl: "" },
        { name: "Vuelos Posteriores en Banco Inclinado", isEnabled: true, videoUrl: "" }
    ],
    "Cuádriceps": [
        { name: "Arranque (Snatch)", isEnabled: true, videoUrl: "" },
        { name: "Búlgaras en Máquina", isEnabled: true, videoUrl: "" },
        { name: "Descenso a un Pie en Landmine", isEnabled: true, videoUrl: "" },
        { name: "Estocada con Barra", isEnabled: true, videoUrl: "" },
        { name: "Estocada con Salto", isEnabled: true, videoUrl: "" },
        { name: "Estocada en Landmine", isEnabled: true, videoUrl: "" },
        { name: "Estocada en Shrug", isEnabled: true, videoUrl: "" },
        { name: "Estocada en Shrug con Apoyo", isEnabled: true, videoUrl: "" },
        { name: "Estocada Paso Atrás con Mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Estocada Trasera con Barra", isEnabled: true, videoUrl: "" },
        { name: "Estocadas con Mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Estocadas y Salto con Apoyo", isEnabled: true, videoUrl: "" },
        { name: "Hack", isEnabled: true, videoUrl: "" },
        { name: "Hack con Apoyo en Cintura", isEnabled: true, videoUrl: "" },
        { name: "Hack Horizontal", isEnabled: true, videoUrl: "" },
        { name: "Hack Horizontal Acostado", isEnabled: true, videoUrl: "" },
        { name: "Hack Invertida (Sentadilla Hammer)", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Sumo", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Sumo Agarre Cintura", isEnabled: true, videoUrl: "" },
        { name: "Máquina Remo Circular", isEnabled: true, videoUrl: "" },
        { name: "Máquina Sentadilla Perfecta", isEnabled: true, videoUrl: "" },
        { name: "Prensa 180º", isEnabled: true, videoUrl: "" },
        { name: "Prensa 45º Fija", isEnabled: true, videoUrl: "" },
        { name: "Prensa 45º Fija Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Prensa 90º", isEnabled: true, videoUrl: "" },
        { name: "Prensa Basculante", isEnabled: true, videoUrl: "" },
        { name: "Prensa Horizontal", isEnabled: true, videoUrl: "" },
        { name: "Prensa Oscilante", isEnabled: true, videoUrl: "" },
        { name: "Rodillas Altas (High Knee)", isEnabled: true, videoUrl: "" },
        { name: "Salto al Cajón", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla (Squat)", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla a 45º con Apoyo", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla con Apoyo en Pared", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla con Barra", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla con Peso", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla con Salto (Jumping Squat)", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla Cobra", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla Cossack con Peso", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla en Smith", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla Frontal (Front Squat)", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla Frontal con Barra", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla Goblet", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla Isométrica", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla Landmine", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla Péndulo", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla Sissy", isEnabled: true, videoUrl: "" },
        { name: "Sentadilla Sumo", isEnabled: true, videoUrl: "" },
        { name: "Sillón de Cuádriceps (Extensión de Rodilla)", isEnabled: true, videoUrl: "" },
        { name: "Sillón de Cuádriceps Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Zancada con Barra", isEnabled: true, videoUrl: "" },
        { name: "Zancada Isométrica", isEnabled: true, videoUrl: "" },
        { name: "Zancada Lateral", isEnabled: true, videoUrl: "" },
        { name: "Zancada Lateral con Alcance", isEnabled: true, videoUrl: "" },
        { name: "Zancadas (Lunges)", isEnabled: true, videoUrl: "" },
        { name: "Zancadas Caminando", isEnabled: true, videoUrl: "" },
        { name: "Zancadas con Alcance", isEnabled: true, videoUrl: "" },
        { name: "Zancadas con Salto", isEnabled: true, videoUrl: "" },
        { name: "Zancadas Hacia Atrás", isEnabled: true, videoUrl: "" }
    ],
    "Femorales e Isquiotibiales": [
        { name: "Camilla de Femorales", isEnabled: true, videoUrl: "" },
        { name: "Camilla de Femorales Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Curl Femoral en Polea", isEnabled: true, videoUrl: "" },
        { name: "Femorales de Pie", isEnabled: true, videoUrl: "" },
        { name: "Femorales Sentado", isEnabled: true, videoUrl: "" },
        { name: "Máquina Curl Femoral Unilateral", isEnabled: true, videoUrl: "" }
    ],
    "Glúteos": [
        { name: "Abducción Lateral de Glúteo", isEnabled: true, videoUrl: "" },
        { name: "Abducción Lateral de Glúteo 90º", isEnabled: true, videoUrl: "" },
        { name: "Banco Hip Thrust", isEnabled: true, videoUrl: "" },
        { name: "Caminata de Peso Muerto", isEnabled: true, videoUrl: "" },
        { name: "Cuadrupedia Patada Atrás (Back Kick)", isEnabled: true, videoUrl: "" },
        { name: "Cuadrupedia Patada Lateral (Lateral Kick)", isEnabled: true, videoUrl: "" },
        { name: "Cuadrupedia Patada Lateral 90º", isEnabled: true, videoUrl: "" },
        { name: "Empuje de Caderas con Mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Extensión de Tronco", isEnabled: true, videoUrl: "" },
        { name: "Hip Thrust", isEnabled: true, videoUrl: "" },
        { name: "Hip Thrust a una Pierna", isEnabled: true, videoUrl: "" },
        { name: "Hip Thrust con Barra", isEnabled: true, videoUrl: "" },
        { name: "Hip Thrust en Máquina", isEnabled: true, videoUrl: "" },
        { name: "Hip Thrust Rana (Frog)", isEnabled: true, videoUrl: "" },
        { name: "Hip Thrust Semiflexión", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Glúteos Horizontal", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Glúteos Vertical", isEnabled: true, videoUrl: "" },
        { name: "Máquina Hip Thrust Parado", isEnabled: true, videoUrl: "" },
        { name: "Multicadera para Glúteos", isEnabled: true, videoUrl: "" },
        { name: "Patada de Glúteos con Polea", isEnabled: true, videoUrl: "" },
        { name: "Patada de Glúteos Diagonal con Polea", isEnabled: true, videoUrl: "" },
        { name: "Peso Muerto con Mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Peso Muerto en Landmine", isEnabled: true, videoUrl: "" },
        { name: "Peso Muerto en Máquina", isEnabled: true, videoUrl: "" },
        { name: "Peso Muerto Rumano", isEnabled: true, videoUrl: "" },
        { name: "Peso Muerto Rumano a una Pierna con Barra", isEnabled: true, videoUrl: "" },
        { name: "Peso Muerto Rumano a una Pierna con Mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Peso Muerto Rumano a una Pierna Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Peso Muerto Rumano con Mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Peso Muerto Sumo con Barra", isEnabled: true, videoUrl: "" },
        { name: "Puente de Glúteos con Barra", isEnabled: true, videoUrl: "" },
        { name: "Puente de Glúteos con Mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Push Press con Barra", isEnabled: true, videoUrl: "" },
        { name: "Salto al Cajón con Zancada", isEnabled: true, videoUrl: "" }
    ],
    "Gemelos y Sóleos": [
        { name: "Elevación de Talones con Mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Gemelo a 45º con Apoyo Lumbar", isEnabled: true, videoUrl: "" },
        { name: "Gemelo Sentado", isEnabled: true, videoUrl: "" },
        { name: "Gemelos a 45º en Prensa", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Flexión Tibial", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Gemelo Parado", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Gemelos", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Gemelos Sentado", isEnabled: true, videoUrl: "" }
    ],
    "Aductores y Abductores": [
        { name: "Abductores en Máquina", isEnabled: true, videoUrl: "" },
        { name: "Abductores en Polea", isEnabled: true, videoUrl: "" },
        { name: "Abductores Parado", isEnabled: true, videoUrl: "" },
        { name: "Aductores en Máquina", isEnabled: true, videoUrl: "" },
        { name: "Multicadera para Abductor", isEnabled: true, videoUrl: "" },
        { name: "Multicadera para Aductor", isEnabled: true, videoUrl: "" },
        { name: "Patada Lateral con Polea (Abductor)", isEnabled: true, videoUrl: "" }
    ],
    "Abdominales": [
        { name: "Abdominales en L", isEnabled: true, videoUrl: "" },
        { name: "Balanceo Hollow (Hollow Rock)", isEnabled: true, videoUrl: "" },
        { name: "Bicicleta (Abdominales)", isEnabled: true, videoUrl: "" },
        { name: "Columpio Ruso", isEnabled: true, videoUrl: "" },
        { name: "Crunch 90 Grados", isEnabled: true, videoUrl: "" },
        { name: "Crunch Abdominal", isEnabled: true, videoUrl: "" },
        { name: "Doble Crunch", isEnabled: true, videoUrl: "" },
        { name: "Elevación de Piernas", isEnabled: true, videoUrl: "" },
        { name: "Elevación de Piernas (Leg Raises)", isEnabled: true, videoUrl: "" },
        { name: "Elevación de Piernas con Giro", isEnabled: true, videoUrl: "" },
        { name: "Elevación de Piernas en Máquina", isEnabled: true, videoUrl: "" },
        { name: "Elevación de Piernas en Posición Supina", isEnabled: true, videoUrl: "" },
        { name: "Elevación de Rodillas en Banco Plano", isEnabled: true, videoUrl: "" },
        { name: "Elevaciones con Peso", isEnabled: true, videoUrl: "" },
        { name: "Encogimiento (Crunch)", isEnabled: true, videoUrl: "" },
        { name: "Encogimiento en Banco Declinado", isEnabled: true, videoUrl: "" },
        { name: "Encogimientos Oblicuos Cruzados", isEnabled: true, videoUrl: "" },
        { name: "Encogimientos en Polea Alta", isEnabled: true, videoUrl: "" },
        { name: "Escaladores (Mountain Climbers)", isEnabled: true, videoUrl: "" },
        { name: "Extensión de Espalda", isEnabled: true, videoUrl: "" },
        { name: "Extensión de Piernas", isEnabled: true, videoUrl: "" },
        { name: "Giro Ruso (Russian Twist)", isEnabled: true, videoUrl: "" },
        { name: "Hollow Hold Flexionado", isEnabled: true, videoUrl: "" },
        { name: "In and Out (Adentro y Afuera)", isEnabled: true, videoUrl: "" },
        { name: "Isométrico Hollow (Hollow Hold)", isEnabled: true, videoUrl: "" },
        { name: "Levantamiento de Torso (Sit-up)", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Crunch Abdominal", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Encogimiento Abdominal", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Espalda Baja", isEnabled: true, videoUrl: "" },
        { name: "Oblicuos en Colchoneta", isEnabled: true, videoUrl: "" },
        { name: "Oblicuos en Suspensión", isEnabled: true, videoUrl: "" },
        { name: "Patada Mariposa", isEnabled: true, videoUrl: "" },
        { name: "Patada Mariposa Extendida", isEnabled: true, videoUrl: "" },
        { name: "Patada Lateral Cruzada", isEnabled: true, videoUrl: "" },
        { name: "Pataleo (Flutter Kicks)", isEnabled: true, videoUrl: "" },
        { name: "Plancha (Plank)", isEnabled: true, videoUrl: "" },
        { name: "Plancha Almeja (Clamshell)", isEnabled: true, videoUrl: "" },
        { name: "Plancha con Deslizamiento", isEnabled: true, videoUrl: "" },
        { name: "Plancha con Elevación de Codo", isEnabled: true, videoUrl: "" },
        { name: "Plancha con Extensión de Codo", isEnabled: true, videoUrl: "" },
        { name: "Plancha con Giro", isEnabled: true, videoUrl: "" },
        { name: "Plancha con Levantamiento", isEnabled: true, videoUrl: "" },
        { name: "Plancha con Rotación de Caderas", isEnabled: true, videoUrl: "" },
        { name: "Plancha Lateral", isEnabled: true, videoUrl: "" },
        { name: "Plancha Lateral con Rotación", isEnabled: true, videoUrl: "" },
        { name: "Postura de la Barca", isEnabled: true, videoUrl: "" },
        { name: "Rotación de Cintura en Landmine", isEnabled: true, videoUrl: "" },
        { name: "Rotación de Torso en Máquina", isEnabled: true, videoUrl: "" },
        { name: "Rotación de Torso Sujeción Superior", isEnabled: true, videoUrl: "" },
        { name: "Rueda Abdominal", isEnabled: true, videoUrl: "" },
        { name: "Sit-Up", isEnabled: true, videoUrl: "" },
        { name: "Toque de Hombros en Plancha", isEnabled: true, videoUrl: "" },
        { name: "Toque de Pies", isEnabled: true, videoUrl: "" },
        { name: "Toque de Talón", isEnabled: true, videoUrl: "" },
        { name: "Toque de Talones Lateral", isEnabled: true, videoUrl: "" },
        { name: "V-Up con Pierna Alternada", isEnabled: true, videoUrl: "" }
    ],
    "Brazos (Bíceps y Tríceps)": [
        { name: "Banco Scott con Disco", isEnabled: true, videoUrl: "" },
        { name: "Bíceps con Barra y Banda", isEnabled: true, videoUrl: "" },
        { name: "Curl 21", isEnabled: true, videoUrl: "" },
        { name: "Curl Alterno", isEnabled: true, videoUrl: "" },
        { name: "Curl Alterno en Banca Inclinada", isEnabled: true, videoUrl: "" },
        { name: "Curl Concentrado", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps con Barra", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps con Barra en Banco Scott", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps con Barra Romana", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps con Barra Z", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps con Mancuerna Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps con Polea Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps Concentrado Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps Convergente", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps en Banco Scott", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps en Máquina Scott", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps en Polea", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps en Polea Invertido", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps en Scott con Polea", isEnabled: true, videoUrl: "" },
        { name: "Curl de Bíceps Sentado Alternado", isEnabled: true, videoUrl: "" },
        { name: "Curl Martillo con Mancuerna", isEnabled: true, videoUrl: "" },
        { name: "Extensión de Codo en Polea Alta con Apoyo", isEnabled: true, videoUrl: "" },
        { name: "Extensión de Codo en Polea Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Extensión de Tríceps con Mancuernas", isEnabled: true, videoUrl: "" },
        { name: "Extensión de Tríceps en Polea Alta Unilateral", isEnabled: true, videoUrl: "" },
        { name: "Fondo en Banco", isEnabled: true, videoUrl: "" },
        { name: "Fondo en Paralelas (Dips)", isEnabled: true, videoUrl: "" },
        { name: "Fondo de Tríceps Sentado", isEnabled: true, videoUrl: "" },
        { name: "Jalón para Bíceps", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Extensión de Brazos", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Extensión de Tríceps", isEnabled: true, videoUrl: "" },
        { name: "Máquina de Press Francés", isEnabled: true, videoUrl: "" },
        { name: "Patada de Tríceps en Polea", isEnabled: true, videoUrl: "" },
        { name: "Press Francés", isEnabled: true, videoUrl: "" },
        { name: "Press Francés Sentado", isEnabled: true, videoUrl: "" },
        { name: "Press Francés Sentado a una Mano", isEnabled: true, videoUrl: "" },
        { name: "Tríceps Trasnuca en Polea", isEnabled: true, videoUrl: "" },
        { name: "Tríceps Trasnuca en Polea Baja", isEnabled: true, videoUrl: "" }
    ],
    "Cardio y Cuerpo Completo": [
        { name: "Burpee", isEnabled: true, videoUrl: "" },
        { name: "Burpee con Salto al Cajón", isEnabled: true, videoUrl: "" },
        { name: "Paso Lateral sobre Cajón", isEnabled: true, videoUrl: "" },
        { name: "Salto al Cajón con Descenso", isEnabled: true, videoUrl: "" },
        { name: "Sprawl", isEnabled: true, videoUrl: "" },
        { name: "Step-Up con Elevación de Rodilla", isEnabled: true, videoUrl: "" },
        { name: "Step-Ups", isEnabled: true, videoUrl: "" },
        { name: "Subida al Cajón con Peso", isEnabled: true, videoUrl: "" },
        { name: "Walk Out", isEnabled: true, videoUrl: "" }
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