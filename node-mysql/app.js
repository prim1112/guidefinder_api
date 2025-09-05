const express = require('express');
const app = express()
const indexRouter = require('./api/routes/index');
const userRouter = require('./api/routes/user');
const bodyParser = require('body-parser');

app.use(bodyParser.json());
app.use('/', indexRouter);
app.use('/user', userRouter);

module.exports = app;