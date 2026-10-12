const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientes.controller');
const validarId = require('../middlewares/validarIdMiddleware');

router.get('/', clientesController.obtenerTodos);
router.get('/:id', validarId, clientesController.obtenerPorId);
router.post('/', clientesController.crear);
router.put('/:id', validarId, clientesController.actualizar);
router.delete('/:id', validarId, clientesController.eliminar);

module.exports = router;