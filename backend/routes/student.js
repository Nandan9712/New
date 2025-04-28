// routes/student.js
const express = require('express');
const TrainingSession = require('../models/TrainingSession');
const Enrollment      = require('../models/Enrollment');
const { keycloak }    = require('../keycloak-config');
const Exam          = require('../models/Exam'); 
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
        const email = req.user.email;
  
        // prevent double-enroll
        const exists = await Enrollment.findOne({ sessionId, studentEmail: email });
        if (exists) return res.status(400).json({ message: 'Already enrolled' });
  
        // save Enrollment
        const e = new Enrollment({ sessionId, studentEmail: email });
        await e.save();
  
        // 💥 Also update TrainingSession
        await TrainingSession.findByIdAndUpdate(
          sessionId,
          { $addToSet: { enrolledStudents: email } }  // use $addToSet to prevent duplicates
        );
  
        res.json({ message: 'Enrolled successfully' });
      } catch (err) {
        console.error('POST /sessions/:id/enroll error', err);
        res.status(500).json({ message: err.message });
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
router.get(
    '/exams/mine',
    keycloak.protect('realm:student'),
    async (req, res) => {
      try {
        // 1) look up all the sessionIds this student enrolled in
        const enrolls    = await Enrollment.find({ studentEmail: req.user.email });
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
