const express = require('express');
const router = express.Router();
const salasController = require('../controllers/salas.controller');
const validarId = require('../middlewares/validarIdMiddleware');
const verificarJWT = require('../middlewares/jwtMiddleware');

const soloEmpleadoAPI = (req, res, next) => {
    if (req.usuarioJWT && req.usuarioJWT.rol === 'empleado') return next();
    return res.status(403).json({ error: 'Acceso denegado', detalle: 'Operación exclusiva para personal administrativo.' });
};

router.get('/', salasController.obtenerTodos);
router.get('/:id', validarId, salasController.obtenerPorId);

// Creación, edición y eliminación administrativa protegidas.
router.post('/', verificarJWT, soloEmpleadoAPI, salasController.crear);
router.put('/:id', verificarJWT, soloEmpleadoAPI, validarId, salasController.actualizar);
router.delete('/:id', verificarJWT, soloEmpleadoAPI, validarId, salasController.eliminar);

module.exports = router;