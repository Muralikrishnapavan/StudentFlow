/**
 * auth.js — JWT Authentication Middleware
 *
 * This middleware runs BEFORE protected route handlers.
 * It checks that the user has a valid JWT token.
 * If the token is missing or invalid, it blocks the request.
 */

const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  // The token is sent in the Authorization header as: "Bearer <token>"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract just the token part

  if (!token) {
    // No token provided — user is not logged in
    return res.status(401).json({ message: 'Access denied. Please log in.' });
  }

  try {
    // Verify the token using our secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach the user info from the token to the request object
    // Now any route handler can access req.user
    req.user = decoded;

    next(); // Token is valid — proceed to the route handler
  } catch (error) {
    // Token is invalid or expired
    return res.status(403).json({ message: 'Invalid or expired token. Please log in again.' });
  }
}

module.exports = authenticateToken;
