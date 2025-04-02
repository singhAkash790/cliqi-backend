// models/User.js - Updated schema
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      // Remove or set unique: false here if it was set before
    },
    password: {
      type: String,
      required: true,
    },
    email: { type: String, required: true, unique: true },
    userId: { type: String, required: true, unique: true },
    roles: {
      User: {
        type: Number,
        default: 2001,
      },
      Admin: Number,
      Editor: Number,
    },
    refreshToken: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);