const mongoose = require('mongoose');

const agentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Agent name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true
  },
  // Google Calendar integration
  googleCalendarId: {
    type: String,
    sparse: true,
    index: true // Allow null values but ensure uniqueness when present
  },
  googleAccessToken: {
    type: String,
    select: false // Don't include in regular queries for security
  },
  googleRefreshToken: {
    type: String,
    select: false
  },
  googleTokenExpiry: {
    type: Date
  },
  // Availability preferences
  workingHours: {
    start: { type: String, default: '09:00' }, // 9 AM
    end: { type: String, default: '17:00' }   // 5 PM
  },
  workingDays: [{
    type: String,
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  }],
  timezone: {
    type: String,
    default: 'America/New_York'
  },
  // Meeting preferences
  meetingDuration: {
    type: Number,
    default: 60, // minutes
    min: 15,
    max: 240
  },
  bufferTime: {
    type: Number,
    default: 15, // minutes between meetings
    min: 0,
    max: 60
  },
  // Performance metrics
  totalMeetings: {
    type: Number,
    default: 0
  },
  completedMeetings: {
    type: Number,
    default: 0
  },
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
agentSchema.index({ isActive: 1 });

// Virtual for success rate
agentSchema.virtual('successRate').get(function() {
  if (this.totalMeetings === 0) return 0;
  return Math.round((this.completedMeetings / this.totalMeetings) * 100);
});

// Instance method to check if agent is available at a specific time
agentSchema.methods.isAvailableAt = function(dateTime) {
  // Check if it's a working day
  const dayName = dateTime.toLocaleLowerCase('en-US', { weekday: 'long' });
  if (!this.workingDays.includes(dayName)) {
    return false;
  }

  // Check if it's within working hours
  const timeString = dateTime.toTimeString().slice(0, 5); // HH:MM format
  return timeString >= this.workingHours.start && timeString <= this.workingHours.end;
};

// Instance method to get next available slots
agentSchema.methods.getNextAvailableSlots = function(startDate = new Date(), count = 3) {
  const slots = [];
  let currentDate = new Date(startDate);

  // Look ahead up to 7 days for available slots
  for (let day = 0; day < 7 && slots.length < count; day++) {
    const dayName = currentDate.toLocaleLowerCase('en-US', { weekday: 'long' });

    if (this.workingDays.includes(dayName)) {
      const [startHour, startMinute] = this.workingHours.start.split(':').map(Number);
      const [endHour, endMinute] = this.workingHours.end.split(':').map(Number);

      let slotTime = new Date(currentDate);
      slotTime.setHours(startHour, startMinute, 0, 0);

      const endTime = new Date(currentDate);
      endTime.setHours(endHour, endMinute, 0, 0);

      // Generate slots every meetingDuration + bufferTime minutes
      while (slotTime < endTime && slots.length < count) {
        // Check if this slot is in the future
        if (slotTime > new Date()) {
          slots.push(new Date(slotTime));
        }

        // Move to next slot
        slotTime.setMinutes(slotTime.getMinutes() + this.meetingDuration + this.bufferTime);
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0); // Reset to start of day
  }

  return slots;
};

// Static method to find available agents for a specific time
agentSchema.statics.findAvailableAgents = function(dateTime) {
  return this.find({
    isActive: true,
    workingDays: new RegExp(dateTime.toLocaleLowerCase('en-US', { weekday: 'long' }), 'i')
  });
};

module.exports = mongoose.model('Agent', agentSchema);