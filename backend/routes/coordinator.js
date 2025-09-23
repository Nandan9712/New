const express = require('express');
const { keycloak } = require('../keycloak-config');
const Exam = require('../models/Exam');
const Availability = require('../models/Availability');
const TrainingSession = require('../models/TrainingSession');
const Enrollment = require('../models/Enrollment');
const { sendEmail } = require('../utils/emailService');

const router = express.Router();

// Helper function to validate exam time
const isValidExamTime = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours < 17; // Before 5PM (17:00)
};

// Helper function to get the next weekday date
const getNextWeekdayDate = (date) => {
  const result = new Date(date);
  result.setDate(result.getDate() + 7);
  
  // If it's Saturday (6) or Sunday (0), move to Monday
  if (result.getDay() === 0) { // Sunday
    result.setDate(result.getDate() + 1);
  } else if (result.getDay() === 6) { // Saturday
    result.setDate(result.getDate() + 2);
  }
  
  return result;
};

// Middleware to auto-schedule exams for new sessions
const autoScheduleExam = async (sessionId) => {
  try {
    const session = await TrainingSession.findById(sessionId);
    if (!session || !session.classDates || session.classDates.length === 0) {
      return null;
    }

    // Check if exam already exists
    const existingExam = await Exam.findOne({ sessionId });
    if (existingExam) {
      return existingExam;
    }

    // Get the last class date
    const lastClassDate = session.classDates.reduce((latest, current) => {
      const currentDate = new Date(current.date);
      return currentDate > latest ? currentDate : latest;
    }, new Date(0));

    // Calculate exam date (1 week after last class, on a weekday)
    const examDate = getNextWeekdayDate(lastClassDate);
    const examDateStr = examDate.toISOString().split('T')[0];
    const examTime = '14:00'; // Default to 2PM
    const examDuration = 60; // Default duration in minutes

    // Find available examiners
    const slotStart = new Date(`${examDateStr}T${examTime}`);
    const slotEnd = new Date(slotStart.getTime() + examDuration * 60 * 1000);
    
    const candidates = await Availability.find({
      availableFrom: { $lte: slotStart },
      availableTo: { $gte: slotEnd },
    }).distinct('examinerId');

    if (!candidates.length) {
      return null;
    }

    // Pick least-loaded examiner
    const load = await Promise.all(
      candidates.map(async (id) => ({
        id,
        count: await Exam.countDocuments({
          assignedExaminer: id,
          date: { $gte: new Date() },
        })
      }))
    );
    load.sort((a, b) => a.count - b.count);
    const assignedExaminer = load[0].id;

    // Create the exam (default to offline mode)
    const exam = new Exam({
      sessionId: session._id,
      date: examDateStr,
      time: examTime,
      isOnline: false,
      location: 'Main Campus - Building A',
      createdBy: 'system',
      assignedExaminer,
      duration: examDuration,
    });

    await exam.save();

    // Send notifications
    await sendEmail({
      to: 'coordinator@example.com',
      subject: `Exam Auto-Scheduled: ${session.title}`,
      html: `
        <h2>Exam Auto-Scheduled</h2>
        <p><strong>Course:</strong> ${session.title}</p>
        <p><strong>Date:</strong> ${examDateStr}</p>
        <p><strong>Time:</strong> ${examTime}</p>
        <p><strong>Duration:</strong> ${examDuration} minutes</p>
        <p><strong>Mode:</strong> Offline</p>
        <p><strong>Location:</strong> Main Campus - Building A</p>
        <hr>
        <p>This exam was automatically scheduled 1 week after the last session.</p>
      `
    });

    await sendEmail({
      to: assignedExaminer,
      subject: `You've been assigned as examiner for ${session.title}`,
      html: `
        <h2>Exam Assignment Notification</h2>
        <p>You have been automatically assigned as the examiner for the following exam:</p>
        
        <h3>Exam Details</h3>
        <p><strong>Course:</strong> ${session.title}</p>
        <p><strong>Date:</strong> ${examDateStr}</p>
        <p><strong>Time:</strong> ${examTime}</p>
        <p><strong>Duration:</strong> ${examDuration} minutes</p>
        <p><strong>Mode:</strong> Offline</p>
        <p><strong>Location:</strong> Main Campus - Building A</p>
        
        <h3>Student Information</h3>
        <p><strong>Total Students:</strong> ${session.enrolledStudents?.length || 0}</p>
        
        <hr>
        <p>Please confirm your availability and prepare the exam materials accordingly.</p>
        <p>If you have any scheduling conflicts, please contact the coordinator immediately.</p>
      `
    });

    return exam;
  } catch (err) {
    console.error('Auto-schedule error:', err);
    return null;
  }
};

