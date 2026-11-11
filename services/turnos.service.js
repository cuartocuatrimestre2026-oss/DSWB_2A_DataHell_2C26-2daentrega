const Turno = require('../models/Turno');
const Cliente = require('../models/Cliente');
const Servicio = require('../models/Servicio');
const Instructor = require('../models/Instructor');
const Sala = require('../models/Sala');
const Contador = require('../models/Contador');

// Convierte fecha y hora respetando el huso horario local de Argentina.
function parsearFechaHoraLocal(fechaStr, horaStr) {
    if (!fechaStr) return null;
    if (horaStr) {
        return new Date(`${fechaStr}T${horaStr}:00.000-03:00`);
    }
    if (fechaStr.includes('T') && !fechaStr.endsWith('Z') && !fechaStr.includes('-03:00')) {
        return new Date(`${fechaStr}:00.000-03:00`);
    }
    return new Date(fechaStr);
}

// Comprueba dinámicamente si el socio tiene el apto vigente hoy.
function esAptoVigente(cliente) {
    if (!cliente) return false;
    if (cliente.fechaVencimientoApto) {
        const zona = { timeZone: 'America/Argentina/Buenos_Aires' };
        const hoyStr = new Date().toLocaleDateString('en-CA', zona);
        const hoyUTC = new Date(`${hoyStr}T00:00:00.000Z`);
        const vencUTC = new Date(cliente.fechaVencimientoApto);
        return vencUTC.getTime() + 15 * 86400000 >= hoyUTC.getTime();
    }
    return cliente.aptoMedicoVigente === true;
}

// Servicio centralizado para Alta de Turno Regular.
async function crearTurnoRegularDominio({ clienteId, servicioId, instructorId, salaId, fecha, hora, fechaHoraRaw }) {
    if (!clienteId || !servicioId || !instructorId || !salaId) {
        return { error: true, status: 400, mensaje: 'Todos los campos de identificación son obligatorios.' };
    }

    const fechaHoraObj = parsearFechaHoraLocal(fecha || fechaHoraRaw, hora);
    if (!fechaHoraObj || isNaN(fechaHoraObj.getTime())) {
        return { error: true, status: 400, mensaje: 'La fecha y hora seleccionada no es válida.' };
    }

    // Verificación de existencia de entidades.
    const [cliente, servicio, instructor, sala] = await Promise.all([
        Cliente.findOne({ id: Number(clienteId) }),
        Servicio.findOne({ id: Number(servicioId) }),
        Instructor.findOne({ id: Number(instructorId) }),
        Sala.findOne({ id: Number(salaId) })
    ]);

    if (!cliente) return { error: true, status: 404, mensaje: 'El socio / cliente no existe.' };
    if (!servicio) return { error: true, status: 404, mensaje: 'El servicio solicitado no existe.' };
    if (!instructor) return { error: true, status: 404, mensaje: 'El instructor seleccionado no existe.' };
    if (!sala) return { error: true, status: 404, mensaje: 'La sala seleccionada no existe.' };

    // Coherencia Servicio - Sala.
    if (Number(servicio.salaRequerida) !== Number(sala.id)) {
        return { 
            error: true, 
            status: 400, 
            mensaje: `La disciplina '${servicio.nombre}' solo puede dictarse en la sala asignada (#${servicio.salaRequerida}).` 
        };
    }

    // Coherencia Instructor - Especialidad / Servicio.
    if (instructor.especialidad && servicio.nombre) {
        const espInst = instructor.especialidad.trim().toLowerCase();
        const nomServ = servicio.nombre.trim().toLowerCase();
        if (espInst !== nomServ && !nomServ.includes(espInst) && !espInst.includes(nomServ)) {
            return {
                error: true,
                status: 400,
                mensaje: `El instructor ${instructor.nombre} ${instructor.apellido} posee especialidad en '${instructor.especialidad}' y no puede impartir '${servicio.nombre}'.`
            };
        }
    }

    // Validación de Apto Médico.
    if (!esAptoVigente(cliente)) {
        return { 
            error: true, 
            status: 403, 
            mensaje: 'El socio cuenta con el certificado de Apto Médico vencido o no presentado. Acceso denegado según protocolo sanitario.' 
        };
    }

    // Verificación de doble reserva del cliente en la misma franja horaria.
    const duracionMs = (servicio.duracionMinutos || 60) * 60 * 1000;
    const inicioTurno = fechaHoraObj.getTime();
    const finTurno = inicioTurno + duracionMs;

    const turnosCliente = await Turno.find({
        clienteId: Number(clienteId),
        estado: 'reservado'
    });

    for (const t of turnosCliente) {
        const srvExistente = await Servicio.findOne({ id: t.servicioId });
        const durExistenteMs = (srvExistente ? srvExistente.duracionMinutos : 60) * 60 * 1000;
        const inicioExistente = new Date(t.fechaHora).getTime();
        const finExistente = inicioExistente + durExistenteMs;

        if (inicioTurno < finExistente && finTurno > inicioExistente) {
            return { error: true, status: 409, mensaje: 'El socio ya cuenta con otra reserva superpuesta en dicha franja horaria.' };
        }
    }

    // Verificación de disponibilidad del instructor.
    const instructorConflicto = await Turno.findOne({
        instructorId: Number(instructorId),
        estado: 'reservado',
        fechaHora: fechaHoraObj,
        $or: [
            { salaId: { $ne: Number(salaId) } },
            { servicioId: { $ne: Number(servicioId) } }
        ]
    });

    if (instructorConflicto) {
        return { 
            error: true, 
            status: 409, 
            mensaje: 'El docente ya cuenta con otra clase asignada en una sala o disciplina distinta en este horario.' 
        };
    }

    // Control de aforo regular.
    const reservasRegulares = await Turno.countDocuments({
        salaId: Number(salaId),
        fechaHora: fechaHoraObj,
        estado: 'reservado',
        esSobreturno: false
    });

    if (reservasRegulares >= sala.capacidadNormal) {
        return { 
            error: true, 
            status: 409, 
            mensaje: `El aforo regular de la sala está lleno (${sala.capacidadNormal} lugares). Solo recepción puede autorizar sobreturnos justificados.` 
        };
    }

    // Generación atómica de ID y creación.
    const nuevoId = await Contador.obtenerSiguienteId('turnos');
    const turno = await Turno.create({
        id: nuevoId,
        clienteId: Number(clienteId),
        servicioId: Number(servicioId),
        instructorId: Number(instructorId),
        salaId: Number(salaId),
        fechaHora: fechaHoraObj,
        estado: 'reservado',
        esSobreturno: false,
        motivoSobreturno: null
    });

    return { error: false, turno };
}

