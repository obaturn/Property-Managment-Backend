const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  address: {
    type: String,
    required: [true, 'Address is required'],
    trim: true,
    maxlength: [200, 'Address cannot be more than 200 characters']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  bedrooms: {
    type: Number,
    min: [0, 'Bedrooms cannot be negative'],
    max: [20, 'Bedrooms cannot be more than 20']
  },
  bathrooms: {
    type: Number,
    min: [0, 'Bathrooms cannot be negative'],
    max: [20, 'Bathrooms cannot be more than 20']
  },
  sqft: {
    type: Number,
    min: [0, 'Square footage cannot be negative']
  },
  images: [{
    url: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['image', 'video'],
      default: 'image'
    },
    filename: {
      type: String,
      trim: true
    },
    size: {
      type: Number
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Keep imageUrl for backward compatibility
  imageUrl: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  propertyType: {
    type: String,
    enum: ['House', 'Condo', 'Townhouse', 'Apartment', 'Land', 'Commercial', 'Other'],
    default: 'House'
  },
  status: {
    type: String,
    enum: ['Available', 'Pending', 'Sold', 'Off Market'],
    default: 'Available'
  },
  yearBuilt: {
    type: Number,
    min: [1800, 'Year built cannot be before 1800'],
    max: [new Date().getFullYear() + 1, 'Year built cannot be in the future']
  },
  features: [{
    type: String,
    maxlength: [100, 'Feature cannot be more than 100 characters']
  }]
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
propertySchema.index({ address: 1 });
propertySchema.index({ price: 1 });
propertySchema.index({ status: 1 });
propertySchema.index({ propertyType: 1 });
propertySchema.index({ createdAt: -1 });

// Virtual for price per square foot
propertySchema.virtual('pricePerSqft').get(function() {
  if (this.sqft && this.sqft > 0) {
    return Math.round((this.price / this.sqft) * 100) / 100;
  }
  return null;
});

// Instance method to update status
propertySchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  return this.save();
};

// Static method to get properties by status
propertySchema.statics.getPropertiesByStatus = function(status) {
  return this.find({ status });
};

// Static method to get properties by price range
propertySchema.statics.getPropertiesByPriceRange = function(minPrice, maxPrice) {
  return this.find({
    price: { $gte: minPrice, $lte: maxPrice }
  });
};

module.exports = mongoose.model('Property', propertySchema);