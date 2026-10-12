module.exports = {
  salas: [
    { id: 1, nombre: "Salón Pilates Reformer", capacidadNormal: 10 },
    { id: 2, nombre: "Salón Cardio / Funcional", capacidadNormal: 20 },
    { id: 3, nombre: "SUM 1 (Yoga / Stretching)", capacidadNormal: 15 },
    { id: 4, nombre: "Gabinete 1 (Terapias Individuales)", capacidadNormal: 1 }
  ],
  servicios: [
    { id: 1, nombre: "Pilates Reformer", modalidad: "GRUPAL", duracionMinutos: 60, salaRequerida: 1 },
    { id: 2, nombre: "Hatha Yoga", modalidad: "GRUPAL", duracionMinutos: 60, salaRequerida: 3 },
    { id: 3, nombre: "Entrenamiento Funcional", modalidad: "GRUPAL", duracionMinutos: 60, salaRequerida: 2 },
    { id: 4, nombre: "Registros Akáshicos", modalidad: "INDIVIDUAL", duracionMinutos: 60, salaRequerida: 4 }
  ],
  instructores: [
    { id: 1, nombre: "Mariana", apellido: "Facchinetti", especialidad: "Pilates Reformer", email: "mariana.pilates@espaciosideral.com" },
    { id: 2, nombre: "Debora", apellido: "Ciezar", especialidad: "Hatha Yoga", email: "debora.yoga@espaciosideral.com" },
    { id: 3, nombre: "Lucas", apellido: "González", especialidad: "Pilates Reformer", email: "lucas.gonzalez@gym.com" },
    { id: 4, nombre: "Sofía", apellido: "Martínez", especialidad: "Pilates Reformer", email: "sofia.martinez@gym.com" },
    { id: 5, nombre: "Mateo", apellido: "Benítez", especialidad: "Hatha Yoga", email: "mateo.benitez@gym.com" },
    { id: 6, nombre: "Camila", apellido: "Rodríguez", especialidad: "Hatha Yoga", email: "camila.rodriguez@gym.com" },
    { id: 7, nombre: "Joaquín", apellido: "López", especialidad: "Entrenamiento Funcional", email: "joaquin.lopez@gym.com" },
    { id: 8, nombre: "Valentina", apellido: "Díaz", especialidad: "Entrenamiento Funcional", email: "valentina.diaz@gym.com" },
    { id: 9, nombre: "Gabriel", apellido: "Pérez", especialidad: "Registros Akáshicos", email: "gabriel.perez@gym.com" },
    { id: 10, nombre: "Martina", apellido: "Gómez", especialidad: "Registros Akáshicos", email: "martina.gomez@gym.com" }
  ],
  clientes: [
    { id: 1, nombre: "Juan", apellido: "Pérez", dni: "38123456", email: "juan.perez@mail.com", telefono: "1145678901" },
    { id: 2, nombre: "María", apellido: "Gómez", dni: "39234567", email: "maria.gomez@mail.com", telefono: "1145678902" },
    { id: 3, nombre: "Carlos", apellido: "Rodríguez", dni: "37345678", email: "carlos.rodriguez@mail.com", telefono: "1145678903" },
    { id: 4, nombre: "Ana", apellido: "Fernández", dni: "40456789", email: "ana.fernandez@mail.com", telefono: "1145678904" },
    { id: 5, nombre: "Luis", apellido: "López", dni: "36567890", email: "luis.lopez@mail.com", telefono: "1145678905" }
  ],
  turnos: [
    { id: 1, clienteId: 1, servicioId: 1, instructorId: 1, salaId: 1, fechaHora: "2026-03-20T09:00:00.000Z", estado: "atendido", esSobreturno: false, motivoSobreturno: null },
    { id: 2, clienteId: 2, servicioId: 1, instructorId: 1, salaId: 1, fechaHora: "2026-03-20T10:00:00.000Z", estado: "reservado", esSobreturno: false, motivoSobreturno: null },
    { id: 3, clienteId: 3, servicioId: 2, instructorId: 3, salaId: 3, fechaHora: "2026-03-20T11:00:00.000Z", estado: "reservado", esSobreturno: false, motivoSobreturno: null },
    { id: 4, clienteId: 4, servicioId: 3, instructorId: 5, salaId: 2, fechaHora: "2026-03-20T14:00:00.000Z", estado: "reservado", esSobreturno: true, motivoSobreturno: "Urgencia médica" },
    { id: 5, clienteId: 5, servicioId: 4, instructorId: 7, salaId: 4, fechaHora: "2026-03-20T15:00:00.000Z", estado: "cancelado", esSobreturno: false, motivoSobreturno: null }
  ]
};