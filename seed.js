require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
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

    // Carga los Instructores.
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

    // Carga Clientes / Socios con contraseñas encriptadas con bcrypt.
    const totalClientes = await Cliente.countDocuments();
    if (totalClientes === 0) {
        const salt = await bcrypt.genSalt(10);
        const passHasheada = await bcrypt.hash('123456', salt);

        const clientesParaInsertar = seedData.clientes.map(c => ({
            ...c,
            password: passHasheada,
            rol: 'cliente',
            aptoMedicoVigente: true,
            patologiasActivas: c.id === 1 ? 'Precaución: Lesión Lumbar L4-L5' : ''
        }));
        await Cliente.insertMany(clientesParaInsertar);
        console.log(`[Seed] ${clientesParaInsertar.length} clientes insertados con credenciales seguras.`);
    }

    // Garantiza usuario administrativo de recepción con contraseña encriptada.
    const saltAdmin = await bcrypt.genSalt(10);
    const passAdminHasheada = await bcrypt.hash('admin123', saltAdmin);

    await Cliente.findOneAndUpdate(
        { email: 'admin@espaciosideral.com' },
        {
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
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log('[Seed] Usuario administrativo (admin@espaciosideral.com) habilitado con hash bcrypt.');

    // Carga Turnos.
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