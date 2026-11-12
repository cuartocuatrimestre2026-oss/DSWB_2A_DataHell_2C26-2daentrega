const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientes.controller');
const validarId = require('../middlewares/validarIdMiddleware');
const verificarJWT = require('../middlewares/jwtMiddleware');
const { estaAutenticado, esEmpleado } = require('../middlewares/authMiddleware');

const soloEmpleadoAPI = (req, res, next) => {
    if (req.usuarioJWT && req.usuarioJWT.rol === 'empleado') return next();
    return res.status(403).json({ error: 'Acceso denegado', detalle: 'Operación exclusiva para personal administrativo.' });
};

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
router.get('/:id', verificarJWT, validarId, clientesController.obtenerClientePorId);
router.post('/', clientesController.crearCliente);
router.put('/:id', validarId, verificarJWT, clientesController.actualizarCliente);
router.delete('/:id', validarId, verificarJWT, soloEmpleadoAPI, clientesController.eliminarCliente);

module.exports = router;