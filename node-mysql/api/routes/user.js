const express = require('express');
const router = express.Router();
const pool = require('../../dbconn');
const mysql = require('mysql');

router.get('/', (req, res) => {
    pool.query('SELECT * from user', (error, results, fields) => {
        if (error) throw error;
        res.status(200).json(results);
    });
});

router.get('/:cusId', (req, res) => {
    let id = req.params.cusId;
    pool.query('SELECT * from user where id = ' + id, (error, results, fields) => {
        if (error) throw error;
        res.status(200).json(results);
    });
});

router.post('/', (req, res) => {
    let data = req.body;
    let sql = 'INSERT INTO user (name, email, phone) ' +
        'VALUES (?, ?, ?)';
    sql = mysql.format(sql, [data.name, data.email, data.phone]);

    pool.query(sql, (error, results, fields) => {
        if (error) throw error;
        if (results.affectedRows == 1) {
            res.status(201).json({
                message: 'Insert success'
            });
        } else {
            res.status(400).json({
                message: 'Insert failed'
            });
        }
    });
});

module.exports = router;