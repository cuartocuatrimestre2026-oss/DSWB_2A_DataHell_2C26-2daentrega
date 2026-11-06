const Servicio = require('../models/Servicio');
const Sala = require('../models/Sala');
const Instructor = require('../models/Instructor');

/**
 * Servicio de Asistente Inteligente para Espacio Sideral S.A.S.
 * Procesa consultas de lenguaje natural, búsqueda de disciplinas y reglas de negocio.
 */
async function procesarConsulta(mensajeUsuario, contextoUsuario = null) {
    if (!mensajeUsuario || typeof mensajeUsuario !== 'string') {
        return 'Hola, ¿en qué puedo ayudarte hoy con tus actividades en Espacio Sideral?';
    }

    const texto = mensajeUsuario.toLowerCase().trim();

    // Consultas sobre Pilates Reformer y Camillas.
    if (texto.includes('reformer') || texto.includes('camilla') || texto.includes('pilates')) {
        return 'En Pilates Reformer contamos con un Salón exclusivo con 10 camillas fijas. Por estricta seguridad biomecánica y física, el sobreturno en esta disciplina es CERO (0). Se requiere además contar con Apto Médico vigente.';
    }

    // Consultas sobre Apto Médico / Certificado de Salud.
    if (texto.includes('apto') || texto.includes('medico') || texto.includes('certificado') || texto.includes('vencimiento')) {
        return 'El Certificado de Aptitud Médica tiene una vigencia legal de 365 días corridos. Al presentarlo en recepción, la fecha de emisión no debe superar los 7 días de antigüedad. El centro cuenta con una tolerancia de 15 días de gracia para su renovación cordial.';
    }

    // Consultas sobre Sobreturnos y Capacidad.
    if (texto.includes('sobreturno') || texto.includes('cupo') || texto.includes('lleno') || texto.includes('aforo')) {
        return 'Los sobreturnos son de gestión exclusiva en recepción cuando el aforo regular está colmado. Se admite hasta un 15% truncado de la capacidad de la sala (máx. 2 en SUM y 3 en Cardio) con justificación obligatoria. En Pilates Reformer no se admiten sobreturnos.';
    }

    // Búsqueda asistida en Base de Datos: Disciplinas y Actividades.
    if (texto.includes('disciplina') || texto.includes('clase') || texto.includes('actividad') || texto.includes('servicio') || texto.includes('yoga') || texto.includes('funcional')) {
        try {
            const servicios = await Servicio.find().sort({ id: 1 });
            const listado = servicios.map(s => `• ${s.nombre} (${s.modalidad}, ${s.duracionMinutos} min)`).join('\n');
            return `Nuestras actividades disponibles en Espacio Sideral son:\n${listado}\n\nPodés reservar tu lugar directamente desde la sección "Reservar Clase".`;
        } catch (err) {
            return 'Ofrecemos Pilates Reformer, Hatha Yoga, Entrenamiento Funcional y terapias como Registros Akáshicos.';
        }
    }

    // Búsqueda de Salas y Espacios.
    if (texto.includes('sala') || texto.includes('salon') || texto.includes('sum') || texto.includes('gabinete')) {
        try {
            const salas = await Sala.find().sort({ id: 1 });
            const listado = salas.map(s => `• ${s.nombre} (Capacidad: ${s.capacidadNormal} personas)`).join('\n');
            return `Nuestros espacios físicos homologados son:\n${listado}`;
        } catch (err) {
            return 'Disponemos del Salón Reformer (10 camillas), Salón Cardio (20 pers), SUM 1 y 2 (15 pers) y Gabinetes Individuales.';
        }
    }

    // Consultas sobre Horarios y Apertura de Agenda.
    if (texto.includes('horario') || texto.includes('abren') || texto.includes('semana') || texto.includes('domingo')) {
        return 'Espacio Sideral atiende de lunes a sábados en 3 turnos (07:00 a 22:30 hs). La agenda de reservas para la semana siguiente se habilita todos los domingos a las 00:00 hs.';
    }

    // Respuesta orientativa por defecto.
    const nombre = (contextoUsuario && contextoUsuario.nombre) ? `${contextoUsuario.nombre}` : 'socio';
    return `Hola ${nombre}, soy el Asistente Virtual de TurnoFlex. Puedo orientarte sobre nuestras disciplinas (Pilates, Yoga, Funcional), capacidades de salas, estado de tu Apto Médico o ayudarte a navegar tus reservas. ¿Qué te gustaría consultar?`;
}

module.exports = { procesarConsulta };