const Turno = require('../models/Turno');
const Cliente = require('../models/Cliente');
const Servicio = require('../models/Servicio');
const Instructor = require('../models/Instructor');
const Sala = require('../models/Sala');

// Listado completo de turnos.
exports.obtenerTodos = async (req, res, next) => {
    try {
        const turnos = await Turno.find().sort({ fechaHora: 1 });
        res.status(200).json(turnos);
    } catch (error) {
        next(error);
    }
};

// Turno por ID.
exports.obtenerPorId = async (req, res, next) => {
    try {
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
        const turnosCliente = await Turno.find({ clienteId: Number(req.params.id) }).sort({ fechaHora: 1 });
        res.status(200).json(turnosCliente);
    } catch (error) {
        next(error);
    }
};

// Turnos por ID de Instructor.
exports.obtenerPorInstructor = async (req, res, next) => {
    try {
        const turnosInstructor = await Turno.find({ instructorId: Number(req.params.id) }).sort({ fechaHora: 1 });
        res.status(200).json(turnosInstructor);
    } catch (error) {
        next(error);
    }
};

// Crea un turno regular con validaciones de negocio.
exports.crearRegular = async (req, res, next) => {
    try {
        const { clienteId, servicioId, instructorId, salaId, fechaHora } = req.body;
        if (!clienteId || !servicioId || !instructorId || !salaId || !fechaHora) {
            return res.status(400).json({ error: "Validación fallida", detalle: "Todos los campos son obligatorios." });
        }

        const [cliente, servicio, instructor, sala] = await Promise.all([
            Cliente.findOne({ id: Number(clienteId) }),
            Servicio.findOne({ id: Number(servicioId) }),
            Instructor.findOne({ id: Number(instructorId) }),
            Sala.findOne({ id: Number(salaId) })
        ]);

        if (!cliente || !servicio || !instructor || !sala) {
            return res.status(404).json({ error: "Entidad inexistente", detalle: "Cliente, servicio, instructor o sala no encontrados." });
        }

        const fechaHoraObj = new Date(fechaHora);

        // Evita la superposición horaria para el mismo instructor.
        const instructorOcupado = await Turno.findOne({
            instructorId: Number(instructorId),
            fechaHora: fechaHoraObj,
            estado: "reservado"
        });
        if (instructorOcupado) {
            return res.status(409).json({ error: "Conflicto", detalle: "El instructor ya cuenta con un turno en dicho horario." });
        }

        // Evita la asignación duplicada para el cliente en el mismo horario.
        const clienteOcupado = await Turno.findOne({
            clienteId: Number(clienteId),
            fechaHora: fechaHoraObj,
            estado: "reservado"
        });
        if (clienteOcupado) {
            return res.status(409).json({ error: "Conflicto", detalle: "El cliente ya tiene una reserva en ese horario." });
        }

        // Controla la capacidad regular de la sala.
        const reservasRegulares = await Turno.countDocuments({
            salaId: Number(salaId),
            fechaHora: fechaHoraObj,
            estado: "reservado",
            esSobreturno: false
        });
        if (reservasRegulares >= sala.capacidadNormal) {
            return res.status(409).json({
                error: "Capacidad completa",
                detalle: "El aforo regular de la sala está lleno. Solo recepción puede autorizar un sobreturno justificado."
            });
        }

        const ultimo = await Turno.findOne().sort({ id: -1 });
        const nuevoId = (ultimo && ultimo.id) ? ultimo.id + 1 : 1;

        const nuevoTurno = await Turno.create({
            id: nuevoId,
            clienteId: Number(clienteId),
            servicioId: Number(servicioId),
            instructorId: Number(instructorId),
            salaId: Number(salaId),
            fechaHora: fechaHoraObj,
            estado: "reservado",
            esSobreturno: false,
            motivoSobreturno: null
        });

        res.status(201).json({ mensaje: "Turno regular registrado exitosamente", turno: nuevoTurno });
    } catch (error) {
        next(error);
    }
};

// Alta de Sobreturno exclusivo para recepción
exports.crearSobreturno = async (req, res, next) => {
    try {
        const { clienteId, servicioId, instructorId, salaId, fechaHora, motivo } = req.body;
        if (!motivo || typeof motivo !== 'string' || motivo.trim().length < 5) {
            return res.status(400).json({
                error: "Validación fallida",
                detalle: "El campo 'motivo' es mandatorio para sobreturnos (mínimo 5 caracteres)."
            });
        }

        const sala = await Sala.findOne({ id: Number(salaId) });
        if (!sala) {
            return res.status(404).json({ error: "No encontrado", detalle: "Sala no encontrada." });
        }

        const fechaHoraObj = new Date(fechaHora);
        const sobreturnosActuales = await Turno.countDocuments({
            salaId: Number(salaId),
            fechaHora: fechaHoraObj,
            estado: "reservado",
            esSobreturno: true
        });

        if (!sala.admiteSobreturno(sobreturnosActuales)) {
            return res.status(409).json({
                error: "Límite excedido",
                detalle: `Se alcanzó el tope máximo del 15% de sobrecupo permitido para esta sala (${sala.calcularSobreturnosPermitidos()} lugar/es).`
            });
        }

        const ultimo = await Turno.findOne().sort({ id: -1 });
        const nuevoId = (ultimo && ultimo.id) ? ultimo.id + 1 : 1;

        const nuevoTurno = await Turno.create({
            id: nuevoId,
            clienteId: Number(clienteId),
            servicioId: Number(servicioId),
            instructorId: Number(instructorId),
            salaId: Number(salaId),
            fechaHora: fechaHoraObj,
            estado: "reservado",
            esSobreturno: true,
            motivoSobreturno: motivo.trim()
        });

        res.status(201).json({ mensaje: "Sobreturno autorizado y registrado exitosamente", turno: nuevoTurno });
    } catch (error) {
        next(error);
    }
};

// Cancela un Turno.
exports.cancelar = async (req, res, next) => {
    try {
        const turno = await Turno.findOne({ id: Number(req.params.id) });
        if (!turno) {
            return res.status(404).json({ error: "No encontrado", detalle: "El turno a cancelar no existe." });
        }
        turno.cancelar();
        await turno.save();
        res.status(200).json({ mensaje: "Turno cancelado exitosamente", turno });
    } catch (error) {
        next(error);
    }
};

// Transmite y actualiza los estados del turno.
exports.actualizarEstado = async (req, res, next) => {
    try {
        const { estado } = req.body;
        const turno = await Turno.findOne({ id: Number(req.params.id) });
        if (!turno) {
            return res.status(404).json({ error: "No encontrado", detalle: "El turno solicitado no existe." });
        }

        if (estado === "atendido") {
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
        if (req.body.salaId) turno.salaId = Number(req.body.salaId);
        if (req.body.fechaHora) turno.fechaHora = new Date(req.body.fechaHora);

        await turno.save();
        res.status(200).json({
            mensaje: "Turno actualizado correctamente",
            turno
        });
    } catch (error) {
        next(error);
    }
};

// Acciones específicas para interfaz web de recepción
exports.marcarAtendidoWeb = async (req, res, next) => {
    try {
        const turno = await Turno.findOne({ id: Number(req.params.id) });
        if (turno) {
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