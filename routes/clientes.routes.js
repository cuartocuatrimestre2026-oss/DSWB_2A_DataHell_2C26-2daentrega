const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientes.controller');
const validarId = require('../middlewares/validarIdMiddleware');
const verificarJWT = require('../middlewares/jwtMiddleware');
const { estaAutenticado, esEmpleado } = require('../middlewares/authMiddleware');

// Consola Web de Mostrador.
router.get('/vista/clientes', estaAutenticado, esEmpleado, clientesController.mostrarPistasClientes);
router.post('/vista/clientes/cambiar-estado/:id', estaAutenticado, esEmpleado, validarId, clientesController.cambiarEstadoClienteWeb);
router.post('/vista/clientes/resetear-password/:id', estaAutenticado, esEmpleado, validarId, clientesController.resetearPasswordWeb);

// Pantallas Web de Apto Físico.
router.get('/vista/apto-fisico', estaAutenticado, esEmpleado, clientesController.mostrarAptoFisicoWeb);
router.post('/vista/apto-fisico', estaAutenticado, esEmpleado, clientesController.actualizarAptoFisicoWeb);
router.post('/vista/apto-fisico/:id', estaAutenticado, esEmpleado, validarId, clientesController.actualizarAptoFisicoWeb);

// API RESTful montada en /clientes.
router.get('/', verificarJWT, clientesController.listarClientes);
router.get('/:id', validarId, clientesController.obtenerClientePorId);
router.post('/', clientesController.crearCliente);
router.put('/:id', validarId, verificarJWT, clientesController.actualizarCliente);
router.delete('/:id', validarId, verificarJWT, clientesController.eliminarCliente);

module.exports = router;