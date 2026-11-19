const express = require('express');
const requireAdmin = require('../../middleware/requireAdmin');
const uploadBuildingImage = require('../../middleware/uploadBuildingImage');
const adminController = require('./adminController');

const router = express.Router();

router.use(requireAdmin);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.listUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);

router.get('/listings', adminController.listListings);
router.delete('/listings/:type/:id', adminController.removeListing);

router.get('/system', adminController.getSystemData);
router.post('/system/:entity', uploadBuildingImage, adminController.createSystemRecord);
router.put('/system/:entity/:id', uploadBuildingImage, adminController.updateSystemRecord);
router.delete('/system/:entity/:id', adminController.deleteSystemRecord);

module.exports = router;
