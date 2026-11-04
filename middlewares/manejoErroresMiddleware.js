function manejoErroresMiddleware(err, req, res, next) {
    console.error(`[Error no controlado]: ${err.message}`);
    const status = err.status || 500;
    
    // Determina si la petición corresponde a la API REST o espera JSON.
    const esRutaApi = req.originalUrl.startsWith('/turnos') ||
                      req.originalUrl.startsWith('/clientes') ||
                      req.originalUrl.startsWith('/salas') ||
                      req.originalUrl.startsWith('/servicios') ||
                      req.originalUrl.startsWith('/instructores') ||
                      req.originalUrl.startsWith('/login/token');

    if (!esRutaApi && req.accepts('html') && !req.xhr) {
        return res.status(status).render('error', {
            status,
            mensaje: 'Ocurrió un inconveniente en el servidor',
            detalle: err.message
        });
    }

    res.status(status).json({
        error: status === 400 ? "Validación fallida" : (status === 404 ? "No encontrado" : "Error interno del servidor"),
        detalle: err.message || "Ocurrió una falla imprevista en el backend."
    });
}

module.exports = manejoErroresMiddleware;