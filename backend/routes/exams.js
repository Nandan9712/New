const express = require('express');
const Exam = require('../models/Exam');
const TrainingSession = require('../models/TrainingSession');
const { keycloak } = require('../keycloak-config');
const router = express.Router();

// GET: Get all exams for the logged-in teacher
router.get('/mine', keycloak.protect(), async (req, res) => {
  try {
    console.log('Fetching exams for user:', req.user.email);
    
    const exams = await Exam.find({ createdBy: req.user.email })
      .populate('sessionId', 'title description isLive classDates zoomLink location')
      .sort({ date: 1, time: 1 });
    
    console.log(`Found ${exams.length} exams for user ${req.user.email}`);
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
      .populate('sessionId', 'title description classDates isLive zoomLink location');
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    if (exam.createdBy !== req.user.email) {
      return res.status(403).json({ message: 'Not authorized' });
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
    const { date, time, location, onlineLink, assignedExaminer, duration } = req.body;
    
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    if (exam.createdBy !== req.user.email) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const updateData = {};
    if (date) updateData.date = new Date(date);
    if (time) updateData.time = time;
    if (location !== undefined) updateData.location = location;
    if (onlineLink !== undefined) updateData.onlineLink = onlineLink;
    if (assignedExaminer) updateData.assignedExaminer = assignedExaminer;
    if (duration) updateData.duration = duration;
    
    const updatedExam = await Exam.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('sessionId');
    
    if (!updatedExam) {
      return res.status(404).json({ message: 'Exam not found after update' });
    }
    
    res.json(updatedExam);
  } catch (err) {
    console.error('Error updating exam:', err);
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
      { 
        $unset: { scheduledExam: 1 },
        $set: { examScheduled: false }
      }
    );
    
    await Exam.findByIdAndDelete(req.params.id);
    res.json({ message: 'Exam cancelled successfully' });
  } catch (err) {
    console.error('Error deleting exam:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET: Get all exams (for debugging)
router.get('/', keycloak.protect(), async (req, res) => {
  try {
    const exams = await Exam.find({})
      .populate('sessionId')
      .sort({ createdAt: -1 });
    
    res.json({
      totalExams: exams.length,
      exams: exams
    });
  } catch (err) {
    console.error('Error fetching all exams:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;