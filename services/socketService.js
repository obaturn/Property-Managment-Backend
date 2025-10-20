const socketIo = require('socket.io');

// Socket.IO service for real-time notifications
class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
  }

  // Initialize Socket.IO server
  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    this.setupEventHandlers();
    console.log('Socket.IO server initialized');
  }

  // Setup event handlers
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Handle user authentication/join
      socket.on('join', (userData) => {
        const { userId, userType } = userData; // userType: 'agent' or 'admin'
        this.connectedUsers.set(userId, socket.id);
        socket.userId = userId;
        socket.userType = userType;

        console.log(`User ${userId} (${userType}) joined with socket ${socket.id}`);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        if (socket.userId) {
          this.connectedUsers.delete(socket.userId);
          console.log(`User ${socket.userId} disconnected`);
        }
      });

      // Handle typing indicators (optional)
      socket.on('typing', (data) => {
        socket.broadcast.emit('userTyping', data);
      });

      // Handle read receipts (optional)
      socket.on('markAsRead', (data) => {
        // Could store read status in database
        socket.broadcast.emit('messageRead', data);
      });
    });
  }

  // Send notification to specific user
  notifyUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit(event, data);
      return true;
    }
    return false; // User not connected
  }

  // Send notification to all connected users
  notifyAll(event, data) {
    this.io.emit(event, data);
  }

  // Send notification to users of specific type (agents/admins)
  notifyUserType(userType, event, data) {
    const connectedSockets = Array.from(this.io.sockets.sockets.values());

    connectedSockets.forEach(socket => {
      if (socket.userType === userType) {
        socket.emit(event, data);
      }
    });
  }

  // Send notification to multiple users
  notifyUsers(userIds, event, data) {
    userIds.forEach(userId => {
      this.notifyUser(userId, event, data);
    });
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get connected users list
  getConnectedUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  // Check if user is connected
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }
}

// Create singleton instance
const socketService = new SocketService();

module.exports = socketService;