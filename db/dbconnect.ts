import mysql from "mysql";

const db = mysql.createConnection({
  host: "mysql-guidefinderapp.alwaysdata.net",
  user: "427092",
  password: "65011212063",
  database: "guidefinderapp_db",
});

db.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed: ", err);
  } else {
    console.log("✅ Connected to MySQL database");
  }
});

export default db;
