const express = require('express');
const router = express.Router();

router.get('/', (req, res)=>{
    res.send('Hello user.js ');
});


module.exports =router;