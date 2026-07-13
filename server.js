require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "frontend")));

// Routes
const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/account", accountRoutes);

// Home route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend", "login.html"));
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});