// 0️⃣ List all training sessions
router.get(
  '/sessions',
  keycloak.protect('realm:coordinator'),
  async (req, res) => {
    try {
      const sessions = await TrainingSession.find().select('title description classDates');
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
      const totalStudents = await Enrollment.countDocuments({ sessionId });
      const onlineSessions = Math.ceil(totalStudents / 20);
      const offlineSessions = Math.ceil(totalStudents / 30);
      res.json({ totalStudents, onlineSessions, offlineSessions });
    } catch (err) {
      console.error('GET /exams/suggest-sessions error', err);
      res.status(500).json({ message: err.message });
    }
  }
);

// 2️⃣ Schedule/Reschedule an exam
router.post(
  '/exams/schedule',
  keycloak.protect('realm:coordinator'),
  async (req, res) => {
    const { sessionId, date, time, isOnline, onlineLink, location, duration, examId } = req.body;
    
    // Validate required fields
    if (!sessionId || !date || !time || typeof isOnline !== 'boolean' || !duration) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate exam time (before 5PM)
    if (!isValidExamTime(time)) {
      return res.status(400).json({ message: 'Exam time must be before 5PM' });
    }

    try {
      // Compute time window
      const slotStart = new Date(`${date}T${time}`);
      const EXAM_DURATION = duration * 60 * 1000;
      const slotEnd = new Date(slotStart.getTime() + EXAM_DURATION);

      // Check for time conflicts with other exams (excluding current exam if rescheduling)
      const conflictQuery = {
        date,
        $or: [
          { 
            time: { 
              $gte: time, 
              $lt: new Date(slotEnd).toTimeString().slice(0, 5) 
            } 
          },
          {
            $expr: {
              $lt: [
                { 
                  $add: [
                    { $toLong: { $toDate: { $concat: [date, "T", "$time"] } } },
                    { $multiply: ["$duration", 60000] }
                  ] 
                },
                { $toLong: { $toDate: { $concat: [date, "T", time] } } }
              ]
            }
          }
        ]
      };

      if (examId) {
        conflictQuery._id = { $ne: examId };
      }

      const conflictingExams = await Exam.find(conflictQuery);

      if (conflictingExams.length > 0) {
        return res.status(400).json({ 
          message: 'Time slot conflicts with existing exams',
          conflictingExams
        });
      }

      // Find available examiners
      const candidates = await Availability.find({
        availableFrom: { $lte: slotStart },
        availableTo: { $gte: slotEnd },
      }).distinct('examinerId');

      if (!candidates.length) {
        return res.status(404).json({ message: 'No examiner available at that time' });
      }

      // Pick least-loaded examiner
      const load = await Promise.all(
        candidates.map(async (id) => ({
          id,
          count: await Exam.countDocuments({
            assignedExaminer: id,
            date: { $gte: new Date() },
          })
        }))
      );
      load.sort((a, b) => a.count - b.count);
      const assigned = load[0].id;

      // Get session details for email
      const session = await TrainingSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      let exam;
      if (examId) {
        // Reschedule existing exam
        exam = await Exam.findByIdAndUpdate(
          examId,
          {
            sessionId,
            date,
            time,
            isOnline,
            onlineLink: isOnline ? onlineLink : undefined,
            location: !isOnline ? location : undefined,
            assignedExaminer: assigned,
            duration,
          },
          { new: true }
        );
      } else {
        // Create new exam
        exam = new Exam({
          sessionId,
          date,
          time,
          isOnline,
          onlineLink: isOnline ? onlineLink : undefined,
          location: !isOnline ? location : undefined,
          createdBy: req.user.email,
          assignedExaminer: assigned,
          duration,
        });
        await exam.save();
      }

      // Send email notification
      const action = examId ? 'Rescheduled' : 'Scheduled';
      await sendEmail({
        to: 'coordinator@example.com',
        subject: `Exam ${action}: ${session.title}`,
        html: `
          <h2>Exam ${action}</h2>
          <p><strong>Course:</strong> ${session.title}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Duration:</strong> ${duration} minutes</p>
          <p><strong>Mode:</strong> ${isOnline ? 'Online' : 'Offline'}</p>
          ${isOnline ? `<p><strong>Link:</strong> ${onlineLink}</p>` : `<p><strong>Location:</strong> ${location}</p>`}
          <hr>
          <p>Please contact your coordinator if you have any questions.</p>
        `
      });

      await sendEmail({
        to: assigned,
        subject: `You've been assigned as examiner for ${session.title}`,
        html: `
          <h2>Exam Assignment Notification</h2>
          <p>You have been assigned as the examiner for the following exam:</p>
          
          <h3>Exam Details</h3>
          <p><strong>Course:</strong> ${session.title}</p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Duration:</strong> ${duration} minutes</p>
          <p><strong>Mode:</strong> ${isOnline ? 'Online' : 'Offline'}</p>
          ${isOnline ? `<p><strong>Meeting Link:</strong> ${onlineLink}</p>` : `<p><strong>Location:</strong> ${location}</p>`}
          
          <h3>Student Information</h3>
          <p><strong>Total Students:</strong> ${session.enrolledStudents?.length || 0}</p>
          
          <hr>
          <p>Please confirm your availability and prepare the exam materials accordingly.</p>
          <p>If you have any scheduling conflicts, please contact the coordinator immediately.</p>
        `
      });

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
        .populate('sessionId', 'title');
      res.json(exams);
    } catch (err) {
      console.error('GET /exams error', err);
      res.status(500).json({ message: err.message });
    }
  }
);

