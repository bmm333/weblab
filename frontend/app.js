const API_URL='http://localhost:3000/api/tasks';

async function getTasks()
{
    try{
        const response=await fetch(API_URL);
        const tasks=await response.json();
        renderTasks(tasks);
    }catch(error)
    {
        console.error('oh shit',error);
    }
}