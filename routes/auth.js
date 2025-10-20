const express = require('express');
const router = express.Router();
const googleCalendar = require('../services/googleCalendar');

// @desc    Initiate Google Calendar OAuth
// @route   GET /api/auth/google
// @access  Private (Agent only)
router.get('/google', (req, res) => {
  try {
    const { agentId } = req.query;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID is required'
      });
    }

    const authUrl = googleCalendar.generateAuthUrl(agentId);

    res.status(200).json({
      success: true,
      authUrl: authUrl
    });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate authentication URL'
    });
  }
});

// @desc    Handle Google Calendar OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public (OAuth callback)
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state: agentId } = req.query;

    if (!code || !agentId) {
      return res.status(400).send(`
        <h1>Authentication Failed</h1>
        <p>Missing authorization code or agent ID.</p>
        <a href="/">Go back</a>
      `);
    }

    await googleCalendar.handleCallback(code, agentId);

    // Redirect to success page or frontend
    res.send(`
      <h1>Success!</h1>
      <p>Google Calendar has been connected successfully.</p>
      <p>You can now close this window and return to the application.</p>
      <script>
        // Try to close the popup window
        if (window.opener) {
          window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CONNECTED', agentId: '${agentId}' }, '*');
          window.close();
        }
      </script>
    `);

  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.status(500).send(`
      <h1>Authentication Failed</h1>
      <p>There was an error connecting your Google Calendar.</p>
      <p>Please try again.</p>
      <a href="/">Go back</a>
    `);
  }
});

// @desc    Disconnect Google Calendar
// @route   DELETE /api/auth/google
// @access  Private (Agent only)
router.delete('/google', async (req, res) => {
  try {
    const { agentId } = req.body;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID is required'
      });
    }

    const result = await googleCalendar.disconnectCalendar(agentId);

    res.status(200).json(result);
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect Google Calendar'
    });
  }
});

// @desc    Check Google Calendar connection status
// @route   GET /api/auth/google/status
// @access  Private (Agent only)
router.get('/google/status', async (req, res) => {
  try {
    const { agentId } = req.query;

    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: 'Agent ID is required'
      });
    }

    // Check if agent has Google Calendar connected
    const Agent = require('../models/Agent');
    const agent = await Agent.findById(agentId).select('googleCalendarId');

    const isConnected = !!(agent && agent.googleCalendarId);

    res.status(200).json({
      success: true,
      isConnected: isConnected,
      calendarId: agent?.googleCalendarId || null
    });
  } catch (error) {
    console.error('Error checking calendar status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check calendar connection status'
    });
  }
});

module.exports = router;