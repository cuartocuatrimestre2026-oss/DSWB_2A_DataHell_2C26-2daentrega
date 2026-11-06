// Pruebas de reglas de negocio.
// Cada prueba describe el comportamiento CORRECTO esperado: hoy fallan y así demuestran la falla.
// El servidor se levanta en UTC para simular el despliegue en Render.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { iniciarServidorPrueba, detenerServidorPrueba, URI_MONGO_PRUEBA } = require('./utilidades/servidorPrueba');
const { pedir, iniciarSesionWeb, obtenerTokenJWT, crearTurnoRegular } = require('./utilidades/clienteHttp');

describe('Reglas de negocio', () => {
    let tokenAdmin = null;

    before(async () => {
        await iniciarServidorPrueba({ zonaHoraria: 'UTC' });
        ({ token: tokenAdmin } = await obtenerTokenJWT('admin@espaciosideral.com', 'admin123'));
    });

    after(async () => {
        await detenerServidorPrueba();
    });

    // Atajo para pedir un sobreturno por la API.
    function pedirSobreturno(datos) {
        return pedir('/turnos/sobreturno', { metodo: 'POST', cuerpo: datos, token: tokenAdmin });
    }

    describe('Punto 7 - Validaciones del sobreturno', () => {
        test('No se autoriza un sobreturno si el aforo regular de la sala NO está completo', async () => {
            // Sala 1 (10 lugares) vacía en ese horario.
            const respuesta = await pedirSobreturno({
                clienteId: 1, servicioId: 1, instructorId: 1, salaId: 1,
                fechaHora: '2027-05-10T12:00:00.000Z', motivo: 'Derivación médica'
            });
            // Se aceptan 400 y 409 como rechazo; un 500 no cuenta como rechazo válido.
            assert.ok([400, 409].includes(respuesta.estado),
                `Se esperaba el rechazo del sobreturno con la sala vacía (HTTP ${respuesta.estado}).`);
        });

        test('No se autoriza un sobreturno para un cliente inexistente', async () => {
            const respuesta = await pedirSobreturno({
                clienteId: 9999, servicioId: 3, instructorId: 7, salaId: 2,
                fechaHora: '2027-05-10T14:00:00.000Z', motivo: 'Derivación médica'
            });
            assert.notEqual(respuesta.estado, 201,
                'Se registró un sobreturno para el cliente 9999, que no existe.');
        });

        test('No se autoriza un sobreturno superpuesto con otra reserva del mismo cliente', async () => {
            const turnoCreado = await crearTurnoRegular({
                clienteId: 2, servicioId: 3, instructorId: 8, salaId: 2,
                fechaHora: '2027-05-10T16:00:00.000Z'
            }, tokenAdmin);
            assert.equal(turnoCreado.estado, 201, 'Precondición: no se pudo crear el turno regular inicial.');

            const respuesta = await pedirSobreturno({
                clienteId: 2, servicioId: 3, instructorId: 7, salaId: 2,
                fechaHora: '2027-05-10T16:00:00.000Z', motivo: 'Derivación médica'
            });
            assert.notEqual(respuesta.estado, 201,
                'Se registró un sobreturno para María Gómez en el mismo horario en que ya tenía un turno.');
        });
    });

    describe('Punto 8 - La superposición considera la duración del servicio', () => {
        test('Un cliente no puede reservar a las 13:30 si ya tiene una clase de 60 min a las 13:00', async () => {
            const turnoCreado = await crearTurnoRegular({
                clienteId: 4, servicioId: 1, instructorId: 3, salaId: 1,
                fechaHora: '2027-05-11T13:00:00.000Z'
            }, tokenAdmin);
            assert.equal(turnoCreado.estado, 201, 'Precondición: no se pudo crear el turno de las 13:00.');

            const respuesta = await crearTurnoRegular({
                clienteId: 4, servicioId: 2, instructorId: 5, salaId: 3,
                fechaHora: '2027-05-11T13:30:00.000Z'
            }, tokenAdmin);
            assert.equal(respuesta.estado, 409,
                `Ana Fernández quedó con dos clases superpuestas (13:00-14:00 y 13:30) (HTTP ${respuesta.estado}).`);
        });
    });

    describe('Punto 9 - PUT /turnos/:id vuelve a validar las reglas', () => {
        test('No se puede mover un turno a una sala que ya está llena', async () => {
            // Gabinete 1 (sala 4) tiene capacidad 1: se ocupa con un turno.
            const turnoGabinete = await crearTurnoRegular({
                clienteId: 1, servicioId: 4, instructorId: 9, salaId: 4,
                fechaHora: '2027-05-12T13:00:00.000Z'
            }, tokenAdmin);
            assert.equal(turnoGabinete.estado, 201, 'Precondición: no se pudo ocupar el gabinete.');

            const turnoAMover = await crearTurnoRegular({
                clienteId: 2, servicioId: 1, instructorId: 1, salaId: 1,
                fechaHora: '2027-05-12T13:00:00.000Z'
            }, tokenAdmin);
            assert.equal(turnoAMover.estado, 201, 'Precondición: no se pudo crear el segundo turno.');

            const respuesta = await pedir(`/turnos/${turnoAMover.cuerpo.turno.id}`, {
                metodo: 'PUT',
                cuerpo: { servicioId: 4, instructorId: 10, salaId: 4 },
                token: tokenAdmin
            });
            assert.equal(respuesta.estado, 409,
                `El gabinete individual quedó con 2 personas tras un PUT (HTTP ${respuesta.estado}).`);
        });
    });

    describe('Punto 10 - Coherencia entre servicio, sala e instructor', () => {
        test('No se reserva Pilates Reformer (requiere sala 1) en el Salón Cardio (sala 2)', async () => {
            const respuesta = await crearTurnoRegular({
                clienteId: 3, servicioId: 1, instructorId: 1, salaId: 2,
                fechaHora: '2027-05-13T13:00:00.000Z'
            }, tokenAdmin);
            assert.notEqual(respuesta.estado, 201,
                'Se registró un turno de Pilates Reformer en una sala que no es la requerida por el servicio.');
        });

        test('No se asigna Pilates Reformer a una instructora de Hatha Yoga', async () => {
            const respuesta = await crearTurnoRegular({
                clienteId: 3, servicioId: 1, instructorId: 2, salaId: 1,
                fechaHora: '2027-05-13T15:00:00.000Z'
            }, tokenAdmin);
            assert.notEqual(respuesta.estado, 201,
                'Se registró una clase de Pilates Reformer con una instructora cuya especialidad es Hatha Yoga.');
        });
    });

    describe('Punto 11 - El apto médico vencido impide reservar', () => {
        test('Un socio con apto médico vencido no puede reservar desde la web', async () => {
            // Un apto solo vence con el tiempo, así que el vencimiento pasado se escribe directo en la base.
            const conexion = await mongoose.createConnection(URI_MONGO_PRUEBA).asPromise();
            await conexion.collection('clientes').updateOne(
                { id: 5 },
                { $set: { fechaEmisionApto: new Date('2025-01-01'), fechaVencimientoApto: new Date('2026-01-01') } }
            );
            await conexion.close();
            const { cookieSesion } = await iniciarSesionWeb('luis.lopez@mail.com', '123456');
            assert.ok(cookieSesion, 'Precondición: Luis López no pudo iniciar sesión.');

            const respuesta = await pedir('/reservar', {
                metodo: 'POST',
                cookie: cookieSesion,
                encabezados: { Accept: 'text/html' },
                formulario: { servicioId: '1', instructorId: '4', salaId: '1', fecha: '2027-05-14', hora: '10:00' }
            });
            const reservaExitosa = (respuesta.ubicacion || '').startsWith('/mis-turnos?exito');
            assert.equal(reservaExitosa, false,
                'Luis López tiene el apto médico vencido y aun así reservó una clase de Pilates.');
        });
    });

    describe('Punto 12 - Generación de ids con altas concurrentes', () => {
        test('10 altas simultáneas de clientes se registran todas correctamente', async () => {
            const altas = Array.from({ length: 10 }, (_, i) => pedir('/clientes', {
                metodo: 'POST',
                token: tokenAdmin,
                cuerpo: {
                    nombre: 'Concurrente', apellido: `Numero${i}`, dni: `5000000${i}`,
                    email: `concurrente${i}@mail.com`, password: 'clave123'
                }
            }));
            const respuestas = await Promise.all(altas);
            const estados = respuestas.map(r => r.estado);
            assert.ok(estados.every(estado => estado === 201),
                `Algunas altas fallaron por id duplicado. Estados HTTP obtenidos: ${estados.join(', ')}`);
        });
    });

    describe('Fechas de emisión y vencimiento del apto', () => {
        const zona = { timeZone: 'America/Argentina/Buenos_Aires' };
        const hoy = new Date().toLocaleDateString('en-CA', zona);
        const ayer = new Date(Date.now() - 86400000).toLocaleDateString('en-CA', zona);

        // Atajo para cargar el apto del socio 5 por la API.
        function cargarApto(cuerpo) {
            return pedir('/clientes/5', { metodo: 'PUT', token: tokenAdmin, cuerpo });
        }

        test('Sin vencimiento cargado, se fija al año de la emisión', async () => {
            const respuesta = await cargarApto({ fechaEmisionApto: hoy, fechaVencimientoApto: null });
            assert.equal(respuesta.estado, 200);
            assert.equal(respuesta.cuerpo.fechaVencimientoApto, `${Number(hoy.slice(0, 4)) + 1}${hoy.slice(4)}T00:00:00.000Z`);
        });

        test('Se respeta un vencimiento especial anterior al año', async () => {
            const respuesta = await cargarApto({ fechaEmisionApto: hoy, fechaVencimientoApto: '2099-01-01' });
            assert.equal(respuesta.cuerpo.fechaVencimientoApto, '2099-01-01T00:00:00.000Z');
            const especial = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-CA', zona);
            const respuestaEspecial = await cargarApto({ fechaEmisionApto: hoy, fechaVencimientoApto: especial });
            assert.equal(respuestaEspecial.cuerpo.fechaVencimientoApto, `${especial}T00:00:00.000Z`);
            assert.equal(respuestaEspecial.cuerpo.aptoMedicoVigente, true);
        });

        test('Al renovar repitiendo el vencimiento guardado, se conserva', async () => {
            await cargarApto({ fechaEmisionApto: hoy, fechaVencimientoApto: '2099-01-01' });
            const respuesta = await cargarApto({ fechaEmisionApto: ayer, fechaVencimientoApto: '2099-01-01' });
            assert.equal(respuesta.cuerpo.fechaVencimientoApto, '2099-01-01T00:00:00.000Z');
        });

        test('Al renovar con una nueva emisión sin vencimiento, se recalcula al año', async () => {
            const respuesta = await cargarApto({ fechaEmisionApto: hoy });
            assert.equal(respuesta.cuerpo.fechaVencimientoApto, `${Number(hoy.slice(0, 4)) + 1}${hoy.slice(4)}T00:00:00.000Z`);
        });

        test('El apto sigue vigente el día del vencimiento y vence al día siguiente', async () => {
            const conexion = await mongoose.createConnection(URI_MONGO_PRUEBA).asPromise();
            await conexion.collection('clientes').updateOne({ id: 5 }, { $set: { fechaVencimientoApto: new Date(hoy) } });
            let respuesta = await pedir('/clientes/5', { token: tokenAdmin });
            assert.equal(respuesta.cuerpo.aptoMedicoVigente, true);
            await conexion.collection('clientes').updateOne({ id: 5 }, { $set: { fechaVencimientoApto: new Date(ayer) } });
            respuesta = await pedir('/clientes/5', { token: tokenAdmin });
            assert.equal(respuesta.cuerpo.aptoMedicoVigente, false);
            await conexion.close();
        });

        test('Se acepta una emisión de hace 7 días y se rechaza una de hace 8', async () => {
            let respuesta = await cargarApto({ fechaEmisionApto: new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', zona), fechaVencimientoApto: null });
            assert.equal(respuesta.estado, 200);
            respuesta = await cargarApto({ fechaEmisionApto: new Date(Date.now() - 8 * 86400000).toLocaleDateString('en-CA', zona), fechaVencimientoApto: null });
            assert.equal(respuesta.estado, 400);
        });

        test('Se rechaza una emisión con fecha futura', async () => {
            const respuesta = await cargarApto({ fechaEmisionApto: new Date(Date.now() + 86400000).toLocaleDateString('en-CA', zona), fechaVencimientoApto: null });
            assert.equal(respuesta.estado, 400);
        });

        test('Se rechaza un vencimiento anterior a la emisión', async () => {
            const respuesta = await cargarApto({ fechaEmisionApto: hoy, fechaVencimientoApto: ayer });
            assert.equal(respuesta.estado, 400);
        });

        test('Un cliente nuevo queda pendiente y no se acepta vencimiento sin emisión', async () => {
            const alta = await pedir('/clientes', {
                metodo: 'POST', token: tokenAdmin,
                cuerpo: { nombre: 'Apto', apellido: 'Pendiente', dni: '70000001', email: 'apto.pendiente@mail.com' }
            });
            assert.equal(alta.estado, 201);
            assert.equal(alta.cuerpo.cliente.aptoMedicoVigente, false);
            const respuesta = await pedir(`/clientes/${alta.cuerpo.cliente.id}`, {
                metodo: 'PUT', token: tokenAdmin,
                cuerpo: { fechaVencimientoApto: '2099-01-01' }
            });
            assert.equal(respuesta.estado, 400);
        });

        test('Un socio no puede cargar su propio apto', async () => {
            const { token } = await obtenerTokenJWT('luis.lopez@mail.com', '123456');
            const respuesta = await pedir('/clientes/5', {
                metodo: 'PUT', token,
                cuerpo: { fechaEmisionApto: hoy }
            });
            assert.equal(respuesta.estado, 403);
        });

        test('Recepción ve la opción Apto Físico y carga el apto desde la pantalla web', async () => {
            const { cookieSesion } = await iniciarSesionWeb('admin@espaciosideral.com', 'admin123');
            const pantalla = await pedir('/vista/apto-fisico', { cookie: cookieSesion, encabezados: { Accept: 'text/html' } });
            assert.equal(pantalla.estado, 200);
            assert.ok(pantalla.cuerpo.includes('href="/vista/apto-fisico"'));
            assert.equal(pantalla.cuerpo.includes('name="fechaVencimientoApto"'), true);

            const respuesta = await pedir('/vista/apto-fisico', {
                metodo: 'POST', cookie: cookieSesion,
                encabezados: { Accept: 'text/html' },
                formulario: { clienteId: '5', fechaEmisionApto: hoy }
            });
            assert.ok((respuesta.ubicacion || '').includes('exitoApto='), respuesta.ubicacion);
        });

        test('La pantalla web respeta un vencimiento especial', async () => {
            const { cookieSesion } = await iniciarSesionWeb('admin@espaciosideral.com', 'admin123');
            const respuesta = await pedir('/vista/apto-fisico', {
                metodo: 'POST', cookie: cookieSesion,
                encabezados: { Accept: 'text/html' },
                formulario: { clienteId: '5', fechaEmisionApto: hoy, fechaVencimientoApto: '2099-01-01' }
            });
            assert.ok((respuesta.ubicacion || '').includes('exitoApto='), respuesta.ubicacion);
            const socio = await pedir('/clientes/5', { token: tokenAdmin });
            assert.equal(socio.cuerpo.fechaVencimientoApto, '2099-01-01T00:00:00.000Z');
        });

        test('La pantalla web informa el error de una emisión fuera de plazo', async () => {
            const { cookieSesion } = await iniciarSesionWeb('admin@espaciosideral.com', 'admin123');
            const respuesta = await pedir('/vista/apto-fisico', {
                metodo: 'POST', cookie: cookieSesion,
                encabezados: { Accept: 'text/html' },
                formulario: { clienteId: '5', fechaEmisionApto: '2020-01-01' }
            });
            assert.ok((respuesta.ubicacion || '').includes('errorApto='), respuesta.ubicacion);
        });

        test('Un socio con una emisión de más de 7 días puede iniciar sesión y ser actualizado', async () => {
            const conexion = await mongoose.createConnection(URI_MONGO_PRUEBA).asPromise();
            await conexion.collection('clientes').updateOne(
                { id: 5 },
                { $set: { fechaEmisionApto: new Date('2025-01-01'), fechaVencimientoApto: new Date('2026-01-01') } }
            );
            await conexion.close();

            const { respuesta, cookieSesion } = await iniciarSesionWeb('luis.lopez@mail.com', '123456');
            assert.ok(cookieSesion);
            assert.equal(respuesta.ubicacion, '/mis-turnos');

            const actualizacion = await pedir('/clientes/5', { metodo: 'PUT', token: tokenAdmin, cuerpo: { telefono: '1140000005' } });
            assert.equal(actualizacion.estado, 200);
        });

        test('Un socio no accede a la pantalla de Apto Físico', async () => {
            const { cookieSesion } = await iniciarSesionWeb('luis.lopez@mail.com', '123456');
            const respuesta = await pedir('/vista/apto-fisico', { cookie: cookieSesion, encabezados: { Accept: 'text/html' } });
            assert.equal(respuesta.estado, 403);
        });
    });

    describe('Punto 13 - No quedan turnos huérfanos', () => {
        test('No se puede eliminar una sala que tiene turnos reservados', async () => {
            // Sala 2 del seed: es la que requiere el servicio 3.
            const salaId = 2;

            const turnoCreado = await crearTurnoRegular({
                clienteId: 1, servicioId: 3, instructorId: 7, salaId,
                fechaHora: '2027-05-15T13:00:00.000Z'
            }, tokenAdmin);
            assert.equal(turnoCreado.estado, 201, 'Precondición: no se pudo crear el turno en la sala.');

            const respuesta = await pedir(`/salas/${salaId}`, { metodo: 'DELETE', token: tokenAdmin });
            assert.notEqual(respuesta.estado, 200,
                `Se eliminó la sala ${salaId} y el turno ${turnoCreado.cuerpo.turno.id} quedó apuntando a una sala inexistente.`);
        });
    });

    describe('Punto 14 - Zona horaria de las reservas web', () => {
        test('Una reserva a las 10:00 (hora de Argentina) se guarda como 13:00 UTC con el servidor en UTC', async () => {
            const { cookieSesion } = await iniciarSesionWeb('juan.perez@mail.com', '123456');
            assert.ok(cookieSesion, 'Precondición: Juan Pérez no pudo iniciar sesión.');

            const reserva = await pedir('/reservar', {
                metodo: 'POST',
                cookie: cookieSesion,
                encabezados: { Accept: 'text/html' },
                formulario: { servicioId: '1', instructorId: '1', salaId: '1', fecha: '2027-06-01', hora: '10:00' }
            });
            assert.ok((reserva.ubicacion || '').startsWith('/mis-turnos?exito'), 'Precondición: la reserva no se registró.');

            const turnosCliente = await pedir('/turnos/cliente/1', { token: tokenAdmin });
            const turnoReservado = turnosCliente.cuerpo.find(turno => turno.fechaHora.startsWith('2027-06-01'));
            assert.equal(turnoReservado.fechaHora, '2027-06-01T13:00:00.000Z',
                `El socio pidió las 10:00 de Argentina, pero se guardó ${turnoReservado.fechaHora} (se mostrará 3 horas antes).`);
        });
    });
});
