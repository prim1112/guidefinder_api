"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql2_1 = __importDefault(require("mysql2"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const db = mysql2_1.default.createPool({
    host: "mysql-guidefinderapp.alwaysdata.net",
    user: "427092",
    password: "65011212063",
    database: "guidefinderapp_db",
    waitForConnections: true, // ✅ ป้องกัน ECONNRESET
    connectionLimit: 10, // ✅ ใช้ได้ใน Pool
    queueLimit: 0,
});
db.getConnection((err, connection) => {
    if (err) {
        console.error("❌ Database connection failed:", err);
    }
    else {
        console.log("✅ Connected to MySQL database (pool)");
        connection.release();
    }
});
exports.default = db;
//# sourceMappingURL=dbconnect.js.map