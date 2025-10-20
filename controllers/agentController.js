const Agent = require('../models/Agent');
const googleCalendar = require('../services/googleCalendar');

// @desc    Get all agents
// @route   GET /api/agents
// @access  Private (Admin only)
const getAgents = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build filter object
    let filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (page - 1) * limit;

    const agents = await Agent.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-googleAccessToken -googleRefreshToken -googleTokenExpiry'); // Exclude sensitive data

    const total = await Agent.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: agents.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: agents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get single agent
// @route   GET /api/agents/:id
// @access  Private
const getAgent = async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id)
      .select('-googleAccessToken -googleRefreshToken -googleTokenExpiry'); // Exclude sensitive data

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    res.status(200).json({
      success: true,
      data: agent
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create new agent
// @route   POST /api/agents
// @access  Private (Admin only)
const createAgent = async (req, res) => {
  try {
    const agent = await Agent.create(req.body);

    // Return agent without sensitive data
    const agentResponse = await Agent.findById(agent._id)
      .select('-googleAccessToken -googleRefreshToken -googleTokenExpiry');

    res.status(201).json({
      success: true,
      data: agentResponse
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

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Agent with this email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update agent
// @route   PUT /api/agents/:id
// @access  Private
const updateAgent = async (req, res) => {
  try {
    const agent = await Agent.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).select('-googleAccessToken -googleRefreshToken -googleTokenExpiry'); // Exclude sensitive data

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    res.status(200).json({
      success: true,
      data: agent
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

// @desc    Delete agent
// @route   DELETE /api/agents/:id
// @access  Private (Admin only)
const deleteAgent = async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id);

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    await agent.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Agent deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get agent's calendar status
// @route   GET /api/agents/:id/calendar-status
// @access  Private
const getAgentCalendarStatus = async (req, res) => {
  try {
    const agent = await Agent.findById(req.params.id).select('googleCalendarId isActive');

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    const isConnected = !!(agent.googleCalendarId && agent.isActive);

    res.status(200).json({
      success: true,
      isConnected: isConnected,
      calendarId: agent.googleCalendarId
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get agent's available time slots
// @route   GET /api/agents/:id/available-slots
// @access  Private
const getAgentAvailableSlots = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required'
      });
    }

    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    if (!agent.googleCalendarId) {
      return res.status(400).json({
        success: false,
        message: 'Agent has not connected Google Calendar'
      });
    }

    const requestedDate = new Date(date);
    const availableSlots = await googleCalendar.getAvailableSlots(
      agent._id,
      requestedDate,
      agent.meetingDuration
    );

    res.status(200).json({
      success: true,
      count: availableSlots.length,
      data: availableSlots
    });
  } catch (error) {
    console.error('Error getting available slots:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get agent's upcoming events
// @route   GET /api/agents/:id/upcoming-events
// @access  Private
const getAgentUpcomingEvents = async (req, res) => {
  try {
    const { maxResults = 10 } = req.query;

    const agent = await Agent.findById(req.params.id);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    if (!agent.googleCalendarId) {
      return res.status(200).json({
        success: true,
        message: 'Agent has not connected Google Calendar',
        data: []
      });
    }

    const events = await googleCalendar.getUpcomingEvents(agent._id, parseInt(maxResults));

    res.status(200).json({
      success: true,
      count: events.length,
      data: events
    });
  } catch (error) {
    console.error('Error getting upcoming events:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAgents,
  getAgent,
  createAgent,
  updateAgent,
  deleteAgent,
  getAgentCalendarStatus,
  getAgentAvailableSlots,
  getAgentUpcomingEvents
};