const request = require('supertest');
const express = require('express');
let server;
let app;

// Mock the database connection and Lead model for testing
jest.mock('../../config/database', () => jest.fn());
jest.mock('../../models/Lead', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  getLeadsByStatus: jest.fn(),
  deleteMany: jest.fn(),
  insertMany: jest.fn()
}));

const Lead = require('../../models/Lead');

beforeAll(async () => {
  // Create test app
  app = express();
  app.use(express.json());

  // Import and use routes after app is created
  const leadRoutes = require('../../routes/leads');
  app.use('/api/leads', leadRoutes);

  server = app.listen(0); // Random port
}, 10000);

afterAll(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
}, 10000);

describe('Lead API Routes', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('GET /api/leads', () => {
    it('should return leads with pagination', async () => {
      // Mock the Lead.find method to return a query object
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([])
      };
      Lead.find.mockReturnValue(mockQuery);
      Lead.countDocuments.mockResolvedValue(0);

      const response = await request(server)
        .get('/api/leads')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(Lead.find).toHaveBeenCalled();
    });

    it('should filter leads by status', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([])
      };
      Lead.find.mockReturnValue(mockQuery);
      Lead.countDocuments.mockResolvedValue(0);

      const response = await request(server)
        .get('/api/leads?status=New')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(Lead.find).toHaveBeenCalledWith({ status: 'New' });
    });
  });

  describe('GET /api/leads/status/:status', () => {
    it('should return leads for valid status', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([])
      };
      Lead.find.mockReturnValue(mockQuery);

      const response = await request(server)
        .get('/api/leads/status/New')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(Lead.find).toHaveBeenCalledWith({ status: 'New' });
    });

    it('should reject invalid status', async () => {
      const response = await request(server)
        .get('/api/leads/status/InvalidStatus')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid status');
    });
  });

  describe('POST /api/leads', () => {
    it('should create a new lead', async () => {
      const leadData = {
        name: 'Test Lead',
        email: 'test@example.com',
        status: 'New',
        source: 'Website',
        assignedTo: 'Test Agent'
      };

      const mockLead = { _id: '507f1f77bcf86cd799439011', ...leadData };
      Lead.create.mockResolvedValue(mockLead);

      const response = await request(server)
        .post('/api/leads')
        .send(leadData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.name).toBe(leadData.name);
      expect(Lead.create).toHaveBeenCalledWith(leadData);
    });

    it('should reject invalid lead data', async () => {
      const invalidData = {
        // Missing required fields
      };

      // Mock validation error
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      validationError.errors = { name: { message: 'Name is required' } };
      Lead.create.mockRejectedValue(validationError);

      const response = await request(server)
        .post('/api/leads')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation Error');
    });
  });

  describe('PATCH /api/leads/:id/status', () => {
    it('should update lead status', async () => {
      // Mock the findByIdAndUpdate method
      const mockUpdatedLead = {
        _id: '507f1f77bcf86cd799439011',
        name: 'Status Test Lead',
        email: 'status@example.com',
        status: 'Contacted',
        source: 'Website',
        assignedTo: 'Test Agent'
      };
      Lead.findByIdAndUpdate.mockResolvedValue(mockUpdatedLead);

      const response = await request(server)
        .patch('/api/leads/507f1f77bcf86cd799439011/status')
        .send({ status: 'Contacted' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('Contacted');
      expect(Lead.findByIdAndUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { status: 'Contacted', lastContacted: expect.any(Date) },
        { new: true, runValidators: true }
      );
    });

    it('should reject invalid status update', async () => {
      const response = await request(server)
        .patch('/api/leads/507f1f77bcf86cd799439011/status')
        .send({ status: 'InvalidStatus' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid status');
    });
  });

  describe('GET /api/leads/:id', () => {
    it('should return 404 for non-existent lead', async () => {
      const response = await request(server)
        .get('/api/leads/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Lead not found');
    });
  });

  describe('PUT /api/leads/:id', () => {
    it('should return 404 for non-existent lead update', async () => {
      Lead.findByIdAndUpdate.mockResolvedValue(null);

      const response = await request(server)
        .put('/api/leads/507f1f77bcf86cd799439011')
        .send({ name: 'Updated Name' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Lead not found');
    });
  });

  describe('DELETE /api/leads/:id', () => {
    it('should return 404 for non-existent lead deletion', async () => {
      const response = await request(server)
        .delete('/api/leads/507f1f77bcf86cd799439011')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Lead not found');
    });
  });
});