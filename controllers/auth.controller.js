const Cliente = require('../models/Cliente');
const Contador = require('../models/Contador');
const jwt = require('jsonwebtoken');

// Lógica de autenticación centralizada para Web y API.
async function autenticarUsuario(identificador, password) {
    if (!identificador || !password) {
        return { exito: false, status: 400, mensaje: 'Por favor complete su correo electrónico/DNI y contraseña.' };
    }

    const termino = String(identificador).trim().toLowerCase();
    const usuario = await Cliente.findOne({
        $or: [
            { email: termino },
            { dni: String(identificador).trim() }
        ]
    });

    if (!usuario) {
        return { exito: false, status: 401, mensaje: 'Credenciales inválidas. Verifique sus datos e intente nuevamente.' };
    }

    // Control de suspensión por fuerza bruta.
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
        const minutosRestantes = Math.ceil((usuario.bloqueadoHasta - new Date()) / (1000 * 60));
        return { 
            exito: false, 
            status: 403, 
            mensaje: `Acceso suspendido temporalmente por seguridad por reiterados intentos fallidos. Intente nuevamente en ${minutosRestantes} minuto(s).` 
        };
    }

    // Control de estados del usuario.
    if (usuario.estado === 'inactivo') {
        return { exito: false, status: 403, mensaje: 'Su cuenta se encuentra inactiva. Comuníquese con la administración de Espacio Sideral.' };
    }
    if (usuario.estado === 'licencia') {
        return { exito: false, status: 403, mensaje: 'El usuario se encuentra actualmente bajo período de licencia laboral.' };
    }

    // Validación de contraseña.
    const esValida = await usuario.compararPassword(password);
    if (!esValida) {
        usuario.intentosFallidos = (usuario.intentosFallidos || 0) + 1;
        if (usuario.intentosFallidos >= 3) {
            usuario.bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000);
            await usuario.save();
            return { exito: false, status: 403, mensaje: 'Superó el límite de 3 intentos fallidos. Su acceso quedó suspendido temporalmente por 15 minutos.' };
        }
        await usuario.save();
        const intentosRestantes = 3 - usuario.intentosFallidos;
        return { exito: false, status: 401, mensaje: `Contraseña incorrecta. Le resta(n) ${intentosRestantes} intento(s) antes del bloqueo temporal.` };
    }

    // Restablecimiento de fallos.
    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;
    await usuario.save();

    return { exito: true, usuario };
}

exports.mostrarLogin = (req, res) => {
    if (req.session && req.session.usuario) {
        return res.redirect(req.session.usuario.rol === 'empleado' ? '/vista/turnos' : '/mis-turnos');
    }
    res.render('login', { error: null });
};

exports.procesarLogin = async (req, res, next) => {
    try {
        const { identificador, password } = req.body;
        const resultado = await autenticarUsuario(identificador, password);

        if (!resultado.exito) {
            return res.render('login', { error: resultado.mensaje });
        }

        const usuario = resultado.usuario;
        req.session.usuario = {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            dni: usuario.dni,
            rol: usuario.rol,
            estado: usuario.estado,
            aptoMedicoVigente: usuario.aptoMedicoVigente
        };

        if (usuario.rol === 'empleado') {
            return res.redirect('/vista/turnos');
        } else {
            return res.redirect('/mis-turnos');
        }
    } catch (error) {
        next(error);
    }
};

exports.generarTokenJWT = async (req, res, next) => {
    try {
        const { identificador, password } = req.body;
        const resultado = await autenticarUsuario(identificador, password);

        if (!resultado.exito) {
            return res.status(resultado.status).json({
                error: "Autenticación fallida",
                detalle: resultado.mensaje
            });
        }

        const usuario = resultado.usuario;
        const secreto = process.env.JWT_SECRET;
        if (!secreto) {
            return res.status(500).json({ error: "Error de configuración", detalle: "JWT_SECRET no definido." });
        }

        const payload = {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            rol: usuario.rol
        };

        const token = jwt.sign(payload, secreto, { expiresIn: '8h' });

        res.status(200).json({
            mensaje: "Autenticación JWT exitosa",
            token,
            usuario: payload
        });
    } catch (error) {
        next(error);
    }
};

exports.mostrarRegistro = (req, res) => {
    if (req.session && req.session.usuario) {
        return res.redirect(req.session.usuario.rol === 'empleado' ? '/vista/turnos' : '/mis-turnos');
    }
    res.render('registro', { error: null, valores: {} });
};

exports.procesarRegistro = async (req, res, next) => {
    try {
        const { nombre, apellido, dni, email, telefono, password } = req.body;
        if (!nombre || !apellido || !dni || !email || !password) {
            return res.render('registro', {
                error: 'Todos los campos obligatorios deben ser completados.',
                valores: req.body
            });
        }
        if (password.length < 4) {
            return res.render('registro', {
                error: 'La contraseña debe tener al menos 4 caracteres.',
                valores: req.body
            });
        }

        const existente = await Cliente.findOne({
            $or: [
                { email: email.toLowerCase().trim() },
                { dni: dni.trim() }
            ]
        });
        if (existente) {
            return res.render('registro', {
                error: 'Ya existe un usuario registrado con ese DNI o correo electrónico.',
                valores: req.body
            });
        }

        // Generación del ID con Contador.
        const nuevoId = await Contador.obtenerSiguienteId('clientes');

        const nuevoCliente = await Cliente.create({
            id: nuevoId,
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            dni: dni.trim(),
            email: email.toLowerCase().trim(),
            telefono: telefono ? telefono.trim() : '',
            password: password.trim(),
            rol: 'cliente',
            estado: 'activo',
            aptoMedicoVigente: true,
            patologiasActivas: ''
        });

        req.session.usuario = {
            id: nuevoCliente.id,
            nombre: nuevoCliente.nombre,
            apellido: nuevoCliente.apellido,
            email: nuevoCliente.email,
            dni: nuevoCliente.dni,
            rol: nuevoCliente.rol,
            estado: nuevoCliente.estado,
            aptoMedicoVigente: nuevoCliente.aptoMedicoVigente
        };

        res.redirect('/mis-turnos');
    } catch (error) {
        next(error);
    }
};

exports.cerrarSesion = (req, res) => {
    if (req.session) {
        req.session.destroy(() => {
            res.redirect('/login');
        });
    } else {
        res.redirect('/login');
    }
};