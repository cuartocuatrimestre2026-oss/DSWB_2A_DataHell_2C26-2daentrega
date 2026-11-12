const express = require('express');
const router = express.Router();
const serviciosController = require('../controllers/servicios.controller');
const validarId = require('../middlewares/validarIdMiddleware');
const verificarJWT = require('../middlewares/jwtMiddleware');

const soloEmpleadoAPI = (req, res, next) => {
    if (req.usuarioJWT && req.usuarioJWT.rol === 'empleado') return next();
    return res.status(403).json({ error: 'Acceso denegado', detalle: 'Operación exclusiva para personal administrativo.' });
};

router.get('/', serviciosController.obtenerTodos);
router.get('/:id', validarId, serviciosController.obtenerPorId);

// Rutas administrativas protegidas.
router.post('/', verificarJWT, soloEmpleadoAPI, serviciosController.crear);
router.put('/:id', verificarJWT, soloEmpleadoAPI, validarId, serviciosController.actualizar);
router.delete('/:id', verificarJWT, soloEmpleadoAPI, validarId, serviciosController.eliminar);

module.exports = router;