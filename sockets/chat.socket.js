const { procesarMensaje } = require('../services/asistenteIA.service');

function inicializarSockets(io) {
    io.on('connection', (socket) => {
        // Obtiene el usuario de la sesión si existe.
        const usuarioSesion = socket.request.session ? socket.request.session.usuario : null;

        // Mensaje de bienvenida inicial.
        socket.emit('mensaje_servidor', {
            autor: 'TurnoBot',
            texto: usuarioSesion 
                ? `¡Hola ${usuarioSesion.nombre}! ¿Tenés dudas sobre tus reservas, salas o disciplinas? Escribime.`
                : '¡Hola! Bienvenido al asistente interactivo de Espacio Sideral. ¿En qué puedo orientarte?',
            timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        });

        // Escucha de mensajes del cliente.
        socket.on('mensaje_cliente', async (data) => {
            const mensajeTexto = (data && data.texto) ? data.texto : '';
            
            // Procesamiento a través del motor inteligente.
            const respuestaTexto = await procesarMensaje(mensajeTexto, usuarioSesion);

            socket.emit('mensaje_servidor', {
                autor: 'TurnoBot',
                texto: respuestaTexto,
                timestamp: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
            });
        });

        socket.on('disconnect', () => {
        });
    });
}

module.exports = inicializarSockets;