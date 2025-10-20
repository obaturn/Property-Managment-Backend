const Meeting = require('../models/Meeting');

// @desc    Get all meetings
// @route   GET /api/meetings
// @access  Private
const getMeetings = async (req, res) => {
  try {
    const {
      status,
      assignedTo,
      leadName,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = 'dateTime',
      sortOrder = 'asc'
    } = req.query;

    // Build filter object
    let filter = {};
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = new RegExp(assignedTo, 'i');
    if (leadName) filter.leadName = new RegExp(leadName, 'i');

    // Date range filter
    if (startDate || endDate) {
      filter.dateTime = {};
      if (startDate) filter.dateTime.$gte = new Date(startDate);
      if (endDate) filter.dateTime.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (page - 1) * limit;

    const meetings = await Meeting.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v');

    const total = await Meeting.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: meetings.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: meetings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get single meeting
// @route   GET /api/meetings/:id
// @access  Private
const getMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    res.status(200).json({
      success: true,
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create new meeting
// @route   POST /api/meetings
// @access  Private
const createMeeting = async (req, res) => {
  try {
    // Check for scheduling conflicts
    const { dateTime, assignedTo } = req.body;
    const meetingStart = new Date(dateTime);
    const meetingEnd = new Date(meetingStart.getTime() + 60 * 60 * 1000); // 1 hour meeting

    // Find meetings that might conflict
    const conflictingMeetings = await Meeting.find({
      assignedTo,
      status: 'Scheduled',
      dateTime: {
        $lt: meetingEnd,
        $gte: new Date(meetingStart.getTime() - 60 * 60 * 1000) // Check 1 hour before
      }
    });

    if (conflictingMeetings.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Scheduling conflict detected',
        conflicts: conflictingMeetings.map(m => ({
          id: m._id,
          leadName: m.leadName,
          dateTime: m.dateTime,
          propertyAddress: m.propertyAddress
        }))
      });
    }

    const meeting = await Meeting.create(req.body);

    res.status(201).json({
      success: true,
      data: meeting
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

// @desc    Update meeting
// @route   PUT /api/meetings/:id
// @access  Private
const updateMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    res.status(200).json({
      success: true,
      data: meeting
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

// @desc    Delete meeting
// @route   DELETE /api/meetings/:id
// @access  Private
const deleteMeeting = async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    await meeting.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Meeting deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get upcoming meetings
// @route   GET /api/meetings/upcoming
// @access  Private
const getUpcomingMeetings = async (req, res) => {
  try {
    const hoursAhead = parseInt(req.query.hours) || 24;
    const upcomingMeetings = await Meeting.findUpcoming(hoursAhead);

    res.status(200).json({
      success: true,
      count: upcomingMeetings.length,
      data: upcomingMeetings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update meeting status
// @route   PATCH /api/meetings/:id/status
// @access  Private
const updateMeetingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['Scheduled', 'Completed', 'Missed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be Scheduled, Completed, or Missed'
      });
    }

    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!meeting) {
      return res.status(404).json({
        success: false,
        message: 'Meeting not found'
      });
    }

    res.status(200).json({
      success: true,
      data: meeting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  getUpcomingMeetings,
  updateMeetingStatus
};