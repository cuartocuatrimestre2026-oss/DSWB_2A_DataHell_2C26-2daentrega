const Cliente = require('../models/Cliente');
const Contador = require('../models/Contador');

// Auxiliar para formatear fecha a medianoche UTC.
function normalizarFechaUTC(fechaStr) {
    if (!fechaStr) return null;
    const str = String(fechaStr).split('T')[0];
    return new Date(`${str}T00:00:00.000Z`);
}

// Auxiliar para calcular si el apto médico está vigente hoy en Argentina.
function calcularVigenciaApto(fechaVencimiento) {
    if (!fechaVencimiento) return false;
    const zona = { timeZone: 'America/Argentina/Buenos_Aires' };
    const hoyStr = new Date().toLocaleDateString('en-CA', zona);
    const hoyUTC = new Date(`${hoyStr}T00:00:00.000Z`);
    const vencUTC = new Date(fechaVencimiento);
    // Vigente el día del vencimiento, vence al día siguiente.
    return vencUTC.getTime() >= hoyUTC.getTime();
}

exports.obtenerTodos = async (req, res, next) => {
    try {
        const clientes = await Cliente.find().sort({ id: 1 }).select('-password');
        
        // Actualiza dinámicamente la vigencia en base a la fecha actual.
        const clientesConVigencia = clientes.map(c => {
            const obj = c.toObject();
            if (obj.fechaVencimientoApto) {
                obj.aptoMedicoVigente = calcularVigenciaApto(obj.fechaVencimientoApto);
            }
            return obj;
        });

        res.status(200).json(clientesConVigencia);
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
        
        const obj = cliente.toObject();
        if (obj.fechaVencimientoApto) {
            obj.aptoMedicoVigente = calcularVigenciaApto(obj.fechaVencimientoApto);
        }
        
        res.status(200).json(obj);
    } catch (error) {
        next(error);
    }
};

exports.crear = async (req, res, next) => {
    try {
        const { nombre, apellido, dni, email, telefono, password, rol, estado, patologiasActivas } = req.body;
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
            fechaEmisionApto: null,
            fechaVencimientoApto: null,
            aptoMedicoVigente: false,
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
        const clienteId = Number(req.params.id);
        const cliente = await Cliente.findOne({ id: clienteId });
        if (!cliente) {
            return res.status(404).json({ error: "No encontrado", detalle: "Cliente no encontrado para actualizar." });
        }

        const usuarioAutenticado = req.usuarioJWT || (req.session && req.session.usuario);
        const intentaModificarApto = req.body.fechaEmisionApto !== undefined || req.body.fechaVencimientoApto !== undefined;

        // Regla: un socio no puede cargar ni modificar su propio apto médico.
        if (intentaModificarApto && usuarioAutenticado && usuarioAutenticado.rol === 'cliente') {
            return res.status(403).json({
                error: "Acceso denegado",
                detalle: "Los socios no tienen permisos para cargar o modificar certificados de apto médico."
            });
        }

        // Bloqueo de escalada de privilegios.
        const datosPermitidos = { ...req.body };
        delete datosPermitidos.rol;
        delete datosPermitidos.estado;
        delete datosPermitidos.id;

        // Tratamiento de Apto Médico y Fechas.
        if (intentaModificarApto) {
            const zona = { timeZone: 'America/Argentina/Buenos_Aires' };
            const hoyStr = new Date().toLocaleDateString('en-CA', zona);
            const hoyUTC = new Date(`${hoyStr}T00:00:00.000Z`);

            // No se acepta vencimiento sin emisión previa o enviada.
            if (req.body.fechaVencimientoApto && !req.body.fechaEmisionApto && !cliente.fechaEmisionApto) {
                return res.status(400).json({
                    error: "Validación fallida",
                    detalle: "No se puede registrar un vencimiento sin una fecha de emisión de apto médico."
                });
            }

            if (req.body.fechaEmisionApto) {
                const emisionUTC = normalizarFechaUTC(req.body.fechaEmisionApto);

                // Rechazar emisión con fecha futura.
                if (emisionUTC.getTime() > hoyUTC.getTime()) {
                    return res.status(400).json({
                        error: "Validación fallida",
                        detalle: "La fecha de emisión del apto médico no puede ser futura."
                    });
                }

                // Rechazar emisión con más de 7 días de antigüedad al momento de cargarla.
                const hace7DiasUTC = new Date(hoyUTC.getTime() - 7 * 86400000);
                if (emisionUTC.getTime() < hace7DiasUTC.getTime()) {
                    return res.status(400).json({
                        error: "Validación fallida",
                        detalle: "El certificado de apto médico presentado tiene más de 7 días de emitido."
                    });
                }

                cliente.fechaEmisionApto = emisionUTC;

                // Si no se envía vencimiento o viene null, se calcula a 1 año exacto de la emisión.
                if (req.body.fechaVencimientoApto === null || req.body.fechaVencimientoApto === undefined) {
                    const emisionStr = req.body.fechaEmisionApto.split('T')[0];
                    const anioSiguiente = Number(emisionStr.slice(0, 4)) + 1;
                    cliente.fechaVencimientoApto = new Date(`${anioSiguiente}${emisionStr.slice(4)}T00:00:00.000Z`);
                }
            }

            if (req.body.fechaVencimientoApto) {
                const vencimientoUTC = normalizarFechaUTC(req.body.fechaVencimientoApto);
                const emisionRef = cliente.fechaEmisionApto || normalizarFechaUTC(req.body.fechaEmisionApto);

                // Rechazar vencimiento anterior a la emisión.
                if (emisionRef && vencimientoUTC.getTime() < emisionRef.getTime()) {
                    return res.status(400).json({
                        error: "Validación fallida",
                        detalle: "La fecha de vencimiento no puede ser anterior a la fecha de emisión."
                    });
                }

                cliente.fechaVencimientoApto = vencimientoUTC;
            }

            cliente.aptoMedicoVigente = calcularVigenciaApto(cliente.fechaVencimientoApto);
            delete datosPermitidos.fechaEmisionApto;
            delete datosPermitidos.fechaVencimientoApto;
            delete datosPermitidos.aptoMedicoVigente;
        }

        // Si actualizan contraseña, se asigna para que actúe el pre-save hook.
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