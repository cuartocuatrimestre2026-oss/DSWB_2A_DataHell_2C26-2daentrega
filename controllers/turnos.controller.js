const Turno = require('../models/Turno');
const Cliente = require('../models/Cliente');
const Servicio = require('../models/Servicio');
const Instructor = require('../models/Instructor');
const Sala = require('../models/Sala');
const turnosService = require('../services/turnos.service');
const { FRANJAS_HORARIAS } = require('./paciente.controller');

// Listado completo de turnos.
exports.obtenerTodos = async (req, res, next) => {
    try {
        // Antes de consultar, los turnos vencidos sin presente pasan a 'ausente'.
        await turnosService.actualizarAusentes();
        const turnos = await Turno.find().sort({ fechaHora: 1 });
        res.status(200).json(turnos);
    } catch (error) {
        next(error);
    }
};

// Turno por ID.
exports.obtenerPorId = async (req, res, next) => {
    try {
        // Antes de consultar, los turnos vencidos sin presente pasan a 'ausente'.
        await turnosService.actualizarAusentes();
        const turno = await Turno.findOne({ id: Number(req.params.id) });
        if (!turno) {
            return res.status(404).json({ error: "No encontrado", detalle: "El turno solicitado no existe." });
        }
        res.status(200).json(turno);
    } catch (error) {
        next(error);
    }
};

// Turnos por ID de Cliente.
exports.obtenerPorCliente = async (req, res, next) => {
    try {
        // Antes de consultar, los turnos vencidos sin presente pasan a 'ausente'.
        await turnosService.actualizarAusentes();
        const turnosCliente = await Turno.find({ clienteId: Number(req.params.id) }).sort({ fechaHora: 1 });
        res.status(200).json(turnosCliente);
    } catch (error) {
        next(error);
    }
};

// Turnos por ID de Instructor.
exports.obtenerPorInstructor = async (req, res, next) => {
    try {
        // Antes de consultar, los turnos vencidos sin presente pasan a 'ausente'.
        await turnosService.actualizarAusentes();
        const turnosInstructor = await Turno.find({ instructorId: Number(req.params.id) }).sort({ fechaHora: 1 });
        res.status(200).json(turnosInstructor);
    } catch (error) {
        next(error);
    }
};

// Alta de turno regular vía API.
exports.crearRegular = async (req, res, next) => {
    try {
        const resultado = await turnosService.crearTurnoRegularDominio({
            clienteId: req.body.clienteId,
            servicioId: req.body.servicioId,
            instructorId: req.body.instructorId,
            salaId: req.body.salaId,
            fechaHoraRaw: req.body.fechaHora
        });

        if (resultado.error) {
            return res.status(resultado.status).json({
                error: resultado.status === 409 ? "Conflicto" : "Validación fallida",
                detalle: resultado.mensaje
            });
        }

        res.status(201).json({ mensaje: "Turno regular registrado exitosamente", turno: resultado.turno });
    } catch (error) {
        next(error);
    }
};

// Alta de sobreturno vía API.
exports.crearSobreturno = async (req, res, next) => {
    try {
        const resultado = await turnosService.crearSobreturnoDominio({
            clienteId: req.body.clienteId,
            servicioId: req.body.servicioId,
            instructorId: req.body.instructorId,
            salaId: req.body.salaId,
            fechaHoraRaw: req.body.fechaHora,
            motivo: req.body.motivo
        });

        if (resultado.error) {
            return res.status(resultado.status).json({
                error: resultado.status === 409 ? "Límite excedido" : "Validación fallida",
                detalle: resultado.mensaje
            });
        }

        res.status(201).json({ mensaje: "Sobreturno autorizado y registrado exitosamente", turno: resultado.turno });
    } catch (error) {
        next(error);
    }
};

// Cancela un Turno vía API.
exports.cancelar = async (req, res, next) => {
    try {
        const turno = await Turno.findOne({ id: Number(req.params.id) });
        if (!turno) {
            return res.status(404).json({ error: "No encontrado", detalle: "El turno a cancelar no existe." });
        }
        if (turno.estado === 'cancelado') {
            return res.status(400).json({ error: "Operación inválida", detalle: "El turno ya se encuentra cancelado." });
        }
        turno.cancelar();
        await turno.save();
        res.status(200).json({ mensaje: "Turno cancelado exitosamente", turno });
    } catch (error) {
        next(error);
    }
};

