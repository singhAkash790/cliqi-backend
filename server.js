require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const taskRoutes = require('./routes/taskRoutes');
const Auth = require("./routes/authRoutes");
const errorHandler = require('./middlewares/errorHandler');
const connectDB = require('./config/db'); // Import the connectDB function

const app = express();


// Database Connection
connectDB().then(() => {
    console.log("MongoDB Connected");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1); // Exit process on failure
});

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", Auth);
app.use('/api/tasks', taskRoutes);

// Error handling
app.use(errorHandler);
