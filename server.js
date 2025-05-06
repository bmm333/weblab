const express= require('express');
const app= express();
const port=3000;
const db=require('./db');

app.use(express.json());

const tasksRouter = require('./tasks');
app.use('/api/tasks',tasksRouter);

app.listen(port, () => {
    const tasks = [
        { id: 1, description: 'Compito 1', important: false },
        { id: 2, description: 'Compito 2', important: true }
      ];
    console.log(`server in ascolto su http://localhost:${port}`);
});

