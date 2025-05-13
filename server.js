// server.js
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Import SQLite DB and tasks router
const db = require('./db');
const tasksRouter = require('./tasks');

// Middleware for logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Middleware to parse JSON
app.use(express.json());

// CORS headers to allow frontend to communicate
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*'); // Or set to your frontend origin
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API routes
app.use('/api/tasks', tasksRouter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve index.html for root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening at http://localhost:${port}`);
});