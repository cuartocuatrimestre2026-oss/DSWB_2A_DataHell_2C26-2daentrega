require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const Cliente = require('./models/Cliente');
const Instructor = require('./models/Instructor');
const Sala = require('./models/Sala');
const Servicio = require('./models/Servicio');
const Turno = require('./models/Turno');
const Contador = require('./models/Contador');
const seedData = require('./seedData');

async function sincronizarContador(nombreSecuencia, Modelo) {
    const ultimo = await Modelo.findOne().sort({ id: -1 });
    const maxId = ultimo && ultimo.id ? ultimo.id : 0;
    await Contador.findOneAndUpdate(
        { id: nombreSecuencia },
        { $max: { secuencia: maxId } },
        { upsert: true, returnDocument: 'after' }
    );
}

async function inicializarBaseDeDatos() {
    console.log('[Seed] Verificando e inicializando base de datos en MongoDB...');
    if (mongoose.connection.readyState !== 1) {
        await connectDB();
    }

    // Carga de Salas.
    for (const sala of seedData.salas) {
        await Sala.findOneAndUpdate(
            { id: sala.id },
            { $setOnInsert: sala },
            { upsert: true, returnDocument: 'after' }
        );
    }
    await sincronizarContador('salas', Sala);

    // Carga de Instructores.
    for (const inst of seedData.instructores) {
        await Instructor.findOneAndUpdate(
            { id: inst.id },
            { $setOnInsert: inst },
            { upsert: true, returnDocument: 'after' }
        );
    }
    await sincronizarContador('instructores', Instructor);

    // Carga de Servicios.
    for (const serv of seedData.servicios) {
        await Servicio.findOneAndUpdate(
            { id: serv.id },
            { $setOnInsert: serv },
            { upsert: true, returnDocument: 'after' }
        );
    }
    await sincronizarContador('servicios', Servicio);

    // Carga de Clientes iniciales con apto vigente.
    const salt = await bcrypt.genSalt(10);
    const passHasheada = await bcrypt.hash('123456', salt);
    const ahora = new Date();
    const emision = new Date(ahora.getTime() - 2 * 86400000); // 2 días atrás
    const vencimiento = new Date(ahora.getTime() + 363 * 86400000); // ~1 año

    for (const cli of seedData.clientes) {
        // Si el cliente en seedData es admin, se omite para no pisar credenciales.
        if (cli.rol === 'empleado' || cli.email === 'admin@espaciosideral.com') {
            continue;
        }

        await Cliente.findOneAndUpdate(
            { id: cli.id },
            {
                $setOnInsert: {
                    ...cli,
                    password: passHasheada,
                    rol: 'cliente',
                    estado: 'activo',
                    fechaEmisionApto: emision,
                    fechaVencimientoApto: vencimiento,
                    aptoMedicoVigente: true,
                    patologiasActivas: cli.id === 1 ? 'Precaución: Lesión Lumbar L4-L5' : ''
                }
            },
            { upsert: true, returnDocument: 'after' }
        );
    }

    // Usuario administrativo (admin@espaciosideral.com).
    // Si ya existe un admin en la base, NO se modifica ni se pisa su password.
    const adminExistente = await Cliente.findOne({
        $or: [
            { email: 'admin@espaciosideral.com' },
            { rol: 'empleado' }
        ]
    });

    if (!adminExistente) {
        const saltAdmin = await bcrypt.genSalt(10);
        const passAdminHasheada = await bcrypt.hash('admin123', saltAdmin);
        await Cliente.create({
            id: 999,
            nombre: 'Personal',
            apellido: 'Recepción',
            dni: '99999999',
            email: 'admin@espaciosideral.com',
            telefono: '1140009999',
            password: passAdminHasheada,
            rol: 'empleado',
            estado: 'activo',
            aptoMedicoVigente: true
        });
    }

    // Sincroniza el contador de clientes usando los IDs regulares.
    const ultimoCliente = await Cliente.findOne({ id: { $lt: 900 } }).sort({ id: -1 });
    const maxClienteId = ultimoCliente ? ultimoCliente.id : 5;
    await Contador.findOneAndUpdate(
        { id: 'clientes' },
        { $max: { secuencia: maxClienteId } },
        { upsert: true, returnDocument: 'after' }
    );

    // Carga de Turnos.
    for (const t of seedData.turnos) {
        await Turno.findOneAndUpdate(
            { id: t.id },
            {
                $setOnInsert: {
                    ...t,
                    fechaHora: new Date(t.fechaHora)
                }
            },
            { upsert: true, returnDocument: 'after' }
        );
    }
    await sincronizarContador('turnos', Turno);

    console.log('[Seed] Base de datos sincronizada con éxito.');
}

if (require.main === module) {
    inicializarBaseDeDatos()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('[Seed Error]:', err.message);
            process.exit(1);
        });
}

module.exports = inicializarBaseDeDatos;