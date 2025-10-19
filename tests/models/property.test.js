const Property = require('../../models/Property');
const mongoose = require('mongoose');

describe('Property Model', () => {
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

  describe('Property Creation', () => {
    it('should create a property with valid data', async () => {
      const propertyData = {
        address: '123 Main St, Springfield, IL',
        price: 250000,
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1800,
        imageUrl: 'https://example.com/image.jpg',
        description: 'Beautiful family home'
      };

      const property = new Property(propertyData);
      const savedProperty = await property.save();

      expect(savedProperty._id).toBeDefined();
      expect(savedProperty.address).toBe(propertyData.address);
      expect(savedProperty.price).toBe(propertyData.price);
      expect(savedProperty.bedrooms).toBe(propertyData.bedrooms);
      expect(savedProperty.bathrooms).toBe(propertyData.bathrooms);
      expect(savedProperty.sqft).toBe(propertyData.sqft);
      expect(savedProperty.imageUrl).toBe(propertyData.imageUrl);
      expect(savedProperty.description).toBe(propertyData.description);
      expect(savedProperty.createdAt).toBeDefined();
      expect(savedProperty.updatedAt).toBeDefined();
    });

    it('should require address and price', async () => {
      const property = new Property({});

      let error;
      try {
        await property.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.name).toBe('ValidationError');
    });

    it('should validate price is positive', async () => {
      const property = new Property({
        address: '123 Main St',
        price: -1000
      });

      let error;
      try {
        await property.save();
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.errors.price.message).toContain('cannot be negative');
    });
  });

  describe('Property Queries', () => {
    beforeEach(async () => {
      // Create test properties
      await Property.create([
        {
          address: '123 Main St',
          price: 200000,
          bedrooms: 3,
          bathrooms: 2,
          sqft: 1500
        },
        {
          address: '456 Oak Ave',
          price: 300000,
          bedrooms: 4,
          bathrooms: 3,
          sqft: 2000
        }
      ]);
    });

    it('should find all properties', async () => {
      const properties = await Property.find({});
      expect(properties.length).toBe(2);
    });

    it('should find property by ID', async () => {
      const property = await Property.findOne({ address: '123 Main St' });
      const foundProperty = await Property.findById(property._id);

      expect(foundProperty.address).toBe('123 Main St');
      expect(foundProperty.price).toBe(200000);
    });
  });
});