const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/users"); // Adjust the path as needed
require("dotenv").config();
const validator = require("validator"); // Optional: For email validation

// Register a new user and log them in automatically
const handleNewUser = async (req, res) => {
  const { username, pwd, email } = req.body;
  console.log(username, pwd, email)


  if (!username || !pwd || !email) {
    return res
      .status(400)
      .json({ message: "Username, password, and email are required." });
  }

  // Validate email format (optional)
  if (!validator.isEmail(email)) {
    return res.status(400).json({ message: "Invalid email format." });
  }

  try {
    // Check for duplicate email or username
    const duplicateEmail = await User.findOne({ email });
    const duplicateUsername = await User.findOne({ username });

    if (duplicateEmail) {
      return res.status(409).json({ message: "Email already exists." });
    }

    if (duplicateUsername) {
      return res.status(409).json({ message: "Username already exists." });
    }
    // Generate a unique userId
    const userId = uuidv4();

    // Hash the password
    const hashedPwd = await bcrypt.hash(pwd, 10);

    // Create and save the new user
    const newUser = new User({
      username: username,
      email: email,
      userId: userId,
      roles: { User: 2001 },
      password: hashedPwd,
    });

    await newUser.save();

    if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
      console.error('ERROR: JWT secret keys not found in environment variables');
      process.exit(1); // Exit with error
    }

    // Generate JWT tokens
    const roles = Object.values(newUser.roles);
    const accessToken = jwt.sign(
      { UserInfo: { userId: newUser.userId, email: newUser.email, roles } },
      process.env.ACCESS_TOKEN_SECRET || 'dev_temp_secret',
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "30s" }
    );

    const refreshToken = jwt.sign(
      { userId: newUser.userId, email: newUser.email },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "1d" }
    );

    // Save refresh token in user document
    newUser.refreshToken = refreshToken;
    await newUser.save();

    // Set the refresh token in an HTTP-only cookie
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      sameSite: "None",
      secure: true, // Set to false if testing on localhost without HTTPS
      maxAge: 24 * 60 * 60 * 1000,
    });

    // Respond with access token
    res.status(201).json({
      success: `New user ${username} created and logged in!`,
      accessToken: accessToken,
    });
  } catch (err) {
    console.error("Error creating new user:", err);
    res.status(500).json({ message: "Server error while creating user." });
  }
};

// Log in an existing user
const handleLogin = async (req, res) => {
  const { email, pwd } = req.body;

  if (!email || !pwd) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  try {
    const foundUser = await User.findOne({ email });
    if (!foundUser) {
      return res.status(401).json({ message: "Unauthorized: User not found." });
    }

    const match = await bcrypt.compare(pwd, foundUser.password);
    if (!match) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Incorrect password." });
    }

    const roles = Object.values(foundUser.roles);
    const accessToken = jwt.sign(
      { UserInfo: { userId: foundUser.userId, email: foundUser.email, roles } },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "30s" }
    );

    const refreshToken = jwt.sign(
      { userId: foundUser.userId, email: foundUser.email },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "1d" }
    );

    foundUser.refreshToken = refreshToken;
    await foundUser.save();

    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      sameSite: "None",
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken });
  } catch (error) {
    console.error("Error during login process:", error);
    res.status(500).json({ message: "Server error during login." });
  }
};

// Log out user by clearing their refresh token
const handleLogout = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); // No content

  const refreshToken = cookies.jwt;

  try {
    const foundUser = await User.findOne({ refreshToken });
    if (!foundUser) {
      res.clearCookie("jwt", {
        httpOnly: true,
        sameSite: "None",
        secure: true,
      });
      return res.sendStatus(204);
    }

    foundUser.refreshToken = "";
    await foundUser.save();

    res.clearCookie("jwt", { httpOnly: true, sameSite: "None", secure: true });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error during logout process:", error);
    res.status(500).json({ message: "Server error during logout." });
  }
};

// Refresh access token using refresh token
const handleRefreshToken = async (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(401); // Unauthorized

  const refreshToken = cookies.jwt;

  try {
    const foundUser = await User.findOne({ refreshToken });
    if (!foundUser) return res.sendStatus(403); // Forbidden

    jwt.verify(
      refreshToken,
      process.env.REFRESH_TOKEN_SECRET,
      (err, decoded) => {
        if (err || foundUser.userId !== decoded.userId)
          return res.sendStatus(403);

        const roles = Object.values(foundUser.roles);
        const accessToken = jwt.sign(
          { UserInfo: { userId: decoded.userId, email: decoded.email, roles } },
          process.env.ACCESS_TOKEN_SECRET,
          { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "30s" }
        );

        res.json({ accessToken });
      }
    );
  } catch (error) {
    console.error("Error during refresh token process:", error);
    res.status(500).json({ message: "Server error during token refresh." });
  }
};

module.exports = {
  handleNewUser,
  handleLogin,
  handleLogout,
  handleRefreshToken,
};
