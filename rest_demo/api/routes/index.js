const express = require('express');
const router = express.Router();

// ถ้ามีการเรียก '/' ให้ทำในคำสั่งนี้ 
router.get('/', (req, res)=>{
    res.send('Hello index.js');
});


module.exports =router;