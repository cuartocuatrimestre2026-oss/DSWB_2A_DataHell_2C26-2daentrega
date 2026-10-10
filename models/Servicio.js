const mongoose = require('mongoose');

const servicioSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
        index: true
    },
    nombre: {
        type: String,
        required: [true, 'El nombre del servicio es obligatorio'],
        trim: true
    },
    modalidad: {
        type: String,
        required: [true, 'La modalidad es obligatoria (GRUPAL o INDIVIDUAL)'],
        trim: true
    },
    duracionMinutos: {
        type: Number,
        required: [true, 'La duración en minutos es obligatoria'],
        min: [15, 'La duración debe ser de al menos 15 minutos']
    },
    salaRequerida: {
        type: Number,
        required: [true, 'La sala requerida es obligatoria']
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Servicio', servicioSchema);