// Servicio centralizado para Alta de Sobreturno en Recepción.
async function crearSobreturnoDominio({ clienteId, servicioId, instructorId, salaId, fechaHoraRaw, motivo }) {
    if (!motivo || typeof motivo !== 'string' || motivo.trim().length < 5) {
        return { error: true, status: 400, mensaje: "El campo 'motivo' es obligatorio para sobreturnos (mínimo 5 caracteres)." };
    }

    const fechaHoraObj = parsearFechaHoraLocal(fechaHoraRaw);
    if (!fechaHoraObj || isNaN(fechaHoraObj.getTime())) {
        return { error: true, status: 400, mensaje: 'La fecha y hora del sobreturno no es válida.' };
    }

    const [cliente, servicio, instructor, sala] = await Promise.all([
        Cliente.findOne({ id: Number(clienteId) }),
        Servicio.findOne({ id: Number(servicioId) }),
        Instructor.findOne({ id: Number(instructorId) }),
        Sala.findOne({ id: Number(salaId) })
    ]);

    if (!cliente) return { error: true, status: 404, mensaje: 'El cliente especificado no existe.' };
    if (!servicio) return { error: true, status: 404, mensaje: 'El servicio especificado no existe.' };
    if (!instructor) return { error: true, status: 404, mensaje: 'El instructor especificado no existe.' };
    if (!sala) return { error: true, status: 404, mensaje: 'La sala especificada no existe.' };

    // Coherencia servicio - sala.
    if (Number(servicio.salaRequerida) !== Number(sala.id)) {
        return { error: true, status: 400, mensaje: `La disciplina '${servicio.nombre}' solo puede dictarse en la sala asignada (#${servicio.salaRequerida}).` };
    }

    // Coherencia instructor - especialidad.
    if (instructor.especialidad && servicio.nombre) {
        const espInst = instructor.especialidad.trim().toLowerCase();
        const nomServ = servicio.nombre.trim().toLowerCase();
        if (espInst !== nomServ && !nomServ.includes(espInst) && !espInst.includes(nomServ)) {
            return { error: true, status: 400, mensaje: `El instructor no cuenta con especialidad en '${servicio.nombre}'.` };
        }
    }

    // Validación de Apto Médico.
    if (!esAptoVigente(cliente)) {
        return { error: true, status: 403, mensaje: 'El socio cuenta con el certificado de Apto Médico vencido o no presentado.' };
    }

    // No permite sobreturno si el aforo regular NO está completo.
    const reservasRegulares = await Turno.countDocuments({
        salaId: Number(salaId),
        fechaHora: fechaHoraObj,
        estado: 'reservado',
        esSobreturno: false
    });

    if (reservasRegulares < sala.capacidadNormal) {
        return { 
            error: true, 
            status: 400, 
            mensaje: 'No corresponde autorizar sobreturno: la sala todavía dispone de vacantes regulares libres.' 
        };
    }

    // No superpone sobreturno con otra reserva del mismo cliente.
    const clienteSuperpuesto = await Turno.findOne({
        clienteId: Number(clienteId),
        fechaHora: fechaHoraObj,
        estado: 'reservado'
    });

    if (clienteSuperpuesto) {
        return { error: true, status: 409, mensaje: 'El cliente ya cuenta con un turno reservado para esa fecha y horario.' };
    }

    // Regla matemática del 15% truncado.
    const sobreturnosActuales = await Turno.countDocuments({
        salaId: Number(salaId),
        fechaHora: fechaHoraObj,
        estado: 'reservado',
        esSobreturno: true
    });

    if (!sala.admiteSobreturno(sobreturnosActuales)) {
        return { 
            error: true, 
            status: 409, 
            mensaje: `Límite excedido: se alcanzó el tope del 15% de sobrecupo permitido para esta sala (${sala.calcularSobreturnosPermitidos()} lugar/es).` 
        };
    }

    const nuevoId = await Contador.obtenerSiguienteId('turnos');
    const turno = await Turno.create({
        id: nuevoId,
        clienteId: Number(clienteId),
        servicioId: Number(servicioId),
        instructorId: Number(instructorId),
        salaId: Number(salaId),
        fechaHora: fechaHoraObj,
        estado: 'reservado',
        esSobreturno: true,
        motivoSobreturno: motivo.trim()
    });

    return { error: false, turno };
}

