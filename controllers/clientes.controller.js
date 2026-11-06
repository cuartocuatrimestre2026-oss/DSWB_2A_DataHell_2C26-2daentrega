const Cliente = require('../models/Cliente');
const Contador = require('../models/Contador');

exports.obtenerTodos = async (req, res, next) => {
    try {
        const clientes = await Cliente.find().sort({ id: 1 }).select('-password');
        res.status(200).json(clientes);
    } catch (error) {
        next(error);
    }
};

exports.obtenerPorId = async (req, res, next) => {
    try {
        const cliente = await Cliente.findOne({ id: Number(req.params.id) }).select('-password');
        if (!cliente) {
            return res.status(404).json({ error: "No encontrado", detalle: "Cliente no registrado." });
        }
        res.status(200).json(cliente);
    } catch (error) {
        next(error);
    }
};

exports.crear = async (req, res, next) => {
    try {
        const { nombre, apellido, dni, email, telefono, password, rol, estado, aptoMedicoVigente, patologiasActivas } = req.body;
        if (!nombre || !apellido || !dni || !email) {
            return res.status(400).json({ error: "Datos incompletos", detalle: "Nombre, apellido, DNI y email son obligatorios." });
        }

        const existente = await Cliente.findOne({
            $or: [{ email: email.toLowerCase().trim() }, { dni: dni.trim() }]
        });
        if (existente) {
            return res.status(409).json({ error: "Conflicto", detalle: "Ya existe un usuario con ese DNI o email." });
        }

        const nuevoId = await Contador.obtenerSiguienteId('clientes');

        const nuevoCliente = await Cliente.create({
            id: nuevoId,
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            dni: dni.trim(),
            email: email.toLowerCase().trim(),
            telefono: telefono ? telefono.trim() : "",
            password: password ? password.trim() : '123456',
            rol: rol || 'cliente',
            estado: estado || 'activo',
            aptoMedicoVigente: aptoMedicoVigente !== undefined ? aptoMedicoVigente : true,
            patologiasActivas: patologiasActivas ? patologiasActivas.trim() : ''
        });

        const clienteRespuesta = nuevoCliente.toObject();
        delete clienteRespuesta.password;

        res.status(201).json({ mensaje: "Cliente creado exitosamente", cliente: clienteRespuesta });
    } catch (error) {
        next(error);
    }
};

exports.actualizar = async (req, res, next) => {
    try {
        // Bloqueo de escalada de privilegios.
        const datosPermitidos = { ...req.body };
        delete datosPermitidos.rol;
        delete datosPermitidos.estado;
        delete datosPermitidos.id;

        const cliente = await Cliente.findOne({ id: Number(req.params.id) });
        if (!cliente) {
            return res.status(404).json({ error: "No encontrado", detalle: "Cliente no encontrado para actualizar." });
        }

        // Si se actualiza la contraseña, se asigna para que actúe el pre-save hook.
        if (datosPermitidos.password) {
            cliente.password = datosPermitidos.password.trim();
            delete datosPermitidos.password;
        }

        Object.assign(cliente, datosPermitidos);
        await cliente.save();

        const clienteRespuesta = cliente.toObject();
        delete clienteRespuesta.password;

        res.status(200).json(clienteRespuesta);
    } catch (error) {
        next(error);
    }
};

// Baja lógica para preservación histórica en la BD.
exports.eliminar = async (req, res, next) => {
    try {
        const cliente = await Cliente.findOneAndUpdate(
            { id: Number(req.params.id) },
            { estado: 'inactivo' },
            { new: true }
        ).select('-password');

        if (!cliente) {
            return res.status(404).json({ error: "No encontrado", detalle: "Cliente no encontrado para archivar." });
        }
        res.status(200).json({ 
            mensaje: "Socio archivado lógicamente como inactivo para trazabilidad histórica.", 
            cliente 
        });
    } catch (error) {
        next(error);
    }
};