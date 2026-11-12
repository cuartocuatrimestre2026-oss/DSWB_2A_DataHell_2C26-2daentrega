const express = require('express');
const router = express.Router();
const instructoresController = require('../controllers/instructores.controller');
const validarId = require('../middlewares/validarIdMiddleware');
const verificarJWT = require('../middlewares/jwtMiddleware');

const soloEmpleadoAPI = (req, res, next) => {
    if (req.usuarioJWT && req.usuarioJWT.rol === 'empleado') return next();
    return res.status(403).json({ error: 'Acceso denegado', detalle: 'Operación exclusiva para personal administrativo.' });
};

router.get('/', instructoresController.obtenerTodos);
router.get('/:id', validarId, instructoresController.obtenerPorId);

// Rutas de administración docente protegidas.
router.post('/', verificarJWT, soloEmpleadoAPI, instructoresController.crear);
router.put('/:id', verificarJWT, soloEmpleadoAPI, validarId, instructoresController.actualizar);
router.delete('/:id', verificarJWT, soloEmpleadoAPI, validarId, instructoresController.eliminar);

module.exports = router;