const express = require('express');
const router = express.Router();
const turnosController = require('../controllers/turnos.controller');
const validarId = require('../middlewares/validarIdMiddleware');

router.get('/', turnosController.obtenerTodos);
router.get('/:id', validarId, turnosController.obtenerPorId);
router.get('/cliente/:id', validarId, turnosController.obtenerPorCliente);
router.get('/instructor/:id', validarId, turnosController.obtenerPorInstructor);
router.post('/', turnosController.crearRegular);
router.post('/sobreturno', turnosController.crearSobreturno);
router.put('/:id', validarId, turnosController.actualizarEstado);
router.delete('/:id', validarId, turnosController.cancelar);

module.exports = router;