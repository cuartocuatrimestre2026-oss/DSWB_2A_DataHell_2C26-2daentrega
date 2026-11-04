const Turno = require('../models/Turno');
const Servicio = require('../models/Servicio');
const Instructor = require('../models/Instructor');
const Sala = require('../models/Sala');
const turnosService = require('../services/turnos.service');

// Función auxiliar para cargar catálogos en un único punto.
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

        const turnosConDetalle = turnos.map(t => {
            const fecha = new Date(t.fechaHora);
            return {
                id: t.id,
                servicioNombre: serviciosMap.get(Number(t.servicioId)) || `Servicio #${t.servicioId}`,
                instructorNombre: instructoresMap.get(Number(t.instructorId)) || `Instructor #${t.instructorId}`,
                salaNombre: salasMap.get(Number(t.salaId)) || `Sala #${t.salaId}`,
                fechaFormateada: fecha.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
                horaFormateada: fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
                estado: t.estado,
                esSobreturno: t.esSobreturno
            };
        });

        res.render('mis-turnos', {
            turnos: turnosConDetalle,
            usuario: req.session.usuario,
            mensajeExito: req.query.exito || null
        });
    } catch (error) {
        next(error);
    }
};

// Formulario de reserva.
exports.mostrarFormularioReserva = async (req, res, next) => {
    try {
        const [servicios, instructores, salas] = await cargarCatalogos();
        res.render('reservar', {
            servicios,
            instructores,
            salas,
            error: null,
            usuario: req.session.usuario
        });
    } catch (error) {
        next(error);
    }
};

// Procesamiento de reserva usando el servicio de dominio unificado.
exports.procesarReserva = async (req, res, next) => {
    try {
        const clienteId = req.session.usuario.id;
        const { servicioId, instructorId, salaId, fecha, hora } = req.body;

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
                error: resultado.mensaje,
                usuario: req.session.usuario
            });
        }

        res.redirect('/mis-turnos?exito=' + encodeURIComponent('Tu turno fue reservado exitosamente.'));
    } catch (error) {
        next(error);
    }
};

// Cancela un turno por parte del paciente.
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

        turno.cancelar();
        await turno.save();
        res.redirect('/mis-turnos?exito=' + encodeURIComponent('El turno fue cancelado correctamente.'));
    } catch (error) {
        next(error);
    }
};