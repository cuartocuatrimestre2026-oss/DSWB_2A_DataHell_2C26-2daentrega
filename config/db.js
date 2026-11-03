const mongoose = require('mongoose');

const connectDB = async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/turnoflex';
    try {
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            autoIndex: true
        });
        console.log(`[MongoDB] Conectado exitosamente: Base '${conn.connection.name}' en Host '${conn.connection.host}'`);
        return conn;
    } catch (error) {
        console.error(`[MongoDB Error] Error crítico de conexión: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;