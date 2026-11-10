document.addEventListener('DOMContentLoaded', () => {
    // Interceptor de confirmación para acciones destructivas o críticas.
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

    // Filtrado dinámico en cascada en views/reservar.pug.
    const selectServicio = document.getElementById('servicioId');
    const selectInstructor = document.getElementById('instructorId');
    const selectSala = document.getElementById('salaId');

    if (selectServicio && selectInstructor && selectSala) {
        const instructoresOriginales = Array.from(selectInstructor.options).filter(o => o.value !== "");
        const salasOriginales = Array.from(selectSala.options).filter(o => o.value !== "");

        selectServicio.addEventListener('change', () => {
            const servicioSeleccionado = selectServicio.options[selectServicio.selectedIndex];
            const salaRequerida = servicioSeleccionado.getAttribute('data-sala-requerida');
            const nombreServicio = (servicioSeleccionado.getAttribute('data-nombre') || '').toLowerCase();

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
                // Fallback de contingencia si no hay coincidencia exacta de texto.
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
                    // Si no es la sala reglamentaria, se deshabilita para evitar inconsistencias.
                    clon.disabled = true;
                    clon.textContent += ' (No compatible con esta disciplina)';
                    selectSala.appendChild(clon);
                }
            });
        });
    }

    // Integración del Asistente Virtual WebSockets en tiempo real - TurnoBot.
    const chatBoton = document.getElementById('chatBotonFlotante');
    const chatVentana = document.getElementById('chatVentana');
    const chatBtnCerrar = document.getElementById('chatBtnCerrar');
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatCuerpo = document.getElementById('chatCuerpo');

    if (chatBoton && chatVentana && window.io) {
        const socket = io();

        chatBoton.addEventListener('click', () => {
            chatVentana.classList.toggle('oculto');
            if (!chatVentana.classList.contains('oculto')) {
                chatInput.focus();
            }
        });

        if (chatBtnCerrar) {
            chatBtnCerrar.addEventListener('click', () => {
                chatVentana.classList.add('oculto');
            });
        }

        function agregarMensaje(autor, texto, esUsuario = false) {
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

        socket.on('mensajeBot', (data) => {
            agregarMensaje(data.autor || 'TurnoBot', data.texto, false);
        });

        if (chatForm) {
            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const mensaje = chatInput.value.trim();
                if (mensaje) {
                    agregarMensaje('Tú', mensaje, true);
                    socket.emit('mensajeUsuario', { texto: mensaje });
                    chatInput.value = '';
                }
            });
        }
    }
});