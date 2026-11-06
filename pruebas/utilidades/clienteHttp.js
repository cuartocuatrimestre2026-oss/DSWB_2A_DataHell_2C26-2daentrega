// Cliente HTTP mínimo para las pruebas: peticiones JSON o de formulario,
// manejo manual de la cookie de sesión y obtención de tokens JWT.
const { URL_BASE } = require('./servidorPrueba');

// Envía una petición al servidor de prueba sin seguir redirecciones.
// opciones: metodo, cuerpo (JSON), formulario (urlencoded), cookie, token, encabezados.
async function pedir(ruta, opciones = {}) {
    const { metodo = 'GET', cuerpo, formulario, cookie, token, encabezados = {} } = opciones;
    const cabeceras = { Accept: 'application/json', ...encabezados };
    let contenido;

    if (formulario) {
        cabeceras['Content-Type'] = 'application/x-www-form-urlencoded';
        contenido = new URLSearchParams(formulario).toString();
    } else if (cuerpo !== undefined) {
        cabeceras['Content-Type'] = 'application/json';
        contenido = JSON.stringify(cuerpo);
    }
    if (cookie) cabeceras.Cookie = cookie;
    if (token) cabeceras.Authorization = `Bearer ${token}`;

    const respuesta = await fetch(`${URL_BASE}${ruta}`, {
        method: metodo,
        headers: cabeceras,
        body: contenido,
        redirect: 'manual'
    });

    const tipoContenido = respuesta.headers.get('content-type') || '';
    const texto = await respuesta.text();
    let datos = texto;
    if (tipoContenido.includes('application/json')) {
        try { datos = JSON.parse(texto); } catch { /* se deja como texto */ }
    }

    return {
        estado: respuesta.status,
        tipoContenido,
        ubicacion: respuesta.headers.get('location'),
        cookies: respuesta.headers.getSetCookie(),
        cuerpo: datos
    };
}

// Inicia sesión por el formulario web y devuelve la respuesta y la cookie de sesión (o null).
async function iniciarSesionWeb(identificador, password) {
    const respuesta = await pedir('/login', {
        metodo: 'POST',
        formulario: { identificador, password },
        encabezados: { Accept: 'text/html' }
    });
    const cookieEncontrada = respuesta.cookies.find(valor => valor.startsWith('connect.sid='));
    const cookieSesion = cookieEncontrada ? cookieEncontrada.split(';')[0] : null;
    return { respuesta, cookieSesion };
}

// Pide un token JWT a la API y devuelve la respuesta y el token (o null).
async function obtenerTokenJWT(identificador, password) {
    const respuesta = await pedir('/login/token', {
        metodo: 'POST',
        cuerpo: { identificador, password }
    });
    const token = (respuesta.cuerpo && respuesta.cuerpo.token) ? respuesta.cuerpo.token : null;
    return { respuesta, token };
}

// Atajo para dar de alta un turno regular por la API.
async function crearTurnoRegular(datos, token) {
    return pedir('/turnos', { metodo: 'POST', cuerpo: datos, token });
}

module.exports = {
    pedir,
    iniciarSesionWeb,
    obtenerTokenJWT,
    crearTurnoRegular
};
