const express = require('express');
const TrainingSession = require('../models/TrainingSession');
const { keycloak } = require('../keycloak-config');
const router = express.Router();

// GET: Get all training sessions of the logged-in teacher
router.get(
  '/mine',
  keycloak.protect(),
  async (req, res) => {
    try {
      const email = req.user?.email;
      console.log(`Fetching sessions for ${email}`);
      const sessions = await TrainingSession.find({ createdBy: email });
      res.json(sessions);
    } catch (err) {
      console.error('Error in GET /mine:', err);
      res.status(500).json({ message: err.message });
    }
  }
);

// POST: Create a new training session
router.post(
  '/',
  keycloak.protect(),
  async (req, res) => {
    const { title, description, zoomLink, classDates, isLive } = req.body;

    if (!title || !description || !classDates || !Array.isArray(classDates) || classDates.length === 0) {
      return res.status(400).json({ message: 'Missing or invalid required fields' });
    }

    // Validate each classDate item
    for (let i = 0; i < classDates.length; i++) {
      const { date, time } = classDates[i];
      if (!date || !time) {
        return res.status(400).json({ message: `Missing date or time in classDates at index ${i}` });
      }
      // Optionally, validate the date and time format (e.g., ensuring valid ISO date and time string)
      if (isNaN(new Date(date))) {
        return res.status(400).json({ message: `Invalid date format at index ${i}` });
      }
      if (!/^\d{2}:\d{2}$/.test(time)) {
        return res.status(400).json({ message: `Invalid time format at index ${i}. Expected "HH:mm"` });
      }
    }

    try {
      console.log(`Creating session for ${req.user?.email}:`, req.body);

      const newSession = new TrainingSession({
        title,
        description,
        zoomLink,
        classDates,  // Now includes both date and time
        isLive,
        createdBy: req.user.email
      });

      await newSession.save();
      res.status(201).json(newSession);
    } catch (err) {
      console.error('Error in POST /:', err);
      res.status(500).json({ message: err.message });
    }
  }
);
router.get(
  '/mines',
  keycloak.protect('realm:examiner'),
  async (req, res) => {
    try {
      console.log('User info:', req.user);

      if (!req.user || !req.user.email) {
        return res.status(400).json({ message: 'User email missing' });
      }

      const sessions = await TrainingSession.find();


      res.json(sessions);
    } catch (err) {
      console.error('Error fetching your sessions:', err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
