const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

//////////////////////////////////////////////////////
// ✅ REGISTER (Updated to include Account Creation)
//////////////////////////////////////////////////////
exports.register = (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const checkUser = "SELECT * FROM users WHERE email = ?";
  db.query(checkUser, [email], async (err, result) => {
    if (err) return res.status(500).json({ message: "Server error" });

    if (result.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);

      const insertUser =
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)";

      db.query(insertUser, [name, email, hashedPassword], (err, userResult) => {
        if (err) {
          return res.status(500).json({ message: "Registration failed" });
        }

        const userId = userResult.insertId;

        // 🔥 STRICT ACCOUNT CREATION (IMPORTANT)
        const createAccount =
          "INSERT INTO accounts (user_id, balance) VALUES (?, 0)";

        db.query(createAccount, [userId], (err) => {
          if (err) {
            console.error("Account creation failed:", err);

            // ❗ rollback user if account fails (VERY IMPORTANT)
            const deleteUser = "DELETE FROM users WHERE id = ?";
            db.query(deleteUser, [userId]);

            return res.status(500).json({
              message: "Failed to create account. Please try again.",
            });
          }

          res.status(201).json({
            message: "User + Bank Account created successfully ✅",
          });
        });
      });
    } catch (error) {
      res.status(500).json({ message: "Error hashing password" });
    }
  });
};
//////////////////////////////////////////////////////
// ✅ LOGIN
//////////////////////////////////////////////////////
exports.login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const findUser = "SELECT * FROM users WHERE email = ?";
  db.query(findUser, [email], async (err, result) => {
    if (err) return res.status(500).json({ message: "Server error" });

    if (result.length === 0) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const user = result[0];

    try {
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      // Create JWT Token
      // We include the ID and Email so the Auth Middleware can identify the user later
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || "secretkey",
        { expiresIn: "1d" }
      );

      res.json({
        message: "Login successful ✅",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Error during login" });
    }
  });
};