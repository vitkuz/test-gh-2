const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to our API!' });
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

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
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