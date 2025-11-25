import mysql, { Pool } from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const db: Pool = mysql.createPool({
  host: "mysql-final-project.alwaysdata.net",
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

export default db;
