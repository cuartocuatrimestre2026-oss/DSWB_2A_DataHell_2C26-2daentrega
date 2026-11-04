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
    const secreto = process.env.JWT_SECRET;

    if (!secreto) {
        return res.status(500).json({
            error: "Error de configuración",
            detalle: "La clave JWT_SECRET no está definida en el entorno del servidor."
        });
    }

    try {
        const decoded = jwt.verify(token, secreto);
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