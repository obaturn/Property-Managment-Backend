const Property = require('../../models/Property');
const {
  getProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty
} = require('../../controllers/propertyController');
const mongoose = require('mongoose');

// Mock request/response objects
const mockRequest = (body = {}, params = {}, query = {}) => ({
  body,
  params,
  query
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Property Controller', () => {
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

  describe('getProperties', () => {
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
      const req = mockRequest();
      const res = mockResponse();

      await getProperties(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          count: 2,
          data: expect.any(Array)
        })
      );
      expect(res.json.mock.calls[0][0].data).toHaveLength(2);
    });

    it('should filter properties by status', async () => {
      const req = mockRequest({}, {}, { status: 'Available' });
      const res = mockResponse();

      await getProperties(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json.mock.calls[0][0].data).toHaveLength(1);
      expect(res.json.mock.calls[0][0].data[0].status).toBe('Available');
    });
  });

  describe('getProperty', () => {
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
      const req = mockRequest({}, { id: testProperty._id.toString() });
      const res = mockResponse();

      await getProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            address: '123 Main St',
            price: 200000
          })
        })
      );
    });

    it('should return 404 for non-existent property', async () => {
      const req = mockRequest({}, { id: new mongoose.Types.ObjectId().toString() });
      const res = mockResponse();

      await getProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Property not found'
        })
      );
    });
  });

  describe('createProperty', () => {
    it('should create a new property', async () => {
      const propertyData = {
        address: '789 Pine St',
        price: 250000,
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1800,
        description: 'Beautiful home'
      };

      const req = mockRequest(propertyData);
      const res = mockResponse();

      await createProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            address: '789 Pine St',
            price: 250000
          })
        })
      );
    });

    it('should return validation error for invalid data', async () => {
      const req = mockRequest({}); // Missing required fields
      const res = mockResponse();

      await createProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Validation Error')
        })
      );
    });
  });

  describe('updateProperty', () => {
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
        description: 'Updated description'
      };

      const req = mockRequest(updateData, { id: testProperty._id.toString() });
      const res = mockResponse();

      await updateProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            price: 220000,
            description: 'Updated description'
          })
        })
      );
    });

    it('should return 404 for non-existent property', async () => {
      const req = mockRequest({ price: 250000 }, { id: new mongoose.Types.ObjectId().toString() });
      const res = mockResponse();

      await updateProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Property not found'
        })
      );
    });
  });

  describe('deleteProperty', () => {
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
      const req = mockRequest({}, { id: testProperty._id.toString() });
      const res = mockResponse();

      await deleteProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Property deleted successfully'
        })
      );

      // Verify property is deleted
      const deletedProperty = await Property.findById(testProperty._id);
      expect(deletedProperty).toBeNull();
    });

    it('should return 404 for non-existent property', async () => {
      const req = mockRequest({}, { id: new mongoose.Types.ObjectId().toString() });
      const res = mockResponse();

      await deleteProperty(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Property not found'
        })
      );
    });
  });
});