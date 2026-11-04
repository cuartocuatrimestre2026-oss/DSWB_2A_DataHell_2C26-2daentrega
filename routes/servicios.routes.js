const express = require('express');
const router = express.Router();
const serviciosController = require('../controllers/servicios.controller');
const validarId = require('../middlewares/validarIdMiddleware');
const verificarJWT = require('../middlewares/jwtMiddleware');

router.get('/', serviciosController.obtenerTodos);
router.get('/:id', validarId, serviciosController.obtenerPorId);

// Rutas administrativas protegidas.
router.post('/', verificarJWT, serviciosController.crear);
router.put('/:id', verificarJWT, validarId, serviciosController.actualizar);
router.delete('/:id', verificarJWT, validarId, serviciosController.eliminar);

module.exports = router;