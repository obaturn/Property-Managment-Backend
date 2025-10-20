const express = require('express');
const router = express.Router();
const {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentCalendarStatus,
  getAgentAvailableSlots,
  getAgentUpcomingEvents
} = require('../controllers/agentController');

// All routes require authentication (middleware would be added here)
// router.use(authMiddleware);

router.route('/')
  .get(getAgents)
  .post(createAgent);

router.route('/:id')
  .get(getAgent)
  .put(updateAgent)
  .delete(deleteAgent);

// Agent-specific routes
router.get('/:id/calendar-status', getAgentCalendarStatus);
router.get('/:id/available-slots', getAgentAvailableSlots);
router.get('/:id/upcoming-events', getAgentUpcomingEvents);

module.exports = router;