const express = require("express");
const router = express.Router();
const accountController = require("../controllers/accountController"); 
const auth = require("../middlewares/authmiddleware");

router.get("/balance", auth, accountController.getBalance);
router.post("/deposit", auth, accountController.deposit);
router.post("/withdraw", auth, accountController.withdraw);
router.post("/transfer", auth, accountController.transfer);
// router.post("/create", auth, accountController.createAccount);
router.get("/transactions", auth, accountController.getTransactions);

module.exports = router;