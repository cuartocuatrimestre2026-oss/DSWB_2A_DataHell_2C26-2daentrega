require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Cliente = require('./models/Cliente');
const Instructor = require('./models/Instructor');
const Sala = require('./models/Sala');
const Servicio = require('./models/Servicio');
const Turno = require('./models/Turno');
const seedData = require('./seedData');

async function inicializarBaseDeDatos() {
    console.log('[Seed] Verificando e inicializando base de datos en MongoDB...');
    if (mongoose.connection.readyState !== 1) {
        await connectDB();
    }

    // Carga las Salas.
    const totalSalas = await Sala.countDocuments();
    if (totalSalas === 0) {
        await Sala.insertMany(seedData.salas);
        console.log(`[Seed] ${seedData.salas.length} salas insertadas.`);
    }

    // Cargar los Instructores.
    const totalInstructores = await Instructor.countDocuments();
    if (totalInstructores === 0) {
        await Instructor.insertMany(seedData.instructores);
        console.log(`[Seed] ${seedData.instructores.length} instructores insertados.`);
    }

    // Carga los Servicios.
    const totalServicios = await Servicio.countDocuments();
    if (totalServicios === 0) {
        await Servicio.insertMany(seedData.servicios);
        console.log(`[Seed] ${seedData.servicios.length} servicios insertados.`);
    }

    // Cargar los Clientes - Socios.
    const totalClientes = await Cliente.countDocuments();
    if (totalClientes === 0) {
        const clientesParaInsertar = seedData.clientes.map(c => ({
            ...c,
            password: '123456',
            rol: 'cliente'
        }));
        await Cliente.insertMany(clientesParaInsertar);
        console.log(`[Seed] ${clientesParaInsertar.length} clientes insertados.`);
    }

    // Garantiza siempre la existencia del usuario administrativo de recepción.
    await Cliente.findOneAndUpdate(
        { email: 'admin@espaciosideral.com' },
        {
            id: 999,
            nombre: 'Personal',
            apellido: 'Recepción',
            dni: '99999999',
            email: 'admin@espaciosideral.com',
            telefono: '1140009999',
            password: 'admin123',
            rol: 'empleado'
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('[Seed] Usuario administrativo (admin@espaciosideral.com / admin123) habilitado.');

    // Carga los Turnos.
    const totalTurnos = await Turno.countDocuments();
    if (totalTurnos === 0) {
        const turnosParaInsertar = seedData.turnos.map(t => ({
            ...t,
            fechaHora: new Date(t.fechaHora)
        }));
        await Turno.insertMany(turnosParaInsertar);
        console.log(`[Seed] ${turnosParaInsertar.length} turnos insertados.`);
    }

    console.log('[Seed] ¡Inicialización completada con éxito!');
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