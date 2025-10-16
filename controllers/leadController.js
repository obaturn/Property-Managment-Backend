const Lead = require('../models/Lead');

// @desc    Get all leads
// @route   GET /api/leads
// @access  Private
const getLeads = async (req, res) => {
  try {
    const { status, assignedTo, page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    // Build filter object
    let filter = {};
    if (status) filter.status = status;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Pagination
    const skip = (page - 1) * limit;

    const leads = await Lead.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v'); // Exclude version field

    const total = await Lead.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: leads.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: leads
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get single lead
// @route   GET /api/leads/:id
// @access  Private
const getLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    res.status(200).json({
      success: true,
      data: lead
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Create new lead
// @route   POST /api/leads
// @access  Private
const createLead = async (req, res) => {
  try {
    const lead = await Lead.create(req.body);

    res.status(201).json({
      success: true,
      data: lead
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate email error
      return res.status(400).json({
        success: false,
        message: 'Lead with this email already exists'
      });
    }

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

// @desc    Update lead
// @route   PUT /api/leads/:id
// @access  Private
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    res.status(200).json({
      success: true,
      data: lead
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

// @desc    Delete lead
// @route   DELETE /api/leads/:id
// @access  Private
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    await lead.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Lead deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update lead status (for drag-and-drop)
// @route   PATCH /api/leads/:id/status
// @access  Private
const updateLeadStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || !['New', 'Contacted', 'Nurturing', 'Closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      {
        status,
        lastContacted: new Date() // Update last contacted when status changes
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found'
      });
    }

    res.status(200).json({
      success: true,
      data: lead
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get leads by status (for Kanban board)
// @route   GET /api/leads/status/:status
// @access  Private
const getLeadsByStatus = async (req, res) => {
  try {
    const { status } = req.params;

    if (!['New', 'Contacted', 'Nurturing', 'Closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const leads = await Lead.find({ status })
      .sort({ createdAt: -1 })
      .select('-__v');

    res.status(200).json({
      success: true,
      count: leads.length,
      data: leads
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
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  updateLeadStatus,
  getLeadsByStatus
};