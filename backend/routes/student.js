const express = require('express');
const router = express.Router();
const ClassSession = require('../models/ClassSession');
const RegisteredCourse = require('../models/RegisteredCourse');
const { protectRole } = require('../keycloak-config');

// ✅ Get all class sessions (for students to view)
router.get("/class-sessions", async (req, res) => {
  try {
    const sessions = await ClassSession.find({});
    res.status(200).json(sessions);
  } catch (error) {
    console.error("Error fetching class sessions:", error);
    res.status(500).json({ message: "Server error while fetching sessions" });
  }
});

// ✅ Register for a class session (Keycloak-protected)
router.post('/register-course', protectRole('student'), async (req, res) => {
  try {
    const { courseTitle, sessionId } = req.body;

    // ✅ Step 1: Extract email from Keycloak access token
    const tokenContent = req.kauth?.grant?.access_token?.content;

    console.log("🔐 Token content:", tokenContent); // DEBUG: Check what's inside

    if (!tokenContent || !tokenContent.email) {
      return res.status(400).json({ message: 'User email not found in token' });
    }

    const userEmail = tokenContent.email;

    // ✅ Step 2: Find the class session
    const classSession = await ClassSession.findOne({ _id: sessionId });

    if (!classSession) {
      return res.status(404).json({ message: 'Class session not found' });
    }

    // ✅ Step 3: Check if already registered
    const alreadyRegistered = await RegisteredCourse.findOne({
      userEmail,
      courseTitle,
      teacherEmail: classSession.teacherEmail
    });

    if (alreadyRegistered) {
      return res.status(400).json({ message: 'Already registered for this session' });
    }

    // ✅ Step 4: Register the student
    const newRegistration = new RegisteredCourse({
      userEmail,
      courseTitle,
      teacherEmail: classSession.teacherEmail
    });

    console.log("📌 New Registration:", newRegistration);

    await newRegistration.save();

    res.status(200).json({ message: 'Registered successfully' });

  } catch (error) {
    console.error("❌ Error during registration:", error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

module.exports = router;
