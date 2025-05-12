const express= require('express');
const app= express();
const port=3000;
const db=require('./db');
const path=require('path');

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  next();
});

const tasksRouter = require('./tasks');
app.use('/api/tasks',tasksRouter);
app.use(express.static(path.join(__dirname, 'frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});
app.listen(port, () => {
    const tasks = [
        { id: 1, description: 'Compito 1', important: false },
        { id: 2, description: 'Compito 2', important: true }
      ];
    console.log(`server in ascolto su http://localhost:${port}`);
});

