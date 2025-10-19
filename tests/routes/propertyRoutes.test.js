const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Property = require('../../models/Property');

describe('Property Routes', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test');
  });

  afterAll(async () => {
    // Close database connection
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clear all properties before each test
    await Property.deleteMany({});
  });

  describe('GET /api/properties', () => {
    beforeEach(async () => {
      // Create test properties
      await Property.create([
        {
          address: '123 Main St',
          price: 200000,
          bedrooms: 3,
          bathrooms: 2,
          sqft: 1500,
          status: 'Available'
        },
        {
          address: '456 Oak Ave',
          price: 300000,
          bedrooms: 4,
          bathrooms: 3,
          sqft: 2000,
          status: 'Pending'
        }
      ]);
    });

    it('should return all properties', async () => {
      const response = await request(app)
        .get('/api/properties')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(2);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0]).toHaveProperty('address');
      expect(response.body.data[0]).toHaveProperty('price');
    });

    it('should filter properties by status', async () => {
      const response = await request(app)
        .get('/api/properties?status=Available')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.data[0].status).toBe('Available');
    });

    it('should filter properties by price range', async () => {
      const response = await request(app)
        .get('/api/properties?minPrice=250000&maxPrice=350000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.data[0].price).toBe(300000);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/properties?page=1&limit=1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.total).toBe(2);
      expect(response.body.totalPages).toBe(2);
      expect(response.body.currentPage).toBe(1);
    });
  });

  describe('GET /api/properties/:id', () => {
    let testProperty;

    beforeEach(async () => {
      testProperty = await Property.create({
        address: '123 Main St',
        price: 200000,
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1500
      });
    });

    it('should return a property by ID', async () => {
      const response = await request(app)
        .get(`/api/properties/${testProperty._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.address).toBe('123 Main St');
      expect(response.body.data.price).toBe(200000);
    });

    it('should return 404 for non-existent property', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/properties/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Property not found');
    });
  });

  describe('POST /api/properties', () => {
    it('should create a new property', async () => {
      const propertyData = {
        address: '789 Pine St',
        price: 250000,
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1800,
        description: 'Beautiful home'
      };

      const response = await request(app)
        .post('/api/properties')
        .send(propertyData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.address).toBe('789 Pine St');
      expect(response.body.data.price).toBe(250000);
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data).toHaveProperty('createdAt');
    });

    it('should return validation error for missing required fields', async () => {
      const response = await request(app)
        .post('/api/properties')
        .send({}) // Missing address and price
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation Error');
      expect(response.body.errors).toBeDefined();
    });

    it('should return validation error for invalid price', async () => {
      const propertyData = {
        address: '123 Main St',
        price: -1000 // Invalid negative price
      };

      const response = await request(app)
        .post('/api/properties')
        .send(propertyData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation Error');
    });
  });

  describe('PUT /api/properties/:id', () => {
    let testProperty;

    beforeEach(async () => {
      testProperty = await Property.create({
        address: '123 Main St',
        price: 200000,
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1500
      });
    });

    it('should update a property', async () => {
      const updateData = {
        price: 220000,
        description: 'Updated beautiful home'
      };

      const response = await request(app)
        .put(`/api/properties/${testProperty._id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.price).toBe(220000);
      expect(response.body.data.description).toBe('Updated beautiful home');
      expect(response.body.data.address).toBe('123 Main St'); // Unchanged field
    });

    it('should return 404 for non-existent property', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .put(`/api/properties/${fakeId}`)
        .send({ price: 250000 })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Property not found');
    });
  });

  describe('DELETE /api/properties/:id', () => {
    let testProperty;

    beforeEach(async () => {
      testProperty = await Property.create({
        address: '123 Main St',
        price: 200000,
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1500
      });
    });

    it('should delete a property', async () => {
      const response = await request(app)
        .delete(`/api/properties/${testProperty._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Property deleted successfully');

      // Verify property is deleted
      const deletedProperty = await Property.findById(testProperty._id);
      expect(deletedProperty).toBeNull();
    });

    it('should return 404 for non-existent property', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .delete(`/api/properties/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Property not found');
    });
  });
});