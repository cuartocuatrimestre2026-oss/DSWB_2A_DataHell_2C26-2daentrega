const mongoose = require('mongoose');

const instructorSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
        index: true
    },
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio'],
        trim: true
    },
    apellido: {
        type: String,
        required: [true, 'El apellido es obligatorio'],
        trim: true
    },
    especialidad: {
        type: String,
        required: [true, 'La especialidad es obligatoria'],
        trim: true
    },
    email: {
        type: String,
        required: [true, 'El correo electrónico es obligatorio'],
        unique: true,
        lowercase: true,
        trim: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Instructor', instructorSchema);