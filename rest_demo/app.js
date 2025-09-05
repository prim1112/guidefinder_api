const express = require('express');
// 2. ให้ app อ้างไปถึง index ตัวนี้ได้
const indexRoute = require('./api/routes/index')
const userRoute = require('./api/routes/user')
const app = express();

// ถ้ามีการเรียก '/' มาให้ไปที่ index => index.js
app.use('/', indexRoute);
app.use('/user', userRoute);


module.exports = app;