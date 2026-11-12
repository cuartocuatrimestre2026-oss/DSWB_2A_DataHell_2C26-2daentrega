const Cliente = require('../models/Cliente');
const Contador = require('../models/Contador');

function calcularVencimientoDefecto(fechaEmision) {
    const d = new Date(fechaEmision);
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    return d;
}

function calcularAptoVigente(fechaVencimiento) {
    if (!fechaVencimiento) return false;
    const v = new Date(fechaVencimiento);
    const hoy = new Date();
    return v.toISOString().slice(0, 10) >= hoy.toISOString().slice(0, 10);
}

// GET /clientes (API).
exports.listarClientes = async (req, res, next) => {
    try {
        const { estado, rol } = req.query;
        const filtro = {};
        if (typeof estado === 'string' && estado.trim()) filtro.estado = estado.trim();
        if (typeof rol === 'string' && rol.trim()) filtro.rol = rol.trim();

        const clientes = await Cliente.find(filtro).select('-password').sort({ id: 1 });
        const resultado = clientes.map(c => {
            const obj = c.toObject();
            obj.aptoMedicoVigente = calcularAptoVigente(obj.fechaVencimientoApto);
            return obj;
        });
        res.status(200).json(resultado);
    } catch (error) {
        next(error);
    }
};

// GET /clientes/:id (API).
exports.obtenerClientePorId = async (req, res, next) => {
    try {
        const cliente = await Cliente.findOne({ id: Number(req.params.id) }).select('-password');
        if (!cliente) {
            return res.status(404).json({
                error: 'Cliente no encontrado',
                detalle: `No existe un usuario con el ID ${req.params.id}`
            });
        }
        const obj = cliente.toObject();
        obj.aptoMedicoVigente = calcularAptoVigente(obj.fechaVencimientoApto);
        res.status(200).json(obj);
    } catch (error) {
        next(error);
    }
};

// POST /clientes (API).
exports.crearCliente = async (req, res, next) => {
    try {
        const { nombre, apellido, dni, email, telefono, password, rol, fechaEmisionApto, fechaVencimientoApto } = req.body;

        if (!nombre || !apellido || !dni || !email) {
            return res.status(400).json({
                error: 'Datos incompletos',
                detalle: 'nombre, apellido, dni y email son obligatorios.'
            });
        }

        const existente = await Cliente.findOne({
            $or: [
                { email: String(email).toLowerCase().trim() },
                { dni: String(dni).trim() }
            ]
        });

        if (existente) {
            return res.status(409).json({
                error: 'Conflicto de unicidad',
                detalle: 'Ya existe un usuario con el mismo DNI o correo electrónico.'
            });
        }

        const usuarioAutenticado = req.usuarioJWT || req.usuario || (req.session && req.session.usuario);
        let rolAsignado = 'cliente';
        if (rol === 'empleado' && usuarioAutenticado && usuarioAutenticado.rol === 'empleado') {
            rolAsignado = 'empleado';
        }

        let fEmision = null;
        let fVenc = null;
        let aptoVigente = false;

        if (fechaEmisionApto) {
            fEmision = new Date(fechaEmisionApto);
            const hoy = new Date();
            if (fEmision > hoy) {
                return res.status(400).json({ error: 'Fecha futura', detalle: 'La fecha de emisión no puede ser futura.' });
            }
            const diasAntiguedad = (hoy - fEmision) / (1000 * 60 * 60 * 24);
            if (diasAntiguedad > 8) {
                return res.status(400).json({ error: 'Emisión vencida', detalle: 'La emisión supera los 7 días reglamentarios.' });
            }

            if (fechaVencimientoApto) {
                fVenc = new Date(fechaVencimientoApto);
                if (fVenc < fEmision) {
                    return res.status(400).json({ error: 'Fechas inconsistentes', detalle: 'El vencimiento no puede ser anterior a la emisión.' });
                }
            } else {
                fVenc = calcularVencimientoDefecto(fEmision);
            }
            aptoVigente = calcularAptoVigente(fVenc);
        }

        const nuevoId = await Contador.obtenerSiguienteId('clientes');

        const nuevoCliente = await Cliente.create({
            id: nuevoId,
            nombre: String(nombre).trim(),
            apellido: String(apellido).trim(),
            dni: String(dni).trim(),
            email: String(email).toLowerCase().trim(),
            telefono: telefono ? String(telefono).trim() : '',
            password: password ? String(password).trim() : '123456',
            rol: rolAsignado,
            estado: 'activo',
            fechaEmisionApto: fEmision,
            fechaVencimientoApto: fVenc,
            aptoMedicoVigente: aptoVigente,
            patologiasActivas: ''
        });

        const objCliente = nuevoCliente.toObject();
        delete objCliente.password;

        res.status(201).json({
            mensaje: 'Cliente registrado exitosamente',
            cliente: objCliente,
            ...objCliente
        });
    } catch (error) {
        next(error);
    }
};

