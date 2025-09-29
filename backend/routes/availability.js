const express = require('express');
const router = express.Router();
const Availability = require('../models/Availability');
const Exam = require('../models/Exam');

const requireAuth = async (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = req.headers.authorization.split(' ')[1];
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    // Extract user information from Keycloak token
    req.user = { 
      id: decoded.sub, // User ID
      // Use preferred_username as fallback for name and email
      email: decoded.email || decoded.preferred_username || `${decoded.sub}@university.edu`,
      name: decoded.name || decoded.preferred_username || decoded.sub
    };
    
    console.log('User info from token:', {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name
    });
    
    next();
  } catch (err) {
    console.error('Authorization error:', err);
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// Create availability
router.post('/', requireAuth, async (req, res) => {
  try {
    const { availableFrom, availableTo, maxExamsPerDay, priority } = req.body;
    
    if (!availableFrom || !availableTo) {
      return res.status(400).json({ message: 'Both availableFrom and availableTo are required' });
    }

    const newFrom = new Date(availableFrom);
    const newTo = new Date(availableTo);

    if (newTo <= newFrom) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    // Check for overlapping availabilities
    const overlapping = await Availability.findOne({
      examinerId: req.user.id,
      $or: [
        { 
          availableFrom: { $lt: newTo }, 
          availableTo: { $gt: newFrom } 
        }
      ]
    });

    if (overlapping) {
      return res.status(400).json({ 
        message: 'This availability overlaps with an existing one',
        conflictingAvailability: overlapping
      });
    }

    // Create availability with user info from Keycloak token
    const availability = new Availability({
      examinerId: req.user.id,
      examinerName: req.user.name,
      examinerEmail: req.user.email,
      availableFrom: newFrom,
      availableTo: newTo,
      maxExamsPerDay: maxExamsPerDay || 3,
      priority: priority || 1
    });

    await availability.save();
    
    console.log('Availability created successfully:', {
      id: availability._id,
      examinerName: availability.examinerName,
      examinerEmail: availability.examinerEmail,
      from: availability.availableFrom,
      to: availability.availableTo
    });
    
    res.status(201).json(availability);
  } catch (err) {
    console.error('Error creating availability:', err);
    
    // Handle validation errors specifically
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors 
      });
    }
    
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my availabilities
router.get('/mine', requireAuth, async (req, res) => {
  try {
    console.log('Fetching availabilities for user:', req.user.id, req.user.name);
    
    const availabilities = await Availability.find({ examinerId: req.user.id }).sort({ availableFrom: 1 });
    
    console.log(`Found ${availabilities.length} availabilities for user ${req.user.name}`);
    
    res.json(availabilities);
  } catch (err) {
    console.error('Error fetching availabilities:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all availabilities (for admin/debugging)
router.get('/', requireAuth, async (req, res) => {
  try {
    const availabilities = await Availability.find().sort({ availableFrom: 1 });
    res.json(availabilities);
  } catch (err) {
    console.error('Error fetching all availabilities:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get available examiners for a specific time slot
router.get('/available-examiners', requireAuth, async (req, res) => {
  try {
    const { date, time, duration } = req.query;
    
    if (!date || !time || !duration) {
      return res.status(400).json({ message: 'Date, time, and duration are required' });
    }

    const [hours, minutes] = time.split(':').map(Number);
    const slotStart = new Date(date);
    slotStart.setHours(hours, minutes, 0, 0);
    const slotEnd = new Date(slotStart.getTime() + parseInt(duration) * 60000);

    // Find available examiners
    const availableExaminers = await Availability.find({
      availableFrom: { $lte: slotStart },
      availableTo: { $gte: slotEnd }
    });

    // Get workload for each examiner
    const examinersWithWorkload = await Promise.all(
      availableExaminers.map(async (availability) => {
        const startOfDay = new Date(slotStart);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(slotStart);
        endOfDay.setHours(23, 59, 59, 999);
        
        const examCount = await Exam.countDocuments({
          assignedExaminerId: availability.examinerId,
          date: { $gte: startOfDay, $lte: endOfDay },
          status: 'scheduled'
        });

        return {
          examinerId: availability.examinerId,
          examinerName: availability.examinerName,
          examinerEmail: availability.examinerEmail,
          currentExams: examCount,
          maxExams: availability.maxExamsPerDay,
          priority: availability.priority,
          available: examCount < availability.maxExamsPerDay
        };
      })
    );

    res.json({
      slotStart: slotStart.toISOString(),
      slotEnd: slotEnd.toISOString(),
      availableExaminers: examinersWithWorkload.filter(e => e.available),
      allExaminers: examinersWithWorkload
    });
  } catch (err) {
    console.error('Error fetching available examiners:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update availability
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { availableFrom, availableTo } = req.body;
    
    if (!availableFrom || !availableTo) {
      return res.status(400).json({ message: 'Both availableFrom and availableTo are required' });
    }

    const newFrom = new Date(availableFrom);
    const newTo = new Date(availableTo);

    if (newTo <= newFrom) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    // Check for overlapping availabilities (excluding the current one)
    const overlapping = await Availability.findOne({
      _id: { $ne: req.params.id },
      examinerId: req.user.id,
      $or: [
        { 
          availableFrom: { $lt: newTo }, 
          availableTo: { $gt: newFrom } 
        }
      ]
    });

    if (overlapping) {
      return res.status(400).json({ 
        message: 'This availability overlaps with an existing one',
        conflictingAvailability: overlapping
      });
    }

    const availability = await Availability.findOneAndUpdate(
      { _id: req.params.id, examinerId: req.user.id },
      { 
        availableFrom: newFrom,
        availableTo: newTo,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    if (!availability) {
      return res.status(404).json({ message: 'Availability not found or not yours' });
    }

    res.json(availability);
  } catch (err) {
    console.error('Error updating availability:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update specific day within availability range
// Update specific day within availability range - FIXED VERSION
// Update specific day within availability range - FIXED TIMEZONE VERSION
router.put('/:id/day', requireAuth, async (req, res) => {
  try {
    const { targetDate, newFromTime, newToTime } = req.body;
    
    console.log('Updating day:', { targetDate, newFromTime, newToTime });
    
    if (!targetDate || !newFromTime || !newToTime) {
      return res.status(400).json({ message: 'Target date and new time range are required' });
    }

    // Find the availability to modify
    const originalAvailability = await Availability.findOne({
      _id: req.params.id,
      examinerId: req.user.id
    });

    if (!originalAvailability) {
      return res.status(404).json({ message: 'Availability not found or not yours' });
    }

    // Parse target date in local timezone (not UTC)
    const targetDay = new Date(targetDate + 'T00:00:00'); // Use local time
    const rangeStart = new Date(originalAvailability.availableFrom);
    const rangeEnd = new Date(originalAvailability.availableTo);

    console.log('Original availability range:', {
      from: rangeStart.toISOString(),
      to: rangeEnd.toISOString(),
      fromLocal: rangeStart.toLocaleString('en-IN'), // Indian timezone
      toLocal: rangeEnd.toLocaleString('en-IN'),
      target: targetDay.toISOString(),
      targetLocal: targetDay.toLocaleString('en-IN')
    });

    // Normalize dates for comparison - use local date parts only
    const targetDayStart = new Date(targetDate + 'T00:00:00');
    const targetDayEnd = new Date(targetDate + 'T23:59:59.999');
    
    const rangeStartDate = new Date(rangeStart);
    rangeStartDate.setHours(0, 0, 0, 0);
    
    const rangeEndDate = new Date(rangeEnd);
    rangeEndDate.setHours(23, 59, 59, 999);

    console.log('Normalized dates for comparison:', {
      targetDayStart: targetDayStart.toISOString(),
      targetDayEnd: targetDayEnd.toISOString(),
      targetDayStartLocal: targetDayStart.toLocaleString('en-IN'),
      targetDayEndLocal: targetDayEnd.toLocaleString('en-IN'),
      rangeStartDate: rangeStartDate.toISOString(),
      rangeEndDate: rangeEndDate.toISOString(),
      rangeStartLocal: rangeStartDate.toLocaleString('en-IN'),
      rangeEndLocal: rangeEndDate.toLocaleString('en-IN')
    });

    // Check if target date is within the original range
    // Compare timestamps to avoid timezone issues
    if (targetDayStart.getTime() < rangeStartDate.getTime() || targetDayStart.getTime() > rangeEndDate.getTime()) {
      return res.status(400).json({ 
        message: 'Target date is not within the availability range',
        details: {
          targetDate: targetDayStart.toLocaleDateString('en-IN'),
          targetTimestamp: targetDayStart.getTime(),
          availabilityStart: rangeStartDate.toLocaleDateString('en-IN'),
          availabilityStartTimestamp: rangeStartDate.getTime(),
          availabilityEnd: rangeEndDate.toLocaleDateString('en-IN'),
          availabilityEndTimestamp: rangeEndDate.getTime()
        }
      });
    }

    // Create new time for the target day in local timezone
    const newFrom = new Date(targetDate + 'T' + newFromTime + ':00');
    const newTo = new Date(targetDate + 'T' + newToTime + ':00');

    // Validate the times
    if (newTo <= newFrom) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    console.log('New time range for the day:', {
      newFrom: newFrom.toISOString(),
      newTo: newTo.toISOString(),
      newFromLocal: newFrom.toLocaleString('en-IN'),
      newToLocal: newTo.toLocaleString('en-IN')
    });

    // If it's a single day availability, just update it
    const rangeStartLocal = new Date(rangeStart);
    rangeStartLocal.setHours(0, 0, 0, 0);
    const rangeEndLocal = new Date(rangeEnd);
    rangeEndLocal.setHours(23, 59, 59, 999);
    
    const isSingleDay = rangeStartLocal.getTime() === rangeEndLocal.getTime();
    if (isSingleDay) {
      console.log('Updating single day availability');
      const updatedAvailability = await Availability.findOneAndUpdate(
        { _id: req.params.id, examinerId: req.user.id },
        { 
          availableFrom: newFrom,
          availableTo: newTo,
          updatedAt: new Date()
        },
        { new: true }
      );
      
      return res.json({
        message: 'Single day availability updated successfully',
        availability: updatedAvailability
      });
    }

    console.log('Splitting multi-day availability');
    // For multi-day range, split into parts
    const availabilitiesToCreate = [];

    // Part before the modified day (if any)
    const dayBefore = new Date(targetDayStart);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(23, 59, 59, 999);
    
    if (rangeStart < dayBefore) {
      availabilitiesToCreate.push({
        examinerId: req.user.id,
        examinerName: req.user.name,
        examinerEmail: req.user.email,
        availableFrom: rangeStart,
        availableTo: dayBefore
      });
      console.log('Added part before target day:', {
        from: rangeStart.toLocaleString('en-IN'),
        to: dayBefore.toLocaleString('en-IN')
      });
    }

    // The modified day
    availabilitiesToCreate.push({
      examinerId: req.user.id,
      examinerName: req.user.name,
      examinerEmail: req.user.email,
      availableFrom: newFrom,
      availableTo: newTo
    });
    console.log('Added modified target day:', {
      from: newFrom.toLocaleString('en-IN'),
      to: newTo.toLocaleString('en-IN')
    });

    // Part after the modified day (if any)
    const dayAfter = new Date(targetDayStart);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dayAfter.setHours(0, 0, 0, 0);
    
    if (dayAfter < rangeEnd) {
      availabilitiesToCreate.push({
        examinerId: req.user.id,
        examinerName: req.user.name,
        examinerEmail: req.user.email,
        availableFrom: dayAfter,
        availableTo: rangeEnd
      });
      console.log('Added part after target day:', {
        from: dayAfter.toLocaleString('en-IN'),
        to: rangeEnd.toLocaleString('en-IN')
      });
    }

    // Check for overlaps with other availabilities (excluding the original)
    for (const availability of availabilitiesToCreate) {
      const overlapping = await Availability.findOne({
        _id: { $ne: req.params.id },
        examinerId: req.user.id,
        $or: [
          { 
            availableFrom: { $lt: availability.availableTo }, 
            availableTo: { $gt: availability.availableFrom } 
          }
        ]
      });

      if (overlapping) {
        return res.status(400).json({ 
          message: 'The modified availability overlaps with an existing one',
          conflictingAvailability: overlapping
        });
      }
    }

    // Delete the original availability
    await Availability.findByIdAndDelete(req.params.id);

    // Create the new split availabilities
    const createdAvailabilities = [];
    for (const availabilityData of availabilitiesToCreate) {
      // Only create if the duration is valid (at least 1 minute)
      if (availabilityData.availableFrom < availabilityData.availableTo) {
        const availability = new Availability(availabilityData);
        await availability.save();
        createdAvailabilities.push(availability);
        console.log('Created new availability:', {
          from: availabilityData.availableFrom.toLocaleString('en-IN'),
          to: availabilityData.availableTo.toLocaleString('en-IN')
        });
      } else {
        console.log('Skipping invalid duration availability');
      }
    }

    res.json({
      message: 'Day availability updated successfully',
      originalAvailability: {
        _id: originalAvailability._id,
        availableFrom: originalAvailability.availableFrom,
        availableTo: originalAvailability.availableTo,
        availableFromLocal: originalAvailability.availableFrom.toLocaleString('en-IN'),
        availableToLocal: originalAvailability.availableTo.toLocaleString('en-IN')
      },
      newAvailabilities: createdAvailabilities.map(avail => ({
        _id: avail._id,
        availableFrom: avail.availableFrom,
        availableTo: avail.availableTo,
        availableFromLocal: avail.availableFrom.toLocaleString('en-IN'),
        availableToLocal: avail.availableTo.toLocaleString('en-IN')
      }))
    });
  } catch (err) {
    console.error('Error updating availability day:', err);
    res.status(500).json({ 
      message: 'Server error: ' + err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});
// Delete specific day from availability range
// Delete specific day from availability range - FIXED VERSION
router.delete('/:id/day', requireAuth, async (req, res) => {
  try {
    const { targetDate } = req.body;
    
    console.log('Deleting day:', { targetDate });
    
    if (!targetDate) {
      return res.status(400).json({ message: 'Target date is required' });
    }

    // Find the availability to modify
    const originalAvailability = await Availability.findOne({
      _id: req.params.id,
      examinerId: req.user.id
    });

    if (!originalAvailability) {
      return res.status(404).json({ message: 'Availability not found or not yours' });
    }

    const targetDay = new Date(targetDate);
    const rangeStart = new Date(originalAvailability.availableFrom);
    const rangeEnd = new Date(originalAvailability.availableTo);

    // Normalize dates for comparison
    const targetDayStart = new Date(targetDay);
    targetDayStart.setHours(0, 0, 0, 0);
    
    const rangeStartDate = new Date(rangeStart);
    rangeStartDate.setHours(0, 0, 0, 0);
    
    const rangeEndDate = new Date(rangeEnd);
    rangeEndDate.setHours(23, 59, 59, 999);

    // Check if target date is within the original range
    if (targetDayStart < rangeStartDate || targetDayStart > rangeEndDate) {
      return res.status(400).json({ 
        message: 'Target date is not within the availability range',
        details: {
          targetDate: targetDayStart.toISOString(),
          availabilityStart: rangeStartDate.toISOString(),
          availabilityEnd: rangeEndDate.toISOString()
        }
      });
    }

    // If it's a single day availability, just delete it
    const isSingleDay = rangeStartDate.getTime() === rangeEndDate.getTime();
    if (isSingleDay) {
      await Availability.findByIdAndDelete(req.params.id);
      return res.json({
        message: 'Single day availability deleted successfully',
        deletedAvailability: originalAvailability
      });
    }

    const availabilitiesToCreate = [];

    // Part before the deleted day
    const dayBefore = new Date(targetDay);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(23, 59, 59, 999);

    if (rangeStart <= dayBefore) {
      availabilitiesToCreate.push({
        examinerId: req.user.id,
        examinerName: req.user.name,
        examinerEmail: req.user.email,
        availableFrom: rangeStart,
        availableTo: dayBefore
      });
    }

    // Part after the deleted day
    const dayAfter = new Date(targetDay);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dayAfter.setHours(0, 0, 0, 0);

    if (dayAfter <= rangeEnd) {
      availabilitiesToCreate.push({
        examinerId: req.user.id,
        examinerName: req.user.name,
        examinerEmail: req.user.email,
        availableFrom: dayAfter,
        availableTo: rangeEnd
      });
    }

    // Delete the original availability
    await Availability.findByIdAndDelete(req.params.id);

    // Create the new split availabilities
    const createdAvailabilities = [];
    for (const availabilityData of availabilitiesToCreate) {
      // Only create if the duration is valid
      if (availabilityData.availableFrom < availabilityData.availableTo) {
        const availability = new Availability(availabilityData);
        await availability.save();
        createdAvailabilities.push(availability);
      }
    }

    res.json({
      message: 'Day removed from availability successfully',
      originalAvailability: originalAvailability,
      newAvailabilities: createdAvailabilities
    });
  } catch (err) {
    console.error('Error deleting availability day:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});
// Delete entire availability
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const availability = await Availability.findOneAndDelete({ 
      _id: req.params.id, 
      examinerId: req.user.id 
    });
    
    if (!availability) {
      return res.status(404).json({ message: 'Availability not found or not yours' });
    }
    
    res.json({ message: 'Deleted successfully', deletedAvailability: availability });
  } catch (err) {
    console.error('Error deleting availability:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;