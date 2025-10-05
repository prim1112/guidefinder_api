import mysql from "mysql";

export const conn = mysql.createConnection({
  host: "mysql-guidefinderapp.alwaysdata.net",
  user: "root",
  password: "65011212063",
  database: "guidefinderapp_db",
});

conn.connect((err) => {
  if (err) {
    console.error("❌ Database connection failed: ", err);
  } else {
    console.log("✅ Connected to MySQL database");
  }
});
