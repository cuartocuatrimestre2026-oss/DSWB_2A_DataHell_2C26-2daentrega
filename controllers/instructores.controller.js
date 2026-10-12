const Instructor = require('../models/Instructor');

exports.obtenerTodos = async (req, res, next) => {
    try {
        const instructores = await Instructor.find().sort({ id: 1 });
        res.status(200).json(instructores);
    } catch (error) {
        next(error);
    }
};

exports.obtenerPorId = async (req, res, next) => {
    try {
        const instructor = await Instructor.findOne({ id: Number(req.params.id) });
        if (!instructor) {
            return res.status(404).json({ error: "No encontrado", detalle: "Instructor no registrado." });
        }
        res.status(200).json(instructor);
    } catch (error) {
        next(error);
    }
};

exports.crear = async (req, res, next) => {
    try {
        const { nombre, apellido, especialidad, email } = req.body;
        if (!nombre || !apellido || !especialidad || !email) {
            return res.status(400).json({
                error: "Datos incompletos",
                detalle: "Nombre, apellido, especialidad y email son obligatorios."
            });
        }
        const ultimo = await Instructor.findOne().sort({ id: -1 });
        const nuevoId = (ultimo && ultimo.id) ? ultimo.id + 1 : 1;

        const nuevoInstructor = await Instructor.create({
            id: nuevoId,
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            especialidad: especialidad.trim(),
            email: email.toLowerCase().trim()
        });

        res.status(201).json({ mensaje: "Instructor creado exitosamente", instructor: nuevoInstructor });
    } catch (error) {
        next(error);
    }
};

exports.actualizar = async (req, res, next) => {
    try {
        const actualizado = await Instructor.findOneAndUpdate(
            { id: Number(req.params.id) },
            req.body,
            { new: true, runValidators: true }
        );
        if (!actualizado) {
            return res.status(404).json({ error: "No encontrado", detalle: "Instructor no encontrado para actualizar." });
        }
        res.status(200).json({ mensaje: "Instructor actualizado exitosamente", instructor: actualizado });
    } catch (error) {
        next(error);
    }
};

exports.eliminar = async (req, res, next) => {
    try {
        const eliminado = await Instructor.findOneAndDelete({ id: Number(req.params.id) });
        if (!eliminado) {
            return res.status(404).json({ error: "No encontrado", detalle: "Instructor no encontrado para eliminar." });
        }
        res.status(200).json({ mensaje: "Instructor eliminado correctamente." });
    } catch (error) {
        next(error);
    }
};