const express = require('express');
const router = express.Router();
const serviciosController = require('../controllers/servicios.controller');
const validarId = require('../middlewares/validarIdMiddleware');

router.get('/', serviciosController.obtenerTodos);
router.get('/:id', validarId, serviciosController.obtenerPorId);
router.post('/', serviciosController.crear);
router.put('/:id', validarId, serviciosController.actualizar);
router.delete('/:id', validarId, serviciosController.eliminar);

module.exports = router;