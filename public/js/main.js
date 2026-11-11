document.addEventListener('DOMContentLoaded', () => {
    // Interceptor de confirmación para formularios o enlaces críticos - data-confirm.
    const elementosConfirmables = document.querySelectorAll('[data-confirm]');
    elementosConfirmables.forEach(elemento => {
        if (elemento.tagName === 'FORM') {
            elemento.addEventListener('submit', (e) => {
                const mensaje = elemento.getAttribute('data-confirm') || '¿Desea continuar con esta acción?';
                if (!window.confirm(mensaje)) {
                    e.preventDefault();
                }
            });
        } else {
            elemento.addEventListener('click', (e) => {
                const mensaje = elemento.getAttribute('data-confirm') || '¿Desea continuar con esta acción?';
                if (!window.confirm(mensaje)) {
                    e.preventDefault();
                }
            });
        }
    });

    // Control de fecha mínima (hoy) en formularios de turnos.
    const inputFecha = document.getElementById('fecha');
    if (inputFecha) {
        const hoy = new Date().toISOString().split('T')[0];
        inputFecha.setAttribute('min', hoy);
    }

    // Desplegable del formulario de Sobreturno en Recepción - views/turnos.pug.
    const btnToggleSobreturno = document.getElementById('btn-toggle-sobreturno');
    const modalSobreturno = document.getElementById('modal-sobreturno');
    if (btnToggleSobreturno && modalSobreturno) {
        btnToggleSobreturno.addEventListener('click', () => {
            modalSobreturno.classList.toggle('activo');
        });
    }

    // Filtrado dinámico en cascada EXCLUSIVO para views/reservar.pug
    const formReserva = document.getElementById('formReserva');
    if (formReserva) {
        const selectServicio = formReserva.querySelector('select#servicioId');
        const selectInstructor = formReserva.querySelector('select#instructorId');
        const selectSala = formReserva.querySelector('select#salaId');

        // Se valida que existan y sean estrictamente etiquetas SELECT.
        if (selectServicio && selectInstructor && selectSala && selectInstructor.options && selectSala.options) {
            const instructoresOriginales = Array.from(selectInstructor.options).filter(o => o.value !== "");
            const salasOriginales = Array.from(selectSala.options).filter(o => o.value !== "");

            selectServicio.addEventListener('change', () => {
                const servicioSeleccionado = selectServicio.options[selectServicio.selectedIndex];
                const salaRequerida = servicioSeleccionado ? servicioSeleccionado.getAttribute('data-sala-requerida') : null;
                const nombreServicio = servicioSeleccionado ? (servicioSeleccionado.getAttribute('data-nombre') || '').toLowerCase() : '';

                // Resetea selectores dependientes.
                selectInstructor.innerHTML = '<option value="">-- Seleccionar docente --</option>';
                selectSala.innerHTML = '<option value="">-- Seleccionar sala --</option>';

                if (!selectServicio.value) {
                    selectInstructor.innerHTML = '<option value="">-- Primero elija una actividad --</option>';
                    selectSala.innerHTML = '<option value="">-- Primero elija una actividad --</option>';
                    return;
                }

                // Filtra instructores según la especialidad de la actividad seleccionada.
                const instructoresFiltrados = instructoresOriginales.filter(opt => {
                    const esp = (opt.getAttribute('data-especialidad') || '').toLowerCase();
                    return esp.includes(nombreServicio) || nombreServicio.includes(esp);
                });

                if (instructoresFiltrados.length > 0) {
                    instructoresFiltrados.forEach(opt => selectInstructor.appendChild(opt.cloneNode(true)));
                } else {
                    instructoresOriginales.forEach(opt => selectInstructor.appendChild(opt.cloneNode(true)));
                }

                // Filtra y auto-selecciona la sala requerida por normativa.
                salasOriginales.forEach(opt => {
                    const idSala = opt.getAttribute('data-sala-id');
                    const clon = opt.cloneNode(true);
                    if (salaRequerida && idSala === String(salaRequerida)) {
                        clon.selected = true;
                        selectSala.appendChild(clon);
                    } else {
                        clon.disabled = true;
                        clon.textContent += ' (No compatible con esta disciplina)';
                        selectSala.appendChild(clon);
                    }
                });
            });
        }
    }

    // Asistente Virtual WebSockets en tiempo real - TurnoBot.
    const chatBoton = document.getElementById('chat-widget-boton');
    const chatVentana = document.getElementById('chat-widget-ventana');
    const chatBtnCerrar = document.getElementById('chat-btn-cerrar');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatCuerpo = document.getElementById('chat-mensajes');

    if (chatBoton && chatVentana) {
        // Apertura y cierre de ventana garantizados independientemente de la conexión.
        chatBoton.addEventListener('click', () => {
            chatVentana.classList.toggle('oculto');
            if (!chatVentana.classList.contains('oculto') && chatInput) {
                chatInput.focus();
            }
        });

        if (chatBtnCerrar) {
            chatBtnCerrar.addEventListener('click', () => {
                chatVentana.classList.add('oculto');
            });
        }

        function agregarMensaje(autor, texto, esUsuario = false) {
            if (!chatCuerpo) return;
            const burbuja = document.createElement('div');
            burbuja.className = `burbuja-chat ${esUsuario ? 'burbuja-usuario' : 'burbuja-bot'}`;

            const autorSpan = document.createElement('div');
            autorSpan.className = 'burbuja-autor';
            autorSpan.textContent = autor;

            const textoP = document.createElement('div');
            textoP.textContent = texto;

            burbuja.appendChild(autorSpan);
            burbuja.appendChild(textoP);
            chatCuerpo.appendChild(burbuja);
            chatCuerpo.scrollTop = chatCuerpo.scrollHeight;
        }

        // Conexión persistente mediante Socket.io
        if (typeof io !== 'undefined') {
            const socket = io();

            socket.on('mensaje_servidor', (data) => {
                agregarMensaje(data.autor || 'TurnoBot', data.texto, false);
            });

            if (chatForm && chatInput) {
                chatForm.addEventListener('submit', (e) => {
                    e.preventDefault();
                    const mensaje = chatInput.value.trim();
                    if (mensaje) {
                        agregarMensaje('Tú', mensaje, true);
                        socket.emit('mensaje_cliente', { texto: mensaje });
                        chatInput.value = '';
                    }
                });
            }
        } else {
            console.warn('[TurnoBot] La librería cliente de Socket.io no se encuentra disponible.');
        }
    }
});