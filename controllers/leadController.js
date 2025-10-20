const Lead = require('../models/Lead');
const socketService = require('../services/socketService');

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

// @desc    Handle webhook lead ingestion from external sources
// @route   POST /api/leads/webhook
// @access  Public (with signature verification)
const handleWebhookLead = async (req, res) => {
  try {
    const {
      // Lead information from webhook
      name,
      email,
      phone,
      source = 'Webhook',
      propertyId,
      preferredDateTime,
      budget,
      preferredPropertyType,
      timeline,
      notes,
      // Webhook metadata
      sourceSystem, // 'REA', 'website', 'crm', etc.
      externalId, // External system reference ID
      signature, // For signature verification
      timestamp,
    } = req.body;

    // Basic validation
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }

    // Optional signature verification (implement based on your webhook provider)
    // This is a basic example - implement proper signature verification for production
    if (process.env.WEBHOOK_SECRET && signature) {
      // Verify webhook signature here
      // Implementation depends on the webhook provider (REA, Zapier, etc.)
    }

    // Check if lead already exists
    let lead = await Lead.findOne({ email });
    if (lead) {
      // Update existing lead with new information
      lead.source = source;
      lead.lastContacted = new Date();
      if (notes) lead.notes = notes;
      if (budget) lead.budget = parseInt(budget);
      if (preferredPropertyType) lead.preferredPropertyType = preferredPropertyType;
      if (timeline) lead.timeline = timeline;
      if (externalId) lead.externalId = externalId;
      if (sourceSystem) lead.sourceSystem = sourceSystem;

      await lead.save();

      return res.status(200).json({
        success: true,
        message: 'Lead updated successfully',
        data: {
          lead: {
            id: lead._id,
            name: lead.name,
            email: lead.email,
            status: lead.status
          },
          action: 'updated'
        }
      });
    }

    // Create new lead
    lead = await Lead.create({
      name,
      email,
      phone,
      source,
      assignedTo: 'Auto-assigned', // Will be updated when agent is assigned
      budget: budget ? parseInt(budget) : undefined,
      preferredPropertyType,
      timeline,
      notes,
      status: 'New',
      externalId,
      sourceSystem,
      lastContacted: new Date()
    });

    // If propertyId is provided and preferredDateTime, attempt automated booking
    if (propertyId && preferredDateTime) {
      try {
        // Import booking controller to reuse logic
        const { createAutomatedBooking } = require('./bookingController');

        // Create a mock request object for the booking
        const mockReq = {
          body: {
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            propertyId,
            preferredDateTime,
            budget,
            preferredPropertyType,
            timeline,
            notes
          }
        };

        const mockRes = {
          status: (code) => ({
            json: (data) => {
              console.log('Automated booking result:', data);
              return data;
            }
          })
        };

        // Attempt automated booking
        await createAutomatedBooking(mockReq, mockRes);
      } catch (bookingError) {
        console.error('Automated booking failed for webhook lead:', bookingError);
        // Continue with lead creation even if booking fails
      }
    }

    // Send real-time notification for new lead
    socketService.notifyUserType('admin', 'newLead', {
      type: 'new_lead',
      title: 'New Lead Created',
      message: `${lead.name} submitted a new lead from ${lead.source}`,
      data: {
        id: lead._id,
        name: lead.name,
        email: lead.email,
        source: lead.source,
        status: lead.status
      },
      timestamp: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Lead created successfully',
      data: {
        lead: {
          id: lead._id,
          name: lead.name,
          email: lead.email,
          status: lead.status
        },
        action: 'created'
      }
    });

  } catch (error) {
    console.error('Error handling webhook lead:', error);

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

// @desc    Get webhook logs/events (for debugging)
// @route   GET /api/leads/webhook/logs
// @access  Private (Admin only)
const getWebhookLogs = async (req, res) => {
  try {
    // This would typically query a WebhookLog model
    // For now, return a placeholder response
    res.status(200).json({
      success: true,
      message: 'Webhook logging not yet implemented',
      data: []
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
  getLeadsByStatus,
  handleWebhookLead,
  getWebhookLogs
};
