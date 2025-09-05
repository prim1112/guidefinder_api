const mysql = require('mysql');

const pool = mysql.createPool({
    connectionLimit: 10,
    host: 'mysql-guidefinderapp.alwaysdata.net',
    user: '427092',
    password: '65011212063',
    database: 'guidefinderapp_db'
});

module.exports = pool;