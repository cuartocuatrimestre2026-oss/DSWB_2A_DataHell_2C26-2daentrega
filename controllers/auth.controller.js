const Cliente = require('../models/Cliente');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.mostrarLogin = (req, res) => {
    if (req.session && req.session.usuario) {
        return res.redirect(req.session.usuario.rol === 'empleado' ? '/vista/turnos' : '/mis-turnos');
    }
    res.render('login', { error: null });
};

exports.procesarLogin = async (req, res, next) => {
    try {
        const { identificador, password } = req.body;
        if (!identificador || !password) {
            return res.render('login', {
                error: 'Por favor complete su correo electrónico/DNI y contraseña.'
            });
        }
        const termino = String(identificador).trim().toLowerCase();
        
        // Busca usuario por email o DNI.
        const usuario = await Cliente.findOne({
            $or: [
                { email: termino },
                { dni: String(identificador).trim() }
            ]
        });

        if (!usuario) {
            return res.render('login', {
                error: 'Credenciales inválidas. Verifique sus datos e intente nuevamente.'
            });
        }

        // Verifica suspensión por fuerza bruta.
        if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
            const minutosRestantes = Math.ceil((usuario.bloqueadoHasta - new Date()) / (1000 * 60));
            return res.render('login', {
                error: `Acceso suspendido temporalmente por seguridad por reiterados intentos fallidos. Intente nuevamente en ${minutosRestantes} minuto(s).`
            });
        }

        // Verifica estado en la BD.
        if (usuario.estado === 'inactivo') {
            return res.render('login', {
                error: 'Su cuenta se encuentra inactiva. Comuníquese con la administración de Espacio Sideral.'
            });
        }
        if (usuario.estado === 'licencia') {
            return res.render('login', {
                error: 'El usuario se encuentra actualmente bajo período de licencia laboral.'
            });
        }

        // Validación criptográfica de contraseña con bcrypt.
        let passValida = false;
        if (usuario.password.startsWith('$2a$') || usuario.password.startsWith('$2b$')) {
            passValida = await bcrypt.compare(String(password).trim(), usuario.password);
        } else {
            passValida = (usuario.password === String(password).trim());
            // Si coincide en texto plano, migra automáticamente a hash bcrypt.
            if (passValida) {
                const salt = await bcrypt.genSalt(10);
                usuario.password = await bcrypt.hash(String(password).trim(), salt);
                await usuario.save();
            }
        }

        if (!passValida) {
            usuario.intentosFallidos = (usuario.intentosFallidos || 0) + 1;
            
            if (usuario.intentosFallidos >= 3) {
                usuario.bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
                await usuario.save();
                return res.render('login', {
                    error: 'Superó el límite de 3 intentos fallidos. Su acceso quedó suspendido temporalmente por 15 minutos.'
                });
            }
            
            await usuario.save();
            const intentosRestantes = 3 - usuario.intentosFallidos;
            return res.render('login', {
                error: `Contraseña incorrecta. Le resta(n) ${intentosRestantes} intento(s) antes del bloqueo temporal.`
            });
        }

        // Login exitoso: resetea contador y guarda sesión.
        usuario.intentosFallidos = 0;
        usuario.bloqueadoHasta = null;
        await usuario.save();

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

// Generador de Token JWT para consumo API / Thunder Client
exports.generarTokenJWT = async (req, res, next) => {
    try {
        const { identificador, password } = req.body;
        if (!identificador || !password) {
            return res.status(400).json({
                error: "Datos incompletos",
                detalle: "Debe enviar identificador (email o DNI) y password."
            });
        }

        const termino = String(identificador).trim().toLowerCase();
        const usuario = await Cliente.findOne({
            $or: [
                { email: termino },
                { dni: String(identificador).trim() }
            ]
        });

        if (!usuario) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        let passValida = false;
        if (usuario.password.startsWith('$2a$') || usuario.password.startsWith('$2b$')) {
            passValida = await bcrypt.compare(String(password).trim(), usuario.password);
        } else {
            passValida = (usuario.password === String(password).trim());
        }

        if (!passValida) {
            return res.status(401).json({ error: "Contraseña incorrecta" });
        }

        const payload = {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            email: usuario.email,
            rol: usuario.rol
        };

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET || 'turnoflex_jwt_secreto_criptografico_2026',
            { expiresIn: '8h' }
        );

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

        const salt = await bcrypt.genSalt(10);
        const passwordHasheada = await bcrypt.hash(String(password).trim(), salt);

        const ultimo = await Cliente.findOne().sort({ id: -1 });
        const nuevoId = (ultimo && ultimo.id) ? ultimo.id + 1 : 1;

        const nuevoCliente = await Cliente.create({
            id: nuevoId,
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            dni: dni.trim(),
            email: email.toLowerCase().trim(),
            telefono: telefono ? telefono.trim() : '',
            password: passwordHasheada,
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