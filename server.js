require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();


app.use(cors());          // 1. CORS first
app.use(express.json());  // 2. JSON parser

// Routes
const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);

// Server start
app.listen(5000, () => {
  console.log("Server running on port 5000");
});