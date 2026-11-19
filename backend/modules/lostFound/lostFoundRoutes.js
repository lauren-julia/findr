const express = require('express');
const router = express.Router();
const requireAuth = require('../../middleware/requireAuth');
const uploadLostFoundImage = require('../../middleware/uploadLostFoundImage');
const lostFoundController = require('./lostFoundController');

router.get('/meta', lostFoundController.getMeta);
router.get('/items', lostFoundController.getItems);
router.get('/my-items', requireAuth, lostFoundController.getMyItems);
router.get('/items/:id', lostFoundController.getItemById);
router.post('/items', requireAuth, uploadLostFoundImage, lostFoundController.createItem);
router.patch('/items/:id/return', requireAuth, lostFoundController.markItemReturned);
router.post('/items/:id/claims', requireAuth, lostFoundController.createClaim);
router.get('/claims', requireAuth, lostFoundController.getClaims);
router.patch('/claims/:claimId/status', requireAuth, lostFoundController.updateClaimStatus);

module.exports = router;
