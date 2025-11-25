"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const db = promise_1.default.createPool({
    host: "mysql-final-projec.alwaysdata.net",
    user: "442588",
    password: "65011212063",
    database: "final-project_guidefinderapp_db",
    waitForConnections: true, // ✅ ป้องกัน ECONNRESET
    connectionLimit: 10, // ✅ ใช้ได้ใน Pool
    queueLimit: 0,
});
// db.getConnection((err, connection) => {
//   if (err) {
//     console.error("❌ Database connection failed:", err);
//   } else {
//     console.log("✅ Connected to MySQL database (pool)");
//     connection.release();
//   }
// });
db.getConnection()
    .then((connection) => {
        console.log("✅ Connected to MySQL database (pool)");
        connection.release();
    })
    .catch((err) => {
        console.error("❌ Database connection failed:", err);
    });
exports.default = db;
//# sourceMappingURL=dbconnect.js.map