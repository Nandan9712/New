const express = require('express');
const TrainingSession = require('../models/TrainingSession');
const Exam = require('../models/Exam');
const { keycloak } = require('../keycloak-config');
const { sendExamNotifications } = require('../utils/emailNotifications');
const router = express.Router();


function convertDurationToHrMin(durationInMinutes) {
  const hours = Math.floor(durationInMinutes / 60);
  const minutes = durationInMinutes % 60;
  return `${hours}hr ${minutes}min`;
}

function hasTimeConflict(newSlot, existingSlot, excludeSessionId = null) {
  // Convert dates to UTC for comparison
  const newDateUTC = new Date(newSlot.date).toISOString().split('T')[0];
  const existingDateUTC = new Date(existingSlot.date).toISOString().split('T')[0];
  
  if (newDateUTC !== existingDateUTC) return false;
  
  const parseTime = (dateStr, timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(dateStr);
    date.setUTCHours(hours, minutes, 0, 0);
    return date;
  };

  const newStart = parseTime(newSlot.date, newSlot.time);
  const newEnd = new Date(newStart.getTime() + newSlot.duration * 60000);
  const existingStart = parseTime(existingSlot.date, existingSlot.time);
  const existingEnd = new Date(existingStart.getTime() + existingSlot.duration * 60000);

  return (
    (newStart >= existingStart && newStart < existingEnd) ||
    (newEnd > existingStart && newEnd <= existingEnd) ||
    (newStart <= existingStart && newEnd >= existingEnd)
  );
}

// Helper function to normalize date to UTC
function normalizeDateToUTC(dateString) {
  const date = new Date(dateString);
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
}

