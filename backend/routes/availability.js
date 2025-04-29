const express = require('express');
const router = express.Router();
const Availability = require('../models/Availability');
const jwt = require('jsonwebtoken');

const requireAuth = async (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.decode(token); // or use jwt.verify() if you have the Keycloak public key

    req.user = { id: decoded.sub }; // usually 'sub' contains the user ID in Keycloak tokens

    next();
  } catch (err) {
    console.error('Authorization error:', err);
    res.status(401).json({ message: 'Unauthorized' });
  }
};


// Create Availability
// Updated Create Availability endpoint
router.post('/', requireAuth, async (req, res) => {
  try {
    const { availableFrom, availableTo } = req.body;
    if (!availableFrom || !availableTo) {
      return res.status(400).json({ message: 'Both availableFrom and availableTo are required' });
    }

    // Convert to Date objects for comparison
    const newFrom = new Date(availableFrom);
    const newTo = new Date(availableTo);

    // Check if end time is after start time
    if (newTo <= newFrom) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    // Check for overlapping availabilities
    const overlapping = await Availability.findOne({
      examinerId: req.user.id,
      $or: [
        { 
          availableFrom: { $lt: newTo }, 
          availableTo: { $gt: newFrom } 
        }
      ]
    });

    if (overlapping) {
      return res.status(400).json({ 
        message: 'This availability overlaps with an existing one',
        conflictingAvailability: overlapping
      });
    }

    const availability = new Availability({
      examinerId: req.user.id,
      availableFrom: newFrom,
      availableTo: newTo
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
