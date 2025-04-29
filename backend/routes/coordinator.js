// routes/coordinator.js
const express = require('express');
const { keycloak } = require('../keycloak-config');
const Exam = require('../models/Exam');
const Availability = require('../models/Availability');
const TrainingSession = require('../models/TrainingSession');
const Enrollment = require('../models/Enrollment');

const router = express.Router();

// 0️⃣ List all training sessions
router.get(
  '/sessions',
  keycloak.protect('realm:coordinator'),
  async (req, res) => {
    try {
      const sessions = await TrainingSession.find().select('title description');
      res.json(sessions);
    } catch (err) {
      console.error('GET /sessions error', err);
      res.status(500).json({ message: err.message });
    }
  }
);

// 1️⃣ Auto-suggest how many online/offline exam slots you need
router.get(
  '/exams/suggest-sessions/:sessionId',
  keycloak.protect('realm:coordinator'),
  async (req, res) => {
    const { sessionId } = req.params;
    try {
      // just count total enrollments (no isOnline flag on Enrollment any more)
      const totalStudents = await Enrollment.countDocuments({ sessionId });
      const onlineSessions  = Math.ceil(totalStudents / 20);
      const offlineSessions = Math.ceil(totalStudents / 30);
      res.json({ totalStudents, onlineSessions, offlineSessions });
    } catch (err) {
      console.error('GET /exams/suggest-sessions error', err);
      res.status(500).json({ message: err.message });
    }
  }
);

// 2️⃣ Schedule a new exam (auto-assign the least busy available examiner)
// 2️⃣ Schedule a new exam (auto-assign the least busy available examiner)
router.post(
  '/exams/schedule',
  keycloak.protect('realm:coordinator'),
  async (req, res) => {
    const { sessionId, date, time, isOnline, onlineLink, location } = req.body;
    if (!sessionId || !date || !time || typeof isOnline !== 'boolean') {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
      // compute time window
      const slotStart = new Date(`${date}T${time}`);
      const EXAM_DURATION = 60 * 60 * 1000; // 1 hour
      const slotEnd = new Date(slotStart.getTime() + EXAM_DURATION);

      // find examiners free at that time
      const candidates = await Availability.find({
        availableFrom: { $lte: slotStart },
        availableTo:   { $gte: slotEnd },
      }).distinct('examinerId');

      if (!candidates.length) {
        return res.status(404).json({ message: 'No examiner available at that time' });
      }

      // pick the least-loaded examiner who ALSO has no clash within 4 hours
      const FOUR_HOURS = 4 * 60 * 60 * 1000; // 4 hours in ms

      const availableCandidates = [];

      for (const examinerId of candidates) {
        // fetch future exams for this examiner
        const futureExams = await Exam.find({ assignedExaminer: examinerId });

        const hasClash = futureExams.some(exam => {
          const examStart = new Date(`${exam.date.toISOString().split('T')[0]}T${exam.time}`);
          const timeDiff = Math.abs(examStart - slotStart); // time difference in ms
          return timeDiff < FOUR_HOURS;
        });

        if (!hasClash) {
          availableCandidates.push(examinerId);
        }
      }

      if (!availableCandidates.length) {
        return res.status(400).json({ message: 'No examiner available with 4-hour gap requirement' });
      }

      // Now pick the least-loaded examiner among filtered candidates
      const load = await Promise.all(
        availableCandidates.map(async (id) => ({
          id,
          count: await Exam.countDocuments({
            assignedExaminer: id,
            date: { $gte: new Date() },
          })
        }))
      );
      load.sort((a, b) => a.count - b.count);
      const assigned = load[0].id;

      // create the exam
      const exam = new Exam({
        sessionId,
        date,
        time,
        isOnline,
        onlineLink: isOnline ? onlineLink : undefined,
        location: !isOnline ? location : undefined,
        createdBy: req.user.email,
        assignedExaminer: assigned
      });

      await exam.save();
      res.status(201).json(exam);
    } catch (err) {
      console.error('POST /exams/schedule error', err);
      res.status(500).json({ message: err.message });
    }
  }
);

// 3️⃣ List all scheduled exams
router.get(
  '/exams',
  keycloak.protect('realm:coordinator'),
  async (req, res) => {
    try {
      const exams = await Exam.find()
        .populate('sessionId', 'title'); // still populate session title
      res.json(exams);
    } catch (err) {
      console.error('GET /exams error', err);
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
