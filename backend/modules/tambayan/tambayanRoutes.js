const express = require('express');
const tambayanController = require('./tambayanController');

const router = express.Router();

router.get('/rooms', tambayanController.getVacantRooms);

module.exports = router;