// 4️⃣ Get exam details for editing
router.get(
  '/exams/:id',
  keycloak.protect('realm:coordinator'),
  async (req, res) => {
    try {
      const exam = await Exam.findById(req.params.id)
        .populate('sessionId', 'title');
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }
      res.json(exam);
    } catch (err) {
      console.error('GET /exams/:id error', err);
      res.status(500).json({ message: err.message });
    }
  }
);

// 5️⃣ Delete an exam
router.delete(
  '/exams/:id',
  keycloak.protect('realm:coordinator'),
  async (req, res) => {
    try {
      const exam = await Exam.findByIdAndDelete(req.params.id);
      if (!exam) {
        return res.status(404).json({ message: 'Exam not found' });
      }
      
      await sendEmail({
        to: 'coordinator@example.com',
        subject: `Exam Cancelled: ${exam.sessionId?.title || 'Unknown Session'}`,
        html: `
          <h2>Exam Cancelled</h2>
          <p>The following exam has been cancelled:</p>
          <p><strong>Course:</strong> ${exam.sessionId?.title || 'Unknown Session'}</p>
          <p><strong>Date:</strong> ${exam.date}</p>
          <p><strong>Time:</strong> ${exam.time}</p>
          <hr>
          <p>Reason: Manual cancellation by coordinator</p>
        `
      });

      res.json({ message: 'Exam cancelled successfully' });
    } catch (err) {
      console.error('DELETE /exams/:id error', err);
      res.status(500).json({ message: err.message });
    }
  }
);

