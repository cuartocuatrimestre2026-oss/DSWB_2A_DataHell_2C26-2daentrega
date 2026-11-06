// Utilidad para levantar el servidor TurnoFlex en un proceso aparte,
// siempre contra una base de datos LOCAL y descartable.
const { spawn } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

const PUERTO_PRUEBA = 3100;
const URI_MONGO_PRUEBA = 'mongodb://127.0.0.1:27017/turnoflex_pruebas';
const URL_BASE = `http://127.0.0.1:${PUERTO_PRUEBA}`;
const RAIZ_PROYECTO = path.resolve(__dirname, '..', '..');

// Tiempo máximo de espera para que el servidor responda.
const TIEMPO_MAXIMO_ARRANQUE_MS = 20000;

let procesoServidor = null;
let zonaHorariaActual = undefined;

// Borra por completo la base de prueba para partir de un estado conocido y limpio.
async function borrarBaseDePrueba() {
    const conexion = await mongoose.createConnection(URI_MONGO_PRUEBA, { serverSelectionTimeoutMS: 5000 }).asPromise();
    await conexion.dropDatabase();
    await conexion.close();
}

// Espera hasta que el servidor responda en la ruta raíz.
async function esperarServidorListo(registros) {
    const limite = Date.now() + TIEMPO_MAXIMO_ARRANQUE_MS;
    while (Date.now() < limite) {
        if (!procesoServidor || procesoServidor.exitCode !== null) {
            throw new Error(`El servidor de prueba terminó antes de estar listo.\n${registros.join('')}`);
        }
        try {
            const respuesta = await fetch(`${URL_BASE}/`);
            if (respuesta.ok) return;
        } catch {
            // Todavía no escucha: se reintenta.
        }
        await new Promise(resolver => setTimeout(resolver, 250));
    }
    throw new Error(`El servidor de prueba no respondió a tiempo.\n${registros.join('')}`);
}

// Arranca app.js con variables de entorno forzadas para el entorno de prueba.
async function arrancarProceso() {
    const registros = [];
    const variablesEntorno = {
        ...process.env,
        PORT: String(PUERTO_PRUEBA),
        MONGODB_URI: URI_MONGO_PRUEBA,
        NODE_ENV: 'test'
    };
    if (zonaHorariaActual) variablesEntorno.TZ = zonaHorariaActual;

    procesoServidor = spawn(process.execPath, ['app.js'], {
        cwd: RAIZ_PROYECTO,
        env: variablesEntorno,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    procesoServidor.stdout.on('data', dato => registros.push(dato.toString()));
    procesoServidor.stderr.on('data', dato => registros.push(dato.toString()));

    await esperarServidorListo(registros);
}

// Borra la base de prueba y levanta el servidor (el seed corre al arrancar).
// opciones.zonaHoraria permite simular el huso horario del servidor.
async function iniciarServidorPrueba(opciones = {}) {
    zonaHorariaActual = opciones.zonaHoraria;
    await borrarBaseDePrueba();
    await arrancarProceso();
}

// Detiene el proceso del servidor y espera a que libere el puerto.
async function detenerServidorPrueba() {
    if (!procesoServidor) return;
    const proceso = procesoServidor;
    procesoServidor = null;
    if (proceso.exitCode !== null) return;
    await new Promise(resolver => {
        proceso.once('exit', resolver);
        proceso.kill();
    });
}

// Reinicia el servidor SIN borrar la base (simula un redeploy o reinicio en producción).
async function reiniciarServidorPrueba() {
    await detenerServidorPrueba();
    await arrancarProceso();
}

module.exports = {
    PUERTO_PRUEBA,
    URI_MONGO_PRUEBA,
    URL_BASE,
    RAIZ_PROYECTO,
    iniciarServidorPrueba,
    detenerServidorPrueba,
    reiniciarServidorPrueba
};
