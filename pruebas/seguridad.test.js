// Pruebas de seguridad.
// Cada prueba describe el comportamiento SEGURO esperado: hoy fallan y así demuestran la falla.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    RAIZ_PROYECTO,
    iniciarServidorPrueba,
    detenerServidorPrueba,
    reiniciarServidorPrueba
} = require('./utilidades/servidorPrueba');
const { pedir, iniciarSesionWeb, obtenerTokenJWT } = require('./utilidades/clienteHttp');

// Lee un archivo del proyecto como texto.
function leerArchivo(rutaRelativa) {
    return fs.readFileSync(path.join(RAIZ_PROYECTO, rutaRelativa), 'utf8');
}

describe('Seguridad', () => {
    let tokenAdmin = null;

    before(async () => {
        await iniciarServidorPrueba();
        // Token de recepción: se envía en los pasos de preparación para que sigan
        // funcionando cuando la API se proteja con JWT.
        ({ token: tokenAdmin } = await obtenerTokenJWT('admin@espaciosideral.com', 'admin123'));
    });

    after(async () => {
        await detenerServidorPrueba();
    });

    describe('Punto 1 - La API REST exige autenticación', () => {
        test('GET /clientes sin token no expone el padrón de socios', async () => {
            const respuesta = await pedir('/clientes');
            assert.equal(respuesta.estado, 401,
                `Se obtuvo el padrón completo sin autenticarse (HTTP ${respuesta.estado}).`);
        });

        test('POST /salas sin token es rechazado', async () => {
            const respuesta = await pedir('/salas', {
                metodo: 'POST',
                cuerpo: { nombre: 'Sala creada por un anónimo', capacidadNormal: 5 }
            });
            assert.equal(respuesta.estado, 401,
                `Un anónimo pudo crear una sala (HTTP ${respuesta.estado}).`);
        });

        test('DELETE /turnos/:id sin token es rechazado', async () => {
            const respuesta = await pedir('/turnos/2', { metodo: 'DELETE' });
            assert.equal(respuesta.estado, 401,
                `Un anónimo pudo cancelar un turno ajeno (HTTP ${respuesta.estado}).`);
        });
    });

    describe('Punto 2 - Nadie puede auto-asignarse el rol empleado', () => {
        test('Un usuario creado anónimamente con rol "empleado" no accede a la consola de recepción', async () => {
            await pedir('/clientes', {
                metodo: 'POST',
                cuerpo: {
                    nombre: 'Intruso', apellido: 'Anonimo', dni: '11111111',
                    email: 'intruso@mail.com', password: 'clave123', rol: 'empleado'
                }
            });
            const { cookieSesion } = await iniciarSesionWeb('intruso@mail.com', 'clave123');
            const respuesta = await pedir('/vista/turnos', {
                cookie: cookieSesion,
                encabezados: { Accept: 'text/html' }
            });
            assert.notEqual(respuesta.estado, 200,
                'Un usuario dado de alta sin autenticación, con rol "empleado", entró a /vista/turnos.');
        });

        test('Un socio no puede escalar a empleado con PUT /clientes/:id', async () => {
            await pedir('/clientes/1', { metodo: 'PUT', cuerpo: { rol: 'empleado' } });
            const { cookieSesion } = await iniciarSesionWeb('juan.perez@mail.com', '123456');
            const respuesta = await pedir('/vista/turnos', {
                cookie: cookieSesion,
                encabezados: { Accept: 'text/html' }
            });
            assert.notEqual(respuesta.estado, 200,
                'El socio Juan Pérez cambió su propio rol a "empleado" y entró a la consola de recepción.');
        });
    });

    describe('Punto 3 - No hay credenciales reales en archivos versionados', () => {
        // No marca valores de ejemplo entre <>, como <USUARIO>:<PASSWORD>.
        const PATRON_URI_CON_CLAVE = /mongodb(\+srv)?:\/\/(?!<)[^:\s/]+:(?!<)[^@\s]+@/;

        test('.env.example no contiene usuario y contraseña de MongoDB', () => {
            assert.doesNotMatch(leerArchivo('.env.example'), PATRON_URI_CON_CLAVE,
                '.env.example publica una cadena de conexión con usuario y contraseña.');
        });

        test('README.md no contiene usuario y contraseña de MongoDB', () => {
            assert.doesNotMatch(leerArchivo('README.md'), PATRON_URI_CON_CLAVE,
                'README.md publica una cadena de conexión con usuario y contraseña.');
        });
    });

    describe('Punto 4 - Sin secretos por defecto en el código', () => {
        const PATRON_SECRETO_POR_DEFECTO = /process\.env\.(SESSION_SECRET|JWT_SECRET)\s*\|\|\s*['"`]/;
        const archivosConSecretos = ['app.js', 'middlewares/jwtMiddleware.js', 'controllers/auth.controller.js'];

        for (const archivo of archivosConSecretos) {
            test(`${archivo} no define un secreto de respaldo fijo`, () => {
                assert.doesNotMatch(leerArchivo(archivo), PATRON_SECRETO_POR_DEFECTO,
                    `${archivo} usa un secreto fijo si falta la variable de entorno: cualquiera que lea el repositorio puede firmar sesiones o tokens.`);
            });
        }

        test('La cookie de sesión declara la opción secure', () => {
            assert.match(leerArchivo('app.js'), /secure\s*:/,
                'La configuración de express-session no define "secure" para la cookie.');
        });
    });

    describe('Punto 5 - POST /login/token respeta bloqueos y estados', () => {
        test('Un usuario bloqueado por 3 intentos fallidos en la web no obtiene token', async () => {
            for (let i = 0; i < 3; i++) {
                await iniciarSesionWeb('maria.gomez@mail.com', 'clave-incorrecta');
            }
            const { respuesta } = await obtenerTokenJWT('maria.gomez@mail.com', '123456');
            assert.notEqual(respuesta.estado, 200,
                'María Gómez está bloqueada 15 minutos en la web pero obtuvo un token JWT válido.');
        });

        test('Los intentos fallidos en /login/token también cuentan para el bloqueo', async () => {
            for (let i = 0; i < 5; i++) {
                await obtenerTokenJWT('ana.fernandez@mail.com', 'clave-incorrecta');
            }
            const { respuesta } = await obtenerTokenJWT('ana.fernandez@mail.com', '123456');
            assert.notEqual(respuesta.estado, 200,
                'Tras 5 intentos fallidos por la API, la cuenta no se bloqueó y se emitió el token.');
        });

        test('Un socio dado de baja (inactivo) no obtiene token', async () => {
            await pedir('/clientes/3', { metodo: 'DELETE', token: tokenAdmin });
            const { respuesta } = await obtenerTokenJWT('carlos.rodriguez@mail.com', '123456');
            assert.notEqual(respuesta.estado, 200,
                'Carlos Rodríguez está inactivo pero obtuvo un token JWT válido.');
        });
    });

    // Va al final porque reinicia el servidor.
    describe('Punto 6 - Reiniciar el servidor no restablece la clave del admin', () => {
        test('Tras cambiar la clave del admin y reiniciar, "admin123" deja de funcionar', async () => {
            await pedir('/clientes/999', {
                metodo: 'PUT',
                cuerpo: { password: 'ClaveNueva2026' },
                token: tokenAdmin
            });
            await reiniciarServidorPrueba();
            const { respuesta } = await iniciarSesionWeb('admin@espaciosideral.com', 'admin123');
            const entroComoAdmin = respuesta.estado === 302 && respuesta.ubicacion === '/vista/turnos';
            assert.equal(entroComoAdmin, false,
                'El seed volvió a poner la clave "admin123" al reiniciar: la clave conocida sigue dando acceso a recepción.');
        });
    });
});
