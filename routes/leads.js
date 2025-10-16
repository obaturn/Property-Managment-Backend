const express = require('express');
const router = express.Router();
const {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  updateLeadStatus,
  getLeadsByStatus
} = require('../controllers/leadController');

// All routes require authentication (middleware would be added here)
// router.use(authMiddleware);

router.route('/')
  .get(getLeads)
  .post(createLead);

router.route('/:id')
  .get(getLead)
  .put(updateLead)
  .delete(deleteLead);

router.route('/:id/status')
  .patch(updateLeadStatus);

router.route('/status/:status')
  .get(getLeadsByStatus);

module.exports = router;