require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const { Server } = require('socket.io');

const connectDB = require('./config/db');
const inicializarBaseDeDatos = require('./seed');
const loggerMiddleware = require('./middlewares/loggerMiddleware');
const manejoErroresMiddleware = require('./middlewares/manejoErroresMiddleware');
const { estaAutenticado, esEmpleado } = require('./middlewares/authMiddleware');
const inicializarSockets = require('./sockets/chat.socket');

// Rutas modulares.
const authRoutes = require('./routes/auth.routes');
const pacienteRoutes = require('./routes/paciente.routes');
const turnosRoutes = require('./routes/turnos.routes');
const clientesRoutes = require('./routes/clientes.routes');
const serviciosRoutes = require('./routes/servicios.routes');
const instructoresRoutes = require('./routes/instructores.routes');
const salasRoutes = require('./routes/salas.routes');

// Modelos y controladores.
const Turno = require('./models/Turno');
const Cliente = require('./models/Cliente');
const Sala = require('./models/Sala');
const Servicio = require('./models/Servicio');
const turnosController = require('./controllers/turnos.controller');
const turnosService = require('./services/turnos.service');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Middlewares base.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loggerMiddleware);
app.set('trust proxy', 1);

// Configuración de sesiones.
const secretoSesion = process.env.SESSION_SECRET;
const middlewareSesion = session({
    secret: secretoSesion,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 horas
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
});
app.use(middlewareSesion);

// Compartir sesión con Socket.io
io.engine.use((req, res, next) => {
    middlewareSesion(req, res, next);
});

// Inicialización de sockets.
inicializarSockets(io);

// Disponibilidad del usuario logueado en plantillas Pug.
app.use((req, res, next) => {
    res.locals.usuarioActual = (req.session && req.session.usuario) ? req.session.usuario : null;
    next();
});

// Recursos estáticos y vistas Pug.
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Rutas web de autenticación y portal de socios.
app.use('/', authRoutes);
app.use('/', pacienteRoutes);

// Rutas de la API REST.
app.use('/turnos', turnosRoutes);
app.use('/clientes', clientesRoutes);
app.use('/servicios', serviciosRoutes);
app.use('/instructores', instructoresRoutes);
app.use('/salas', salasRoutes);

// Redirecciones directas de barra de navegación hacia la consola de clientes.
app.get('/vista/clientes', estaAutenticado, esEmpleado, (req, res) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(`/clientes/vista/clientes${query}`);
});
app.post('/vista/clientes/resetear-password/:id', estaAutenticado, esEmpleado, (req, res) => {
    res.redirect(307, `/clientes/vista/clientes/resetear-password/${req.params.id}`);
});
app.post('/vista/clientes/cambiar-estado/:id', estaAutenticado, esEmpleado, (req, res) => {
    res.redirect(307, `/clientes/vista/clientes/cambiar-estado/${req.params.id}`);
});

// Portada pública del sistema.
app.get('/', async (req, res, next) => {
    try {
        const [totalTurnos, totalClientes, totalSalas, totalServicios] = await Promise.all([
            Turno.countDocuments(),
            Cliente.countDocuments(),
            Sala.countDocuments(),
            Servicio.countDocuments()
        ]);
        res.render('index', {
            totalTurnos,
            totalClientes,
            totalSalas,
            totalServicios
        });
    } catch (error) {
        next(error);
    }
});

// Consola Operativa de Recepción.
app.get('/vista/turnos', estaAutenticado, esEmpleado, async (req, res, next) => {
    try {
        await turnosService.actualizarAusentes();
        const [turnos, clientes, salas] = await Promise.all([
            Turno.find().sort({ fechaHora: 1 }),
            Cliente.find(),
            Sala.find()
        ]);
        const clientesMap = new Map(clientes.map(c => [Number(c.id), c]));
        const salasMap = new Map(salas.map(s => [Number(s.id), s.nombre]));
        const turnosMapeados = turnos.map(t => {
            const clienteObj = clientesMap.get(Number(t.clienteId));
            return {
                id: t.id,
                clienteId: t.clienteId,
                clienteDetalle: clienteObj ? `${clienteObj.apellido}, ${clienteObj.nombre} (DNI ${clienteObj.dni})` : `Socio #${t.clienteId}`,
                aptoMedicoVigente: clienteObj ? clienteObj.aptoMedicoVigente : true,
                patologiasActivas: clienteObj ? clienteObj.patologiasActivas : '',
                salaId: t.salaId,
                salaDetalle: salasMap.get(Number(t.salaId)) || `Sala #${t.salaId}`,
                fechaHora: t.fechaHora,
                estado: t.estado,
                esSobreturno: t.esSobreturno,
                motivoSobreturno: t.motivoSobreturno
            };
        });
        res.render('turnos', {
            turnos: turnosMapeados,
            errorSobreturno: req.query.errorSobreturno || null,
            exitoReasignacion: req.query.exitoReasignacion || null
        });
    } catch (error) {
        next(error);
    }
});

app.post('/vista/turnos/atender/:id', estaAutenticado, esEmpleado, turnosController.marcarAtendidoWeb);
app.post('/vista/turnos/cancelar/:id', estaAutenticado, esEmpleado, turnosController.cancelarWeb);
app.post('/vista/turnos/sobreturno', estaAutenticado, esEmpleado, turnosController.crearSobreturnoWeb);

