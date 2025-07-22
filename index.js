const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to our API!' });
});

app.get('/test', (req, res) => {
  res.sendFile(__dirname + '/client.html');
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/version', (req, res) => {
  res.json({ 
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/websocket', (req, res) => {
  res.json({
    status: 'WebSocket server is running',
    endpoint: `ws://localhost:${PORT}`
  });
});

app.get('/api/background-service', (req, res) => {
  res.json({
    timeBroadcast: {
      status: timeInterval ? 'running' : 'stopped',
      interval: TIME_BROADCAST_INTERVAL,
      description: 'Broadcasting current time to all connected WebSocket clients'
    }
  });
});

app.get('/api/users', (req, res) => {
  res.json({
    totalUsers: connectedUsers.size,
    users: getUserList()
  });
});

// User presence tracking
const connectedUsers = new Map();
const adjectives = ['Happy', 'Clever', 'Brave', 'Swift', 'Bright', 'Cool', 'Super', 'Smart', 'Lucky', 'Mighty'];
const animals = ['Tiger', 'Eagle', 'Dolphin', 'Lion', 'Wolf', 'Bear', 'Fox', 'Hawk', 'Shark', 'Panda'];

const generateUsername = () => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const number = Math.floor(Math.random() * 100);
  return `${adjective}${animal}${number}`;
};

const getUserList = () => {
  return Array.from(connectedUsers.values()).map(user => ({
    id: user.id,
    username: user.username,
    connectedAt: user.connectedAt
  }));
};

// Background service - Time broadcaster
let timeInterval = null;
const TIME_BROADCAST_INTERVAL = 1000; // Broadcast every second

const startTimeBroadcast = () => {
  console.log('Starting time broadcast service...');
  timeInterval = setInterval(() => {
    const currentTime = {
      time: new Date().toISOString(),
      timestamp: Date.now(),
      formatted: new Date().toLocaleString()
    };
    
    // Broadcast to all connected clients
    io.emit('time-update', currentTime);
  }, TIME_BROADCAST_INTERVAL);
};

const stopTimeBroadcast = () => {
  if (timeInterval) {
    console.log('Stopping time broadcast service...');
    clearInterval(timeInterval);
    timeInterval = null;
  }
};

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('New WebSocket client connected:', socket.id);
  
  // Create user and add to connected users
  const user = {
    id: socket.id,
    username: generateUsername(),
    connectedAt: new Date().toISOString()
  };
  connectedUsers.set(socket.id, user);
  
  // Send welcome message with user info
  socket.emit('welcome', {
    message: 'Connected to WebSocket server',
    socketId: socket.id,
    timestamp: new Date().toISOString(),
    user: user,
    onlineUsers: getUserList()
  });
  
  // Broadcast user joined to all other clients
  socket.broadcast.emit('user-joined', {
    user: user,
    onlineUsers: getUserList(),
    totalUsers: connectedUsers.size
  });
  
  // Handle username change
  socket.on('change-username', (newUsername) => {
    const user = connectedUsers.get(socket.id);
    if (user && newUsername && newUsername.trim()) {
      const oldUsername = user.username;
      user.username = newUsername.trim();
      connectedUsers.set(socket.id, user);
      
      // Notify all clients about username change
      io.emit('username-changed', {
        userId: socket.id,
        oldUsername: oldUsername,
        newUsername: user.username,
        onlineUsers: getUserList()
      });
    }
  });
  
  // Echo messages back to client
  socket.on('message', (data) => {
    console.log('Received message:', data);
    const user = connectedUsers.get(socket.id);
    socket.emit('echo', {
      original: data,
      timestamp: new Date().toISOString(),
      from: user ? user.username : 'Unknown'
    });
  });
  
  // Broadcast to all clients
  socket.on('broadcast', (data) => {
    const user = connectedUsers.get(socket.id);
    io.emit('broadcast', {
      from: socket.id,
      username: user ? user.username : 'Unknown',
      message: data,
      timestamp: new Date().toISOString()
    });
  });
  
  socket.on('disconnect', () => {
    console.log('WebSocket client disconnected:', socket.id);
    const user = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);
    
    // Broadcast user left to all remaining clients
    if (user) {
      io.emit('user-left', {
        user: user,
        onlineUsers: getUserList(),
        totalUsers: connectedUsers.size
      });
    }
  });
});

const server = httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Start the background time broadcast service
  startTimeBroadcast();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.log('Please either:');
    console.log(`1. Stop the process using port ${PORT}`);
    console.log('2. Set a different port using: PORT=3001 npm start');
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown handlers
const gracefulShutdown = () => {
  console.log('\nGracefully shutting down...');
  
  // Stop the time broadcast service
  stopTimeBroadcast();
  
  // Close the server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle different shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  stopTimeBroadcast();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  stopTimeBroadcast();
  process.exit(1);
});