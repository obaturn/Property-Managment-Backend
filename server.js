const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/database');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes - Always register routes regardless of how the module is loaded
app.use('/api/leads', require('./routes/leads'));
app.use('/api/properties', require('./routes/properties'));
console.log('Routes registered successfully');
console.log('Available routes:');
console.log('- /api/leads');
console.log('- /api/properties');

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to RealtyFlow Backend API' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'RealtyFlow API is running',
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// For testing purposes, export the app
module.exports = app;

// Start server only when this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}