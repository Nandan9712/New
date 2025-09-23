const express = require('express');
const TrainingSession = require('../models/TrainingSession');
const { keycloak } = require('../keycloak-config');
const router = express.Router();

function convertDurationToHrMin(durationInMinutes) {
  const hours = Math.floor(durationInMinutes / 60);
  const minutes = durationInMinutes % 60;
  return `${hours}hr ${minutes}min`;
}

function hasTimeConflict(newSlot, existingSlot) {
  if (new Date(newSlot.date).toDateString() !== new Date(existingSlot.date).toDateString()) {
    return false;
  }

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

router.post('/', keycloak.protect(), async (req, res) => {
  try {
    const { title, description, zoomLink, location, classDates, isLive, recurringWeeks = 1 } = req.body;
    const email = req.user?.email;

    if (!title || !description || !classDates || !Array.isArray(classDates) || classDates.length === 0) {
      return res.status(400).json({ message: 'Missing or invalid required fields' });
    }

    if (isLive && (!location || location.trim() === '')) {
      return res.status(400).json({ message: 'Please enter a valid location for live sessions' });
    }

    const now = new Date();
    const normalizedClassDates = [];
    
    for (const [i, slot] of classDates.entries()) {
      if (!slot.date || !slot.time || !slot.duration) {
        return res.status(400).json({ message: `Missing date, time, or duration in slot ${i + 1}` });
      }

      const normalizedDate = new Date(slot.date).toISOString().split('T')[0];
      const [hours, minutes] = slot.time.split(':').map(Number);
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return res.status(400).json({ message: `Invalid time format (HH:mm) in slot ${i + 1}` });
      }

      if (hours < 6 || (hours >= 18 && minutes > 0)) {
        return res.status(400).json({ message: `Slot ${i + 1} must be between 6:00 AM and 6:00 PM` });
      }

      if (isNaN(slot.duration) || slot.duration <= 0) {
        return res.status(400).json({ message: `Invalid duration in slot ${i + 1}` });
      }

      const slotDateTime = new Date(`${normalizedDate}T${slot.time}`);
      if (slotDateTime < now) {
        return res.status(400).json({ message: `Slot ${i + 1} is in the past` });
      }

      normalizedClassDates.push({
        date: normalizedDate,
        time: slot.time,
        duration: slot.duration
      });
    }

    const existingSessions = await TrainingSession.find({ createdBy: email });
    for (const existingSession of existingSessions) {
      for (const existingSlot of existingSession.classDates) {
        for (const newSlot of normalizedClassDates) {
          if (hasTimeConflict(newSlot, existingSlot)) {
            return res.status(400).json({
              message: `Time conflict with "${existingSession.title}" on ${new Date(existingSlot.date).toLocaleDateString()} from ${existingSlot.time} (${existingSlot.duration} min)`
            });
          }
        }
      }
    }

    for (let i = 0; i < normalizedClassDates.length; i++) {
      for (let j = i + 1; j < normalizedClassDates.length; j++) {
        if (hasTimeConflict(normalizedClassDates[i], normalizedClassDates[j])) {
          return res.status(400).json({
            message: `Time conflict between your slots on ${new Date(normalizedClassDates[i].date).toLocaleDateString()} (${normalizedClassDates[i].time} and ${normalizedClassDates[j].time})`
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
      recurringWeeks
    };

    const newSession = new TrainingSession(sessionData);
    await newSession.save();
    res.status(201).json(newSession);

  } catch (err) {
    console.error('Error creating session:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});



// PUT: Update a session with the same validation
router.put('/:id', keycloak.protect(), async (req, res) => {
  try {
    const { id } = req.params;
    const { classDates, zoomLink, location } = req.body;
    const email = req.user?.email;

    // Validate the updated class dates
    if (classDates && Array.isArray(classDates)) {
      const now = new Date();
      const normalizedClassDates = [];
      
      for (const [i, slot] of classDates.entries()) {
        if (!slot.date || !slot.time || !slot.duration) {
          return res.status(400).json({ message: `Missing date, time, or duration in slot ${i + 1}` });
        }

        // Normalize date to YYYY-MM-DD format
        const normalizedDate = new Date(slot.date).toISOString().split('T')[0];
        const [hours, minutes] = slot.time.split(':').map(Number);
        
        // Validate time format
       if (
  isNaN(hours) || isNaN(minutes) ||
  hours < 0 || hours > 23 || minutes < 0 || minutes > 59
) {
  return res.status(400).json({ message: `Invalid time format (HH:mm) in slot ${i + 1}` });
}

// Enforce time between 6:00 and 18:00
if (hours < 6 || (hours >= 18 && minutes > 0)) {
  return res.status(400).json({ message: `Slot ${i + 1} must be between 6:00 AM and 6:00 PM` });
}


        if (isNaN(slot.duration) || slot.duration <= 0) {
          return res.status(400).json({ message: `Invalid duration in slot ${i + 1}` });
        }

        // Check if slot is in the past
        const slotDateTime = new Date(`${normalizedDate}T${slot.time}`);
        if (slotDateTime < now) {
          return res.status(400).json({ message: `Slot ${i + 1} is in the past` });
        }

        normalizedClassDates.push({
          date: normalizedDate,
          time: slot.time,
          duration: slot.duration
        });
      }

      // Check for conflicts with other sessions (excluding current session)
      const existingSessions = await TrainingSession.find({ 
        createdBy: email,
        _id: { $ne: id }
      });

      for (const existingSession of existingSessions) {
        for (const existingSlot of existingSession.classDates) {
          for (const newSlot of normalizedClassDates) {
            if (hasTimeConflict(newSlot, existingSlot)) {
              return res.status(400).json({
                message: `Time conflict with "${existingSession.title}" on ${new Date(existingSlot.date).toLocaleDateString()} from ${existingSlot.time} (${existingSlot.duration} min)`
              });
            }
          }
        }
      }

      // Check for internal conflicts
      for (let i = 0; i < normalizedClassDates.length; i++) {
        for (let j = i + 1; j < normalizedClassDates.length; j++) {
          if (hasTimeConflict(normalizedClassDates[i], normalizedClassDates[j])) {
            return res.status(400).json({
              message: `Time conflict between your slots on ${new Date(normalizedClassDates[i].date).toLocaleDateString()} (${normalizedClassDates[i].time} and ${normalizedClassDates[j].time})`
            });
          }
        }
      }
    }

    // Update the session
    const updateData = {};
    if (classDates) {
      updateData.classDates = classDates.map(slot => ({
        date: new Date(slot.date).toISOString().split('T')[0],
        time: slot.time,
        duration: slot.duration,
        durationFormatted: convertDurationToHrMin(slot.duration)
      }));
    }
    if (zoomLink) updateData.zoomLink = zoomLink;
    if (location) updateData.location = location;

    const updated = await TrainingSession.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) return res.status(404).json({ message: 'Session not found' });
    res.json(updated);

  } catch (err) {
    console.error('Error updating session:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// GET: Get all training sessions of the logged-in teacher
router.get('/mine', keycloak.protect(), async (req, res) => {
  try {
    const sessions = await TrainingSession.find({ createdBy: req.user.email });
    res.json(sessions);
  } catch (err) {
    console.error('Error fetching sessions:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE: Cancel a session
router.delete('/:id', keycloak.protect(), async (req, res) => {
  try {
    const deleted = await TrainingSession.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Session not found' });
    res.json({ message: 'Session canceled successfully' });
  } catch (err) {
    console.error('Error deleting session:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;