require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const connectDB = require('./config/db');
const inicializarBaseDeDatos = require('./seed');
const loggerMiddleware = require('./middlewares/loggerMiddleware');
const manejoErroresMiddleware = require('./middlewares/manejoErroresMiddleware');
const { estaAutenticado, esEmpleado } = require('./middlewares/authMiddleware');

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

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares base.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(loggerMiddleware);

// Sesiones de usuario.
app.use(session({
    secret: process.env.SESSION_SECRET || 'turnoflex_super_secreto_session_2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 24 horas
    }
}));

// Disponibilidad del usuario logueado en todas las plantillas Pug.
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

// Rutas de la API REST (JSON).
app.use('/turnos', turnosRoutes);
app.use('/clientes', clientesRoutes);
app.use('/servicios', serviciosRoutes);
app.use('/instructores', instructoresRoutes);
app.use('/salas', salasRoutes);

// Vistas Server-Side para Administración y Recepción.
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

app.get('/vista/turnos', estaAutenticado, esEmpleado, async (req, res, next) => {
    try {
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
            errorSobreturno: req.query.errorSobreturno || null
        });
    } catch (error) {
        next(error);
    }
});

app.post('/vista/turnos/atender/:id', estaAutenticado, esEmpleado, turnosController.marcarAtendidoWeb);
app.post('/vista/turnos/cancelar/:id', estaAutenticado, esEmpleado, turnosController.cancelarWeb);
app.post('/vista/turnos/sobreturno', estaAutenticado, esEmpleado, turnosController.crearSobreturnoWeb);

app.get('/vista/clientes', estaAutenticado, esEmpleado, async (req, res, next) => {
    try {
        const clientes = await Cliente.find().sort({ id: 1 });
        res.render('clientes', { clientes });
    } catch (error) {
        next(error);
    }
});

// Manejo de recursos no encontrados (404).
app.use((req, res) => {
    if (req.accepts('html')) {
        return res.status(404).render('error', {
            status: 404,
            mensaje: "Recurso no encontrado",
            detalle: `La ruta solicitada '${req.originalUrl}' no existe en el servidor.`
        });
    }
    res.status(404).json({
        error: "Ruta no encontrada",
        detalle: `El endpoint '${req.originalUrl}' no existe.`
    });
});

// Middleware centralizado de errores.
app.use(manejoErroresMiddleware);

// Inicio del servidor y conexión.
async function iniciarServidor() {
    try {
        await connectDB();
        await inicializarBaseDeDatos();
        app.listen(PORT, () => {
            console.log(`Servidor TurnoFlex iniciado exitosamente en: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Error al iniciar el servidor:', error.message);
        process.exit(1);
    }
}

iniciarServidor();

module.exports = app;