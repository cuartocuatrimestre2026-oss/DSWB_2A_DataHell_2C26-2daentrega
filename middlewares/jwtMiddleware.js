const jwt = require('jsonwebtoken');

function verificarJWT(req, res, next) {
    const authHeader = req.headers['authorization'] || req.headers['x-access-token'];
    
    if (!authHeader) {
        return res.status(401).json({
            error: "Acceso no autorizado",
            detalle: "Token JWT no provisto en la cabecera Authorization (formato: Bearer <TOKEN>)."
        });
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'turnoflex_jwt_secreto_criptografico_2026');
        req.usuarioJWT = decoded;
        next();
    } catch (err) {
        return res.status(403).json({
            error: "Token inválido o expirado",
            detalle: "La firma del token provisto no es válida o su vigencia ha caducado."
        });
    }
}

module.exports = verificarJWT;