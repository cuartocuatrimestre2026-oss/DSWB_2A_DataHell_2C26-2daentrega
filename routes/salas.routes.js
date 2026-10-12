const express = require('express');
const router = express.Router();
const salasController = require('../controllers/salas.controller');
const validarId = require('../middlewares/validarIdMiddleware');

router.get('/', salasController.obtenerTodos);
router.get('/:id', validarId, salasController.obtenerPorId);
router.post('/', salasController.crear);
router.put('/:id', validarId, salasController.actualizar);
router.delete('/:id', validarId, salasController.eliminar);

module.exports = router;