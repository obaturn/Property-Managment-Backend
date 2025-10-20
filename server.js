const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
require('dotenv').config();
const connectDB = require('./config/database');
const socketService = require('./services/socketService');

// Cloudinary configuration
const cloudinary = require('cloudinary').v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.IO
socketService.initialize(server);

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
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/booking', require('./routes/booking'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/agents', require('./routes/agents'));
console.log('Routes registered successfully');
console.log('Available routes:');
console.log('- /api/leads');
console.log('- /api/properties');
console.log('- /api/meetings');
console.log('- /api/booking');
console.log('- /api/auth');
console.log('- /api/agents');

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

// For testing purposes, export the app and server
module.exports = { app, server };

// Start server only when this file is run directly
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket server initialized`);
  });
}