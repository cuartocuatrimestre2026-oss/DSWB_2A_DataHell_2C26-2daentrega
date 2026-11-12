const express = require('express');
const router = express.Router();
const turnosController = require('../controllers/turnos.controller');
const validarId = require('../middlewares/validarIdMiddleware');
const verificarJWT = require('../middlewares/jwtMiddleware');

const soloEmpleadoAPI = (req, res, next) => {
    if (req.usuarioJWT && req.usuarioJWT.rol === 'empleado') return next();
    return res.status(403).json({ error: 'Acceso denegado', detalle: 'Los sobreturnos solo pueden ser autorizados por personal de recepción.' });
};

router.get('/', turnosController.obtenerTodos);
router.get('/:id', validarId, turnosController.obtenerPorId);
router.get('/cliente/:id', validarId, turnosController.obtenerPorCliente);
router.get('/instructor/:id', validarId, turnosController.obtenerPorInstructor);

// Operaciones de gestión protegidas con JWT.
router.post('/', verificarJWT, turnosController.crearRegular);
router.post('/sobreturno', verificarJWT, soloEmpleadoAPI, turnosController.crearSobreturno);
router.put('/:id', verificarJWT, validarId, turnosController.actualizarEstado);
router.delete('/:id', verificarJWT, validarId, turnosController.cancelar);

module.exports = router;