const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot be more than 20 characters']
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Nurturing', 'Closed'],
    default: 'New'
  },
  source: {
    type: String,
    required: [true, 'Lead source is required'],
    enum: ['Zillow', 'Realtor.com', 'Website', 'Referral', 'Organic', 'Other'],
    default: 'Website'
  },
  assignedTo: {
    type: String,
    required: [true, 'Agent assignment is required'],
    trim: true
  },
  lastContacted: {
    type: Date,
    default: Date.now
  },
  score: {
    type: Number,
    min: [0, 'Score cannot be negative'],
    max: [100, 'Score cannot be more than 100']
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'hot']
  },
  engagementScore: {
    type: Number,
    min: [0, 'Engagement score cannot be negative'],
    max: [100, 'Engagement score cannot be more than 100']
  },
  budget: {
    type: Number,
    min: [0, 'Budget cannot be negative']
  },
  preferredPropertyType: {
    type: String,
    trim: true,
    maxlength: [100, 'Property type cannot be more than 100 characters']
  },
  timeline: {
    type: String,
    trim: true,
    maxlength: [100, 'Timeline cannot be more than 100 characters']
  },
  aiInsights: [{
    type: String,
    maxlength: [500, 'AI insight cannot be more than 500 characters']
  }],
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot be more than 1000 characters']
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better query performance
leadSchema.index({ status: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ createdAt: -1 });

// Virtual for days since last contact
leadSchema.virtual('daysSinceLastContact').get(function() {
  return Math.floor((Date.now() - this.lastContacted) / (1000 * 60 * 60 * 24));
});

// Instance method to update last contacted
leadSchema.methods.updateLastContacted = function() {
  this.lastContacted = new Date();
  return this.save();
};

// Static method to get leads by status
leadSchema.statics.getLeadsByStatus = function(status) {
  return this.find({ status });
};

// Static method to get leads by agent
leadSchema.statics.getLeadsByAgent = function(agentName) {
  return this.find({ assignedTo: agentName });
};

module.exports = mongoose.model('Lead', leadSchema);