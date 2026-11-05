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
    fechaEmisionApto: {
        type: Date,
        default: null,
        required: [
            function() { return !!this.fechaVencimientoApto; },
            'La fecha de emisión del apto es obligatoria.'
        ],
        validate: [
            {
                validator: function(v) {
                    // Los límites aplican al cargar la fecha, no en cada guardado del cliente.
                    if (!v || !this.isModified('fechaEmisionApto')) return true;
                    return v.toISOString().slice(0, 10) <= new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
                },
                message: 'La fecha de emisión del apto no puede ser futura.'
            },
            {
                validator: function(v) {
                    if (!v || !this.isModified('fechaEmisionApto')) return true;
                    return v.toISOString().slice(0, 10) >= new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
                },
                message: 'La fecha de emisión del apto no puede tener más de 7 días de antigüedad.'
            }
        ]
    },
    fechaVencimientoApto: {
        type: Date,
        default: null,
        validate: {
            validator: function(v) {
                if (!v || !this.fechaEmisionApto) return true;
                return v.toISOString().slice(0, 10) >= this.fechaEmisionApto.toISOString().slice(0, 10);
            },
            message: 'La fecha de vencimiento del apto no puede ser anterior a la de emisión.'
        }
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// El apto se calcula por fecha: sigue vigente el mismo día del vencimiento y vence al día siguiente.
clienteSchema.virtual('aptoMedicoVigente').get(function() {
    if (this.rol === 'empleado') return true;
    if (!this.fechaVencimientoApto) return false;
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
        <= this.fechaVencimientoApto.toISOString().slice(0, 10);
});

// Si no se carga el vencimiento, se fija al año de la emisión (también al renovar el apto).
clienteSchema.pre('validate', function() {
    if (!this.fechaEmisionApto) return;
    if (!this.fechaVencimientoApto || (this.isModified('fechaEmisionApto') && !this.isModified('fechaVencimientoApto'))) {
        this.fechaVencimientoApto = this.calcularVencimientoApto();
    }
});

// Hashea la contraseña automáticamente si fue modificada.
clienteSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) return;
    
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password.trim(), salt);
});

// Método de dominio para calcular el vencimiento del apto: un año después de la emisión.
clienteSchema.methods.calcularVencimientoApto = function() {
    return new Date(new Date(this.fechaEmisionApto).setUTCFullYear(this.fechaEmisionApto.getUTCFullYear() + 1));
};

// Método de dominio para validar contraseña.
clienteSchema.methods.compararPassword = async function(candidata) {
    if (this.password.startsWith('$2a$') || this.password.startsWith('$2b$')) {
        return await bcrypt.compare(String(candidata).trim(), this.password);
    }
    return this.password === String(candidata).trim();
};

module.exports = mongoose.model('Cliente', clienteSchema);