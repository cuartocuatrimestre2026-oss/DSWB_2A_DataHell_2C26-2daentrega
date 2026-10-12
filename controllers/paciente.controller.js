const Turno = require('../models/Turno');
const Servicio = require('../models/Servicio');
const Instructor = require('../models/Instructor');
const Sala = require('../models/Sala');

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
                fechaFormateada: fecha.toLocaleDateString('es-AR'),
                horaFormateada: fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
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

// Formulario de reserva autónoma.
exports.mostrarFormularioReserva = async (req, res, next) => {
    try {
        const [servicios, instructores, salas] = await Promise.all([
            Servicio.find(),
            Instructor.find(),
            Sala.find()
        ]);
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

// Procesamiento de reserva autónoma.
exports.procesarReserva = async (req, res, next) => {
    try {
        const clienteId = req.session.usuario.id;
        const { servicioId, instructorId, salaId, fecha, hora } = req.body;

        if (!servicioId || !instructorId || !salaId || !fecha || !hora) {
            const [servicios, instructores, salas] = await Promise.all([
                Servicio.find(),
                Instructor.find(),
                Sala.find()
            ]);
            return res.render('reservar', {
                servicios,
                instructores,
                salas,
                error: 'Por favor complete todos los campos requeridos para la reserva.',
                usuario: req.session.usuario
            });
        }

        const fechaHoraObj = new Date(`${fecha}T${hora}:00`);
        if (isNaN(fechaHoraObj.getTime())) {
            const [servicios, instructores, salas] = await Promise.all([
                Servicio.find(),
                Instructor.find(),
                Sala.find()
            ]);
            return res.render('reservar', {
                servicios,
                instructores,
                salas,
                error: 'La fecha y hora seleccionada no es válida.',
                usuario: req.session.usuario
            });
        }

        const sala = await Sala.findOne({ id: Number(salaId) });
        if (!sala) {
            const [servicios, instructores, salas] = await Promise.all([
                Servicio.find(),
                Instructor.find(),
                Sala.find()
            ]);
            return res.render('reservar', {
                servicios,
                instructores,
                salas,
                error: 'La sala seleccionada no existe.',
                usuario: req.session.usuario
            });
        }

        // Valida que el paciente no tenga ya un turno reservado en ese mismo horario.
        const turnoExistente = await Turno.findOne({
            clienteId: Number(clienteId),
            fechaHora: fechaHoraObj,
            estado: 'reservado'
        });
        if (turnoExistente) {
            const [servicios, instructores, salas] = await Promise.all([
                Servicio.find(),
                Instructor.find(),
                Sala.find()
            ]);
            return res.render('reservar', {
                servicios,
                instructores,
                salas,
                error: 'Ya tenés un turno reservado para esa misma fecha y horario.',
                usuario: req.session.usuario
            });
        }

        // Valida la disponibilidad del instructor.
        const instructorOcupado = await Turno.findOne({
            instructorId: Number(instructorId),
            fechaHora: fechaHoraObj,
            estado: 'reservado'
        });
        if (instructorOcupado) {
            const [servicios, instructores, salas] = await Promise.all([
                Servicio.find(),
                Instructor.find(),
                Sala.find()
            ]);
            return res.render('reservar', {
                servicios,
                instructores,
                salas,
                error: 'El instructor seleccionado ya cuenta con otra clase en ese horario.',
                usuario: req.session.usuario
            });
        }

        // Valida el aforo regular de sala.
        const turnosRegulares = await Turno.countDocuments({
            salaId: Number(salaId),
            fechaHora: fechaHoraObj,
            estado: 'reservado',
            esSobreturno: false
        });
        if (turnosRegulares >= sala.capacidadNormal) {
            const [servicios, instructores, salas] = await Promise.all([
                Servicio.find(),
                Instructor.find(),
                Sala.find()
            ]);
            return res.render('reservar', {
                servicios,
                instructores,
                salas,
                error: `El aforo regular de la sala está completo (${sala.capacidadNormal} cupos). Solo recepción puede autorizar sobreturnos justificados.`,
                usuario: req.session.usuario
            });
        }

        // Crea un nuevo turno.
        const ultimoTurno = await Turno.findOne().sort({ id: -1 });
        const nuevoId = (ultimoTurno && ultimoTurno.id) ? ultimoTurno.id + 1 : 1;

        await Turno.create({
            id: nuevoId,
            clienteId: Number(clienteId),
            servicioId: Number(servicioId),
            instructorId: Number(instructorId),
            salaId: Number(salaId),
            fechaHora: fechaHoraObj,
            estado: 'reservado',
            esSobreturno: false,
            motivoSobreturno: null
        });

        res.redirect('/mis-turnos?exito=Tu turno fue reservado exitosamente.');
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
        res.redirect('/mis-turnos?exito=El turno fue cancelado correctamente.');
    } catch (error) {
        next(error);
    }
};