const mongoose = require('mongoose');

const turnoSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true,
        index: true
    },
    clienteId: {
        type: Number,
        required: [true, 'El ID del cliente es obligatorio'],
        index: true
    },
    servicioId: {
        type: Number,
        required: [true, 'El ID del servicio es obligatorio']
    },
    instructorId: {
        type: Number,
        required: [true, 'El ID del instructor es obligatorio'],
        index: true
    },
    salaId: {
        type: Number,
        required: [true, 'El ID de la sala es obligatorio']
    },
    fechaHora: {
        type: Date,
        required: [true, 'La fecha y hora del turno es obligatoria']
    },
    estado: {
        type: String,
        enum: ['reservado', 'atendido', 'cancelado', 'ausente', 'reasignado'],
        default: 'reservado'
    },
    esSobreturno: {
        type: Boolean,
        default: false
    },
    motivoSobreturno: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Métodos de dominio
turnoSchema.methods.cancelar = function() {
    this.estado = 'cancelado';
};

turnoSchema.methods.atender = function() {
    this.estado = 'atendido';
};

// El socio no fue acreditado en recepción antes de la hora de inicio del turno.
turnoSchema.methods.marcarAusente = function() {
    this.estado = 'ausente';
};

// El turno ausente fue reemplazado por un nuevo turno generado en recepción.
turnoSchema.methods.marcarReasignado = function() {
    this.estado = 'reasignado';
};

module.exports = mongoose.model('Turno', turnoSchema);