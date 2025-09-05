const express = require('express');
const app = express();

//มันทำงานอะไร Restful api => http://localhost:3000
app.use('/', (req, res)=>{
    res.send('Hello');
});

module.exports = app;