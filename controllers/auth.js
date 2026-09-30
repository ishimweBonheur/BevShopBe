const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Register a new user
const registerUser = async (req, res) => {
  try {
    const { firstName, lastName, username, email, phone, password, role } = req.body;

    // Check if the user already exists by email, username, or phone
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }, { phone }] 
    });

    if (existingUser) {
      let conflictField;
      if (existingUser.email === email) conflictField = "email";
      else if (existingUser.username === username) conflictField = "username";
      else if (existingUser.phone === phone) conflictField = "phone";

      return res.status(400).json({ 
        error: `A user with this ${conflictField} already exists. Please use a different ${conflictField}.`
      });
    }

    // Create new user
    const user = await new User({ firstName, lastName, username, email, phone, password, role }).save();

    // Generate JWT token
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ user, token });
  } catch (error) {
    if (error.code === 11000) {
      // Handle MongoDB duplicate key error
      const duplicateField = Object.keys(error.keyValue)[0];
      res.status(400).json({
        error: `A user with this ${duplicateField} already exists: ${error.keyValue[duplicateField]}. Please use a different ${duplicateField}.`
      });
    } else if (error.name === "ValidationError") {
      // Handle Mongoose validation errors
      const validationErrors = Object.values(error.errors).map(err => err.message);
      res.status(400).json({ error: `Validation failed: ${validationErrors.join(", ")}` });
    } else {
      // Handle generic server errors
      res.status(500).json({ error: `Server error: ${error.message}` });
    }
  }
};

// Login user
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const checkUser = async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


module.exports = { registerUser, loginUser,checkUser};
