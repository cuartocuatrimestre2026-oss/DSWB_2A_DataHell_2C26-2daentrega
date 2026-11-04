const Sala = require('../models/Sala');
const Turno = require('../models/Turno');
const Contador = require('../models/Contador');

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

        const nuevoId = await Contador.obtenerSiguienteId('salas');
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

// Bloqueo de eliminación si tiene turnos activos.
exports.eliminar = async (req, res, next) => {
    try {
        const salaId = Number(req.params.id);
        const turnosAsociados = await Turno.countDocuments({
            salaId,
            estado: 'reservado'
        });

        if (turnosAsociados > 0) {
            return res.status(409).json({
                error: "Conflicto de integridad",
                detalle: `No se puede eliminar la sala porque cuenta con ${turnosAsociados} turno(s) reservado(s) activo(s).`
            });
        }

        const eliminado = await Sala.findOneAndDelete({ id: salaId });
        if (!eliminado) {
            return res.status(404).json({ error: "No encontrado", detalle: "Sala no encontrada para eliminar." });
        }
        res.status(200).json({ mensaje: "Sala eliminada correctamente." });
    } catch (error) {
        next(error);
    }
};