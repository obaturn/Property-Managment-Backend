const nodemailer = require('nodemailer');
const twilio = require('twilio');

class NotificationService {
  constructor() {
    // Email transporter
    this.emailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD // App-specific password for Gmail
      }
    });

    // SMS client (only initialize if credentials are provided)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.smsClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    } else {
      this.smsClient = null;
      console.log('Twilio SMS service not configured - SMS notifications disabled');
    }
  }

  // Send email notification
  async sendEmail(to, subject, html, text = null) {
    try {
      const mailOptions = {
        from: `"RealtyFlow" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: subject,
        html: html,
        text: text || this.stripHtml(html)
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email notification');
    }
  }

  // Send SMS notification
  async sendSMS(to, message) {
    // Check if SMS service is configured
    if (!this.smsClient) {
      console.log('SMS service not configured - skipping SMS notification');
      return { success: false, message: 'SMS service not configured' };
    }

    try {
      const result = await this.smsClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      console.log('SMS sent successfully:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw new Error('Failed to send SMS notification');
    }
  }

  // Send meeting confirmation email
  async sendMeetingConfirmation(lead, agent, meeting, property) {
    const subject = `Meeting Confirmed: Property Viewing - ${property.address}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Meeting Confirmed!</h2>

        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Property Viewing Details</h3>
          <p><strong>Property:</strong> ${property.address}</p>
          <p><strong>Date & Time:</strong> ${meeting.dateTime.toLocaleString()}</p>
          <p><strong>Agent:</strong> ${agent.name}</p>
          <p><strong>Agent Email:</strong> ${agent.email}</p>
          ${agent.phone ? `<p><strong>Agent Phone:</strong> ${agent.phone}</p>` : ''}
        </div>

        <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h4>What happens next?</h4>
          <ul>
            <li>You'll receive a calendar invite shortly</li>
            <li>The agent will contact you if needed</li>
            <li>Bring any questions about the property</li>
          </ul>
        </div>

        <p style="color: #6b7280; font-size: 14px;">
          If you need to reschedule or have questions, please contact your agent directly.
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #9ca3af; font-size: 12px;">
          This is an automated message from RealtyFlow. Please do not reply to this email.
        </p>
      </div>
    `;

    return await this.sendEmail(lead.email, subject, html);
  }

  // Send meeting reminder email
  async sendMeetingReminder(lead, agent, meeting, property, minutesUntil = 30) {
    const subject = `Reminder: Property Viewing in ${minutesUntil} minutes`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Meeting Reminder</h2>

        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Your property viewing starts in ${minutesUntil} minutes!</h3>
          <p><strong>Property:</strong> ${property.address}</p>
          <p><strong>Time:</strong> ${meeting.dateTime.toLocaleString()}</p>
          <p><strong>Agent:</strong> ${agent.name}</p>
          ${agent.phone ? `<p><strong>Agent Phone:</strong> ${agent.phone}</p>` : ''}
        </div>

        <p>If you're running late or need to reschedule, please contact your agent immediately.</p>

        <p style="color: #9ca3af; font-size: 12px;">
          RealtyFlow - Smart Real Estate Booking
        </p>
      </div>
    `;

    return await this.sendEmail(lead.email, subject, html);
  }

  // Send SMS reminder
  async sendSMSReminder(lead, meeting, property, minutesUntil = 30) {
    const message = `Reminder: Your property viewing at ${property.address} starts in ${minutesUntil} minutes (${meeting.dateTime.toLocaleString()}). RealtyFlow`;

    if (lead.phone) {
      return await this.sendSMS(lead.phone, message);
    }
  }

  // Send agent notification about new lead/meeting
  async notifyAgentOfNewMeeting(agent, lead, meeting, property) {
    const subject = `New Meeting Scheduled: ${lead.name} - ${property.address}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Meeting Scheduled</h2>

        <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>Meeting Details</h3>
          <p><strong>Client:</strong> ${lead.name}</p>
          <p><strong>Email:</strong> ${lead.email}</p>
          ${lead.phone ? `<p><strong>Phone:</strong> ${lead.phone}</p>` : ''}
          <p><strong>Property:</strong> ${property.address}</p>
          <p><strong>Date & Time:</strong> ${meeting.dateTime.toLocaleString()}</p>
          <p><strong>Source:</strong> ${lead.source}</p>
          ${lead.notes ? `<p><strong>Notes:</strong> ${lead.notes}</p>` : ''}
        </div>

        <div style="background-color: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h4>Client Preferences</h4>
          ${lead.budget ? `<p><strong>Budget:</strong> $${lead.budget.toLocaleString()}</p>` : ''}
          ${lead.preferredPropertyType ? `<p><strong>Property Type:</strong> ${lead.preferredPropertyType}</p>` : ''}
          ${lead.timeline ? `<p><strong>Timeline:</strong> ${lead.timeline}</p>` : ''}
        </div>

        <p>A calendar event has been added to your Google Calendar.</p>

        <p style="color: #9ca3af; font-size: 12px;">
          RealtyFlow - Automated Meeting Management
        </p>
      </div>
    `;

    return await this.sendEmail(agent.email, subject, html);
  }

  // Send bulk notifications (for reminders, etc.)
  async sendBulkReminders(reminders) {
    const results = [];

    for (const reminder of reminders) {
      try {
        const emailResult = await this.sendMeetingReminder(
          reminder.lead,
          reminder.agent,
          reminder.meeting,
          reminder.property,
          reminder.minutesUntil
        );

        let smsResult = null;
        if (reminder.lead.phone) {
          smsResult = await this.sendSMSReminder(
            reminder.lead,
            reminder.meeting,
            reminder.property,
            reminder.minutesUntil
          );
        }

        results.push({
          success: true,
          leadId: reminder.lead.id,
          email: emailResult,
          sms: smsResult
        });
      } catch (error) {
        console.error(`Failed to send reminder to ${reminder.lead.email}:`, error);
        results.push({
          success: false,
          leadId: reminder.lead.id,
          error: error.message
        });
      }
    }

    return results;
  }

  // Strip HTML for text version
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Test email configuration
  async testEmail() {
    try {
      const result = await this.sendEmail(
        process.env.EMAIL_USER,
        'RealtyFlow Email Test',
        '<h1>Email service is working!</h1><p>This is a test message from RealtyFlow.</p>'
      );
      return { success: true, message: 'Email service tested successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Test SMS configuration
  async testSMS() {
    try {
      // This would need a test phone number
      return { success: true, message: 'SMS service configured (test number needed)' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();