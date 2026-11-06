document.addEventListener('DOMContentLoaded', () => {
    // Manejo accesible del modal de sobreturnos.
    const btnToggleSobreturno = document.getElementById('btn-toggle-sobreturno');
    const modalSobreturno = document.getElementById('modal-sobreturno');
    if (btnToggleSobreturno && modalSobreturno) {
        btnToggleSobreturno.addEventListener('click', () => {
            modalSobreturno.classList.toggle('activo');
        });
    }

    // Interceptor accesible para formularios de confirmación.
    const formsConfirmar = document.querySelectorAll('form[data-confirm]');
    formsConfirmar.forEach(form => {
        form.addEventListener('submit', (e) => {
            const mensaje = form.getAttribute('data-confirm') || '¿Está seguro de continuar?';
            if (!confirm(mensaje)) {
                e.preventDefault();
            }
        });
    });

    // Cliente WebSockets / Socket.io para el Asistente Virtual.
    if (typeof io !== 'undefined') {
        const socket = io();
        const botonChat = document.getElementById('chat-widget-boton');
        const ventanaChat = document.getElementById('chat-widget-ventana');
        const btnCerrar = document.getElementById('chat-btn-cerrar');
        const formChat = document.getElementById('chat-form');
        const inputChat = document.getElementById('chat-input');
        const contenedorMensajes = document.getElementById('chat-mensajes');

        if (botonChat && ventanaChat && btnCerrar) {
            botonChat.addEventListener('click', () => {
                ventanaChat.classList.toggle('oculto');
                if (!ventanaChat.classList.contains('oculto') && inputChat) {
                    inputChat.focus();
                }
            });

            btnCerrar.addEventListener('click', () => {
                ventanaChat.classList.add('oculto');
            });
        }

        if (formChat && inputChat && contenedorMensajes) {
            formChat.addEventListener('submit', (e) => {
                e.preventDefault();
                const texto = inputChat.value.trim();
                if (!texto) return;

                // Renderizar mensaje del usuario localmente
                agregarMensaje('Vos', texto, 'usuario');
                socket.emit('mensaje_cliente', { texto });
                inputChat.value = '';
            });

            // Recepción de respuesta del servidor (TurnoBot).
            socket.on('mensaje_servidor', (data) => {
                agregarMensaje(data.autor || 'TurnoBot', data.texto, 'bot', data.timestamp);
            });
        }

        function agregarMensaje(autor, texto, tipo, hora) {
            if (!contenedorMensajes) return;
            const div = document.createElement('div');
            div.className = `burbuja-chat burbuja-${tipo}`;

            const headerSpan = document.createElement('div');
            headerSpan.className = 'burbuja-autor';
            headerSpan.textContent = autor + (hora ? ` • ${hora}` : '');

            const textoP = document.createElement('div');
            textoP.className = 'burbuja-texto';
            textoP.textContent = texto;

            div.appendChild(headerSpan);
            div.appendChild(textoP);
            contenedorMensajes.appendChild(div);
            contenedorMensajes.scrollTop = contenedorMensajes.scrollHeight;
        }
    }
});