const BASE_URL = 'http://localhost:3000/api';

async function getAllTasks()
{
    try
    {
        const response=await fetch(`${BASE_URL}/tasks`);
        if(!response.ok)
        {
            throw new Error(`HTTP error: Status: ${response.status}`);
        }
        return await response.json();
    }catch(error)
    {
        console.error('Error fetching tasks:', error);
        throw error;
    }
}
async function getTaskById(id)
{
    try{
        const response = await fetch(`${BASE_URL}/tasks/${id}`);
        if(!response.ok)
        {
            throw new Error(`HTTP error: Status: ${response.status}`);
        }
        return await response.json();
    }catch(error)
    {
        console.error('Error fetching task:', error);
        throw error;
    }
}
async function createTask(task)
{
    try{
        const response=await fetch(`${BASE_URL}/tasks`,{
            method:'POST',
            headers:{
                'Content-Type':'application/json'
            },
            body:JSON.stringify(task)
        });
        if(!response.ok)
        {
            throw new Error(`HTTP error: Status: ${response.status}`);
        }
        return await response.json();
    }catch(error)
    {
        console.error('Error creating task:', error);
        throw error;
    }
}
async function updateTask(id,task)
{
    try{
        const response = await fetch(`${BASE_URL}/tasks/${id}`,{
            method:'PUT',
            headers:{
                'Content-Type':'application/json'
            },
            body:JSON.stringify(task)
        });
        if(!response.ok)
        {
            throw new Error(`HTTP error: Status: ${response.status}`);
        }
    }catch(error)
    {
        console.error('Error updating task:', error);
        throw error;
    }
}
async function deleteTask(id) {
  try {
    const response = await fetch(`${BASE_URL}/tasks/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error deleting task ${id}:`, error);
    throw error;
  }
}

async function markTaskAsCompleted(id) {
  try {
    const response = await fetch(`${BASE_URL}/tasks/${id}/completed`, {
      method: 'PATCH',
    });
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error marking task ${id} as completed:`, error);
    throw error;
  }
}

const API = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  markTaskAsCompleted,
};

export default API;