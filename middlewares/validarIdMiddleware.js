function validarIdMiddleware(req, res, next) {
    const { id } = req.params;
    const numId = Number(id);
    if (!id || isNaN(numId) || numId <= 0 || !Number.isInteger(numId)) {
        return res.status(400).json({
            error: "Parámetro inválido",
            detalle: "El identificador provisto en la ruta debe ser un número entero positivo válido."
        });
    }
    next();
}

module.exports = validarIdMiddleware;