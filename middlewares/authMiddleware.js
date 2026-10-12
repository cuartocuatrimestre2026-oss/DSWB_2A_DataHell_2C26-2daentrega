function estaAutenticado(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }
    return res.redirect('/login');
}

function esEmpleado(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.redirect('/login');
    }
    if (req.session.usuario.rol === 'empleado') {
        return next();
    }
    return res.status(403).render('error', {
        status: 403,
        mensaje: 'Acceso Denegado',
        detalle: 'Esta sección es de uso exclusivo para el personal de administración y recepción.'
    });
}

function esCliente(req, res, next) {
    if (!req.session || !req.session.usuario) {
        return res.redirect('/login');
    }
    if (req.session.usuario.rol === 'cliente') {
        return next();
    }
    return res.redirect('/vista/turnos');
}

module.exports = {
    estaAutenticado,
    esEmpleado,
    esCliente
};