// PUT /clientes/:id (API).
exports.actualizarCliente = async (req, res, next) => {
    try {
        const cliente = await Cliente.findOne({ id: Number(req.params.id) });
        if (!cliente) {
            return res.status(404).json({
                error: 'Cliente no encontrado',
                detalle: `No existe un usuario con el ID ${req.params.id}`
            });
        }

        const usuarioAutenticado = req.usuarioJWT || req.usuario || req.user || (req.session && req.session.usuario);
        const { nombre, apellido, telefono, estado, patologiasActivas, rol, password, fechaEmisionApto, fechaVencimientoApto } = req.body;

        // Protección IDOR y escalada de privilegios para socios autenticados.
        if (usuarioAutenticado && usuarioAutenticado.rol === 'cliente') {
            if (Number(req.params.id) !== Number(usuarioAutenticado.id)) {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    detalle: 'No posee permisos para modificar perfiles de otros usuarios.'
                });
            }
            if (fechaEmisionApto !== undefined || fechaVencimientoApto !== undefined || rol !== undefined || estado !== undefined) {
                return res.status(403).json({
                    error: 'Acceso denegado',
                    detalle: 'Un socio no puede cargar su propio apto médico ni alterar su rol o estado.'
                });
            }
        }

        // Si se intenta fijar vencimiento sin emisión registrada.
        if (fechaVencimientoApto && !fechaEmisionApto && !cliente.fechaEmisionApto) {
            return res.status(400).json({
                error: 'Datos inválidos',
                detalle: 'No se puede ingresar un vencimiento sin una fecha de emisión registrada.'
            });
        }

        if (fechaEmisionApto !== undefined) {
            const fEmision = new Date(fechaEmisionApto);
            const hoy = new Date();
            if (fEmision > hoy) {
                return res.status(400).json({ error: 'Fecha futura', detalle: 'La fecha de emisión no puede ser futura.' });
            }
            const diasAntiguedad = (hoy - fEmision) / (1000 * 60 * 60 * 24);
            if (diasAntiguedad > 8) {
                return res.status(400).json({ error: 'Emisión fuera de plazo', detalle: 'La emisión supera los 7 días de validez para carga.' });
            }

            cliente.fechaEmisionApto = fEmision;
            if (fechaVencimientoApto) {
                const fVenc = new Date(fechaVencimientoApto);
                if (fVenc < fEmision) {
                    return res.status(400).json({ error: 'Fechas inconsistentes', detalle: 'El vencimiento no puede ser anterior a la emisión.' });
                }
                cliente.fechaVencimientoApto = fVenc;
            } else {
                cliente.fechaVencimientoApto = calcularVencimientoDefecto(fEmision);
            }
        } else if (fechaVencimientoApto !== undefined) {
            const fVenc = new Date(fechaVencimientoApto);
            if (cliente.fechaEmisionApto && fVenc < cliente.fechaEmisionApto) {
                return res.status(400).json({ error: 'Fechas inconsistentes', detalle: 'El vencimiento no puede ser anterior a la emisión.' });
            }
            cliente.fechaVencimientoApto = fVenc;
        }

        cliente.aptoMedicoVigente = calcularAptoVigente(cliente.fechaVencimientoApto);

        if (nombre) cliente.nombre = String(nombre).trim();
        if (apellido) cliente.apellido = String(apellido).trim();
        if (telefono !== undefined) cliente.telefono = String(telefono).trim();
        if (patologiasActivas !== undefined) cliente.patologiasActivas = String(patologiasActivas).trim();
        if (rol && usuarioAutenticado && usuarioAutenticado.rol === 'empleado') cliente.rol = rol;
        if (estado && ['activo', 'inactivo', 'licencia'].includes(estado) && usuarioAutenticado && usuarioAutenticado.rol === 'empleado') {
            cliente.estado = estado;
        }

        // Actualización de contraseña, soporta cambio de clave por API y blanqueo.
        if (password) {
            cliente.password = String(password).trim();
            cliente.intentosFallidos = 0;
            cliente.bloqueadoHasta = null;
        }

        await cliente.save();

        const respuesta = cliente.toObject();
        delete respuesta.password;
        respuesta.aptoMedicoVigente = calcularAptoVigente(respuesta.fechaVencimientoApto);

        res.status(200).json(respuesta);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: 'Validación fallida', detalle: error.message });
        }
        next(error);
    }
};

// DELETE /clientes/:id - API - Baja Lógica.
exports.eliminarCliente = async (req, res, next) => {
    try {
        const cliente = await Cliente.findOne({ id: Number(req.params.id) });
        if (!cliente) {
            return res.status(404).json({
                error: 'Cliente no encontrado',
                detalle: `No existe un usuario con el ID ${req.params.id}`
            });
        }

        cliente.estado = 'inactivo';
        await cliente.save();

        res.status(200).json({
            mensaje: `El usuario ${cliente.nombre} ${cliente.apellido} fue dado de baja lógica correctamente.`,
            cliente: { id: cliente.id, estado: cliente.estado }
        });
    } catch (error) {
        next(error);
    }
};

