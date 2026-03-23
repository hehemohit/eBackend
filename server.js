const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const ALLOWED_ORIGINS = [
  'https://efarmer.vercel.app',
  'https://efarmerr.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : [])
];

const io = socketIo(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true
  }
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/efarmer';

// Middleware
const corsOptions = {
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// cors() middleware handles preflight (OPTIONS) automatically — no app.options('*') needed
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  
  // Start auto-ending expired auctions
  const { autoEndExpiredAuctions } = require('./controllers/produce');
  
  // Run immediately on startup
  autoEndExpiredAuctions();
  
  // Then run every 5 minutes
  setInterval(autoEndExpiredAuctions, 5 * 60 * 1000);
  
  console.log('Auto-auction ending scheduled every 5 minutes');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join user to their personal room for notifications
  socket.on('join-user-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Handle bid updates
  socket.on('bid-update', (data) => {
    // Broadcast to all users interested in this produce
    socket.broadcast.emit('bid-updated', data);
  });

  // Handle auction updates
  socket.on('auction-update', (data) => {
    // Broadcast to all users
    io.emit('auction-updated', data);
  });

  // Handle ticket message updates
  socket.on('join-ticket-room', (ticketId) => {
    socket.join(`ticket-${ticketId}`);
    console.log(`User joined ticket room: ${ticketId}`);
  });

  // Handle ticket status updates
  socket.on('ticket-status-update', (data) => {
    socket.to(`ticket-${data.ticketId}`).emit('ticket-status-updated', data);
  });

  // Handle typing indicators
  socket.on('typing-start', (data) => {
    socket.to(`ticket-${data.ticketId}`).emit('user-typing', {
      ticketId: data.ticketId,
      userId: data.userId,
      userName: data.userName,
      userRole: data.userRole,
      isTyping: true
    });
  });

  socket.on('typing-stop', (data) => {
    socket.to(`ticket-${data.ticketId}`).emit('user-typing', {
      ticketId: data.ticketId,
      userId: data.userId,
      userName: data.userName,
      userRole: data.userRole,
      isTyping: false
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Make io available to other modules
app.set('io', io);

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    message: 'eFarmer Backend Server is running!',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/produce', require('./routes/produce'));
app.use('/api/v1/bids', require('./routes/bids'));
app.use('/api/v1/verification', require('./routes/verification'));
app.use('/api/v1/notifications', require('./routes/notifications'));
app.use('/api/v1/wholesaler-listings', require('./routes/wholesalerListings'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/v1/tickets', require('./routes/tickets'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 eFarmer Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
  console.log(`🗄️  MongoDB URI: ${MONGODB_URI}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    mongoose.connection.close();
  });
});