router.delete(
  '/availability/:id',
  keycloak.protect('realm:examiner'),
  async (req, res) => {
    try {
      // 1. Delete the availability slot
      const availability = await Availability.findByIdAndDelete(req.params.id);
      if (!availability) {
        return res.status(404).json({ message: 'Availability not found' });
      }

      const { examinerId, availableFrom, availableTo } = availability;

      // 2. Find affected exams (exams assigned to this examiner during this time slot)
      const affectedExams = await Exam.find({
        assignedExaminer: examinerId,
        date: { 
          $gte: new Date(availableFrom).toISOString().split('T')[0],
          $lte: new Date(availableTo).toISOString().split('T')[0]
        },
        time: {
          $gte: new Date(availableFrom).toTimeString().slice(0, 5),
          $lte: new Date(availableTo).toTimeString().slice(0, 5)
        }
      }).populate('sessionId', 'title');

      if (affectedExams.length === 0) {
        return res.json({ 
          message: 'Availability removed, no exams affected' 
        });
      }

      // 3. Process each affected exam
      const results = await Promise.all(
        affectedExams.map(async (exam) => {
          try {
            const slotStart = new Date(`${exam.date}T${exam.time}`);
            const slotEnd = new Date(
              slotStart.getTime() + exam.duration * 60 * 1000
            );

            // Find alternative examiners
            const candidates = await Availability.find({
              examinerId: { $ne: examinerId }, // Exclude current examiner
              availableFrom: { $lte: slotStart },
              availableTo: { $gte: slotEnd },
            }).distinct('examinerId');

            if (candidates.length > 0) {
              // Pick least-loaded examiner
              const load = await Promise.all(
                candidates.map(async (id) => ({
                  id,
                  count: await Exam.countDocuments({
                    assignedExaminer: id,
                    date: { $gte: new Date() },
                  })
                }))
              );
              load.sort((a, b) => a.count - b.count);
              const newExaminer = load[0].id;

              // Reassign exam
              const updatedExam = await Exam.findByIdAndUpdate(
                exam._id,
                { assignedExaminer: newExaminer },
                { new: true }
              );

              // Send reassignment email
              await sendEmail({
                to: 'coordinator@example.com',
                subject: `Exam Reassigned: ${exam.sessionId.title}`,
                html: `
                  <h2>Exam Reassigned</h2>
                  <p>The following exam has been reassigned to a new examiner:</p>
                  <p><strong>Course:</strong> ${exam.sessionId.title}</p>
                  <p><strong>Date:</strong> ${exam.date}</p>
                  <p><strong>Time:</strong> ${exam.time}</p>
                  <p><strong>New Examiner ID:</strong> ${newExaminer}</p>
                  <hr>
                  <p>Reason: Original examiner removed availability</p>
                `
              });

              return {
                examId: exam._id,
                status: 'reassigned',
                newExaminer
              };
            } else {
              // No available examiners - cancel exam
              await Exam.findByIdAndDelete(exam._id);

              // Send cancellation email
              await sendEmail({
                to: 'coordinator@example.com',
                subject: `Exam Cancelled: ${exam.sessionId.title}`,
                html: `
                  <h2>Exam Cancelled</h2>
                  <p>The following exam has been cancelled:</p>
                  <p><strong>Course:</strong> ${exam.sessionId.title}</p>
                  <p><strong>Date:</strong> ${exam.date}</p>
                  <p><strong>Time:</strong> ${exam.time}</p>
                  <hr>
                  <p>Reason: No available examiners after original examiner removed availability</p>
                  <p>Please schedule a new exam with different timing.</p>
                `
              });

              return {
                examId: exam._id,
                status: 'cancelled',
                reason: 'No available examiners'
              };
            }
          } catch (error) {
            console.error(`Error processing exam ${exam._id}:`, error);
            return {
              examId: exam._id,
              status: 'error',
              error: error.message
            };
          }
        })
      );

      res.json({
        message: 'Availability removed and exams processed',
        results
      });
    } catch (err) {
      console.error('DELETE /availability/:id error', err);
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = { router, autoScheduleExam };