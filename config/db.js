const mysql = require("mysql2");

// Create connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Kaif@hassan1",
  database: "safebank"
});

// Connect to database
db.connect((err) => {
  if (err) {
    console.log("Database connection failed ❌", err);
  } else {
    console.log("Connected to MySQL ✅");
  }
});

module.exports = db;