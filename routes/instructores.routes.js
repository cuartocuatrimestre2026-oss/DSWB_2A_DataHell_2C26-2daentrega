const express = require('express');
const router = express.Router();
const instructoresController = require('../controllers/instructores.controller');
const validarId = require('../middlewares/validarIdMiddleware');
const verificarJWT = require('../middlewares/jwtMiddleware');

router.get('/', instructoresController.obtenerTodos);
router.get('/:id', validarId, instructoresController.obtenerPorId);

// Rutas de administración docente protegidas.
router.post('/', verificarJWT, instructoresController.crear);
router.put('/:id', verificarJWT, validarId, instructoresController.actualizar);
router.delete('/:id', verificarJWT, validarId, instructoresController.eliminar);

module.exports = router;