const express = require('express');
const TrainingSession = require('../models/TrainingSession');
const Exam = require('../models/Exam');
const Enrollment = require('../models/Enrollment');
const Availability = require('../models/Availability');
const { keycloak } = require('../keycloak-config');
const { sendEmail } = require('../utils/emailService');
const router = express.Router();

// Get all sessions for coordinator
router.get('/sessions', keycloak.protect('realm:coordinator'), async (req, res) => {
  try {
    console.log('Fetching all sessions for coordinator...');
    const sessions = await TrainingSession.find()
      .populate('scheduledExam')
      .sort({ createdAt: -1 });
    
    console.log(`Found ${sessions.length} sessions`);
    
    const transformedSessions = sessions.map(session => ({
      _id: session._id,
      title: session.title,
      description: session.description,
      isLive: session.isLive,
      classDates: session.classDates || [],
      enrolledStudents: session.enrolledStudents || [],
      createdBy: session.createdBy,
      createdAt: session.createdAt,
      scheduledExam: session.scheduledExam,
      examScheduled: session.examScheduled
    }));

    res.json(transformedSessions);
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Get all exams for coordinator
router.get('/exams', keycloak.protect('realm:coordinator'), async (req, res) => {
  try {
    console.log('Fetching all exams for coordinator...');
    const exams = await Exam.find()
      .populate('sessionId')
      .sort({ date: 1, time: 1 });
    
    console.log(`Found ${exams.length} exams`);
    res.json(exams);
  } catch (err) {
    console.error('Error fetching exams:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Get specific exam details
router.get('/exams/:id', keycloak.protect('realm:coordinator'), async (req, res) => {
  try {
    console.log('Fetching exam details for:', req.params.id);
    const exam = await Exam.findById(req.params.id).populate('sessionId');
    
    if (!exam) {
      console.log('Exam not found:', req.params.id);
      return res.status(404).json({ message: 'Exam not found' });
    }

    console.log('Exam found:', exam._id);
    res.json(exam);
  } catch (err) {
    console.error('Error fetching exam:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Debug endpoint for exams
router.get('/exams-debug/:id', keycloak.protect('realm:coordinator'), async (req, res) => {
  try {
    console.log('DEBUG: Fetching exam with ID:', req.params.id);
    
    const exam = await Exam.findById(req.params.id).populate('sessionId');
    
    if (!exam) {
      console.log('DEBUG: Exam not found');
      return res.status(404).json({ message: 'Exam not found' });
    }

    console.log('DEBUG: Exam found:', {
      id: exam._id,
      title: exam.sessionId?.title,
      date: exam.date,
      time: exam.time,
      examiner: exam.assignedExaminer,
      examinerId: exam.assignedExaminerId
    });

    res.json(exam);
  } catch (err) {
    console.error('DEBUG: Error fetching exam:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Get available examiners from Availability collection
router.get('/examiners', keycloak.protect('realm:coordinator'), async (req, res) => {
  try {
    const { date, time, duration } = req.query;
    
    console.log('Fetching examiners with params:', { date, time, duration });

    // Get unique examiners from Availability collection
    const availabilityRecords = await Availability.find().sort({ examinerName: 1 });
    
    const uniqueExaminers = [];
    const examinerMap = new Map();
    
    availabilityRecords.forEach(record => {
      if (!examinerMap.has(record.examinerId)) {
        examinerMap.set(record.examinerId, true);
        uniqueExaminers.push({
          id: record.examinerId,
          name: record.examinerName,
          email: record.examinerEmail,
          specialization: record.examinerSpecialization || 'General',
          department: 'Examination Department'
        });
      }
    });

    console.log(`Found ${uniqueExaminers.length} unique examiners`);

    // If date, time, and duration are provided, filter available examiners for that slot
    if (date && time && duration) {
      const [hours, minutes] = time.split(':').map(Number);
      const slotStart = new Date(date);
      slotStart.setHours(hours, minutes, 0, 0);
      const slotEnd = new Date(slotStart.getTime() + parseInt(duration) * 60000);

      const availableExaminers = await Availability.find({
        availableFrom: { $lte: slotStart },
        availableTo: { $gte: slotEnd }
      });

      const availableExaminerIds = availableExaminers.map(avail => avail.examinerId);
      
      // Filter unique examiners by availability and workload
      const filteredExaminers = await Promise.all(
        uniqueExaminers
          .filter(examiner => availableExaminerIds.includes(examiner.id))
          .map(async (examiner) => {
            const startOfDay = new Date(slotStart);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(slotStart);
            endOfDay.setHours(23, 59, 59, 999);
            
            const examCount = await Exam.countDocuments({
              assignedExaminerId: examiner.id,
              date: { $gte: startOfDay, $lte: endOfDay },
              status: 'scheduled'
            });

            const examinerAvailability = availableExaminers.find(avail => avail.examinerId === examiner.id);
            const maxExams = examinerAvailability?.maxExamsPerDay || 3;

            return {
              ...examiner,
              currentExams: examCount,
              maxExams: maxExams,
              available: examCount < maxExams
            };
          })
      );

      const availableOnes = filteredExaminers.filter(e => e.available);
      console.log(`Found ${availableOnes.length} available examiners for the slot`);
      res.json(availableOnes);
    } else {
      res.json(uniqueExaminers);
    }
  } catch (err) {
    console.error('Error fetching examiners:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Schedule new exam
router.post('/exams/schedule', keycloak.protect('realm:coordinator'), async (req, res) => {
  try {
    const { sessionId, date, time, duration, isOnline, onlineLink, location, assignedExaminer, instructions, totalMarks } = req.body;

    console.log('Scheduling exam with data:', { 
      sessionId, date, time, duration, isOnline, 
      assignedExaminer, totalMarks 
    });

    if (!sessionId || !date || !time || !duration || !assignedExaminer) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (isOnline && !onlineLink) {
      return res.status(400).json({ message: 'Online link required for online exams' });
    }

    if (!isOnline && !location) {
      return res.status(400).json({ message: 'Location required for offline exams' });
    }

    const session = await TrainingSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Get examiner details from Availability
    const examinerAvailability = await Availability.findOne({ examinerId: assignedExaminer });
    if (!examinerAvailability) {
      return res.status(400).json({ message: 'Selected examiner not found in availability records' });
    }

    const examData = {
      sessionId,
      date: new Date(date),
      time,
      duration: parseInt(duration),
      isOnline,
      onlineLink: isOnline ? onlineLink : undefined,
      location: !isOnline ? location : undefined,
      assignedExaminer: examinerAvailability.examinerName,
      assignedExaminerId: examinerAvailability.examinerId,
      assignedExaminerEmail: examinerAvailability.examinerEmail,
      totalMarks: parseInt(totalMarks) || 100,
      instructions: instructions || 'Please bring your student ID and arrive 15 minutes early.',
      status: 'scheduled'
    };

    const exam = new Exam(examData);
    await exam.save();

    // Update session with exam reference
    session.scheduledExam = exam._id;
    session.examScheduled = true;
    await session.save();

    // Send notifications to enrolled students and examiner
    await sendExamCreatedNotifications(session, exam);

    const populatedExam = await Exam.findById(exam._id).populate('sessionId');
    
    console.log('Exam scheduled successfully:', populatedExam._id);
    res.status(201).json(populatedExam);
  } catch (err) {
    console.error('Error scheduling exam:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Update exam - FIXED VERSION
router.put('/exams/:id', keycloak.protect('realm:coordinator'), async (req, res) => {
  try {
    const { date, time, duration, isOnline, onlineLink, location, assignedExaminer, instructions, totalMarks } = req.body;

    console.log('Updating exam:', req.params.id, { 
      date, time, duration, isOnline, assignedExaminer 
    });

    // Get original exam data before update for comparison
    const originalExam = await Exam.findById(req.params.id).populate('sessionId');
    if (!originalExam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Get examiner details if assignedExaminer changed
    let examinerName = exam.assignedExaminer;
    let examinerEmail = exam.assignedExaminerEmail;
    let examinerId = exam.assignedExaminerId;
    
    if (assignedExaminer && assignedExaminer !== exam.assignedExaminerId) {
      const examinerAvailability = await Availability.findOne({ examinerId: assignedExaminer });
      if (!examinerAvailability) {
        return res.status(400).json({ message: 'Selected examiner not found in availability records' });
      }
      examinerName = examinerAvailability.examinerName;
      examinerEmail = examinerAvailability.examinerEmail;
      examinerId = examinerAvailability.examinerId;
    }

    const updateData = {};
    if (date) updateData.date = new Date(date);
    if (time) updateData.time = time;
    if (duration) updateData.duration = parseInt(duration);
    if (isOnline !== undefined) updateData.isOnline = isOnline;
    if (onlineLink !== undefined) updateData.onlineLink = onlineLink;
    if (location !== undefined) updateData.location = location;
    if (assignedExaminer) {
      updateData.assignedExaminer = examinerName;
      updateData.assignedExaminerId = examinerId;
      updateData.assignedExaminerEmail = examinerEmail;
    }
    if (instructions) updateData.instructions = instructions;
    if (totalMarks) updateData.totalMarks = parseInt(totalMarks);

    const updatedExam = await Exam.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('sessionId');

    if (!updatedExam) {
      return res.status(404).json({ message: 'Exam not found after update' });
    }

    // Send update notifications to students and examiner
    await sendExamUpdatedNotifications(originalExam, updatedExam);

    console.log('Exam updated successfully:', updatedExam._id);
    res.json(updatedExam);
  } catch (err) {
    console.error('Error updating exam:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Delete exam
router.delete('/exams/:id', keycloak.protect('realm:coordinator'), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate('sessionId');
    if (!exam) {
      return res.status(404).json({ message: 'Exam not found' });
    }

    // Remove exam reference from session
    await TrainingSession.findByIdAndUpdate(exam.sessionId, {
      $unset: { scheduledExam: 1 },
      examScheduled: false
    });

    await Exam.findByIdAndDelete(req.params.id);
    
    // Send deletion notifications to students and examiner
    await sendExamDeletedNotifications(exam);

    console.log('Exam deleted successfully:', req.params.id);
    res.json({ message: 'Exam deleted successfully' });
  } catch (err) {
    console.error('Error deleting exam:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get exam suggestions for a session
router.get('/exams/suggest-sessions/:sessionId', keycloak.protect('realm:coordinator'), async (req, res) => {
  try {
    const session = await TrainingSession.findById(req.params.sessionId);
    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    const enrollments = await Enrollment.find({ sessionId: req.params.sessionId });
    const totalStudents = enrollments.length;

    // Calculate suggested exam date (1 week after last session)
    const lastSessionDate = session.classDates.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const suggestedDate = new Date(lastSessionDate.date);
    suggestedDate.setDate(suggestedDate.getDate() + 7);

    const suggestions = {
      totalStudents,
      onlineSessions: session.classDates.filter(slot => !session.isLive).length,
      offlineSessions: session.classDates.filter(slot => session.isLive).length,
      suggestedDate: suggestedDate.toISOString().split('T')[0],
      suggestedTime: '10:00',
      sessionMode: session.isLive ? 'offline' : 'online'
    };

    res.json(suggestions);
  } catch (err) {
    console.error('Error getting suggestions:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to send exam creation notifications
async function sendExamCreatedNotifications(session, exam) {
  try {
    const enrollments = await Enrollment.find({ sessionId: session._id });
    
    const examDate = new Date(exam.date);
    const formattedDate = examDate.toLocaleDateString();
    const formattedTime = exam.time;

    // Send email to each enrolled student
    for (const enrollment of enrollments) {
      try {
        await sendEmail({
          to: 'vani.chillale@gmail.com', // Replace with enrollment.studentEmail
          subject: `📢 Exam Scheduled: ${session.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb; text-align: center;">Exam Scheduled Successfully</h2>
              <div style="background: #f8fafc; padding: 20px; border-radius: 10px; border-left: 4px solid #2563eb;">
                <p>Dear Student,</p>
                <p>An exam has been scheduled for the session: <strong>${session.title}</strong></p>
                
                <div style="margin: 20px 0;">
                  <h3 style="color: #374151; margin-bottom: 10px;">Exam Details:</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Date:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formattedDate}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Time:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formattedTime}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Duration:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.duration} minutes</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Total Marks:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.totalMarks}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Examiner:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.assignedExaminer}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Mode:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.isOnline ? 'Online' : 'Offline'}</td>
                    </tr>
                    ${exam.isOnline ? `
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Online Link:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><a href="${exam.onlineLink}">${exam.onlineLink}</a></td>
                    </tr>
                    ` : `
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Location:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.location}</td>
                    </tr>
                    `}
                  </table>
                </div>

                ${exam.instructions ? `
                <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 15px 0;">
                  <h4 style="color: #374151; margin-bottom: 10px;">📝 Instructions:</h4>
                  <p style="margin: 0;">${exam.instructions}</p>
                </div>
                ` : ''}

                <p>Please make sure to attend the exam on time and bring all necessary materials.</p>
                
                <div style="text-align: center; margin-top: 20px; padding: 15px; background: #dcfce7; border-radius: 8px;">
                  <p style="margin: 0; color: #166534;">Best of luck for your exam! 🎯</p>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
                <p>Best regards,<br>Exam Coordination Team</p>
              </div>
            </div>
          `
        });
        console.log(`Exam creation notification sent to student: ${enrollment.studentEmail}`);
      } catch (emailError) {
        console.error(`Failed to send exam email to ${enrollment.studentEmail}:`, emailError);
      }
    }

    // Send notification to assigned examiner
    try {
      await sendEmail({
        to: 'vani.chillale@gmail.com', // Replace with exam.assignedExaminerEmail
        subject: `📋 New Exam Assigned: ${session.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #7c3aed; text-align: center;">New Exam Assignment</h2>
            <div style="background: #faf5ff; padding: 20px; border-radius: 10px; border-left: 4px solid #7c3aed;">
              <p>Dear <strong>${exam.assignedExaminer}</strong>,</p>
              <p>You have been assigned as the examiner for the following exam:</p>
              
              <div style="margin: 20px 0;">
                <h3 style="color: #374151; margin-bottom: 10px;">Exam Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Session:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${session.title}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Date:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Time:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formattedTime}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Duration:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.duration} minutes</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Total Students:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${enrollments.length}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Mode:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.isOnline ? 'Online' : 'Offline'}</td>
                  </tr>
                </table>
              </div>

              <p>Please prepare the necessary examination materials and be available at the scheduled time.</p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
              <p>Best regards,<br>Exam Coordination Team</p>
            </div>
          </div>
        `
      });
      console.log(`Exam assignment notification sent to examiner: ${exam.assignedExaminerEmail}`);
    } catch (examinerEmailError) {
      console.error(`Failed to send exam assignment email to examiner:`, examinerEmailError);
    }

  } catch (error) {
    console.error('Error sending exam creation notifications:', error);
  }
}

// Helper function to send exam update notifications
async function sendExamUpdatedNotifications(originalExam, updatedExam) {
  try {
    const enrollments = await Enrollment.find({ sessionId: updatedExam.sessionId._id });
    
    const originalDate = new Date(originalExam.date);
    const updatedDate = new Date(updatedExam.date);
    const formattedOriginalDate = originalDate.toLocaleDateString();
    const formattedUpdatedDate = updatedDate.toLocaleDateString();

    // Check what changed
    const changes = [];
    if (originalExam.date.getTime() !== updatedExam.date.getTime()) {
      changes.push(`Date changed from ${formattedOriginalDate} to ${formattedUpdatedDate}`);
    }
    if (originalExam.time !== updatedExam.time) {
      changes.push(`Time changed from ${originalExam.time} to ${updatedExam.time}`);
    }
    if (originalExam.assignedExaminer !== updatedExam.assignedExaminer) {
      changes.push(`Examiner changed from ${originalExam.assignedExaminer} to ${updatedExam.assignedExaminer}`);
    }
    if (originalExam.location !== updatedExam.location && !updatedExam.isOnline) {
      changes.push(`Location changed from ${originalExam.location} to ${updatedExam.location}`);
    }
    if (originalExam.onlineLink !== updatedExam.onlineLink && updatedExam.isOnline) {
      changes.push('Online meeting link has been updated');
    }

    // Send email to each enrolled student about updates
    for (const enrollment of enrollments) {
      try {
        await sendEmail({
          to: 'vani.chillale@gmail.com', // Replace with enrollment.studentEmail
          subject: `🔄 Exam Updated: ${updatedExam.sessionId.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #f59e0b; text-align: center;">Exam Details Updated</h2>
              <div style="background: #fffbeb; padding: 20px; border-radius: 10px; border-left: 4px solid #f59e0b;">
                <p>Dear Student,</p>
                <p>The exam for <strong>${updatedExam.sessionId.title}</strong> has been updated with the following changes:</p>
                
                <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 15px 0;">
                  <h4 style="color: #d97706; margin-bottom: 10px;">📋 Changes Made:</h4>
                  <ul style="margin: 0; padding-left: 20px;">
                    ${changes.map(change => `<li>${change}</li>`).join('')}
                  </ul>
                </div>

                <div style="margin: 20px 0;">
                  <h3 style="color: #374151; margin-bottom: 10px;">Updated Exam Details:</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Date:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formattedUpdatedDate}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Time:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${updatedExam.time}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Duration:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${updatedExam.duration} minutes</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Examiner:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${updatedExam.assignedExaminer}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Mode:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${updatedExam.isOnline ? 'Online' : 'Offline'}</td>
                    </tr>
                    ${updatedExam.isOnline ? `
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Online Link:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><a href="${updatedExam.onlineLink}">${updatedExam.onlineLink}</a></td>
                    </tr>
                    ` : `
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Location:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${updatedExam.location}</td>
                    </tr>
                    `}
                  </table>
                </div>

                <p>Please update your schedule accordingly and make note of the changes.</p>
                
                <div style="text-align: center; margin-top: 20px; padding: 15px; background: #fef3c7; border-radius: 8px;">
                  <p style="margin: 0; color: #92400e;">Please review the updated exam details carefully! 📝</p>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
                <p>Best regards,<br>Exam Coordination Team</p>
              </div>
            </div>
          `
        });
        console.log(`Exam update notification sent to student: ${enrollment.studentEmail}`);
      } catch (emailError) {
        console.error(`Failed to send exam update email to ${enrollment.studentEmail}:`, emailError);
      }
    }

    // Send notification to new examiner (if changed)
    if (originalExam.assignedExaminer !== updatedExam.assignedExaminer) {
      try {
        await sendEmail({
          to: 'vani.chillale@gmail.com', // Replace with updatedExam.assignedExaminerEmail
          subject: `📋 Exam Assignment Update: ${updatedExam.sessionId.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7c3aed; text-align: center;">Exam Assignment Update</h2>
              <div style="background: #faf5ff; padding: 20px; border-radius: 10px; border-left: 4px solid #7c3aed;">
                <p>Dear <strong>${updatedExam.assignedExaminer}</strong>,</p>
                <p>You have been assigned as the examiner for the following exam:</p>
                
                <div style="margin: 20px 0;">
                  <h3 style="color: #374151; margin-bottom: 10px;">Exam Details:</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Session:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${updatedExam.sessionId.title}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Date:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formattedUpdatedDate}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Time:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${updatedExam.time}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Duration:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${updatedExam.duration} minutes</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Total Students:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${enrollments.length}</td>
                    </tr>
                  </table>
                </div>

                <p>Please prepare the necessary examination materials and be available at the scheduled time.</p>
              </div>
              
              <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
                <p>Best regards,<br>Exam Coordination Team</p>
              </div>
            </div>
          `
        });
        console.log(`Exam assignment update sent to new examiner: ${updatedExam.assignedExaminerEmail}`);
      } catch (examinerEmailError) {
        console.error(`Failed to send exam assignment update to examiner:`, examinerEmailError);
      }
    }

  } catch (error) {
    console.error('Error sending exam update notifications:', error);
  }
}

// Helper function to send exam deletion notifications
async function sendExamDeletedNotifications(exam) {
  try {
    const enrollments = await Enrollment.find({ sessionId: exam.sessionId._id });
    
    const examDate = new Date(exam.date);
    const formattedDate = examDate.toLocaleDateString();

    // Send email to each enrolled student about cancellation
    for (const enrollment of enrollments) {
      try {
        await sendEmail({
          to: 'vani.chillale@gmail.com', // Replace with enrollment.studentEmail
          subject: `❌ Exam Cancelled: ${exam.sessionId.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626; text-align: center;">Exam Cancelled</h2>
              <div style="background: #fef2f2; padding: 20px; border-radius: 10px; border-left: 4px solid #dc2626;">
                <p>Dear Student,</p>
                <p>We regret to inform you that the exam for <strong>${exam.sessionId.title}</strong> scheduled for <strong>${formattedDate} at ${exam.time}</strong> has been cancelled.</p>
                
                <div style="background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 15px 0;">
                  <h4 style="color: #dc2626; margin-bottom: 10px;">Cancelled Exam Details:</h4>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Session:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.sessionId.title}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Original Date:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formattedDate}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Original Time:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.time}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Examiner:</strong></td>
                      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.assignedExaminer}</td>
                    </tr>
                  </table>
                </div>

                <p>We apologize for any inconvenience this may cause. A new exam schedule will be communicated to you in due course.</p>
                
                <div style="text-align: center; margin-top: 20px; padding: 15px; background: #fecaca; border-radius: 8px;">
                  <p style="margin: 0; color: #991b1b;">Please disregard any previous communications about this exam.</p>
                </div>
              </div>
              
              <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
                <p>Best regards,<br>Exam Coordination Team</p>
              </div>
            </div>
          `
        });
        console.log(`Exam cancellation notification sent to student: ${enrollment.studentEmail}`);
      } catch (emailError) {
        console.error(`Failed to send exam cancellation email to ${enrollment.studentEmail}:`, emailError);
      }
    }

    // Send notification to examiner about cancellation
    try {
      await sendEmail({
        to: 'vani.chillale@gmail.com', // Replace with exam.assignedExaminerEmail
        subject: `📋 Exam Assignment Cancelled: ${exam.sessionId.title}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6b7280; text-align: center;">Exam Assignment Cancelled</h2>
            <div style="background: #f9fafb; padding: 20px; border-radius: 10px; border-left: 4px solid #6b7280;">
              <p>Dear <strong>${exam.assignedExaminer}</strong>,</p>
              <p>Your assignment as examiner for the following exam has been cancelled:</p>
              
              <div style="margin: 20px 0;">
                <h3 style="color: #374151; margin-bottom: 10px;">Cancelled Exam Details:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Session:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.sessionId.title}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Original Date:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formattedDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Original Time:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${exam.time}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Total Students:</strong></td>
                    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${enrollments.length}</td>
                  </tr>
                </table>
              </div>

              <p>You are no longer required to conduct this examination. Thank you for your understanding.</p>
            </div>
            
            <div style="text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px;">
              <p>Best regards,<br>Exam Coordination Team</p>
            </div>
          </div>
        `
      });
      console.log(`Exam cancellation notification sent to examiner: ${exam.assignedExaminerEmail}`);
    } catch (examinerEmailError) {
      console.error(`Failed to send exam cancellation email to examiner:`, examinerEmailError);
    }

  } catch (error) {
    console.error('Error sending exam deletion notifications:', error);
  }
}

module.exports = router;