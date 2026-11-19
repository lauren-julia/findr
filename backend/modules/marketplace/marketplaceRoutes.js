const express = require('express');
const router = express.Router();
const requireAuth = require('../../middleware/requireAuth');
const optionalAuth = require('../../middleware/optionalAuth');
const uploadMarketplaceImage = require('../../middleware/uploadMarketplaceImage');
const marketplaceController = require('./marketplaceController');

router.get('/meta', marketplaceController.getMeta);
router.get('/items', optionalAuth, marketplaceController.getItems);
router.get('/my-items', requireAuth, marketplaceController.getMyItems);
router.get('/items/:id', marketplaceController.getItemById);
router.post('/items', requireAuth, uploadMarketplaceImage, marketplaceController.createItem);
router.patch('/items/:id/sold', requireAuth, marketplaceController.markItemSold);
router.post('/items/:id/requests', requireAuth, marketplaceController.createRequest);
router.get('/requests', requireAuth, marketplaceController.getRequests);
router.patch('/requests/:requestId/status', requireAuth, marketplaceController.updateRequestStatus);

module.exports = router;