// Reasignación de turnos ausentes desde la consola de recepción.
app.get('/vista/turnos/reasignar/:id', estaAutenticado, esEmpleado, turnosController.mostrarReasignarWeb);
app.post('/vista/turnos/reasignar/:id', estaAutenticado, esEmpleado, turnosController.reasignarWeb);

// Pantalla y procesamiento de Apto Físico para Recepción.
app.get('/vista/apto-fisico', estaAutenticado, esEmpleado, async (req, res, next) => {
    try {
        const socios = await Cliente.find({ rol: 'cliente', estado: 'activo' }).sort({ apellido: 1, nombre: 1 });
        
        const zona = { timeZone: 'America/Argentina/Buenos_Aires' };
        const hoyStr = new Date().toLocaleDateString('en-CA', zona);
        const hoyUTC = new Date(`${hoyStr}T00:00:00.000Z`);
        const sociosMapeados = socios.map(s => {
            const obj = s.toObject();
            if (obj.fechaVencimientoApto) {
                const vencUTC = new Date(obj.fechaVencimientoApto);
                obj.aptoMedicoVigente = vencUTC.getTime() >= hoyUTC.getTime();
            } else {
                obj.aptoMedicoVigente = false;
            }
            return obj;
        });
        res.render('apto-fisico', {
            socios: sociosMapeados,
            errorApto: req.query.errorApto || null,
            exitoApto: req.query.exitoApto || null
        });
    } catch (error) {
        next(error);
    }
});

app.post('/vista/apto-fisico', estaAutenticado, esEmpleado, async (req, res, next) => {
    try {
        const { clienteId, fechaEmisionApto, fechaVencimientoApto } = req.body;
        if (!clienteId || !fechaEmisionApto) {
            return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('El socio y la fecha de emisión son obligatorios.'));
        }
        const cliente = await Cliente.findOne({ id: Number(clienteId) });
        if (!cliente) {
            return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('El socio seleccionado no existe.'));
        }
        const zona = { timeZone: 'America/Argentina/Buenos_Aires' };
        const hoyStr = new Date().toLocaleDateString('en-CA', zona);
        const hoyUTC = new Date(`${hoyStr}T00:00:00.000Z`);
        const emisionUTC = new Date(`${fechaEmisionApto.split('T')[0]}T00:00:00.000Z`);
        if (emisionUTC.getTime() > hoyUTC.getTime()) {
            return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('La fecha de emisión no puede ser futura.'));
        }
        const hace7DiasUTC = new Date(hoyUTC.getTime() - 7 * 86400000);
        if (emisionUTC.getTime() < hace7DiasUTC.getTime()) {
            return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('El certificado de apto médico presentado tiene más de 7 días de emitido.'));
        }
        cliente.fechaEmisionApto = emisionUTC;
        if (fechaVencimientoApto) {
            const vencimientoUTC = new Date(`${fechaVencimientoApto.split('T')[0]}T00:00:00.000Z`);
            if (vencimientoUTC.getTime() < emisionUTC.getTime()) {
                return res.redirect('/vista/apto-fisico?errorApto=' + encodeURIComponent('La fecha de vencimiento no puede ser anterior a la de emisión.'));
            }
            cliente.fechaVencimientoApto = vencimientoUTC;
        } else {
            const emisionStr = fechaEmisionApto.split('T')[0];
            const anioSiguiente = Number(emisionStr.slice(0, 4)) + 1;
            cliente.fechaVencimientoApto = new Date(`${anioSiguiente}${emisionStr.slice(4)}T00:00:00.000Z`);
        }
        cliente.aptoMedicoVigente = cliente.fechaVencimientoApto.getTime() >= hoyUTC.getTime();
        await cliente.save();
        res.redirect('/vista/apto-fisico?exitoApto=' + encodeURIComponent('Apto médico cargado exitosamente.'));
    } catch (error) {
        next(error);
    }
});

// Manejo de recursos no encontrados (404).
app.use((req, res) => {
    const esRutaApi = req.originalUrl.startsWith('/turnos') ||
                      req.originalUrl.startsWith('/clientes') ||
                      req.originalUrl.startsWith('/salas') ||
                      req.originalUrl.startsWith('/servicios') ||
                      req.originalUrl.startsWith('/instructores') ||
                      req.originalUrl.startsWith('/login/token');
    if (!esRutaApi && req.accepts('html') && !req.xhr) {
        return res.status(404).render('error', {
            status: 404,
            mensaje: "Recurso no encontrado",
            detalle: `La ruta solicitada '${req.originalUrl}' no existe en el servidor.`
        });
    }
    res.status(404).json({
        error: "Ruta no encontrada",
        detalle: `El endpoint '${req.originalUrl}' no existe en la API REST.`
    });
});

// Middleware centralizado de errores.
app.use(manejoErroresMiddleware);

// Inicio del servidor HTTP con WebSockets.
async function iniciarServidor() {
    try {
        await connectDB();
        await inicializarBaseDeDatos();
        server.listen(PORT, () => {
            console.log(`Servidor TurnoFlex (HTTP + WebSockets) iniciado exitosamente en: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Error al iniciar el servidor:', error.message);
        process.exit(1);
    }
}

iniciarServidor();

module.exports = app;