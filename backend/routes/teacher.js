const express = require("express");
const router = express.Router();
const ClassSession = require("../models/ClassSession");

// POST: Schedule a class
router.post("/schedule-class", async (req, res) => {
  try {
    const { teacherEmail, courseTitle, dateTime } = req.body;

    const newClassSession = new ClassSession({
      teacherEmail,
      courseTitle,
      dateTime,
    });

    await newClassSession.save();

    res.status(201).json(newClassSession);
  } catch (error) {
    console.error("Error scheduling class:", error);
    res.status(500).json({ message: "Failed to schedule class" });
  }
});

// GET: Get all scheduled classes for a teacher by email
router.get("/scheduled-classes", async (req, res) => {
  try {
    const { email } = req.query;
    const sessions = await ClassSession.find({ teacherEmail: email });
    res.status(200).json(sessions);
  } catch (error) {
    console.error("Error fetching scheduled classes:", error);
    res.status(500).json({ message: "Failed to fetch scheduled classes" });
  }
});

module.exports = router;
