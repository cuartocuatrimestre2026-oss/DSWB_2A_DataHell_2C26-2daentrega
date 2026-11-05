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
        // La carga del apto es exclusiva del personal administrativo.
        if (req.usuarioJWT.rol !== 'empleado' && (req.body.fechaEmisionApto !== undefined || req.body.fechaVencimientoApto !== undefined)) {
            return res.status(403).json({ error: "Acceso denegado", detalle: "Solo el personal administrativo puede cargar el apto." });
        }

        const { nombre, apellido, dni, email, telefono, password, rol, estado, fechaEmisionApto, fechaVencimientoApto, patologiasActivas } = req.body;
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
            fechaEmisionApto,
            fechaVencimientoApto,
            patologiasActivas: patologiasActivas ? patologiasActivas.trim() : ''
        });

        const clienteRespuesta = nuevoCliente.toObject();
        delete clienteRespuesta.password;

        res.status(201).json({ mensaje: "Cliente creado exitosamente", cliente: clienteRespuesta });
    } catch (error) {
        if (error.name === 'ValidationError') error.status = 400;
        next(error);
    }
};

exports.actualizar = async (req, res, next) => {
    try {
        // La carga del apto es exclusiva del personal administrativo.
        if (req.usuarioJWT.rol !== 'empleado' && (req.body.fechaEmisionApto !== undefined || req.body.fechaVencimientoApto !== undefined)) {
            return res.status(403).json({ error: "Acceso denegado", detalle: "Solo el personal administrativo puede cargar el apto." });
        }

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
        // Un vencimiento informado se respeta aunque coincida con el guardado.
        if (datosPermitidos.fechaVencimientoApto) cliente.markModified('fechaVencimientoApto');
        await cliente.save();

        const clienteRespuesta = cliente.toObject();
        delete clienteRespuesta.password;

        res.status(200).json(clienteRespuesta);
    } catch (error) {
        if (error.name === 'ValidationError') error.status = 400;
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

// Pantalla de carga del apto físico para el personal administrativo.
exports.mostrarAptoFisicoWeb = async (req, res, next) => {
    try {
        const socios = await Cliente.find({ rol: 'cliente', estado: { $ne: 'inactivo' } }).sort({ apellido: 1, nombre: 1 });
        res.render('apto-fisico', {
            socios,
            errorApto: req.query.errorApto || null,
            exitoApto: req.query.exitoApto || null
        });
    } catch (error) {
        next(error);
    }
};

// Guarda el apto físico cargado desde la pantalla web.
exports.cargarAptoFisicoWeb = async (req, res, next) => {
    try {
        const { clienteId, fechaEmisionApto, fechaVencimientoApto } = req.body;
        if (!fechaEmisionApto) {
            return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('La fecha de emisión del apto es obligatoria.'));
        }

        const cliente = await Cliente.findOne({ id: Number(clienteId) || 0, rol: 'cliente', estado: { $ne: 'inactivo' } });
        if (!cliente) {
            return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('Debe seleccionar un socio activo.'));
        }

        cliente.fechaEmisionApto = fechaEmisionApto;
        cliente.fechaVencimientoApto = fechaVencimientoApto || null;
        // Un vencimiento informado se respeta aunque coincida con el guardado.
        if (fechaVencimientoApto) cliente.markModified('fechaVencimientoApto');
        await cliente.save();

        res.redirect('/vista/apto-fisico?exitoApto=' + encodeURIComponent(
            `Apto de ${cliente.apellido}, ${cliente.nombre} cargado. Vence el ${cliente.fechaVencimientoApto.toLocaleDateString('es-AR', { timeZone: 'UTC' })}.`
        ));
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent(Object.values(error.errors)[0].message));
        }
        next(error);
    }
};
