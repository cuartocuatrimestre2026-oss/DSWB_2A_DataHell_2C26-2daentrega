const mongoose = require('mongoose');

const connectDB = async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/turnoflex';
    try {
        const conn = await mongoose.connect(uri);
        console.log(`[MongoDB] Conectado exitosamente a la base de datos: ${conn.connection.name} (${conn.connection.host})`);
        return conn;
    } catch (error) {
        console.error(`[MongoDB Error] Error al conectar a la base de datos: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;