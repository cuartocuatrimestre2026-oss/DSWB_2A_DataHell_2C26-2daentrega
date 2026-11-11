const Servicio = require('../models/Servicio');
const Sala = require('../models/Sala');

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

// Consulta fallback a una API externa.
async function consultarApiExterna(mensaje, rolUsuario) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY_IA;
    if (!apiKey) return null;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const promptContexto = `Sos el Asistente Virtual oficial de 'Espacio Sideral', un centro de bienestar integral y disciplinas corporales. 
El usuario tiene rol '${rolUsuario}'. Responde de forma cordial, concisa (máximo 3 párrafos cortos) y orientada al bienestar y las actividades del centro.
Pregunta del usuario: "${mensaje}"`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: promptContexto }] }]
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        const textoRespuesta = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return textoRespuesta ? textoRespuesta.trim() : null;
    } catch (err) {
        return null;
    }
}

async function procesarMensaje(mensaje, usuario = null) {
    try {
        const query = normalizarTexto(mensaje);
        const esAdmin = usuario && usuario.rol === 'empleado';
        const nombreUsuario = usuario ? usuario.nombre : 'practicante';

        // Saludos y Menú Inicial de Ayuda.
        if (query.match(/^(hola|buen|buenas|hello|hi|inicio|empezar|ayuda|opciones|menu)/)) {
            if (esAdmin) {
                return `¡Hola ${nombreUsuario} (Personal de Recepción)! 👋 Como copiloto de mostrador podés consultarme sobre:\n` +
                       `• 'Salas' o 'Aforos': capacidades nominales y topes de salas.\n` +
                       `• 'Sobreturnos': normativa del 15% truncado y regla 0% en camillas.\n` +
                       `• 'Apto Médico': plazos legales de 365 días y gracia de 15 días.\n` +
                       `• 'Disciplinas': catálogo activo en base de datos.`;
            } else {
                return `¡Hola ${nombreUsuario}! 👋 Te doy la bienvenida a Espacio Sideral. ¿En qué te puedo asesorar hoy? Podés consultarme sobre:\n` +
                       `1. 'Disciplinas' o 'Clases': para conocer las actividades y modalidades.\n` +
                       `2. 'Salas': para conocer nuestros espacios físicos.\n` +
                       `3. 'Apto Médico': requisitos de salud y vigencias para reservar.\n` +
                       `4. 'Horarios': franjas de clases y políticas de cancelación.`;
            }
        }

        // Consulta a la Base de Datos: Disciplinas y Actividades.
        if (query.includes('disciplina') || query.includes('clase') || query.includes('servicio') || query.includes('actividad') || query.includes('yoga') || query.includes('pilates') || query.includes('funcional')) {
            const servicios = await Servicio.find().sort({ id: 1 });
            if (servicios && servicios.length > 0) {
                const lista = servicios.map(s => `• ${s.nombre} (${s.modalidad}): bloque de ${s.duracionMinutos} min en Sala #${s.salaRequerida}`).join('\n');
                return `En Espacio Sideral disponemos de las siguientes disciplinas activas:\n${lista}\n\nRecordá que para agendar cualquiera de ellas debés contar con tu Apto Médico al día.`;
            }
            return "Actualmente disponemos de Pilates Reformer, Hatha Yoga, Entrenamiento Funcional y Registros Akáshicos.";
        }

        // Consulta en caliente a Base de Datos: Salas, Aforos y Sobretornos Permitidos.
        if (query.includes('sala') || query.includes('aforo') || query.includes('capacidad') || query.includes('espacio') || query.includes('salon')) {
            const salas = await Sala.find().sort({ id: 1 });
            if (salas && salas.length > 0) {
                const lista = salas.map(s => {
                    const st = s.calcularSobreturnosPermitidos();
                    const stTxt = st === 0 ? 'Sobreturno CERO (rígido)' : `admite hasta +${st} sobreturno(s)`;
                    return `• Sala #${s.id} - ${s.nombre}: capacidad estándar de ${s.capacidadNormal} personas (${stTxt}).`;
                }).join('\n');
                return `Infraestructura física homologada de Espacio Sideral (350 m²):\n${lista}`;
            }
            return "Contamos con el Salón Pilates Reformer (10 camillas fijas), Salón Funcional (20 personas), SUM 1 y SUM 2 (15 personas) y Gabinetes Individuales.";
        }

        // Reglas de Apto Médico y Certificado de Salud.
        if (query.includes('apto') || query.includes('medico') || query.includes('certificado') || query.includes('salud') || query.includes('venc') || query.includes('gracia')) {
            return `📋 Normativa Sanitaria de Apto Médico (RF-02):\n` +
                   `• Vigencia: El certificado tiene una validez legal de 365 días corridos.\n` +
                   `• Período de Gracia: Otorgamos 15 días cordiales para tramitar la renovación antes de bloquear el sistema de reservas.\n` +
                   `• Trámite: Se presenta el certificado físico en recepción (con no más de 7 días de emitido) para que el personal lo cargue y habilite tu ficha en el momento.`;
        }

        // Políticas de Horarios, Franjas Fijas y Cancelaciones.
        if (query.includes('horario') || query.includes('franja') || query.includes('grilla') || query.includes('cancelar') || query.includes('cancelacion')) {
            return `⏰ Horarios y Cancelación de Clases:\n` +
                   `• Grilla Oficial: Las clases se dictan en bloques cerrados de 60 minutos entre las 08:00 y las 20:00 hs.\n` +
                   `• Cancelación Autónoma: Podés cancelar tu clase desde la sección 'Mis Turnos' siempre que falten al menos 4 horas para el inicio. Dentro de las 4 horas previas, la cancelación queda bloqueada por sistema y debés llamar a recepción.`;
        }

        // Sobreturnos y Políticas de Sobrecupo.
        if (query.includes('sobreturno') || query.includes('sobrecupo') || query.includes('excepcion')) {
            return `⚠️ Regla Gerencial de Sobreturnos (RN05 / RN06):\n` +
                   `• Se autorizan únicamente desde la consola de recepción ante clases regulares colmadas, con justificación obligatoria (mínimo 5 caracteres).\n` +
                   `• Tope matemático: Máximo 15% con truncamiento entero.\n` +
                   `• En Pilates Reformer el sobreturno es algorítmicamente CERO por motivos de seguridad física (no hay camillas libres).`;
        }

        // Respuesta de cortesía ante despedidas.
        if (query.match(/^(gracias|muchas gracias|chau|adios|listo)/)) {
            return `¡Un placer ayudarte, ${nombreUsuario}! Que tengas un excelente día de bienestar en Espacio Sideral. ✨`;
        }

        // Consulta a API externa si la pregunta no coincidió con las reglas duras.
        const respuestaExterna = await consultarApiExterna(mensaje, usuario ? usuario.rol : 'visitante');
        if (respuestaExterna) {
            return respuestaExterna;
        }

        // Mensaje por defecto orientador.
        return `Entendido. No encontré una coincidencia exacta para "${mensaje}". Podés probar escribiendo:\n` +
               `• 'disciplinas' para ver la oferta de actividades.\n` +
               `• 'salas' para consultar los salones y sus cupos.\n` +
               `• 'apto medico' para informarte sobre el estado de salud requerido.\n` +
               `• 'horarios' para conocer la grilla y política de cancelación de 4 horas.`;
    } catch (error) {
        console.error("Error en asistenteIA.service:", error);
        return "El asistente se encuentra temporalmente en mantenimiento local. Por favor consulte en el mostrador del centro.";
    }
}

// Exportación dual para compatibilidad total con cualquier módulo que requiera el servicio.
module.exports = {
    procesarMensaje,
    procesarConsulta: procesarMensaje
};