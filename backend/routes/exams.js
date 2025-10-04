const express = require('express');
const Exam = require('../models/Exam');
const TrainingSession = require('../models/TrainingSession');
const Availability = require('../models/Availability');
const { keycloak } = require('../keycloak-config');
const router = express.Router();

// Helper function to find available examiner for reassignment
const findAvailableExaminer = async (examDate, examTime, duration, excludeExaminerId = null) => {
  try {
    // Get all active examiners (excluding the one who cancelled)
    const activeExaminers = await Availability.distinct('examinerId', {
      examinerId: { $ne: excludeExaminerId }
    });

    if (activeExaminers.length === 0) {
      return null;
    }

    const [hours, minutes] = examTime.split(':').map(Number);
    const examStart = new Date(examDate);
    examStart.setHours(hours, minutes, 0, 0);
    const examEnd = new Date(examStart.getTime() + duration * 60000);

    // Find examiners available during exam time
    const availableExaminers = await Availability.find({
      examinerId: { $in: activeExaminers },
      availableFrom: { $lte: examStart },
      availableTo: { $gte: examEnd }
    });

    if (availableExaminers.length === 0) {
      return null;
    }

    // Check workload for each available examiner
    const examinerWorkloads = [];
    
    for (const availability of availableExaminers) {
      const startOfDay = new Date(examDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(examDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const examCount = await Exam.countDocuments({
        assignedExaminerId: availability.examinerId,
        date: { 
          $gte: startOfDay, 
          $lte: endOfDay 
        },
        status: 'scheduled'
      });
      
      examinerWorkloads.push({
        availability,
        examCount,
        maxExams: availability.maxExamsPerDay || 3
      });
    }

    // Filter examiners who haven't reached their daily limit
    const eligibleExaminers = examinerWorkloads.filter(
      workload => workload.examCount < workload.maxExams
    );

    if (eligibleExaminers.length === 0) {
      return null;
    }

    // Sort by exam count (fewer exams first)
    eligibleExaminers.sort((a, b) => a.examCount - b.examCount);

    return eligibleExaminers[0].availability;
  } catch (error) {
    console.error('Error finding available examiner:', error);
    return null;
  }
};

// GET: Get all exams for the logged-in examiner
router.get('/mine', keycloak.protect(), async (req, res) => {
  try {
    console.log('Fetching exams for examiner:', req.user.email);
    
    const exams = await Exam.find({ 
      assignedExaminerEmail: req.user.email,
      status: 'scheduled'
    })
      .populate('sessionId', 'title description isLive classDates zoomLink location')
      .sort({ date: 1, time: 1 });
    
    console.log(`Found ${exams.length} exams for examiner ${req.user.email}`);
    res.json(exams);
  } catch (err) {
    console.error('Error fetching exams:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET: Get exam by ID (examiner can only see their assigned exams)
router.get('/:id', keycloak.protect(), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id)
      .populate('sessionId', 'title description classDates isLive zoomLink location');
    
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    // Examiner can only view exams assigned to them
    if (exam.assignedExaminerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Not authorized to view this exam' });
    }
    
    res.json(exam);
  } catch (err) {
    console.error('Error fetching exam:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT: Cancel exam (examiner cancellation with auto-reassignment)
router.put('/:id/cancel', keycloak.protect(), async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const examId = req.params.id;
    
    // Find the exam
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }
    
    // Verify the exam is assigned to this examiner
    if (exam.assignedExaminerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Not authorized to cancel this exam' });
    }
    
    // Find a replacement examiner
    const replacementExaminer = await findAvailableExaminer(
      exam.date, 
      exam.time, 
      exam.duration, 
      exam.assignedExaminerId // Exclude current examiner
    );
    
    if (replacementExaminer) {
      // Reassign to new examiner
      exam.assignedExaminer = replacementExaminer.examinerName;
      exam.assignedExaminerName = replacementExaminer.examinerName;
      exam.assignedExaminerId = replacementExaminer.examinerId;
      exam.assignedExaminerEmail = replacementExaminer.examinerEmail;
      exam.assignmentReason = `Reassigned after cancellation by ${req.user.email}. Reason: ${cancellationReason || 'No reason provided'}`;
      
      await exam.save();
      
      res.json({ 
        message: 'Exam successfully reassigned to another examiner',
        exam: exam,
        reassigned: true
      });
    } else {
      // No available examiner found, cancel the exam entirely
      exam.status = 'cancelled';
      exam.assignmentReason = `Cancelled by examiner ${req.user.email}. No replacement available. Reason: ${cancellationReason || 'No reason provided'}`;
      
      await exam.save();
      
      // Remove exam reference from training session
      await TrainingSession.updateOne(
        { scheduledExam: examId },
        { 
          $unset: { scheduledExam: 1 },
          $set: { examScheduled: false }
        }
      );
      
      res.json({ 
        message: 'Exam cancelled. No available examiners found for reassignment.',
        exam: exam,
        reassigned: false
      });
    }
  } catch (err) {
    console.error('Error cancelling exam:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET: Get examiner statistics
router.get('/stats/mine', keycloak.protect(), async (req, res) => {
  try {
    const examinerEmail = req.user.email;
    
    const totalExams = await Exam.countDocuments({ 
      assignedExaminerEmail: examinerEmail,
      status: 'scheduled'
    });
    
    const completedExams = await Exam.countDocuments({ 
      assignedExaminerEmail: examinerEmail,
      status: 'completed'
    });
    
    const upcomingExams = await Exam.find({ 
      assignedExaminerEmail: examinerEmail,
      status: 'scheduled',
      date: { $gte: new Date() }
    }).sort({ date: 1 }).limit(5);
    
    res.json({
      totalAssigned: totalExams,
      completed: completedExams,
      upcoming: upcomingExams.length,
      upcomingExams: upcomingExams
    });
  } catch (err) {
    console.error('Error fetching examiner stats:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;