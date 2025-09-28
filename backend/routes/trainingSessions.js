const express = require('express');
const TrainingSession = require('../models/TrainingSession');
const Exam = require('../models/Exam');
const { keycloak } = require('../keycloak-config');
const router = express.Router();

function convertDurationToHrMin(durationInMinutes) {
  const hours = Math.floor(durationInMinutes / 60);
  const minutes = durationInMinutes % 60;
  return `${hours}hr ${minutes}min`;
}

function hasTimeConflict(newSlot, existingSlot) {
  if (new Date(newSlot.date).toDateString() !== new Date(existingSlot.date).toDateString()) return false;
  
  const parseTime = (dateStr, timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(dateStr);
    date.setHours(hours, minutes, 0, 0);
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

    const now = new Date();
    const normalizedClassDates = [];
    
    for (const [i, slot] of classDates.entries()) {
      if (!slot.date || !slot.time || !slot.duration) {
        return res.status(400).json({ message: `Missing data in slot ${i + 1}` });
      }

      const normalizedDate = new Date(slot.date);
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

      const slotDateTime = new Date(normalizedDate);
      slotDateTime.setHours(hours, minutes, 0, 0);
      if (slotDateTime < now) {
        return res.status(400).json({ message: `Slot ${i + 1} is in the past` });
      }

      normalizedClassDates.push({ date: normalizedDate, time: slot.time, duration: slot.duration });
    }

    // Check conflicts
    const existingSessions = await TrainingSession.find({ createdBy: email });
    for (const existingSession of existingSessions) {
      for (const existingSlot of existingSession.classDates) {
        for (const newSlot of normalizedClassDates) {
          if (hasTimeConflict(newSlot, existingSlot)) {
            return res.status(400).json({
              message: `Conflict with "${existingSession.title}" on ${new Date(existingSlot.date).toLocaleDateString()}`
            });
          }
        }
      }
    }

    // Check internal conflicts
    for (let i = 0; i < normalizedClassDates.length; i++) {
      for (let j = i + 1; j < normalizedClassDates.length; j++) {
        if (hasTimeConflict(normalizedClassDates[i], normalizedClassDates[j])) {
          return res.status(400).json({
            message: `Internal conflict on ${new Date(normalizedClassDates[i].date).toLocaleDateString()}`
          });
        }
      }
    }

    const sessionData = {
      title, description, zoomLink, location,
      classDates: normalizedClassDates.map(slot => ({
        date: slot.date, time: slot.time, duration: slot.duration,
        durationFormatted: convertDurationToHrMin(slot.duration)
      })),
      isLive, createdBy: email, recurringWeeks, examScheduled: false
    };

    const newSession = new TrainingSession(sessionData);
    await newSession.save();
    
    let exam;
    try {
      exam = await newSession.scheduleExam();
    } catch (examError) {
      console.error('Exam scheduling failed:', examError);
    }
    
    const sessionWithExam = await TrainingSession.findById(newSession._id).populate('scheduledExam');
    res.status(201).json(sessionWithExam);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Update session
router.put('/:id', keycloak.protect(), async (req, res) => {
  try {
    const { id } = req.params;
    const { classDates, zoomLink, location, title, description, isLive } = req.body;
    const email = req.user?.email;

    const session = await TrainingSession.findById(id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.createdBy !== email) return res.status(403).json({ message: 'Not authorized' });

    if (classDates && Array.isArray(classDates)) {
      const now = new Date();
      const normalizedClassDates = [];
      
      for (const [i, slot] of classDates.entries()) {
        if (!slot.date || !slot.time || !slot.duration) {
          return res.status(400).json({ message: `Missing data in slot ${i + 1}` });
        }

        const normalizedDate = new Date(slot.date);
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

        const slotDateTime = new Date(normalizedDate);
        slotDateTime.setHours(hours, minutes, 0, 0);
        if (slotDateTime < now) return res.status(400).json({ message: `Slot ${i + 1} is in the past` });

        normalizedClassDates.push({ date: normalizedDate, time: slot.time, duration: slot.duration });
      }

      const existingSessions = await TrainingSession.find({ createdBy: email, _id: { $ne: id } });
      for (const existingSession of existingSessions) {
        for (const existingSlot of existingSession.classDates) {
          for (const newSlot of normalizedClassDates) {
            if (hasTimeConflict(newSlot, existingSlot)) {
              return res.status(400).json({ message: `Conflict with existing session` });
            }
          }
        }
      }

      for (let i = 0; i < normalizedClassDates.length; i++) {
        for (let j = i + 1; j < normalizedClassDates.length; j++) {
          if (hasTimeConflict(normalizedClassDates[i], normalizedClassDates[j])) {
            return res.status(400).json({ message: `Internal conflict between slots` });
          }
        }
      }
    }

    const updateData = {};
    if (classDates) {
      updateData.classDates = classDates.map(slot => ({
        date: new Date(slot.date), time: slot.time, duration: slot.duration,
        durationFormatted: convertDurationToHrMin(slot.duration)
      }));
    }
    if (zoomLink !== undefined) updateData.zoomLink = zoomLink;
    if (location !== undefined) updateData.location = location;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (isLive !== undefined) updateData.isLive = isLive;

    const updated = await TrainingSession.findByIdAndUpdate(id, updateData, { new: true }).populate('scheduledExam');
    if (!updated) return res.status(404).json({ message: 'Session not found' });
    
    if (classDates) {
      try {
        if (updated.scheduledExam) await Exam.findByIdAndDelete(updated.scheduledExam);
        await updated.scheduleExam();
        const finalSession = await TrainingSession.findById(id).populate('scheduledExam');
        return res.json(finalSession);
      } catch (error) {
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
    res.json(sessions);
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
    res.json(session);
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
    const updatedSession = await TrainingSession.findById(req.params.id).populate('scheduledExam');
    
    res.status(201).json({ message: 'Exam created', session: updatedSession, exam: exam });
  } catch (err) {
    res.status(500).json({ message: 'Error creating exam: ' + err.message });
  }
});

module.exports = router;