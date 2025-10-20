const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  leadName: {
    type: String,
    required: [true, 'Lead name is required'],
    trim: true
  },
  propertyAddress: {
    type: String,
    required: [true, 'Property address is required'],
    trim: true
  },
  dateTime: {
    type: Date,
    required: [true, 'Meeting date and time is required'],
    validate: {
      validator: function(value) {
        return value > new Date();
      },
      message: 'Meeting date and time must be in the future'
    }
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Completed', 'Missed'],
    default: 'Scheduled'
  },
  notes: {
    type: String,
    trim: true
  },
  assignedTo: {
    type: String,
    required: [true, 'Assigned agent is required'],
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for efficient queries
meetingSchema.index({ dateTime: 1, status: 1 });
meetingSchema.index({ leadName: 1 });
meetingSchema.index({ assignedTo: 1 });

// Virtual for formatted date
meetingSchema.virtual('formattedDate').get(function() {
  return this.dateTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for formatted time
meetingSchema.virtual('formattedTime').get(function() {
  return this.dateTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Instance method to check if meeting is upcoming
meetingSchema.methods.isUpcoming = function() {
  return this.dateTime > new Date() && this.status === 'Scheduled';
};

// Instance method to check if meeting conflicts with another
meetingSchema.methods.conflictsWith = function(otherMeeting) {
  if (this.status !== 'Scheduled' || otherMeeting.status !== 'Scheduled') {
    return false;
  }

  const thisEnd = new Date(this.dateTime.getTime() + 60 * 60 * 1000); // 1 hour meeting
  const otherEnd = new Date(otherMeeting.dateTime.getTime() + 60 * 60 * 1000);

  return (this.dateTime < otherEnd && thisEnd > otherMeeting.dateTime);
};

// Static method to find meetings by date range
meetingSchema.statics.findByDateRange = function(startDate, endDate) {
  return this.find({
    dateTime: {
      $gte: startDate,
      $lte: endDate
    }
  });
};

// Static method to find upcoming meetings
meetingSchema.statics.findUpcoming = function(hoursAhead = 24) {
  const futureDate = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  return this.find({
    dateTime: {
      $gte: new Date(),
      $lte: futureDate
    },
    status: 'Scheduled'
  });
};

module.exports = mongoose.model('Meeting', meetingSchema);