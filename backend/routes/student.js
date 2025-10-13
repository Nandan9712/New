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

// 2️⃣ Enroll in a session by its ID - OPTIMIZED
router.post(
  '/sessions/:id/enroll',
  keycloak.protect('realm:student'),
  async (req, res) => {
    try {
      const sessionId = req.params.id;
      const { email, name } = req.user;
      const studentName = name || req.user.preferred_username || 'Student';

      // Check existing enrollment
      const existingEnrollment = await Enrollment.findOne({ sessionId, studentEmail: email });
      if (existingEnrollment) {
        return res.status(400).json({ message: 'Already enrolled' });
      }

      // Get session details
      const session = await TrainingSession.findById(sessionId);
      if (!session) return res.status(404).json({ message: 'Session not found' });

      // Create enrollment and update session in parallel
      const [enrollment, updatedSession] = await Promise.all([
        new Enrollment({ sessionId, studentEmail: email }).save(),
        TrainingSession.findByIdAndUpdate(
          sessionId,
          { $addToSet: { enrolledStudents: email } },
          { new: true }
        )
      ]);

      // Get updated exams for this session
      const updatedExams = await Exam.find({ sessionId }).populate('sessionId', 'title');

      // Send notifications in background (don't wait for them)
      Promise.all([
        sendEnrollmentNotifications(updatedSession, email, studentName),
        updatedSession.scheduledExam ? Exam.findById(updatedSession.scheduledExam).then(exam => {
          if (exam) return sendExamNotifications(updatedSession, exam);
        }) : Promise.resolve()
      ]).catch(error => {
        console.error('Background notification error:', error);
      });

      res.json({ 
        success: true, 
        message: 'Enrolled successfully',
        session: updatedSession,
        exams: updatedExams
      });
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
      const enrolls = await Enrollment.find({ studentEmail: req.user.email });
      const sessionIds = enrolls.map(e => e.sessionId);
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