// GET /vista/clientes - Consola Web.
exports.mostrarPistasClientes = async (req, res, next) => {
    try {
        const clientes = await Cliente.find().select('-password').sort({ id: 1 });
        const clientesConApto = clientes.map(c => {
            const obj = c.toObject();
            obj.aptoMedicoVigente = calcularAptoVigente(obj.fechaVencimientoApto);
            return obj;
        });
        res.render('clientes', {
            clientes: clientesConApto,
            usuario: req.session.usuario,
            mensajeExito: req.query.exito || null,
            mensajeError: req.query.error || null
        });
    } catch (error) {
        next(error);
    }
};

// POST /vista/clientes/cambiar-estado/:id - Consola Web.
exports.cambiarEstadoClienteWeb = async (req, res, next) => {
    try {
        const { nuevoEstado } = req.body;
        const cliente = await Cliente.findOne({ id: Number(req.params.id) });

        if (!cliente) {
            return res.redirect('/vista/clientes?error=' + encodeURIComponent('El usuario seleccionado no existe.'));
        }

        if (nuevoEstado === 'licencia' && cliente.rol !== 'empleado') {
            return res.redirect('/vista/clientes?error=' + encodeURIComponent('El estado "licencia" solo aplica al personal administrativo.'));
        }

        if (['activo', 'inactivo', 'licencia'].includes(nuevoEstado)) {
            cliente.estado = nuevoEstado;
            await cliente.save();
        }

        res.redirect('/vista/clientes?exito=' + encodeURIComponent(`Estado de ${cliente.nombre} ${cliente.apellido} actualizado a '${nuevoEstado}'.`));
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.redirect('/vista/clientes?error=' + encodeURIComponent(error.message));
        }
        next(error);
    }
};

// POST /vista/clientes/resetear-password/:id - Consola Web - Blanqueo por Admin.
exports.resetearPasswordWeb = async (req, res, next) => {
    try {
        const cliente = await Cliente.findOne({ id: Number(req.params.id) });
        if (!cliente) {
            return res.redirect('/vista/clientes?error=' + encodeURIComponent('Usuario no encontrado.'));
        }

        cliente.password = '123456';
        cliente.intentosFallidos = 0;
        cliente.bloqueadoHasta = null;
        await cliente.save();

        res.redirect('/vista/clientes?exito=' + encodeURIComponent(`Contraseña de ${cliente.nombre} ${cliente.apellido} restablecida a '123456' y bloqueo suspendido.`));
    } catch (error) {
        next(error);
    }
};

// GET /vista/apto-fisico - Consola Web - Apto Médico.
exports.mostrarAptoFisicoWeb = async (req, res, next) => {
    try {
        const clientes = await Cliente.find({ rol: 'cliente', estado: 'activo' }).select('-password').sort({ apellido: 1, nombre: 1 });
        const sociosMapeados = clientes.map(c => {
            const obj = c.toObject();
            obj.aptoMedicoVigente = calcularAptoVigente(obj.fechaVencimientoApto);
            return obj;
        });
        res.render('apto-fisico', {
            socios: sociosMapeados,
            clientes: sociosMapeados,
            usuario: req.session.usuario,
            errorApto: req.query.errorApto || req.query.error || null,
            exitoApto: req.query.exitoApto || req.query.exito || null
        });
    } catch (error) {
        next(error);
    }
};

// POST /vista/apto-fisico - Consola Web - Carga de Apto Médico.
exports.actualizarAptoFisicoWeb = async (req, res, next) => {
    try {
        const { clienteId, fechaEmisionApto, fechaVencimientoApto } = req.body;
        const targetId = clienteId || req.params.id;
        const cliente = await Cliente.findOne({ id: Number(targetId) });

        if (!cliente) {
            return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('Socio no encontrado.'));
        }

        if (!fechaEmisionApto) {
            return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('Debe ingresar la fecha de emisión del certificado.'));
        }

        const fEmision = new Date(fechaEmisionApto);
        const hoy = new Date();
        if (fEmision > hoy) {
            return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('La fecha de emisión no puede ser futura.'));
        }

        const diasAntiguedad = (hoy - fEmision) / (1000 * 60 * 60 * 24);
        if (diasAntiguedad > 8) {
            return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('El certificado supera los 7 días de emitido y no puede ser cargado.'));
        }

        cliente.fechaEmisionApto = fEmision;
        if (fechaVencimientoApto) {
            const fVenc = new Date(fechaVencimientoApto);
            if (fVenc < fEmision) {
                return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('La fecha de vencimiento no puede ser anterior a la de emisión.'));
            }
            cliente.fechaVencimientoApto = fVenc;
        } else {
            cliente.fechaVencimientoApto = calcularVencimientoDefecto(fEmision);
        }

        cliente.aptoMedicoVigente = calcularAptoVigente(cliente.fechaVencimientoApto);
        await cliente.save();

        res.redirect('/vista/apto-fisico?exitoApto=' + encodeURIComponent(`Apto físico de ${cliente.nombre} ${cliente.apellido} actualizado correctamente.`));
    } catch (error) {
        next(error);
    }
};