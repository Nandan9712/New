const express = require('express');
const router = express.Router();
const Availability = require('../models/Availability');

// Middleware to check if user is authenticated (assume you have this)
const requireAuth = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = req.headers.authorization.split(' ')[1];
  // Normally you would verify token and decode user info
  // For now assume user ID or email is inside token somehow (or you pass it manually for testing)
  req.user = { id: "mock-user-id" }; // Replace this later with real Keycloak decoding
  next();
};

// Create Availability
router.post('/', requireAuth, async (req, res) => {
  try {
    const { availableFrom, availableTo } = req.body;
    if (!availableFrom || !availableTo) {
      return res.status(400).json({ message: 'Both availableFrom and availableTo are required' });
    }
    const availability = new Availability({
      examinerId: req.user.id,
      availableFrom,
      availableTo
    });
    await availability.save();
    res.status(201).json(availability);
  } catch (err) {
    console.error('Error creating availability:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my Availabilities
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const availabilities = await Availability.find({ examinerId: req.user.id }).sort({ createdAt: -1 });
    res.json(availabilities);
  } catch (err) {
    console.error('Error fetching availabilities:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Availability
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const availability = await Availability.findOneAndDelete({ _id: req.params.id, examinerId: req.user.id });
    if (!availability) {
      return res.status(404).json({ message: 'Availability not found or not yours' });
    }
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error('Error deleting availability:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
