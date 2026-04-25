const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../../db/models/User');

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function register(req, res) {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
  if (exists) {
    return res.status(409).json({ error: 'Username or email already taken' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ username, email, password: hashed });
  const token = signToken(user._id);

  res.status(201).json({ token, user: { id: user._id, username: user.username, email: user.email } });
}

async function login(req, res) {
  const { login: loginField, password } = req.body;
  if (!loginField || !password) {
    return res.status(400).json({ error: 'login and password are required' });
  }

  const user = await User.findOne({
    $or: [{ email: loginField.toLowerCase() }, { username: loginField }],
  });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken(user._id);
  res.json({ token, user: { id: user._id, username: user.username, email: user.email } });
}

module.exports = { register, login };
