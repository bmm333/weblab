import API from './api.js';

let tasks = [];
let currentFilter = 'all';
let currentProject = 'null';

const taskList=document.getElementById('main .list-group-flush');
const addTaskBtn=document.getElementById('.fixed-right-bottom');
const filterLinks = document.querySelectorAll('.list-group-item-action');
const projectLinks = document.querySelectorAll('.my-5 .list-group-item-action');
const filterTitle = document.querySelector('main h1');

async function init()
{
    await loadTasks();
    setupEventListeners();
}
async function loadTasks()
{
    try{
        tasks=await API.getAllTasks();
        renderTasks();
    }catch(error)
    {
        console.error('Error loading tasks:',error);
        alert('Failed to load tasks.Try again..');
    }
}
function renderTasks()
{
    taskList.innerHTML='';
    const filteredTasks = filterTasks();
    filteredTasks.forEach(task=>{
        const taskElement=createTaskElement(task);
        taskList.appendChild(taskElement);
    });
}

function createTaskElement(task)
{
    const li=document.createElement('li');
    li.className='list-group-item';
    li.dataset.taskId=task.id;
    let descriptionText = task.description;
    if (task.important) {
        descriptionText = `<span class="text-danger pr-1">!!!</span>${task.description}`;
    }
    let deadlineText = '';
    if (task.deadline) {
        const date = new Date(task.deadline);
        const options = { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit', 
            minute: '2-digit' 
        };
        deadlineText = `<small>${date.toLocaleDateString('it-IT', options)}</small>`;
    }
    li.innerHTML = `
        <div class="d-flex w-100 justify-content-between">
            <div class="form-check">
                <input type="checkbox" class="form-check-input" id="check-t${task.id}" 
                    ${task.completed ? 'checked' : ''}>
                <label class="form-check-label ${task.completed ? 'text-decoration-line-through' : ''}" 
                    for="check-t${task.id}">${descriptionText}</label>
                ${task.project ? `<span class="badge bg-primary mx-4">${task.project}</span>` : ''}
            </div>
            <div>
                <button class="btn btn-sm btn-outline-secondary edit-task-btn" data-task-id="${task.id}">✎</button>
                <button class="btn btn-sm btn-outline-danger delete-task-btn" data-task-id="${task.id}">🗑️</button>
            </div>
            ${deadlineText}
        </div>
    `;
    
    return li;
}
function showTaskForm(taskToEdit=null)
{
    const isEditing=taskToEdit !== null;
    //Html form
    const formHtml=`<div class="modal fade" id="taskFormModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${isEditing ? 'Edit Task' : 'New Task'}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <form id="taskForm">
                            <div class="mb-3">
                                <label for="description" class="form-label">Description</label>
                                <input type="text" class="form-control" id="description" required 
                                    value="${isEditing ? taskToEdit.description : ''}">
                            </div>
                            <div class="mb-3">
                                <label for="project" class="form-label">Project</label>
                                <input type="text" class="form-control" id="project" 
                                    value="${isEditing && taskToEdit.project ? taskToEdit.project : ''}">
                            </div>
                            <div class="mb-3">
                                <label for="deadline" class="form-label">Deadline</label>
                                <input type="datetime-local" class="form-control" id="deadline" 
                                    value="${isEditing && taskToEdit.deadline ? new Date(taskToEdit.deadline).toISOString().slice(0, 16) : ''}">
                            </div>
                            <div class="form-check mb-3">
                                <input type="checkbox" class="form-check-input" id="important" 
                                    ${isEditing && taskToEdit.important ? 'checked' : ''}>
                                <label class="form-check-label" for="important">Important</label>
                            </div>
                            <div class="form-check mb-3">
                                <input type="checkbox" class="form-check-input" id="private" 
                                    ${isEditing && taskToEdit.private ? 'checked' : ''}>
                                <label class="form-check-label" for="private">Private</label>
                            </div>
                            ${isEditing ? `
                                <div class="form-check mb-3">
                                    <input type="checkbox" class="form-check-input" id="completed" 
                                        ${taskToEdit.completed ? 'checked' : ''}>
                                    <label class="form-check-label" for="completed">Completed</label>
                                </div>
                                <input type="hidden" id="taskId" value="${taskToEdit.id}">
                            ` : ''}
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="saveTaskBtn">
                            ${isEditing ? 'Update' : 'Add'}
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
        const formContainer=document.createElement('div');
        formContainer.innerHTML=formHtml;
        document.body.appendChild(formContainer.firstChild);
        const modal=new boostrap.Modal(document.getElementById('taskFormModal'));
        modal.show();
        document.getElementById('saveTaskBtn').addEventListener('click',async ()=>{
            const description=document.getElementById('description').value.trim();
            if(!description)
            {
                alert('Description is required');
                return;
            }
            const taskData={
                description: description,
                project: document.getElementById('project').value.trim(),
                deadline: document.getElementById('deadline').value ? new Date(document.getElementById('deadline').value).toISOString() : null,
                important: document.getElementById('important').checked,
                private: document.getElementById('private').checked
            };
            try{
                if(isEditing)
                {
                    const taskId=document.getElementById('taskId').value;
                    taskData.completed=document.getElementById('completed').checked;
                    await API.updateTask(taskId,taskData);
                }else
                {
                    await API.createTask(taskData);
                }
                await loadTasks();
                modal.hide();
            }
            catch(error)
            {
                console.error('Error saving task:',error);
                alert('Failed to save task. Try again.');
            }
        });
        document.getElementById('taskFormModal').addEventListener('hidden.bs.modal',()=>{
            this.remove();
        });
}
function filterTasks()
{
    let filtered= [...tasks];
    if(currentProject)
    {
        filtered=filtered.filter(task=>task.project===currentProject);
    }
    const today=new Date().setHours(0,0,0,0);
    const nextWeek=new Date();
    nextWeek.setDate(today.getDate()+7);
    nextWeek.setHours(0,0,0,0);
    switch(currentFilter){
        case 'important':
            filtered=filtered.filter(task=>task.important);
            break;
        case 'today':
            filtered=filtered.filter(task=>{
                const taskDate=new Date(task.deadline);
                return taskDate.setHours(0,0,0,0)===today;
            });
            break;
        case 'next7days':
            filtered=filtered.filter(task=>{
                const taskDate=new Date(task.deadline);
                return taskDate>=today && taskDate<=nextWeek;
            });
            break;
        case 'private':
            filtered=filtered.filter(task=>task.private);
            break;
    }
    return filtered;
}
function filterTasks() {
    let filtered = [...tasks];

    if (currentProject) {
        filtered = filtered.filter(task => task.project === currentProject);
    }

    const today = new Date().setHours(0, 0, 0, 0);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(0, 0, 0, 0);

    switch (currentFilter) {
        case 'important':
            filtered = filtered.filter(task => task.important);
            break;
        case 'today':
            filtered = filtered.filter(task => {
                if (!task.deadline) return false;
                const taskDate = new Date(task.deadline).setHours(0, 0, 0, 0);
                return taskDate === today;
            });
            break;
        case 'next7days':
            filtered = filtered.filter(task => {
                if (!task.deadline) return false;
                const taskDate = new Date(task.deadline).setHours(0, 0, 0, 0);
                return taskDate >= today && taskDate <= nextWeek;
            });
            break;
        case 'private':
            filtered = filtered.filter(task => task.private);
            break;
    }

    return filtered;
}

function setupEventListeners() {
    taskList.addEventListener('change', async (e) => {
        if (e.target.classList.contains('form-check-input')) {
            const taskId = e.target.closest('li').dataset.taskId;
            const isChecked = e.target.checked;

            try {
                if (isChecked) {
                    await API.markTaskAsCompleted(taskId);
                } else {
                    const task = tasks.find(t => t.id == taskId);
                    if (task) {
                        await API.updateTask(taskId, { ...task, completed: false });
                    }
                }
                await loadTasks();
            } catch (error) {
                console.error('Error updating task completion:', error);
                e.target.checked = !isChecked;
            }
        }
    });

    taskList.addEventListener('click', async (e) => {
        if (e.target.closest('.delete-task-btn')) {
            const taskId = e.target.closest('.delete-task-btn').dataset.taskId;

            if (confirm('Are you sure you want to delete this task?')) {
                try {
                    await API.deleteTask(taskId);
                    await loadTasks();
                } catch (error) {
                    console.error('Error deleting task:', error);
                    alert('Failed to delete task. Please try again.');
                }
            }
        }
    });

    taskList.addEventListener('click', (e) => {
        if (e.target.closest('.edit-task-btn')) {
            const taskId = e.target.closest('.edit-task-btn').dataset.taskId;
            const task = tasks.find(t => t.id == taskId);

            if (task) {
                showTaskForm(task);
            }
        }
    });

    addTaskBtn.addEventListener('click', () => {
        showTaskForm();
    });

    filterLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            filterLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const text = link.textContent.trim().toLowerCase();
            if (text === 'tutti') {
                currentFilter = 'all';
            } else if (text === 'importanti') {
                currentFilter = 'important';
            } else if (text === 'oggi') {
                currentFilter = 'today';
            } else if (text === 'prossimi 7 giorni') {
                currentFilter = 'next7days';
            } else if (text === 'privati') {
                currentFilter = 'private';
            }
            filterTitle.textContent = link.textContent.trim();
            currentProject = null;
            renderTasks();
        });
    });

    projectLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            projectLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            currentProject = link.textContent.trim();
            filterTitle.textContent = currentProject;
            renderTasks();
        });
    });
}

export {init};
document.addEventListener('DOMContentLoaded',init);