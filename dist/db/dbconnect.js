"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mysql_1 = __importDefault(require("mysql"));
const db = mysql_1.default.createConnection({
    host: "mysql-guidefinderapp.alwaysdata.net",
    user: "427092",
    password: "65011212063",
    database: "guidefinderapp_db",
});
db.connect((err) => {
    if (err) {
        console.error("❌ Database connection failed: ", err);
    }
    else {
        console.log("✅ Connected to MySQL database");
    }
});
exports.default = db;
//# sourceMappingURL=dbconnect.js.map