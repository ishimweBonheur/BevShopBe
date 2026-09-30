const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const register = async (userData) => {
  const { email, username, phone } = userData;
  const existingUser = await User.findOne({ $or: [{ email }, { username }, { phone }] });
  if (existingUser) {
    throw new Error('User with this email, username, or phone already exists');
  }

  const newUser = new User(userData);
  await newUser.save();
  const token = generateToken(newUser.id);
  return { user: newUser, token };
};

const login = async (email, password) => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }

  const token = generateToken(user.id);
  return { user, token };
};

module.exports = { register, login };