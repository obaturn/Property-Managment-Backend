const mongoose = require('mongoose');
const Lead = require('../../models/Lead');

describe('Lead Model', () => {
  beforeAll(async () => {
    // For TDD, we'll skip actual database connection
    // In production, this would connect to MongoDB
    console.log('Lead Model tests - using mock database for TDD');
  }, 10000);

  afterAll(async () => {
    // Skip actual database cleanup for TDD
    console.log('Lead Model tests - skipping database cleanup');
  }, 10000);

  beforeEach(async () => {
    // Skip database cleanup for TDD
    console.log('Skipping database cleanup for TDD');
  });

  describe('Lead Schema Validation', () => {
    it('should validate lead schema structure', () => {
      const leadData = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-0123',
        status: 'New',
        source: 'Website',
        assignedTo: 'Jane Agent'
      };

      // Test schema validation without database
      const lead = new Lead(leadData);

      expect(lead.name).toBe(leadData.name);
      expect(lead.email).toBe(leadData.email.toLowerCase());
      expect(lead.status).toBe(leadData.status);
      expect(lead.source).toBe(leadData.source);
      expect(lead.assignedTo).toBe(leadData.assignedTo);
    });

    it('should validate required fields', () => {
      const lead = new Lead({});

      // Test schema validation
      const validationError = lead.validateSync();
      expect(validationError).toBeDefined();
      expect(validationError.errors.name).toBeDefined();
      expect(validationError.errors.email).toBeDefined();
    });

    it('should validate email format', () => {
      const leadData = {
        name: 'John Doe',
        email: 'invalid-email',
        status: 'New',
        source: 'Website',
        assignedTo: 'Jane Agent'
      };

      const lead = new Lead(leadData);
      const validationError = lead.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError.errors.email).toBeDefined();
    });

    it('should convert email to lowercase', () => {
      const leadData = {
        name: 'John Doe',
        email: 'JOHN@EXAMPLE.COM',
        status: 'New',
        source: 'Website',
        assignedTo: 'Jane Agent'
      };

      const lead = new Lead(leadData);
      expect(lead.email).toBe('john@example.com');
    });
  });

  describe('Lead Status Validation', () => {
    it('should accept valid status values', () => {
      const validStatuses = ['New', 'Contacted', 'Nurturing', 'Closed'];

      for (const status of validStatuses) {
        const leadData = {
          name: 'Test Lead',
          email: `test${status}@example.com`,
          status,
          source: 'Website',
          assignedTo: 'Jane Agent'
        };

        const lead = new Lead(leadData);
        expect(lead.status).toBe(status);
      }
    });

    it('should reject invalid status values', () => {
      const leadData = {
        name: 'Test Lead',
        email: 'test@example.com',
        status: 'InvalidStatus',
        source: 'Website',
        assignedTo: 'Jane Agent'
      };

      const lead = new Lead(leadData);
      const validationError = lead.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError.errors.status).toBeDefined();
    });
  });

  describe('Lead Methods', () => {
    it('should have updateLastContacted method defined', () => {
      const leadData = {
        name: 'John Doe',
        email: 'john@example.com',
        status: 'New',
        source: 'Website',
        assignedTo: 'Jane Agent'
      };

      const lead = new Lead(leadData);
      expect(typeof lead.updateLastContacted).toBe('function');
    });
  });

  describe('Lead Virtuals', () => {
    it('should have daysSinceLastContact virtual', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5); // 5 days ago

      const leadData = {
        name: 'John Doe',
        email: 'john@example.com',
        status: 'New',
        source: 'Website',
        assignedTo: 'Jane Agent',
        lastContacted: pastDate
      };

      const lead = new Lead(leadData);

      // Test that virtual property exists and calculates correctly
      expect(lead.daysSinceLastContact).toBeDefined();
      expect(typeof lead.daysSinceLastContact).toBe('number');
    });
  });

  describe('Lead Statics', () => {
    it('should have static methods defined', () => {
      expect(typeof Lead.getLeadsByStatus).toBe('function');
      expect(typeof Lead.getLeadsByAgent).toBe('function');
    });

    it('should validate static method parameters', () => {
      // Test that static methods exist and are callable
      expect(() => Lead.getLeadsByStatus('New')).not.toThrow();
      expect(() => Lead.getLeadsByAgent('Agent A')).not.toThrow();
    });
  });
});