// Transición y actualización de estados del turno.
exports.actualizarEstado = async (req, res, next) => {
    try {
        const { estado, salaId } = req.body;
        const turno = await Turno.findOne({ id: Number(req.params.id) });
        if (!turno) {
            return res.status(404).json({ error: "No encontrado", detalle: "El turno solicitado no existe." });
        }

        // Si se intenta cambiar de sala, se valida la capacidad.
        if (salaId && Number(salaId) !== turno.salaId) {
            const Sala = require('../models/Sala');
            const nuevaSala = await Sala.findOne({ id: Number(salaId) });
            if (!nuevaSala) return res.status(404).json({ error: "Sala no encontrada" });

            const ocupacion = await Turno.countDocuments({
                salaId: Number(salaId),
                fechaHora: turno.fechaHora,
                estado: 'reservado'
            });

            if (ocupacion >= nuevaSala.capacidadNormal) {
                return res.status(409).json({
                    error: "Capacidad completa",
                    detalle: "La sala de destino no dispone de vacantes libres para este horario."
                });
            }
            turno.salaId = Number(salaId);
        }

        // Verifica el estado previo antes de atender.
        if (estado === "atendido") {
            if (turno.estado === "cancelado") {
                return res.status(400).json({ error: "Operación inválida", detalle: "No se puede marcar como atendido un turno previamente cancelado." });
            }
            turno.atender();
        } else if (estado === "cancelado") {
            turno.cancelar();
        } else if (estado === "reservado") {
            turno.estado = "reservado";
        } else if (estado) {
            return res.status(400).json({
                error: "Estado inválido",
                detalle: "Los estados válidos son: 'reservado', 'atendido', 'cancelado'."
            });
        }

        if (req.body.clienteId) turno.clienteId = Number(req.body.clienteId);
        if (req.body.servicioId) turno.servicioId = Number(req.body.servicioId);
        if (req.body.instructorId) turno.instructorId = Number(req.body.instructorId);
        if (req.body.fechaHora) turno.fechaHora = new Date(req.body.fechaHora);

        await turno.save();
        res.status(200).json({ mensaje: "Turno actualizado correctamente", turno });
    } catch (error) {
        next(error);
    }
};

// Acciones específicas para interfaz web de recepción.
exports.marcarAtendidoWeb = async (req, res, next) => {
    try {
        const turno = await Turno.findOne({ id: Number(req.params.id) });
        if (turno && turno.estado === 'reservado') {
            turno.atender();
            await turno.save();
        }
        res.redirect('/vista/turnos');
    } catch (error) {
        next(error);
    }
};

exports.cancelarWeb = async (req, res, next) => {
    try {
        const turno = await Turno.findOne({ id: Number(req.params.id) });
        if (turno) {
            turno.cancelar();
            await turno.save();
        }
        res.redirect('/vista/turnos');
    } catch (error) {
        next(error);
    }
};

// Alta de sobreturno desde el formulario web.
exports.crearSobreturnoWeb = async (req, res, next) => {
    try {
        const resultado = await turnosService.crearSobreturnoDominio({
            clienteId: req.body.clienteId,
            servicioId: req.body.servicioId,
            instructorId: req.body.instructorId,
            salaId: req.body.salaId,
            fechaHoraRaw: req.body.fechaHora,
            motivo: req.body.motivo
        });

        if (resultado.error) {
            return res.redirect('/vista/turnos?errorSobreturno=' + encodeURIComponent(resultado.mensaje));
        }

        res.redirect('/vista/turnos');
    } catch (error) {
        next(error);
    }
};

// Formulario de reasignación de un turno ausente - consola de recepción.
exports.mostrarReasignarWeb = async (req, res, next) => {
    try {
        const turno = await Turno.findOne({ id: Number(req.params.id) });
        if (!turno || turno.estado !== 'ausente') {
            return res.redirect('/vista/turnos');
        }
        const [cliente, servicio, sala, instructores] = await Promise.all([
            Cliente.findOne({ id: turno.clienteId }),
            Servicio.findOne({ id: turno.servicioId }),
            Sala.findOne({ id: turno.salaId }),
            Instructor.find().sort({ apellido: 1, nombre: 1 })
        ]);
        res.render('reasignar-turno', {
            turno,
            cliente,
            servicio,
            sala,
            instructores,
            franjasHorarias: FRANJAS_HORARIAS,
            errorReasignacion: req.query.errorReasignacion || null
        });
    } catch (error) {
        next(error);
    }
};

// Procesa la reasignación, genera el turno nuevo y marca el original como reasignado.
exports.reasignarWeb = async (req, res, next) => {
    try {
        const { instructorId, fecha, hora, motivo } = req.body;
        if (!instructorId || !fecha || !hora) {
            return res.redirect(`/vista/turnos/reasignar/${req.params.id}?errorReasignacion=` + encodeURIComponent('Complete el docente, la fecha y el horario.'));
        }
        if (!FRANJAS_HORARIAS.includes(hora)) {
            return res.redirect(`/vista/turnos/reasignar/${req.params.id}?errorReasignacion=` + encodeURIComponent('El horario seleccionado no corresponde a un bloque de la grilla oficial.'));
        }

        const resultado = await turnosService.reasignarTurnoDominio({
            turnoId: req.params.id,
            instructorId,
            fecha,
            hora,
            motivo
        });

        if (resultado.error) {
            return res.redirect(`/vista/turnos/reasignar/${req.params.id}?errorReasignacion=` + encodeURIComponent(resultado.mensaje));
        }

        res.redirect('/vista/turnos?exitoReasignacion=' + encodeURIComponent(
            `Turno #${req.params.id} reasignado: se generó el turno #${resultado.turno.id}${resultado.turno.esSobreturno ? ' como SOBRETURNO' : ''}.`
        ));
    } catch (error) {
        next(error);
    }
};
