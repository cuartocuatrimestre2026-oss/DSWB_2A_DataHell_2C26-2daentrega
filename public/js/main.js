document.addEventListener('DOMContentLoaded', () => {
    // Manejo accesible y desacoplado del modal de sobreturnos.
    const btnToggleSobreturno = document.getElementById('btn-toggle-sobreturno');
    const modalSobreturno = document.getElementById('modal-sobreturno');

    if (btnToggleSobreturno && modalSobreturno) {
        btnToggleSobreturno.addEventListener('click', () => {
            modalSobreturno.classList.toggle('activo');
        });
    }

    // Interceptor accesible para formularios de cancelación con confirmación.
    const formsConfirmar = document.querySelectorAll('form[data-confirm]');
    formsConfirmar.forEach(form => {
        form.addEventListener('submit', (e) => {
            const mensaje = form.getAttribute('data-confirm') || '¿Está seguro de continuar?';
            if (!confirm(mensaje)) {
                e.preventDefault();
            }
        });
    });
});