// Helper function to format date for display (UTC)
function formatDateForDisplay(dateString) {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

// Create session
router.post('/', keycloak.protect(), async (req, res) => {
  try {
    const { title, description, zoomLink, location, classDates, isLive, recurringWeeks = 1 } = req.body;
    const email = req.user?.email;

    if (!title || !description || !classDates || !Array.isArray(classDates) || classDates.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (isLive && (!location || location.trim() === '')) {
      return res.status(400).json({ message: 'Location required for live sessions' });
    }

    const now = normalizeDateToUTC(new Date());
    const normalizedClassDates = [];
    
    for (const [i, slot] of classDates.entries()) {
      if (!slot.date || !slot.time || !slot.duration) {
        return res.status(400).json({ message: `Missing data in slot ${i + 1}` });
      }

      // Normalize date to UTC to avoid timezone issues
      const normalizedDate = normalizeDateToUTC(slot.date);
      if (isNaN(normalizedDate.getTime())) {
        return res.status(400).json({ message: `Invalid date in slot ${i + 1}` });
      }

      const [hours, minutes] = slot.time.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return res.status(400).json({ message: `Invalid time in slot ${i + 1}` });
      }

      if (hours < 6 || (hours >= 18 && minutes > 0)) {
        return res.status(400).json({ message: `Slot ${i + 1} must be between 6:00 AM and 6:00 PM` });
      }

      if (isNaN(slot.duration) || slot.duration <= 0) {
        return res.status(400).json({ message: `Invalid duration in slot ${i + 1}` });
      }

      // Create date-time in UTC for comparison
      const slotDateTime = new Date(normalizedDate);
      slotDateTime.setUTCHours(hours, minutes, 0, 0);
      
      if (slotDateTime < now) {
        return res.status(400).json({ message: `Slot ${i + 1} is in the past` });
      }

      normalizedClassDates.push({ 
        date: normalizedDate, 
        time: slot.time, 
        duration: slot.duration 
      });
    }

    // Check conflicts
    const existingSessions = await TrainingSession.find({ createdBy: email });
    for (const existingSession of existingSessions) {
      for (const existingSlot of existingSession.classDates) {
        for (const newSlot of normalizedClassDates) {
          if (hasTimeConflict(newSlot, existingSlot)) {
            const conflictDate = new Date(existingSlot.date).toLocaleDateString();
            return res.status(400).json({
              message: `Conflict with "${existingSession.title}" on ${conflictDate}`
            });
          }
        }
      }
    }

    // Check internal conflicts
    for (let i = 0; i < normalizedClassDates.length; i++) {
      for (let j = i + 1; j < normalizedClassDates.length; j++) {
        if (hasTimeConflict(normalizedClassDates[i], normalizedClassDates[j])) {
          const conflictDate = new Date(normalizedClassDates[i].date).toLocaleDateString();
          return res.status(400).json({
            message: `Internal conflict on ${conflictDate}`
          });
        }
      }
    }

    const sessionData = {
      title, 
      description, 
      zoomLink, 
      location,
      classDates: normalizedClassDates.map(slot => ({
        date: slot.date, 
        time: slot.time, 
        duration: slot.duration,
        durationFormatted: convertDurationToHrMin(slot.duration)
      })),
      isLive, 
      createdBy: email, 
      recurringWeeks, 
      examScheduled: false
    };

    const newSession = new TrainingSession(sessionData);
    await newSession.save();
    
    let exam;
    try {
      exam = await newSession.scheduleExam();
      
      if (exam) {
        await sendExamNotifications(newSession, exam);
      }
    } catch (examError) {
      console.error('Exam scheduling failed:', examError);
    }
    
    const sessionWithExam = await TrainingSession.findById(newSession._id).populate('scheduledExam');
    res.status(201).json(sessionWithExam);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Update session - Enhanced with edit type support
router.put('/:id', keycloak.protect(), async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      classDates, 
      zoomLink, 
      location, 
      title, 
      description, 
      isLive,
      editType, // 'full-course' or 'specific-session'
      sessionIndex, // index of specific session to edit (if editType is 'specific-session')
      newDate,
      newTime,
      newDuration
    } = req.body;
    
    const email = req.user?.email;

    const session = await TrainingSession.findById(id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.createdBy !== email) return res.status(403).json({ message: 'Not authorized' });

    let updatedClassDates = [...session.classDates];

    if (editType === 'full-course' && classDates && Array.isArray(classDates)) {
      // Full course editing - replace all dates
      const now = normalizeDateToUTC(new Date());
      const normalizedClassDates = [];
      
      for (const [i, slot] of classDates.entries()) {
        if (!slot.date || !slot.time || !slot.duration) {
          return res.status(400).json({ message: `Missing data in slot ${i + 1}` });
        }

        // Normalize date to UTC
        const normalizedDate = normalizeDateToUTC(slot.date);
        if (isNaN(normalizedDate.getTime())) return res.status(400).json({ message: `Invalid date in slot ${i + 1}` });

        const [hours, minutes] = slot.time.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          return res.status(400).json({ message: `Invalid time in slot ${i + 1}` });
        }

        if (hours < 6 || (hours >= 18 && minutes > 0)) {
          return res.status(400).json({ message: `Slot ${i + 1} must be between 6:00 AM and 6:00 PM` });
        }

        if (isNaN(slot.duration) || slot.duration <= 0) {
          return res.status(400).json({ message: `Invalid duration in slot ${i + 1}` });
        }

        // Create date-time in UTC for comparison
        const slotDateTime = new Date(normalizedDate);
        slotDateTime.setUTCHours(hours, minutes, 0, 0);
        if (slotDateTime < now) return res.status(400).json({ message: `Slot ${i + 1} is in the past` });

        normalizedClassDates.push({ 
          date: normalizedDate, 
          time: slot.time, 
          duration: slot.duration 
        });
      }

      // Check conflicts with other sessions
      const existingSessions = await TrainingSession.find({ createdBy: email, _id: { $ne: id } });
      for (const existingSession of existingSessions) {
        for (const existingSlot of existingSession.classDates) {
          for (const newSlot of normalizedClassDates) {
            if (hasTimeConflict(newSlot, existingSlot)) {
              const conflictDate = new Date(existingSlot.date).toLocaleDateString();
              return res.status(400).json({ 
                message: `Conflict with "${existingSession.title}" on ${conflictDate}` 
              });
            }
          }
        }
      }

      // Check internal conflicts
      for (let i = 0; i < normalizedClassDates.length; i++) {
        for (let j = i + 1; j < normalizedClassDates.length; j++) {
          if (hasTimeConflict(normalizedClassDates[i], normalizedClassDates[j])) {
            const conflictDate = new Date(normalizedClassDates[i].date).toLocaleDateString();
            return res.status(400).json({ 
              message: `Internal conflict between slots on ${conflictDate}` 
            });
          }
        }
      }

      updatedClassDates = normalizedClassDates.map(slot => ({
        date: slot.date, 
        time: slot.time, 
        duration: slot.duration,
        durationFormatted: convertDurationToHrMin(slot.duration)
      }));

    } else if (editType === 'specific-session' && sessionIndex !== undefined && newDate && newTime) {
      // Specific session editing - update only one session
      if (sessionIndex < 0 || sessionIndex >= updatedClassDates.length) {
        return res.status(400).json({ message: 'Invalid session index' });
      }

      const now = normalizeDateToUTC(new Date());
      // Normalize new date to UTC
      const normalizedDate = normalizeDateToUTC(newDate);
      
      if (isNaN(normalizedDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date' });
      }

      const [hours, minutes] = newTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return res.status(400).json({ message: 'Invalid time' });
      }

      if (hours < 6 || (hours >= 18 && minutes > 0)) {
        return res.status(400).json({ message: 'Time must be between 6:00 AM and 6:00 PM' });
      }

      const newDurationValue = newDuration || updatedClassDates[sessionIndex].duration;
      if (isNaN(newDurationValue) || newDurationValue <= 0) {
        return res.status(400).json({ message: 'Invalid duration' });
      }

      // Create date-time in UTC for comparison
      const slotDateTime = new Date(normalizedDate);
      slotDateTime.setUTCHours(hours, minutes, 0, 0);
      if (slotDateTime < now) {
        return res.status(400).json({ message: 'Selected date and time is in the past' });
      }

      const updatedSlot = {
        date: normalizedDate,
        time: newTime,
        duration: newDurationValue,
        durationFormatted: convertDurationToHrMin(newDurationValue)
      };

      // Check conflicts with other sessions
      const existingSessions = await TrainingSession.find({ createdBy: email, _id: { $ne: id } });
      for (const existingSession of existingSessions) {
        for (const existingSlot of existingSession.classDates) {
          if (hasTimeConflict(updatedSlot, existingSlot)) {
            const conflictDate = new Date(existingSlot.date).toLocaleDateString();
            return res.status(400).json({ 
              message: `Conflict with "${existingSession.title}" on ${conflictDate}` 
            });
          }
        }
      }

      // Check conflicts with other sessions in the same course
      for (let i = 0; i < updatedClassDates.length; i++) {
        if (i !== sessionIndex && hasTimeConflict(updatedSlot, updatedClassDates[i])) {
          const conflictDate = new Date(updatedClassDates[i].date).toLocaleDateString();
          return res.status(400).json({ 
            message: `Conflict with another session in this course on ${conflictDate}` 
          });
        }
      }

      updatedClassDates[sessionIndex] = updatedSlot;
    }

    const updateData = {};
    if (classDates || editType) {
      updateData.classDates = updatedClassDates;
    }
    if (zoomLink !== undefined) updateData.zoomLink = zoomLink;
    if (location !== undefined) updateData.location = location;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (isLive !== undefined) updateData.isLive = isLive;

    const updated = await TrainingSession.findByIdAndUpdate(id, updateData, { new: true }).populate('scheduledExam');
    if (!updated) return res.status(404).json({ message: 'Session not found' });
    
    // Reschedule exam if class dates changed
    if (classDates || editType) {
      try {
        if (updated.scheduledExam) await Exam.findByIdAndDelete(updated.scheduledExam);
        const newExam = await updated.scheduleExam();
        
        if (newExam) {
          await sendExamNotifications(updated, newExam);
        }
        
        const finalSession = await TrainingSession.findById(id).populate('scheduledExam');
        return res.json(finalSession);
      } catch (error) {
        console.error('Error rescheduling exam:', error);
        return res.status(500).json({ message: 'Error rescheduling exam' });
      }
    }
    
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Get my sessions
router.get('/mine', keycloak.protect(), async (req, res) => {
  try {
    const sessions = await TrainingSession.find({ createdBy: req.user.email })
      .populate('scheduledExam')
      .sort({ createdAt: -1 });
    
    // Ensure dates are properly formatted for frontend
    const sessionsWithFormattedDates = sessions.map(session => ({
      ...session._doc,
      classDates: session.classDates.map(slot => ({
        ...slot._doc,
        date: slot.date.toISOString().split('T')[0] // Ensure consistent date format
      }))
    }));
    
    res.json(sessionsWithFormattedDates);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get session by ID
router.get('/:id', keycloak.protect(), async (req, res) => {
  try {
    const session = await TrainingSession.findById(req.params.id).populate('scheduledExam');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.createdBy !== req.user.email) return res.status(403).json({ message: 'Not authorized' });
    
    // Format dates for consistent display
    const sessionWithFormattedDates = {
      ...session._doc,
      classDates: session.classDates.map(slot => ({
        ...slot._doc,
        date: slot.date.toISOString().split('T')[0]
      }))
    };
    
    res.json(sessionWithFormattedDates);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete session
router.delete('/:id', keycloak.protect(), async (req, res) => {
  try {
    const session = await TrainingSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.createdBy !== req.user.email) return res.status(403).json({ message: 'Not authorized' });

    if (session.scheduledExam) await Exam.findByIdAndDelete(session.scheduledExam);
    await TrainingSession.findByIdAndDelete(req.params.id);
    res.json({ message: 'Session and exam cancelled successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create exam for session
router.post('/:id/create-exam', keycloak.protect(), async (req, res) => {
  try {
    const session = await TrainingSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.createdBy !== req.user.email) return res.status(403).json({ message: 'Not authorized' });

    if (session.scheduledExam) await Exam.findByIdAndDelete(session.scheduledExam);
    const exam = await session.scheduleExam();
    
    if (exam) {
      await sendExamNotifications(session, exam);
    }
    
    const updatedSession = await TrainingSession.findById(req.params.id).populate('scheduledExam');
    
    res.status(201).json({ message: 'Exam created', session: updatedSession, exam: exam });
  } catch (err) {
    res.status(500).json({ message: 'Error creating exam: ' + err.message });
  }
});

module.exports = router;