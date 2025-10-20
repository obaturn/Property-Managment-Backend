const Property = require('../models/Property');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// @desc    Get all properties
// @route   GET /api/properties
// @access  Private
const getProperties = async (req, res) => {
  try {
    const { status, propertyType, minPrice, maxPrice, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build filter object
    let filter = {};
    if (status) filter.status = status;
    if (propertyType) filter.propertyType = propertyType;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (page - 1) * limit;

    const properties = await Property.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v'); // Exclude version field

    const total = await Property.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: properties.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: properties
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get single property
// @route   GET /api/properties/:id
// @access  Private
const getProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.status(200).json({
      success: true,
      data: property
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create new property
// @route   POST /api/properties
// @access  Private
const createProperty = async (req, res) => {
  try {
    let propertyData = req.body;

    // Handle FormData requests (when files are uploaded)
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
      // Parse the JSON data from FormData
      if (req.body.data) {
        try {
          propertyData = JSON.parse(req.body.data);
        } catch (error) {
          console.error('Error parsing property data:', error);
          return res.status(400).json({
            success: false,
            message: 'Invalid property data format'
          });
        }
      }
    }

    // Handle file uploads if files are present
    if (req.files && req.files.length > 0) {
      const uploadedFiles = [];

      for (const file of req.files) {
        try {
          // Upload to Cloudinary
          const result = await cloudinary.uploader.upload(file.path, {
            folder: 'realtyflow/properties',
            resource_type: 'auto', // Auto-detect image/video
            public_id: `property_${Date.now()}_${file.filename}`,
            transformation: [
              { width: 1200, height: 800, crop: 'limit' }, // Resize for web
              { quality: 'auto' } // Auto quality optimization
            ]
          });

          uploadedFiles.push({
            url: result.secure_url,
            public_id: result.public_id,
            type: file.mimetype.startsWith('video/') ? 'video' : 'image',
            filename: file.filename,
            size: file.size,
            uploadedAt: new Date()
          });
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          // Continue with other files if one fails
        }
      }

      // Set the uploaded files as the property images
      if (uploadedFiles.length > 0) {
        propertyData.images = uploadedFiles;
      }
    }

    const property = await Property.create(propertyData);

    res.status(201).json({
      success: true,
      data: property
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update property
// @route   PUT /api/properties/:id
// @access  Private
const updateProperty = async (req, res) => {
  try {
    const property = await Property.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    res.status(200).json({
      success: true,
      data: property
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors: messages
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Delete property
// @route   DELETE /api/properties/:id
// @access  Private
const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    await property.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Upload files for a property
// @route   POST /api/properties/:id/upload
// @access  Private
const uploadPropertyFiles = async (req, res) => {
  try {
    const propertyId = req.params.id;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Find the property
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Upload files to Cloudinary
    const uploadedFiles = [];

    for (const file of files) {
      try {
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'realtyflow/properties',
          resource_type: 'auto', // Auto-detect image/video
          public_id: `${propertyId}_${Date.now()}_${file.filename}`,
          transformation: [
            { width: 1200, height: 800, crop: 'limit' }, // Resize for web
            { quality: 'auto' } // Auto quality optimization
          ]
        });

        uploadedFiles.push({
          url: result.secure_url,
          public_id: result.public_id,
          type: file.mimetype.startsWith('video/') ? 'video' : 'image',
          filename: file.filename,
          size: file.size,
          uploadedAt: new Date()
        });
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        // Continue with other files if one fails
      }
    }

    if (uploadedFiles.length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to upload any files to Cloudinary'
      });
    }

    // Add files to property
    if (!property.images) {
      property.images = [];
    }
    property.images.push(...uploadedFiles);

    await property.save();

    res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      data: uploadedFiles
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadPropertyFiles
};