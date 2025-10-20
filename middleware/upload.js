const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Create uploads directory if it doesn't exist (for temporary storage before Cloudinary upload)
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Cloudinary storage configuration
const cloudinaryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'realtyflow/properties',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'avi'],
    transformation: [
      { width: 1200, height: 800, crop: 'limit' },
      { quality: 'auto' }
    ]
  }
});

// Local storage configuration (temporary, before uploading to Cloudinary)
const localStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images and videos
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image and video files are allowed!'), false);
  }
};

// Upload middleware for local storage (temporary before Cloudinary)
const localUpload = multer({
  storage: localStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 20 // Maximum 20 files
  }
});

// Upload middleware for direct Cloudinary upload
const cloudinaryUpload = multer({
  storage: cloudinaryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 20 // Maximum 20 files
  }
});

// Export different upload configurations
module.exports = {
  localUpload,
  cloudinaryUpload,
  uploadSingle: localUpload.single('file'),
  uploadMultiple: localUpload.array('files', 20),
  cloudinarySingle: cloudinaryUpload.single('file'),
  cloudinaryMultiple: cloudinaryUpload.array('files', 20),
  uploadsDir
};