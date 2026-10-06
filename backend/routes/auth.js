/**
 * auth.js — Authentication Routes
 *
 * Handles:
 *   POST /api/auth/register  → Create a new user account
 *   POST /api/auth/login     → Log in and receive a JWT token
 */

const express = require('express');
const bcrypt = require('bcryptjs');   // Used to hash passwords securely
const jwt = require('jsonwebtoken'); // Used to create/verify tokens
const { v4: uuidv4 } = require('uuid'); // Generates unique IDs
const db = require('../utils/db');

const router = express.Router();

// ─────────────────────────────────────────
// POST /api/auth/register
// Register a new student account
// ─────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Basic validation — make sure all fields are provided
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please fill in all fields.' });
    }

    // Check if a user with this email already exists
    const existingUser = await db.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    // Hash the password before saving (never store plain text passwords!)
    // The "10" is the salt rounds — higher = more secure but slower
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the new user object
    const newUser = {
      id: uuidv4(),           // Unique ID for this user
      name,
      email,
      password: hashedPassword, // Store only the hashed version
      createdAt: new Date().toISOString(),
    };

    // Save the user to our "database"
    await db.saveUser(newUser);

    // Return success (don't send back the password)
    res.status(201).json({
      message: 'Account created successfully! You can now log in.',
    });
  } catch (error) {
    console.error('Register error:', error.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ─────────────────────────────────────────
// POST /api/auth/login
// Log in and receive a JWT token
// ─────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' });
    }

    // Look up the user by email
    const user = await db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Compare the provided password with the stored hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Create a JWT token — it contains the user's ID and name
    // This token is sent back to the frontend and used for all future requests
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Send the token and user info (no password!)
    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

module.exports = router;
