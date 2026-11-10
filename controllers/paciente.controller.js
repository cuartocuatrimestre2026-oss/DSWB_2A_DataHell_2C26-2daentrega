const Turno = require('../models/Turno');
const Servicio = require('../models/Servicio');
const Instructor = require('../models/Instructor');
const Sala = require('../models/Sala');
const turnosService = require('../services/turnos.service');

// Franjas horarias homologadas del centro (bloques cerrados de 60 min).
const FRANJAS_HORARIAS = [
    '08:00', '09:00', '10:00', '11:00',
    '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00'
];

async function cargarCatalogos() {
    return await Promise.all([
        Servicio.find().sort({ id: 1 }),
        Instructor.find().sort({ id: 1 }),
        Sala.find().sort({ id: 1 })
    ]);
}

// Lista los turnos del paciente logueado.
exports.verMisTurnos = async (req, res, next) => {
    try {
        const clienteId = req.session.usuario.id;
        const [turnos, servicios, instructores, salas] = await Promise.all([
            Turno.find({ clienteId }).sort({ fechaHora: 1 }),
            Servicio.find(),
            Instructor.find(),
            Sala.find()
        ]);

        const serviciosMap = new Map(servicios.map(s => [Number(s.id), s.nombre]));
        const instructoresMap = new Map(instructores.map(i => [Number(i.id), `${i.nombre} ${i.apellido}`]));
        const salasMap = new Map(salas.map(s => [Number(s.id), s.nombre]));

        const ahora = Date.now();
        const turnosConDetalle = turnos.map(t => {
            const fecha = new Date(t.fechaHora);
            const tiempoRestanteHoras = (fecha.getTime() - ahora) / (1000 * 60 * 60);

            return {
                id: t.id,
                servicioNombre: serviciosMap.get(Number(t.servicioId)) || `Servicio #${t.servicioId}`,
                instructorNombre: instructoresMap.get(Number(t.instructorId)) || `Instructor #${t.instructorId}`,
                salaNombre: salasMap.get(Number(t.salaId)) || `Sala #${t.salaId}`,
                fechaFormateada: fecha.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
                horaFormateada: fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
                estado: t.estado,
                esSobreturno: t.esSobreturno,
                permiteCancelar: t.estado === 'reservado' && tiempoRestanteHoras >= 4
            };
        });

        res.render('mis-turnos', {
            turnos: turnosConDetalle,
            usuario: req.session.usuario,
            mensajeExito: req.query.exito || null,
            mensajeError: req.query.error || null
        });
    } catch (error) {
        next(error);
    }
};

// Formulario de reserva con horarios prefijados.
exports.mostrarFormularioReserva = async (req, res, next) => {
    try {
        const [servicios, instructores, salas] = await cargarCatalogos();
        res.render('reservar', {
            servicios,
            instructores,
            salas,
            franjasHorarias: FRANJAS_HORARIAS,
            error: null,
            usuario: req.session.usuario
        });
    } catch (error) {
        next(error);
    }
};

// Procesamiento de reserva validando grilla y fecha futura.
exports.procesarReserva = async (req, res, next) => {
    try {
        const clienteId = req.session.usuario.id;
        const { servicioId, instructorId, salaId, fecha, hora } = req.body;

        // Validación de campos obligatorios.
        if (!servicioId || !instructorId || !salaId || !fecha || !hora) {
            const [servicios, instructores, salas] = await cargarCatalogos();
            return res.render('reservar', {
                servicios,
                instructores,
                salas,
                franjasHorarias: FRANJAS_HORARIAS,
                error: 'Por favor complete todos los campos requeridos para la reserva.',
                usuario: req.session.usuario
            });
        }

        // Validación de franja horaria prefijada de Espacio Sideral.
        if (!FRANJAS_HORARIAS.includes(hora)) {
            const [servicios, instructores, salas] = await cargarCatalogos();
            return res.render('reservar', {
                servicios,
                instructores,
                salas,
                franjasHorarias: FRANJAS_HORARIAS,
                error: `El horario ${hora} no corresponde a un bloque de clase habilitado en la grilla. Seleccione un horario oficial.`,
                usuario: req.session.usuario
            });
        }

        // Validación de fecha y hora futura.
        const fechaHoraLocal = turnosService.parsearFechaHoraLocal(fecha, hora);
        if (!fechaHoraLocal || isNaN(fechaHoraLocal.getTime())) {
            const [servicios, instructores, salas] = await cargarCatalogos();
            return res.render('reservar', {
                servicios,
                instructores,
                salas,
                franjasHorarias: FRANJAS_HORARIAS,
                error: 'La fecha u hora seleccionada no es válida.',
                usuario: req.session.usuario
            });
        }

        if (fechaHoraLocal.getTime() <= Date.now()) {
            const [servicios, instructores, salas] = await cargarCatalogos();
            return res.render('reservar', {
                servicios,
                instructores,
                salas,
                franjasHorarias: FRANJAS_HORARIAS,
                error: 'No es posible reservar clases en fechas u horarios pasados.',
                usuario: req.session.usuario
            });
        }

        // Procesar reserva a través de la capa de dominio.
        const resultado = await turnosService.crearTurnoRegularDominio({
            clienteId,
            servicioId,
            instructorId,
            salaId,
            fecha,
            hora
        });

        if (resultado.error) {
            const [servicios, instructores, salas] = await cargarCatalogos();
            return res.render('reservar', {
                servicios,
                instructores,
                salas,
                franjasHorarias: FRANJAS_HORARIAS,
                error: resultado.mensaje,
                usuario: req.session.usuario
            });
        }

        res.redirect('/mis-turnos?exito=' + encodeURIComponent('Tu turno fue reservado exitosamente.'));
    } catch (error) {
        next(error);
    }
};

// Cancelación autónoma con ventana mínima de 4 horas.
exports.cancelarMiTurno = async (req, res, next) => {
    try {
        const clienteId = req.session.usuario.id;
        const turnoId = req.params.id;

        const turno = await Turno.findOne({
            id: Number(turnoId),
            clienteId: Number(clienteId)
        });

        if (!turno) {
            return res.status(404).render('error', {
                status: 404,
                mensaje: 'Turno no encontrado',
                detalle: 'El turno que intentás cancelar no existe o no corresponde a tu usuario.'
            });
        }

        if (turno.estado === 'cancelado') {
            return res.redirect('/mis-turnos?error=' + encodeURIComponent('El turno ya se encuentra cancelado.'));
        }

        // Cancelación con al menos 4 horas de anticipación.
        const horasFaltantes = (new Date(turno.fechaHora).getTime() - Date.now()) / (1000 * 60 * 60);
        if (horasFaltantes < 4) {
            return res.redirect('/mis-turnos?error=' + encodeURIComponent('Las cancelaciones autónomas exigen al menos 4 horas de anticipación. Por favor, comunicate con recepción.'));
        }

        turno.cancelar();
        await turno.save();

        res.redirect('/mis-turnos?exito=' + encodeURIComponent('El turno fue cancelado correctamente.'));
    } catch (error) {
        next(error);
    }
};