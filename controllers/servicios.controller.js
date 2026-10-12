const Servicio = require('../models/Servicio');

exports.obtenerTodos = async (req, res, next) => {
    try {
        const servicios = await Servicio.find().sort({ id: 1 });
        res.status(200).json(servicios);
    } catch (error) {
        next(error);
    }
};

exports.obtenerPorId = async (req, res, next) => {
    try {
        const servicio = await Servicio.findOne({ id: Number(req.params.id) });
        if (!servicio) {
            return res.status(404).json({ error: "No encontrado", detalle: "Servicio no registrado." });
        }
        res.status(200).json(servicio);
    } catch (error) {
        next(error);
    }
};

exports.crear = async (req, res, next) => {
    try {
        const { nombre, modalidad, duracionMinutos, salaRequerida } = req.body;
        if (!nombre || !modalidad || !duracionMinutos || !salaRequerida) {
            return res.status(400).json({
                error: "Datos incompletos",
                detalle: "Nombre, modalidad, duración en minutos y sala requerida son obligatorios."
            });
        }
        const ultimo = await Servicio.findOne().sort({ id: -1 });
        const nuevoId = (ultimo && ultimo.id) ? ultimo.id + 1 : 1;

        const nuevoServicio = await Servicio.create({
            id: nuevoId,
            nombre: nombre.trim(),
            modalidad: modalidad.toUpperCase().trim(),
            duracionMinutos: Number(duracionMinutos),
            salaRequerida: Number(salaRequerida)
        });

        res.status(201).json({ mensaje: "Servicio creado exitosamente", servicio: nuevoServicio });
    } catch (error) {
        next(error);
    }
};

exports.actualizar = async (req, res, next) => {
    try {
        const actualizado = await Servicio.findOneAndUpdate(
            { id: Number(req.params.id) },
            req.body,
            { new: true, runValidators: true }
        );
        if (!actualizado) {
            return res.status(404).json({ error: "No encontrado", detalle: "Servicio no encontrado para actualizar." });
        }
        res.status(200).json({ mensaje: "Servicio actualizado exitosamente", servicio: actualizado });
    } catch (error) {
        next(error);
    }
};

exports.eliminar = async (req, res, next) => {
    try {
        const eliminado = await Servicio.findOneAndDelete({ id: Number(req.params.id) });
        if (!eliminado) {
            return res.status(404).json({ error: "No encontrado", detalle: "Servicio no encontrado para eliminar." });
        }
        res.status(200).json({ mensaje: "Servicio eliminado correctamente." });
    } catch (error) {
        next(error);
    }
};