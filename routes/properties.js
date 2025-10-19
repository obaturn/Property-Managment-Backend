const express = require('express');
const router = express.Router();
const {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadPropertyFiles
} = require('../controllers/propertyController');
const { uploadMultiple } = require('../middleware/upload');

// All routes require authentication (middleware would be added here)
// router.use(authMiddleware);

router.route('/')
  .get(getProperties)
  .post(createProperty);

router.route('/:id')
  .get(getProperty)
  .put(updateProperty)
  .delete(deleteProperty);

// File upload route
router.post('/:id/upload', uploadMultiple, uploadPropertyFiles);

module.exports = router;