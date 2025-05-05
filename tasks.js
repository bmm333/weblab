const express = require('express');
const router = express.Router();
const db = require('./db');

router.get('/', (req, res) => {
  db.all('SELECT * FROM tasks', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});
router.get('/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM tasks WHERE id=?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Task not found' });
    res.json(row);
  });
});
router.post('/', (req, res) => {
  const { description, important, private, project, deadline, completed } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }
  const stmt = db.prepare(`
    INSERT INTO tasks (description, important, private, project, deadline, completed)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    description,
    important || false,
    private || true,
    project || '',
    deadline || null,
    completed || false,
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        id: this.lastID,
        description,
        important,
        private,
        project,
        deadline,
        completed,
      });
    }
  );
});
router.put('/:id', (req, res) => {
  const id = req.params.id;
  const { description, important, private, project, deadline, completed } = req.body;
  
  const sql = `
    UPDATE tasks
    SET description = ?, important = ?, private = ?, project = ?, deadline = ?, completed = ?
    WHERE id = ?
  `;
  db.run(
    sql,
    [description, important, private, project, deadline, completed, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });
      res.json({ message: 'Task updated successfully' });
    }
  );
});
router.delete('/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM tasks WHERE id=?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  });
});
router.patch('/:id/completed', (req, res) => {
  const id = req.params.id;
  db.run('UPDATE tasks SET completed = 1 WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  });
});

module.exports = router;
