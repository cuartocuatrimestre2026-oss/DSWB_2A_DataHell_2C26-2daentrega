const mongoose = require('mongoose');

const salaSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
        index: true
    },
    nombre: {
        type: String,
        required: [true, 'El nombre de la sala es obligatorio'],
        trim: true
    },
    capacidadNormal: {
        type: Number,
        required: [true, 'La capacidad normal es obligatoria'],
        min: [1, 'La capacidad debe ser de al menos 1 persona']
    }
}, {
    timestamps: true
});

// Métodos de dominio y reglas de negocio
salaSchema.methods.calcularSobreturnosPermitidos = function () {
    // Regla estricta RF-02 / RN06: En Pilates Reformer el sobreturno es 0% (camillas rígidas).
    if (this.id === 1 || (this.nombre && this.nombre.toLowerCase().includes('reformer'))) {
        return 0;
    }
    return Math.floor(this.capacidadNormal * 0.15);
};

salaSchema.methods.admiteSobreturno = function (sobreturnosActuales) {
    return sobreturnosActuales < this.calcularSobreturnosPermitidos();
};

module.exports = mongoose.model('Sala', salaSchema);