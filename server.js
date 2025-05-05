const express= require('express');
const app= express();
const port=3000;
const db=require('./db');

app.use(express.json());

const tasksRouter = require('./tasks');
app.use('api/tasks',tasksRouter);

app.listen(port, () => {
    console.log(`server in ascolto su http://localhost:${port}`);
});