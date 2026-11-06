const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const clienteSchema = new mongoose.Schema({
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
    dni: {
        type: String,
        required: [true, 'El DNI es obligatorio'],
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: [true, 'El correo electrónico es obligatorio'],
        unique: true,
        lowercase: true,
        trim: true
    },
    telefono: {
        type: String,
        trim: true,
        default: ''
    },
    password: {
        type: String,
        required: [true, 'La contraseña es obligatoria']
    },
    rol: {
        type: String,
        enum: ['cliente', 'empleado'],
        default: 'cliente'
    },

    // Baja lógica sin borrado físico en la BD.
    estado: {
        type: String,
        enum: ['activo', 'inactivo', 'licencia'],
        default: 'activo',
        validate: {
            validator: function(v) {
                if (v === 'licencia') return this.rol === 'empleado';
                return true;
            },
            message: 'El estado "licencia" solo aplica al personal administrativo.'
        }
    },

    // Apto Médico y Salud Postural.
    aptoMedicoVigente: {
        type: Boolean,
        default: true
    },
    patologiasActivas: {
        type: String,
        trim: true,
        default: ''
    },

    // Seguridad y Mitigación de Fuerza Bruta.
    intentosFallidos: {
        type: Number,
        default: 0
    },
    bloqueadoHasta: {
        type: Date,
        default: null
    },
    fechaAlta: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Hashea la contraseña automáticamente si fue modificada.
clienteSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) return;
    
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password.trim(), salt);
});

// Método de dominio para validar contraseña.
clienteSchema.methods.compararPassword = async function(candidata) {
    if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
        return await bcrypt.compare(String(candidata).trim(), this.password);
    }
    return this.password === String(candidata).trim();
};

module.exports = mongoose.model('Cliente', clienteSchema);