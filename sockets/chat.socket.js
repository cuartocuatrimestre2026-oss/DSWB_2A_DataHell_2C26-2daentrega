const asistenteService = require('../services/asistenteIA.service');

// Soporte desacoplado, obtiene la función de procesamiento sin importar cómo sea importada.
const procesar = asistenteService.procesarConsulta || asistenteService.procesarMensaje;

function inicializarSockets(io) {
    io.on('connection', (socket) => {
        // Recuperación segura de la sesión del usuario
        const sesion = socket.request && socket.request.session;
        const usuarioSesion = (sesion && sesion.usuario) ? sesion.usuario : null;

        // Saludo de bienvenida inicial hacia el cliente.
        const mensajeBienvenida = {
            autor: 'TurnoBot',
            texto: usuarioSesion 
                ? `¡Hola ${usuarioSesion.nombre}! ¿Tenés dudas sobre tus reservas, salas o disciplinas? Escribime.`
                : '¡Hola! Bienvenido al asistente interactivo de Espacio Sideral. ¿En qué puedo orientarte?',
            timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        };

        // Emite en ambos canales para garantizar recepción según el script del cliente.
        socket.emit('mensaje_servidor', mensajeBienvenida);
        socket.emit('respuesta-chat', mensajeBienvenida);

        // Función unificada de atención de mensajes.
        const manejarMensajeEntrante = async (data) => {
            try {
                const mensajeTexto = (typeof data === 'string') ? data : ((data && data.texto) ? data.texto : '');
                if (!mensajeTexto.trim()) return;

                let respuestaTexto = '';
                if (typeof procesar === 'function') {
                    respuestaTexto = await procesar(mensajeTexto, usuarioSesion);
                } else {
                    respuestaTexto = 'El motor de asistencia no se encuentra disponible momentáneamente.';
                }

                const paqueteRespuesta = {
                    autor: 'TurnoBot',
                    texto: respuestaTexto,
                    timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                };

                socket.emit('mensaje_servidor', paqueteRespuesta);
                socket.emit('respuesta-chat', paqueteRespuesta);
            } catch (error) {
                console.error("Error en procesamiento de socket chat:", error.message);
                const paqueteError = {
                    autor: 'Sistema',
                    texto: 'Ocurrió un error al procesar tu consulta. Por favor, reintentá.',
                    timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                };
                socket.emit('mensaje_servidor', paqueteError);
                socket.emit('respuesta-chat', paqueteError);
            }
        };

        // Escucha ambos nombres de eventos para compatibilidad total con main.js
        socket.on('mensaje_cliente', manejarMensajeEntrante);
        socket.on('mensaje-chat', manejarMensajeEntrante);

        socket.on('disconnect', () => {
        });
    });
}

module.exports = inicializarSockets;