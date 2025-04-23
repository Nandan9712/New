const express = require('express');
const router = express.Router();
const ClassSession = require('../models/ClassSession');
const RegisteredCourse = require('../models/RegisteredCourse');

// Get all class sessions
router.get('/classsessions', async (req, res) => {
  try {
    const sessions = await ClassSession.find();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register a course
router.post('/register', async (req, res) => {
  try {
    const { userEmail, courseTitle, teacherEmail, dateTime } = req.body;
    const reg = new RegisteredCourse({ userEmail, courseTitle, teacherEmail, dateTime });
    await reg.save();
    res.json({ message: 'Registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
