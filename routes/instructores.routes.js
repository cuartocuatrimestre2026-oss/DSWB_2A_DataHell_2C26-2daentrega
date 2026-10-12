const express = require('express');
const router = express.Router();
const instructoresController = require('../controllers/instructores.controller');
const validarId = require('../middlewares/validarIdMiddleware');

router.get('/', instructoresController.obtenerTodos);
router.get('/:id', validarId, instructoresController.obtenerPorId);
router.post('/', instructoresController.crear);
router.put('/:id', validarId, instructoresController.actualizar);
router.delete('/:id', validarId, instructoresController.eliminar);

module.exports = router;