const express = require('express');
const TrainingSession = require('../models/TrainingSession');
const Enrollment = require('../models/Enrollment');
const Exam = require('../models/Exam');
const { keycloak } = require('../keycloak-config');
const { sendExamNotifications, sendEnrollmentNotifications } = require('../utils/emailNotifications');
const router = express.Router();

// 1️⃣ List all sessions (teacher-created)
router.get(
  '/sessions',
  keycloak.protect('realm:student'),
  async (req, res) => {
    try {
      const all = await TrainingSession.find();
      res.json(all);
    } catch (err) {
      console.error('GET /sessions error', err);
      res.status(500).json({ message: err.message });
    }
  }
);

// 2️⃣ Enroll in a session by its ID
router.post(
  '/sessions/:id/enroll',
  keycloak.protect('realm:student'),
  async (req, res) => {
    try {
      const sessionId = req.params.id;
      const { email, name } = req.user;
      const studentName = name || req.user.preferred_username || 'Student';

      // Check existing enrollment
      if (await Enrollment.findOne({ sessionId, studentEmail: email })) {
        return res.status(400).json({ message: 'Already enrolled' });
      }

      // Get session details
      const session = await TrainingSession.findById(sessionId);
      if (!session) return res.status(404).json({ message: 'Session not found' });

      // Save enrollment
      await new Enrollment({ sessionId, studentEmail: email }).save();
      const updatedSession = await TrainingSession.findByIdAndUpdate(
        sessionId,
        { $addToSet: { enrolledStudents: email } },
        { new: true }
      );

      // Send enrollment notifications to both student and teacher
      await sendEnrollmentNotifications(updatedSession, email, studentName);

      // If session already has an exam scheduled, send exam notification to the new student
      if (updatedSession.scheduledExam) {
        const exam = await Exam.findById(updatedSession.scheduledExam);
        if (exam) {
          await sendExamNotifications(updatedSession, exam);
        }
      }

      res.json({ success: true, message: 'Enrolled successfully' });
    } catch (error) {
      console.error('Enrollment error:', error);
      res.status(500).json({ 
        success: false,
        message: error.response || error.message 
      });
    }
  }
);

// 3️⃣ Get sessions this student is enrolled in
router.get(
  '/sessions/mine',
  keycloak.protect('realm:student'),
  async (req, res) => {
    try {
      const email = req.user.email;
      const enrolls = await Enrollment.find({ studentEmail: email });
      const ids = enrolls.map(e => e.sessionId);
      const mine = await TrainingSession.find({ _id: { $in: ids } });
      res.json(mine);
    } catch (err) {
      console.error('GET /sessions/mine error', err);
      res.status(500).json({ message: err.message });
    }
  }
);

// 4️⃣ Get exams for sessions the student is enrolled in
router.get(
  '/exams/mine',
  keycloak.protect('realm:student'),
  async (req, res) => {
    try {
      // 1) look up all the sessionIds this student enrolled in
      const enrolls = await Enrollment.find({ studentEmail: req.user.email });
      const sessionIds = enrolls.map(e => e.sessionId);

      // 2) fetch any exams for those sessions
      const exams = await Exam.find({ sessionId: { $in: sessionIds } })
                              .populate('sessionId','title');
      return res.json(exams);
    } catch (err) {
      console.error('GET /exams/mine error', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;