// Pasa a 'ausente' los turnos que siguen 'reservado' y cuya hora de inicio ya pasó.
async function actualizarAusentes() {
    const turnosVencidos = await Turno.find({
        estado: 'reservado',
        fechaHora: { $lte: new Date() }
    });
    for (const turno of turnosVencidos) {
        turno.marcarAusente();
        await turno.save();
    }
    return turnosVencidos.length;
}

// Reasigna un turno 'ausente' a una nueva fecha, hora y docente.
async function reasignarTurnoDominio({ turnoId, instructorId, fecha, hora, motivo }) {
    const turnoOriginal = await Turno.findOne({ id: Number(turnoId) });
    if (!turnoOriginal) {
        return { error: true, status: 404, mensaje: 'El turno a reasignar no existe.' };
    }
    if (turnoOriginal.estado !== 'ausente') {
        return { error: true, status: 400, mensaje: 'Solo se pueden reasignar turnos en estado ausente.' };
    }

    const fechaHoraObj = parsearFechaHoraLocal(fecha, hora);
    if (!fechaHoraObj || isNaN(fechaHoraObj.getTime())) {
        return { error: true, status: 400, mensaje: 'La fecha u hora seleccionada no es válida.' };
    }
    if (fechaHoraObj.getTime() <= Date.now()) {
        return { error: true, status: 400, mensaje: 'No es posible reasignar un turno a una fecha u horario pasados.' };
    }

    const sala = await Sala.findOne({ id: Number(turnoOriginal.salaId) });
    if (!sala) {
        return { error: true, status: 404, mensaje: 'La sala del turno original no existe.' };
    }

    const reservasRegulares = await Turno.countDocuments({
        salaId: Number(sala.id),
        fechaHora: fechaHoraObj,
        estado: 'reservado',
        esSobreturno: false
    });

    let resultado;
    if (reservasRegulares >= sala.capacidadNormal) {
        if (sala.calcularSobreturnosPermitidos() === 0) {
            return { error: true, status: 409, mensaje: `La sala ${sala.nombre} está completa en ese horario y no admite sobreturnos.` };
        }
        if (!motivo || typeof motivo !== 'string' || motivo.trim().length < 5) {
            return { error: true, status: 400, mensaje: 'La sala está completa en ese horario: para generar un sobreturno ingresá un motivo de al menos 5 caracteres.' };
        }
        resultado = await crearSobreturnoDominio({
            clienteId: turnoOriginal.clienteId,
            servicioId: turnoOriginal.servicioId,
            instructorId,
            salaId: sala.id,
            fechaHoraRaw: `${fecha}T${hora}`,
            motivo
        });
    } else {
        resultado = await crearTurnoRegularDominio({
            clienteId: turnoOriginal.clienteId,
            servicioId: turnoOriginal.servicioId,
            instructorId,
            salaId: sala.id,
            fecha,
            hora
        });
    }

    if (resultado.error) {
        return resultado;
    }

    turnoOriginal.marcarReasignado();
    await turnoOriginal.save();
    return { error: false, turno: resultado.turno };
}

module.exports = {
    crearTurnoRegularDominio,
    crearSobreturnoDominio,
    parsearFechaHoraLocal,
    actualizarAusentes,
    reasignarTurnoDominio
};