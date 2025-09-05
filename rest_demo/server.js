//server ทำงาน ที่ app
const http = require('http');
const port = process.env.port || 3000;
const app = require('./app');
// 1. server จะเรียก app => app.js
const server = http.createServer(app);
server.listen(port);

console.log('Server started on port: ' + port);
