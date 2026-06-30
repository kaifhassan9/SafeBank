const db = require("../config/db");

// GET BALANCE
// GET BALANCE (FIXED)
exports.getBalance = (req, res) => {
  const userId = req.user.id;

  const query = "SELECT balance FROM accounts WHERE user_id = ?";
  db.query(query, [userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Server error" });

    // 🔥 FIX: AUTO CREATE ACCOUNT IF NOT EXISTS
    if (result.length === 0) {
      const createQuery = "INSERT INTO accounts (user_id, balance) VALUES (?, 0)";

      return db.query(createQuery, [userId], (err) => {
        if (err) {
          console.error("Auto account creation failed:", err);
          return res.status(500).json({ message: "Error creating account" });
        }

        return res.json({ balance: 0 }); // ✅ return default balance
      });
    }

    res.json({ balance: result[0].balance });
  });
};
// DEPOSIT (FIXED + SAFE)
exports.deposit = (req, res) => {
  const userId = req.user.id;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ message: "Transaction Error" });

    // 🔥 STEP 1: Ensure account exists
    const ensureAccount =
      "INSERT IGNORE INTO accounts (user_id, balance) VALUES (?, 0)";

    db.query(ensureAccount, [userId], (err) => {
      if (err) {
        return db.rollback(() =>
          res.status(500).json({ message: "Error ensuring account" })
        );
      }

      // 🔥 STEP 2: Deposit money
      const updateQuery =
        "UPDATE accounts SET balance = balance + ? WHERE user_id = ?";

      db.query(updateQuery, [amount, userId], (err) => {
        if (err) {
          return db.rollback(() =>
            res.status(500).json({ message: "Deposit failed" })
          );
        }

        //  Log transaction
        const transQuery =
          "INSERT INTO transactions (receiver_id, amount, type) VALUES (?, ?, 'deposit')";

        db.query(transQuery, [userId, amount], (err) => {
          if (err) {
            return db.rollback(() =>
              res.status(500).json({ message: "Transaction log failed" })
            );
          }

          db.commit((err) => {
            if (err) {
              return db.rollback(() =>
                res.status(500).json({ message: "Commit error" })
              );
            }

            res.json({ message: "Money deposited successfully ✅" });
          });
        });
      });
    });
  });
};

// WITHDRAW
exports.withdraw = (req, res) => {
  const userId = req.user.id;
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ message: "Invalid amount" });

  db.beginTransaction((err) => {
    if (err) return res.status(500).json({ message: "Transaction Error" });
    db.query("SELECT balance FROM accounts WHERE user_id = ? FOR UPDATE", [userId], (err, result) => {
      if (err || result.length === 0) return db.rollback(() => res.status(404).json({ message: "Account not found" }));
      if (result[0].balance < amount) return db.rollback(() => res.status(400).json({ message: "Insufficient balance" }));

      db.query("UPDATE accounts SET balance = balance - ? WHERE user_id = ?", [amount, userId], (err) => {
        if (err) return db.rollback(() => res.status(500).json({ message: "Server error" }));
        const transQuery = "INSERT INTO transactions (sender_id, amount, type) VALUES (?, ?, 'withdraw')";
        db.query(transQuery, [userId, amount], (err) => {
          if (err) return db.rollback(() => res.status(500).json({ message: "Server error" }));
          db.commit((err) => {
            if (err) return db.rollback(() => res.status(500).json({ message: "Commit error" }));
            res.json({ message: "Withdrawal successful" });
          });
        });
      });
    });
  });
};

// TRANSFER
// TRANSFER (FIXED - NO "Receiver not found" ERROR)
exports.transfer = (req, res) => {
  const senderId = req.user.id;
  const { receiverId, amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ message: "Invalid amount" });
  }

  if (senderId == receiverId) {
    return res.status(400).json({ message: "Cannot transfer to yourself" });
  }

  // ✅ Check if receiver exists in users table
  const checkUser = "SELECT * FROM users WHERE id = ?";
  db.query(checkUser, [receiverId], (err, userResult) => {
    if (err) return res.status(500).json({ message: "Server error" });

    if (userResult.length === 0) {
      return res.status(404).json({ message: "Receiver user does not exist" });
    }

    db.beginTransaction((err) => {
      if (err) return res.status(500).json({ message: "Transaction Error" });

      // 🔥 Ensure both accounts exist
      const ensureAccount =
        "INSERT IGNORE INTO accounts (user_id, balance) VALUES (?, 0)";

      db.query(ensureAccount, [senderId], (err) => {
        if (err)
          return db.rollback(() =>
            res.status(500).json({ message: "Error ensuring sender account" })
          );

        db.query(ensureAccount, [receiverId], (err) => {
          if (err)
            return db.rollback(() =>
              res.status(500).json({ message: "Error ensuring receiver account" })
            );

          // 🔒 Lock sender account
          db.query(
            "SELECT balance FROM accounts WHERE user_id = ? FOR UPDATE",
            [senderId],
            (err, result) => {
              if (err || result.length === 0) {
                return db.rollback(() =>
                  res.status(404).json({ message: "Sender account not found" })
                );
              }

              if (result[0].balance < amount) {
                return db.rollback(() =>
                  res.status(400).json({ message: "Insufficient balance" })
                );
              }

              // 💸 Deduct from sender
              db.query(
                "UPDATE accounts SET balance = balance - ? WHERE user_id = ?",
                [amount, senderId],
                (err) => {
                  if (err) {
                    return db.rollback(() =>
                      res.status(500).json({ message: "Deduct error" })
                    );
                  }

                  // 💰 Add to receiver
                  db.query(
                    "UPDATE accounts SET balance = balance + ? WHERE user_id = ?",
                    [amount, receiverId],
                    (err) => {
                      if (err) {
                        return db.rollback(() =>
                          res.status(500).json({ message: "Transfer failed" })
                        );
                      }

                      // 🧾 Log transaction
                      const transQuery =
                        "INSERT INTO transactions (sender_id, receiver_id, amount, type) VALUES (?, ?, ?, 'transfer')";

                      db.query(
                        transQuery,
                        [senderId, receiverId, amount],
                        (err) => {
                          if (err) {
                            return db.rollback(() =>
                              res.status(500).json({ message: "Log error" })
                            );
                          }

                          db.commit((err) => {
                            if (err) {
                              return db.rollback(() =>
                                res.status(500).json({ message: "Commit error" })
                              );
                            }

                            res.json({
                              message: "Transfer successful ✅",
                            });
                          });
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        });
      });
    });
  });
};

// GET TRANSACTIONS
exports.getTransactions = (req, res) => {
  const userId = req.user.id;
  const query = "SELECT * FROM transactions WHERE sender_id = ? OR receiver_id = ? ORDER BY created_at DESC";
  db.query(query, [userId, userId], (err, result) => {
    if (err) return res.status(500).json({ message: "Server error" });
    res.json(result);
  });
};

