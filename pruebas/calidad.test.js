// Pruebas de calidad y prolijidad.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RAIZ_PROYECTO, iniciarServidorPrueba, detenerServidorPrueba } = require('./utilidades/servidorPrueba');
const { pedir, obtenerTokenJWT } = require('./utilidades/clienteHttp');

// Devuelve todas las plantillas .pug dentro de una carpeta.
function listarPlantillasPug(carpeta) {
    return fs.readdirSync(carpeta, { withFileTypes: true }).flatMap(entrada => {
        const rutaCompleta = path.join(carpeta, entrada.name);
        if (entrada.isDirectory()) return listarPlantillasPug(rutaCompleta);
        return entrada.name.endsWith('.pug') ? [rutaCompleta] : [];
    });
}

describe('Calidad', () => {
    let tokenAdmin = null;

    before(async () => {
        await iniciarServidorPrueba();
        ({ token: tokenAdmin } = await obtenerTokenJWT('admin@espaciosideral.com', 'admin123'));
    });

    after(async () => {
        await detenerServidorPrueba();
    });

    describe('Punto 15 - La API responde JSON a clientes como Thunder Client o Postman', () => {
        test('Una ruta inexistente de la API devuelve JSON con "Accept: */*"', async () => {
            const respuesta = await pedir('/turnos/1/ruta-inexistente', {
                token: tokenAdmin,
                encabezados: { Accept: '*/*' }
            });
            assert.equal(respuesta.estado, 404);
            assert.match(respuesta.tipoContenido, /application\/json/,
                `El 404 de la API devolvió "${respuesta.tipoContenido}" en lugar de JSON.`);
        });

        test('Un error de validación de la API devuelve JSON con "Accept: */*"', async () => {
            const respuesta = await pedir('/salas', {
                metodo: 'POST',
                token: tokenAdmin,
                cuerpo: { nombre: 'Sala inválida', capacidadNormal: 0 },
                encabezados: { Accept: '*/*' }
            });
            assert.match(respuesta.tipoContenido, /application\/json/,
                `El error de la API (HTTP ${respuesta.estado}) devolvió "${respuesta.tipoContenido}" en lugar de JSON.`);
        });
    });

    describe('Punto 16 - Colección de Thunder Client', () => {
        test('Existe turnoflex_thunder_collection.json, mencionado en el README', () => {
            const existeColeccion = fs.existsSync(path.join(RAIZ_PROYECTO, 'turnoflex_thunder_collection.json'));
            assert.equal(existeColeccion, true,
                'El README menciona turnoflex_thunder_collection.json, pero el archivo no está en el proyecto.');
        });
    });

    describe('Punto 17 - Sin estilos ni JS en línea en las vistas Pug', () => {
        test('Ninguna plantilla usa style=, onclick= u onsubmit=', () => {
            const PATRON_EN_LINEA = /\b(style|onclick|onsubmit)\s*=/;
            const hallazgos = [];
            for (const plantilla of listarPlantillasPug(path.join(RAIZ_PROYECTO, 'views'))) {
                fs.readFileSync(plantilla, 'utf8').split(/\r?\n/).forEach((linea, indice) => {
                    if (PATRON_EN_LINEA.test(linea)) {
                        hallazgos.push(`${path.relative(RAIZ_PROYECTO, plantilla)}:${indice + 1}`);
                    }
                });
            }
            assert.equal(hallazgos.length, 0,
                `Se encontraron ${hallazgos.length} atributos en línea:\n  ${hallazgos.join('\n  ')}`);
        });
    });

    describe('Punto 19 - Archivos del IDE fuera del repositorio', () => {
        test('.gitignore excluye la carpeta .vs/ de Visual Studio', () => {
            const lineas = fs.readFileSync(path.join(RAIZ_PROYECTO, '.gitignore'), 'utf8')
                .split(/\r?\n/).map(linea => linea.trim());
            assert.ok(lineas.some(linea => ['.vs', '.vs/', '/.vs', '/.vs/'].includes(linea)),
                '.gitignore no excluye .vs/, y esa carpeta (con slnx.sqlite) está en el proyecto.');
        });
    });
});
