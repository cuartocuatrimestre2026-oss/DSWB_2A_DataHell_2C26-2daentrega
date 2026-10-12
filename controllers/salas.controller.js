const Sala = require('../models/Sala');

exports.obtenerTodos = async (req, res, next) => {
    try {
        const salas = await Sala.find().sort({ id: 1 });
        res.status(200).json(salas);
    } catch (error) {
        next(error);
    }
};

exports.obtenerPorId = async (req, res, next) => {
    try {
        const sala = await Sala.findOne({ id: Number(req.params.id) });
        if (!sala) {
            return res.status(404).json({ error: "No encontrado", detalle: "Sala no registrada." });
        }
        res.status(200).json({
            id: sala.id,
            nombre: sala.nombre,
            capacidadNormal: sala.capacidadNormal,
            sobreturnosPermitidos: sala.calcularSobreturnosPermitidos()
        });
    } catch (error) {
        next(error);
    }
};

exports.crear = async (req, res, next) => {
    try {
        const { nombre, capacidadNormal } = req.body;
        if (!nombre || capacidadNormal === undefined || isNaN(Number(capacidadNormal))) {
            return res.status(400).json({
                error: "Datos incompletos",
                detalle: "Nombre y capacidadNormal numérica son obligatorios."
            });
        }
        const ultimo = await Sala.findOne().sort({ id: -1 });
        const nuevoId = (ultimo && ultimo.id) ? ultimo.id + 1 : 1;

        const nuevaSala = await Sala.create({
            id: nuevoId,
            nombre: nombre.trim(),
            capacidadNormal: Number(capacidadNormal)
        });

        res.status(201).json({ mensaje: "Sala creada exitosamente", sala: nuevaSala });
    } catch (error) {
        next(error);
    }
};

exports.actualizar = async (req, res, next) => {
    try {
        const actualizado = await Sala.findOneAndUpdate(
            { id: Number(req.params.id) },
            req.body,
            { new: true, runValidators: true }
        );
        if (!actualizado) {
            return res.status(404).json({ error: "No encontrado", detalle: "Sala no encontrada para actualizar." });
        }
        res.status(200).json({ mensaje: "Sala actualizada exitosamente", sala: actualizado });
    } catch (error) {
        next(error);
    }
};

exports.eliminar = async (req, res, next) => {
    try {
        const eliminado = await Sala.findOneAndDelete({ id: Number(req.params.id) });
        if (!eliminado) {
            return res.status(404).json({ error: "No encontrado", detalle: "Sala no encontrada para eliminar." });
        }
        res.status(200).json({ mensaje: "Sala eliminada correctamente." });
    } catch (error) {
        next(error);
    }
};