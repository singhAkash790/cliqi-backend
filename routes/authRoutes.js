const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Route for handling login
router.post("/login", authController.handleLogin);

// Route for handling logout
router.post("/logout", authController.handleLogout);

// Route for handling token refresh
router.get("/refresh", authController.handleRefreshToken);

// Route for handling new user registration
router.post("/register", authController.handleNewUser);

module.exports = router;
