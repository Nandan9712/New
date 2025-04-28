// backend/routes/exams.js
const express = require('express');
const { keycloak } = require('../keycloak-config');
const TrainingSession = require('../models/TrainingSession');
const Exam             = require('../models/Exam');
const router           = express.Router();

// ─── List & Filter ─────────────────────────────────────────────────────────────
router.get(
  '/',
  keycloak.protect('realm:examiner'),
  async (req, res) => {
    try {
      const filter = {};
      if (req.query.sessionId) filter.sessionId = req.query.sessionId;
      const exams = await Exam.find(filter)
                              .populate('sessionId', 'title');
      return res.json(exams);
    } catch (err) {
      console.error('GET /exams error', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

// ─── Create ────────────────────────────────────────────────────────────────────
router.post(
  '/',
  keycloak.protect('realm:examiner'),
  async (req, res) => {
    const { sessionId, date, time, isOnline, onlineLink, location } = req.body;
    if (!sessionId || !date || !time) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    try {
      // Verify session exists
      const sess = await TrainingSession.findById(sessionId);
      if (!sess) return res.status(404).json({ message: 'Training session not found' });

      const exam = new Exam({
        sessionId,
        date,
        time,
        isOnline,
        onlineLink: isOnline ? onlineLink : undefined,
        location: !isOnline ? location : undefined,
        createdBy: req.user.email
      });
      await exam.save();
      return res.status(201).json(exam);
    } catch (err) {
      console.error('POST /exams error', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

// ─── Update ────────────────────────────────────────────────────────────────────
router.put(
  '/:id',
  keycloak.protect('realm:examiner'),
  async (req, res) => {
    try {
      const updates = req.body;
      const exam = await Exam.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, runValidators: true }
      );
      if (!exam) return res.status(404).json({ message: 'Exam not found' });
      return res.json(exam);
    } catch (err) {
      console.error('PUT /exams/:id error', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

// ─── Delete ────────────────────────────────────────────────────────────────────
router.delete(
  '/:id',
  keycloak.protect('realm:examiner'),
  async (req, res) => {
    try {
      const exam = await Exam.findByIdAndDelete(req.params.id);
      if (!exam) return res.status(404).json({ message: 'Exam not found' });
      return res.json({ message: 'Exam cancelled' });
    } catch (err) {
      console.error('DELETE /exams/:id error', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;
