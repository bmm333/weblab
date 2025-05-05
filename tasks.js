const express = require('express');
const router = express.Router();
const db=require('./db');
const { error } = require('console');

router.get('/',(req,res)=>
{
    db.all('SELECT * FROM tasks',[],(err,rows)=>{
        if(err) return res.status(500).json({error:err.message});
        res.json(rows)
    });
});
router.get('/:id',(req,res)=>{
    const id=req.params.id;
    db.get('SELECT * FROM tasks WHERE id=?',[id],(err,row)=>{
        if(err) return res.status(500).json({error:err.message});
        if(!row) return res.status(404).json({error:'Task not found'});
        res.json(row);
    });
});
router.post('/',(req,res)=>{
    const {description,importante=0,privato=1,progetto,scadenza,completato=0}=req.body;
    const sql=`INSERT INTO tasks (description,importante,privato,progetto,scadenza,completato)
    VALUES(?,?,?,?,?,?)`;
    db.run(sql,[description,importante,privato,progetto,scadenza,completato],function(err){
        if(err) return res.status(500).json({error:err.message});
        res.status(201).json({id:this.lastID});
    });
});

router.put(':/id',(req,res)=>{
    const id=req.params.id;
    const {description,importante,privato,progetto,scadenza,completato}=req.body;
    const sql=`UPDATE tasks SET description=?,importante=?,privato=?,progetto=?,scadenza=?,completato=? WHERE id=?`;
    db.run(sql,[description,importante,privato,progetto,scadenza,completato,id],function(err){
        if(err) return res.status(500).json({error:err.message});
        if(this.changes===0) return res.status(404).json({error:'Task not found'});
        res.json({message:'Task updated successfully'});
    }); 
});

router.delete('/:id',(req,res)=>{
    const id=req.params.id;
    db.run('DELETE FROM tasks WHERE id=?',[id],function(err){
        if(err) return res.status(500).json({error:err.message});
        if(this.changes===0) return res.status(404).json({error:'Task not found'});
        res.json({success:true});
    });
});
router.patch('/:id/completed', (req, res) => {
    const id = req.params.id;
    db.run('UPDATE tasks SET completato = 1 WHERE id = ?', [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Task non trovato' });
      res.json({ success: true });
    });
  });

  module.exports=router;