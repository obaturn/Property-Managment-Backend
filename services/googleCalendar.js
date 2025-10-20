const { google } = require('googleapis');
const Agent = require('../models/Agent');

class GoogleCalendarService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/google/callback`
    );

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  // Generate OAuth URL for Google Calendar access
  generateAuthUrl(state = null) {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent' // Force refresh token
    });
  }

  // Handle OAuth callback and store tokens
  async handleCallback(code, agentId) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);

      // Get calendar ID
      const calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      const calendarList = await calendar.calendarList.list();
      const primaryCalendar = calendarList.data.items.find(cal => cal.primary);

      if (!primaryCalendar) {
        throw new Error('No primary calendar found');
      }

      // Update agent with Google Calendar info
      await Agent.findByIdAndUpdate(agentId, {
        googleCalendarId: primaryCalendar.id,
        googleAccessToken: tokens.access_token,
        googleRefreshToken: tokens.refresh_token,
        googleTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        lastActive: new Date()
      });

      return {
        success: true,
        calendarId: primaryCalendar.id,
        message: 'Google Calendar connected successfully'
      };
    } catch (error) {
      console.error('Error handling Google Calendar callback:', error);
      throw new Error('Failed to connect Google Calendar');
    }
  }

  // Set credentials for an agent
  async setAgentCredentials(agentId) {
    try {
      const agent = await Agent.findById(agentId).select('+googleAccessToken +googleRefreshToken +googleTokenExpiry');

      if (!agent || !agent.googleAccessToken) {
        throw new Error('Agent not connected to Google Calendar');
      }

      // Check if token is expired and refresh if needed
      if (agent.googleTokenExpiry && agent.googleTokenExpiry < new Date()) {
        await this.refreshAccessToken(agentId);
        // Re-fetch agent with new token
        const updatedAgent = await Agent.findById(agentId).select('+googleAccessToken +googleRefreshToken +googleTokenExpiry');
        this.oauth2Client.setCredentials({
          access_token: updatedAgent.googleAccessToken,
          refresh_token: updatedAgent.googleRefreshToken,
          expiry_date: updatedAgent.googleTokenExpiry.getTime()
        });
      } else {
        this.oauth2Client.setCredentials({
          access_token: agent.googleAccessToken,
          refresh_token: agent.googleRefreshToken,
          expiry_date: agent.googleTokenExpiry ? agent.googleTokenExpiry.getTime() : null
        });
      }

      return agent.googleCalendarId;
    } catch (error) {
      console.error('Error setting agent credentials:', error);
      throw error;
    }
  }

  // Refresh access token
  async refreshAccessToken(agentId) {
    try {
      const agent = await Agent.findById(agentId).select('+googleRefreshToken');

      if (!agent || !agent.googleRefreshToken) {
        throw new Error('No refresh token available');
      }

      this.oauth2Client.setCredentials({
        refresh_token: agent.googleRefreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);

      // Update agent with new tokens
      await Agent.findByIdAndUpdate(agentId, {
        googleAccessToken: credentials.access_token,
        googleTokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date) : null
      });

      return credentials.access_token;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw new Error('Failed to refresh Google Calendar access token');
    }
  }

  // Check agent availability for a specific time slot
  async checkAvailability(agentId, startTime, endTime) {
    try {
      const calendarId = await this.setAgentCredentials(agentId);

      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: startTime.toISOString(),
          timeMax: endTime.toISOString(),
          items: [{ id: calendarId }]
        }
      });

      const busySlots = response.data.calendars[calendarId].busy || [];
      return busySlots.length === 0; // Available if no busy slots

    } catch (error) {
      console.error('Error checking availability:', error);
      // If we can't check calendar, assume available (fail-safe)
      return true;
    }
  }

  // Get available time slots for an agent
  async getAvailableSlots(agentId, date, duration = 60) {
    try {
      const agent = await Agent.findById(agentId);
      if (!agent) throw new Error('Agent not found');

      const calendarId = await this.setAgentCredentials(agentId);

      // Get working hours for the day
      const dayName = date.toLocaleLowerCase('en-US', { weekday: 'long' });
      if (!agent.workingDays.includes(dayName)) {
        return []; // Not a working day
      }

      const [startHour, startMinute] = agent.workingHours.start.split(':').map(Number);
      const [endHour, endMinute] = agent.workingHours.end.split(':').map(Number);

      // Generate potential slots
      const slots = [];
      let currentTime = new Date(date);
      currentTime.setHours(startHour, startMinute, 0, 0);

      const endTime = new Date(date);
      endTime.setHours(endHour, endMinute, 0, 0);

      while (currentTime < endTime) {
        const slotEnd = new Date(currentTime.getTime() + duration * 60000);

        // Check if slot is available
        const isAvailable = await this.checkAvailability(agentId, currentTime, slotEnd);

        if (isAvailable && slotEnd <= endTime) {
          slots.push({
            start: new Date(currentTime),
            end: new Date(slotEnd)
          });
        }

        // Move to next slot (duration + buffer)
        currentTime = new Date(slotEnd.getTime() + agent.bufferTime * 60000);
      }

      return slots;
    } catch (error) {
      console.error('Error getting available slots:', error);
      return [];
    }
  }

  // Create calendar event
  async createEvent(agentId, eventDetails) {
    try {
      const calendarId = await this.setAgentCredentials(agentId);

      const event = {
        summary: eventDetails.title,
        description: eventDetails.description,
        start: {
          dateTime: eventDetails.start.toISOString(),
          timeZone: eventDetails.timezone || 'America/New_York'
        },
        end: {
          dateTime: eventDetails.end.toISOString(),
          timeZone: eventDetails.timezone || 'America/New_York'
        },
        attendees: eventDetails.attendees || [],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 30 },
            { method: 'popup', minutes: 15 }
          ]
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: calendarId,
        resource: event,
        sendUpdates: 'all' // Send email notifications to attendees
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink
      };
    } catch (error) {
      console.error('Error creating calendar event:', error);
      throw new Error('Failed to create calendar event');
    }
  }

  // Get agent's upcoming events
  async getUpcomingEvents(agentId, maxResults = 10) {
    try {
      const calendarId = await this.setAgentCredentials(agentId);

      const response = await this.calendar.events.list({
        calendarId: calendarId,
        timeMin: new Date().toISOString(),
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error getting upcoming events:', error);
      return [];
    }
  }

  // Disconnect Google Calendar
  async disconnectCalendar(agentId) {
    try {
      await Agent.findByIdAndUpdate(agentId, {
        $unset: {
          googleCalendarId: 1,
          googleAccessToken: 1,
          googleRefreshToken: 1,
          googleTokenExpiry: 1
        }
      });

      return { success: true, message: 'Google Calendar disconnected successfully' };
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      throw new Error('Failed to disconnect Google Calendar');
    }
  }
}

module.exports = new GoogleCalendarService();