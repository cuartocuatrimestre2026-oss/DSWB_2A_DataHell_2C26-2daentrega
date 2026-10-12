const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/paciente.controller');
const { estaAutenticado, esCliente } = require('../middlewares/authMiddleware');

router.get('/mis-turnos', estaAutenticado, esCliente, pacienteController.verMisTurnos);
router.get('/reservar', estaAutenticado, esCliente, pacienteController.mostrarFormularioReserva);
router.post('/reservar', estaAutenticado, esCliente, pacienteController.procesarReserva);
router.post('/mis-turnos/cancelar/:id', estaAutenticado, esCliente, pacienteController.cancelarMiTurno);

module.exports = router;