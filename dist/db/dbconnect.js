"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const db = promise_1.default.createPool({
    host: "mysql-guidefinderapp.alwaysdata.net",
    user: "guidefinderapp",
    password: "65011212063",
    database: "guidefinderapp_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});
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