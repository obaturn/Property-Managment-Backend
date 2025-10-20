const express = require('express');
const router = express.Router();
const {
  createAutomatedBooking,
  getAvailableSlots,
  getBookingStats
} = require('../controllers/bookingController');

// Public routes (for lead forms)
router.post('/request-visit', createAutomatedBooking);
router.get('/available-slots', getAvailableSlots);

// Private routes (require authentication)
router.get('/stats', getBookingStats);

module.exports = router;