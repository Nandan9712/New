const express = require('express');
const { keycloak } = require('../keycloak-config');
const TrainingSession = require('../models/TrainingSession');
const Exam = require('../models/Exam');
const { sendEmail } = require('../utils/emailService');

const router = express.Router();

// ─── List Exams (with optional session filter) ─────────────────────────────────
router.get(
  '/',
  keycloak.protect('realm:examiner'),
  async (req, res) => {
    try {
      const filter = {};
      if (req.query.sessionId) filter.sessionId = req.query.sessionId;
      const exams = await Exam.find(filter).populate('sessionId', 'title');
      return res.json(exams);
    } catch (err) {
      console.error('GET /exams error', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

// ─── Create Exam ───────────────────────────────────────────────────────────────
router.post(
  '/',
  keycloak.protect('realm:examiner'),
  async (req, res) => {
    const { sessionId, date, time, isOnline, onlineLink, location } = req.body;
    if (!sessionId || !date || !time) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
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

// ─── Update Exam ───────────────────────────────────────────────────────────────
router.put(
  '/:id',
  keycloak.protect('realm:examiner'),
  async (req, res) => {
    try {
      const exam = await Exam.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
      });
      if (!exam) return res.status(404).json({ message: 'Exam not found' });
      return res.json(exam);
    } catch (err) {
      console.error('PUT /exams/:id error', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

// ─── Delete Exam and Send Notification ─────────────────────────────────────────
router.delete(
  '/:id',
  keycloak.protect('realm:examiner'),
  async (req, res) => {
    try {
      // First get the exam details before deleting
      const exam = await Exam.findById(req.params.id).populate('sessionId', 'title');
      
      if (!exam) return res.status(404).json({ message: 'Exam not found' });

      // Prepare email content BEFORE deleting
      const emailContent = {
        to: 'chillalsaikishor21@gmail.com',
        subject: 'Exam Cancellation Notification',
        html: `
          <h2>Exam Cancelled</h2>
          <p>The following exam has been cancelled:</p>
          <ul>
            <li><strong>Session:</strong> ${exam.sessionId?.title || 'N/A'}</li>
            <li><strong>Date:</strong> ${new Date(exam.date).toLocaleDateString()}</li>
            <li><strong>Time:</strong> ${exam.time}</li>
            <li><strong>Mode:</strong> ${exam.isOnline ? 'Online' : 'Offline'}</li>
            ${exam.isOnline ? 
              `<li><strong>Link:</strong> ${exam.onlineLink || 'N/A'}</li>` : 
              `<li><strong>Location:</strong> ${exam.location || 'N/A'}</li>`}
          </ul>
          <p>Cancelled by: ${req.user.email}</p>
        `
      };

      // Delete the exam
      await Exam.findByIdAndDelete(req.params.id);

      // Send email with proper error handling
      try {
        await sendEmail(emailContent);
        console.log('Cancellation email sent successfully');
      } catch (emailError) {
        console.error('Failed to send cancellation email:', emailError);
        // Don't fail the request if email fails
      }

      return res.json({ 
        message: 'Exam cancelled',
        emailSent: true // Indicate email was attempted
      });
    } catch (err) {
      console.error('DELETE /exams/:id error', err);
      return res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;