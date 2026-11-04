const mongoose = require('mongoose');

const contadorSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    secuencia: {
        type: Number,
        default: 0
    }
});

contadorSchema.statics.obtenerSiguienteId = async function(nombreSecuencia) {
    const contador = await this.findOneAndUpdate(
        { id: nombreSecuencia },
        { $inc: { secuencia: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return contador.secuencia;
};

module.exports = mongoose.model('Contador', contadorSchema);