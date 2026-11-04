const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientes.controller');
const validarId = require('../middlewares/validarIdMiddleware');
const verificarJWT = require('../middlewares/jwtMiddleware');

// Lectura de padrón protegida con token JWT.
router.get('/', verificarJWT, clientesController.obtenerTodos);
router.get('/:id', verificarJWT, validarId, clientesController.obtenerPorId);

// Creación, actualización y baja lógica protegidas.
router.post('/', verificarJWT, clientesController.crear);
router.put('/:id', verificarJWT, validarId, clientesController.actualizar);
router.delete('/:id', verificarJWT, validarId, clientesController.eliminar);

module.exports = router;