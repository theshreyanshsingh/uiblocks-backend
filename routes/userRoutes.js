const express = require('express');
const router = express.Router();
const {login, userData} = require('../controllers/userController');

// Auth routes
router.post('/login', login);
router.post('/user-data', userData);

module.exports = router;