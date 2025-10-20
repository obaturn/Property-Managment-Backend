const express = require('express');
const router = express.Router();
const {
  getMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getUpcomingMeetings,
  updateMeetingStatus
} = require('../controllers/meetingController');

// All routes require authentication (middleware would be added here)
// router.use(authMiddleware);

router.route('/')
  .get(getMeetings)
  .post(createMeeting);

router.route('/:id')
  .get(getMeeting)
  .put(updateMeeting)
  .delete(deleteMeeting);

// Additional routes
router.get('/upcoming', getUpcomingMeetings);
router.patch('/:id/status', updateMeetingStatus);

module.exports = router;