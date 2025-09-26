const express = require('express');
const Exam = require('../models/Exam');
const TrainingSession = require('../models/TrainingSession');
const { keycloak } = require('../keycloak-config');
const router = express.Router();

// GET: Get all exams for the logged-in teacher
router.get('/mine', keycloak.protect(), async (req, res) => {
  try {
    const exams = await Exam.find({ createdBy: req.user.email })
      .populate('sessionId', 'title description isLive')
      .sort({ date: 1 });
    res.json(exams);
  } catch (err) {
    console.error('Error fetching exams:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET: Get exam by ID
router.get('/:id', keycloak.protect(), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('sessionId', 'title description classDates isLive');
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    res.json(exam);
  } catch (err) {
    console.error('Error fetching exam:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT: Update exam details
router.put('/:id', keycloak.protect(), async (req, res) => {
  try {
    const { date, time, location, onlineLink, assignedExaminer } = req.body;
    
    const updateData = {};
    if (date) updateData.date = new Date(date);
    if (time) updateData.time = time;
    if (location) updateData.location = location;
    if (onlineLink) updateData.onlineLink = onlineLink;
    if (assignedExaminer) updateData.assignedExaminer = assignedExaminer;
    
    const updatedExam = await Exam.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('sessionId');
    
    if (!updatedExam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    res.json(updatedExam);
  } catch (err) {
    console.error('Error updating exam:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST: Manually schedule exam for a session
router.post('/session/:sessionId/schedule', keycloak.protect(), async (req, res) => {
  try {
    const session = await TrainingSession.findById(req.params.sessionId);
    
    if (!session) {
      return res.status(404).json({ message: 'Training session not found' });
    }
    
    if (session.createdBy !== req.user.email) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    if (session.scheduledExam) {
      return res.status(400).json({ message: 'Exam already scheduled for this session' });
    }
    
    const exam = await session.scheduleExam();
    res.status(201).json(exam);
  } catch (err) {
    console.error('Error scheduling exam:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE: Cancel exam
router.delete('/:id', keycloak.protect(), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    if (exam.createdBy !== req.user.email) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Remove exam reference from training session
    await TrainingSession.updateOne(
      { scheduledExam: req.params.id },
      { $unset: { scheduledExam: 1 } }
    );
    
    await Exam.findByIdAndDelete(req.params.id);
    res.json({ message: 'Exam cancelled successfully' });
  } catch (err) {
    console.error('Error deleting exam:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;