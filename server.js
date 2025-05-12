const express = require('express');
const app = express();
const port = 3000;
const db = require('./db');

app.use(express.json());

const tasksRouter = require('./tasks');
app.use('/api/tasks', tasksRouter);

app.use(express.static('frontend'));

app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on http://localhost:${port}`);
});