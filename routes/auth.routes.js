const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.get('/login', authController.mostrarLogin);
router.post('/login', authController.procesarLogin);
router.get('/registro', authController.mostrarRegistro);
router.post('/registro', authController.procesarRegistro);
router.get('/logout', authController.cerrarSesion);

module.exports = router;