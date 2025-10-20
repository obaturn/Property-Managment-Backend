const Lead = require('../models/Lead');
const Meeting = require('../models/Meeting');
const Agent = require('../models/Agent');
const Property = require('../models/Property');
const googleCalendar = require('../services/googleCalendar');
const notificationService = require('../services/notificationService');
const socketService = require('../services/socketService');

// @desc    Create automated booking (lead + meeting)
// @route   POST /api/booking/request-visit
// @access  Public (for lead form submissions)
const createAutomatedBooking = async (req, res) => {
  const session = await Lead.startSession();
  session.startTransaction();

  try {
    const {
      // Lead information
      name,
      email,
      phone,
      source = 'Website',
      budget,
      preferredPropertyType,
      timeline,
      notes,

      // Property and meeting preferences
      propertyId,
      preferredDateTime, // Optional: user's preferred time
      timezone = 'America/New_York'
    } = req.body;

    // Validate required fields
    if (!name || !email || !propertyId) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and property ID are required'
      });
    }

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check if lead already exists
    let lead = await Lead.findOne({ email }).session(session);
    if (lead) {
      return res.status(409).json({
        success: false,
        message: 'A lead with this email already exists. Please contact us directly.',
        existingLead: {
          id: lead._id,
          name: lead.name,
          status: lead.status
        }
      });
    }

    // Create lead
    lead = await Lead.create([{
      name,
      email,
      phone,
      source,
      assignedTo: 'Auto-assigned', // Will be updated when agent is assigned
      budget: budget ? parseInt(budget) : undefined,
      preferredPropertyType,
      timeline,
      notes,
      status: 'New'
    }], { session });

    lead = lead[0]; // Since create returns an array

    // Find available agents
    const availableAgents = await Agent.find({
      isActive: true,
      googleCalendarId: { $exists: true } // Must have Google Calendar connected
    }).session(session);

    if (availableAgents.length === 0) {
      // No agents available, create lead only
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: 'Lead created successfully. No agents currently available for booking.',
        data: {
          lead: {
            id: lead._id,
            name: lead.name,
            email: lead.email,
            status: lead.status
          },
          bookingStatus: 'lead_only'
        }
      });
    }

    // Try to find an available time slot
    let selectedAgent = null;
    let selectedSlot = null;
    const meetingDuration = 60; // 60 minutes default

    // If user provided preferred time, try that first
    if (preferredDateTime) {
      const preferredTime = new Date(preferredDateTime);

      for (const agent of availableAgents) {
        const slotEnd = new Date(preferredTime.getTime() + meetingDuration * 60000);
        const isAvailable = await googleCalendar.checkAvailability(
          agent._id,
          preferredTime,
          slotEnd
        );

        if (isAvailable) {
          selectedAgent = agent;
          selectedSlot = { start: preferredTime, end: slotEnd };
          break;
        }
      }
    }

    // If no preferred time or preferred time not available, find next available slot
    if (!selectedSlot) {
      const startDate = preferredDateTime ? new Date(preferredDateTime) : new Date();

      for (const agent of availableAgents) {
        const availableSlots = await googleCalendar.getAvailableSlots(
          agent._id,
          startDate,
          meetingDuration
        );

        if (availableSlots.length > 0) {
          selectedAgent = agent;
          selectedSlot = availableSlots[0]; // Take first available slot
          break;
        }
      }
    }

    if (!selectedAgent || !selectedSlot) {
      // No available slots found, create lead only
      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: 'Lead created successfully. No available time slots found.',
        data: {
          lead: {
            id: lead._id,
            name: lead.name,
            email: lead.email,
            status: lead.status
          },
          bookingStatus: 'lead_only'
        }
      });
    }

    // Update lead assignment
    lead.assignedTo = selectedAgent.name;
    await lead.save({ session });

    // Create meeting
    const meeting = await Meeting.create([{
      leadName: lead.name,
      propertyAddress: property.address,
      dateTime: selectedSlot.start,
      status: 'Scheduled',
      assignedTo: selectedAgent.name,
      notes: `Auto-booked via website form. ${notes || ''}`.trim()
    }], { session });

    // Create calendar event (skip if no valid Google Calendar tokens)
    let calendarEvent = null;
    try {
      const eventDetails = {
        title: `Property Viewing - ${property.address}`,
        description: `Meeting with ${lead.name} (${lead.email}) to view property at ${property.address}. ${lead.notes || ''}`,
        start: selectedSlot.start,
        end: selectedSlot.end,
        timezone: selectedAgent.timezone,
        attendees: [
          { email: lead.email, displayName: lead.name },
          { email: selectedAgent.email, displayName: selectedAgent.name }
        ]
      };

      calendarEvent = await googleCalendar.createEvent(selectedAgent._id, eventDetails);
    } catch (calendarError) {
      console.warn('Google Calendar integration failed, proceeding without calendar event:', calendarError.message);
      calendarEvent = { eventId: null, htmlLink: null };
    }

    // Update meeting with calendar event ID
    meeting[0].calendarEventId = calendarEvent.eventId;
    await meeting[0].save({ session });

    // Update agent stats
    selectedAgent.totalMeetings += 1;
    await selectedAgent.save({ session });

    // Send notifications
    try {
      // Send confirmation to lead
      await notificationService.sendMeetingConfirmation(
        lead,
        selectedAgent,
        meeting[0],
        property
      );

      // Send notification to agent
      await notificationService.notifyAgentOfNewMeeting(
        selectedAgent,
        lead,
        meeting[0],
        property
      );

      // Send SMS if phone provided
      if (lead.phone) {
        const smsMessage = `Hi ${lead.name}! Your property viewing at ${property.address} is confirmed for ${selectedSlot.start.toLocaleString()}. RealtyFlow`;
        await notificationService.sendSMS(lead.phone, smsMessage);
      }

      // Send real-time in-app notifications
      const meetingData = {
        id: meeting[0]._id,
        leadName: lead.name,
        propertyAddress: property.address,
        dateTime: selectedSlot.start,
        status: 'Scheduled'
      };

      // Notify agent of new meeting
      socketService.notifyUser(selectedAgent._id.toString(), 'newMeeting', {
        type: 'new_meeting',
        title: 'New Meeting Scheduled',
        message: `You have a new meeting with ${lead.name} for ${property.address}`,
        data: meetingData,
        timestamp: new Date()
      });

      // Notify all admins of new booking
      socketService.notifyUserType('admin', 'newBooking', {
        type: 'new_booking',
        title: 'New Booking Created',
        message: `${lead.name} booked a viewing for ${property.address}`,
        data: {
          lead: { id: lead._id, name: lead.name, email: lead.email },
          meeting: meetingData,
          agent: { name: selectedAgent.name }
        },
        timestamp: new Date()
      });

    } catch (notificationError) {
      console.error('Error sending notifications:', notificationError);
      // Don't fail the booking if notifications fail
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Booking created successfully!',
      data: {
        lead: {
          id: lead._id,
          name: lead.name,
          email: lead.email,
          status: lead.status
        },
        meeting: {
          id: meeting[0]._id,
          dateTime: meeting[0].dateTime,
          status: meeting[0].status,
          calendarLink: calendarEvent.htmlLink
        },
        agent: {
          name: selectedAgent.name,
          email: selectedAgent.email,
          phone: selectedAgent.phone
        },
        property: {
          address: property.address,
          price: property.price
        },
        bookingStatus: 'fully_booked'
      }
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error creating automated booking:', error);

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

// @desc    Get available time slots for a property
// @route   GET /api/booking/available-slots
// @access  Public
const getAvailableSlots = async (req, res) => {
  try {
    const { propertyId, date, timezone = 'America/New_York' } = req.query;

    if (!propertyId || !date) {
      return res.status(400).json({
        success: false,
        message: 'Property ID and date are required'
      });
    }

    // Check if property exists
    const property = await Property.findById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Get available agents
    const availableAgents = await Agent.find({
      isActive: true,
      googleCalendarId: { $exists: true }
    });

    if (availableAgents.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No agents available for booking',
        data: []
      });
    }

    const requestedDate = new Date(date);
    const allSlots = [];

    // Get slots from all available agents
    for (const agent of availableAgents) {
      const agentSlots = await googleCalendar.getAvailableSlots(
        agent._id,
        requestedDate,
        agent.meetingDuration
      );

      // Add agent info to slots
      const slotsWithAgent = agentSlots.map(slot => ({
        ...slot,
        agent: {
          id: agent._id,
          name: agent.name,
          email: agent.email
        }
      }));

      allSlots.push(...slotsWithAgent);
    }

    // Sort slots by time
    allSlots.sort((a, b) => a.start.getTime() - b.start.getTime());

    res.status(200).json({
      success: true,
      count: allSlots.length,
      data: allSlots
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

// @desc    Get booking statistics
// @route   GET /api/booking/stats
// @access  Private (Admin only)
const getBookingStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Get various statistics
    const [
      totalLeads,
      newLeadsThisMonth,
      meetingsThisMonth,
      completedMeetingsThisMonth,
      availableAgents
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Meeting.countDocuments({ dateTime: { $gte: startOfMonth } }),
      Meeting.countDocuments({
        dateTime: { $gte: startOfMonth },
        status: 'Completed'
      }),
      Agent.countDocuments({
        isActive: true,
        googleCalendarId: { $exists: true }
      })
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalLeads,
        newLeadsThisMonth,
        meetingsThisMonth,
        completedMeetingsThisMonth,
        availableAgents,
        conversionRate: meetingsThisMonth > 0 ? (completedMeetingsThisMonth / meetingsThisMonth * 100).toFixed(1) : 0
      }
    });

  } catch (error) {
    console.error('Error getting booking stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  createAutomatedBooking,
  getAvailableSlots,
  getBookingStats
};