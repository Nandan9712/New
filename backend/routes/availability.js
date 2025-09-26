const express = require('express');
const router = express.Router();
const Availability = require('../models/Availability');

const requireAuth = async (req, res, next) => {
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const token = req.headers.authorization.split(' ')[1];
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    
    req.user = { id: decoded.sub };
    next();
  } catch (err) {
    console.error('Authorization error:', err);
    res.status(401).json({ message: 'Unauthorized' });
  }
};

// Create Availability
router.post('/', requireAuth, async (req, res) => {
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

    const availability = new Availability({
      examinerId: req.user.id,
      availableFrom: newFrom,
      availableTo: newTo
    });

    await availability.save();
    res.status(201).json(availability);
  } catch (err) {
    console.error('Error creating availability:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get my Availabilities
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const availabilities = await Availability.find({ examinerId: req.user.id }).sort({ availableFrom: 1 });
    res.json(availabilities);
  } catch (err) {
    console.error('Error fetching availabilities:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Availability
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

    const targetDay = new Date(targetDate);
    const originalFrom = new Date(originalAvailability.availableFrom);
    const originalTo = new Date(originalAvailability.availableTo);

    // Check if target date is within the original range
    if (targetDay < new Date(originalFrom.setHours(0, 0, 0, 0)) || 
        targetDay > new Date(originalTo.setHours(23, 59, 59, 999))) {
      return res.status(400).json({ message: 'Target date is not within the availability range' });
    }

    // Create new time for the target day
    const newFrom = new Date(targetDate);
    const [fromHours, fromMinutes] = newFromTime.split(':');
    newFrom.setHours(parseInt(fromHours), parseInt(fromMinutes), 0, 0);

    const newTo = new Date(targetDate);
    const [toHours, toMinutes] = newToTime.split(':');
    newTo.setHours(parseInt(toHours), parseInt(toMinutes), 0, 0);

    if (newTo <= newFrom) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    // If it's a single day availability, just update it
    const isSingleDay = originalFrom.toDateString() === originalTo.toDateString();
    if (isSingleDay) {
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

    // For multi-day range, split into parts
    const availabilitiesToCreate = [];

    // Part before the modified day (if any)
    const dayBefore = new Date(targetDay);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(23, 59, 59, 999);
    
    if (originalFrom < dayBefore) {
      availabilitiesToCreate.push({
        examinerId: req.user.id,
        availableFrom: originalFrom,
        availableTo: dayBefore
      });
    }

    // The modified day
    availabilitiesToCreate.push({
      examinerId: req.user.id,
      availableFrom: newFrom,
      availableTo: newTo
    });

    // Part after the modified day (if any)
    const dayAfter = new Date(targetDay);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dayAfter.setHours(0, 0, 0, 0);
    
    if (dayAfter < originalTo) {
      availabilitiesToCreate.push({
        examinerId: req.user.id,
        availableFrom: dayAfter,
        availableTo: originalTo
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
      // Only create if the duration is valid
      if (availabilityData.availableFrom < availabilityData.availableTo) {
        const availability = new Availability(availabilityData);
        await availability.save();
        createdAvailabilities.push(availability);
      }
    }

    res.json({
      message: 'Day availability updated successfully',
      originalAvailability: originalAvailability,
      newAvailabilities: createdAvailabilities
    });
  } catch (err) {
    console.error('Error updating availability day:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Delete specific day from availability range
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
    const originalFrom = new Date(originalAvailability.availableFrom);
    const originalTo = new Date(originalAvailability.availableTo);

    // Check if target date is within the original range
    if (targetDay < new Date(originalFrom.setHours(0, 0, 0, 0)) || 
        targetDay > new Date(originalTo.setHours(23, 59, 59, 999))) {
      return res.status(400).json({ message: 'Target date is not within the availability range' });
    }

    // If it's a single day availability, just delete it
    const isSingleDay = originalFrom.toDateString() === originalTo.toDateString();
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

    if (originalFrom <= dayBefore) {
      availabilitiesToCreate.push({
        examinerId: req.user.id,
        availableFrom: originalFrom,
        availableTo: dayBefore
      });
    }

    // Part after the deleted day
    const dayAfter = new Date(targetDay);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dayAfter.setHours(0, 0, 0, 0);

    if (dayAfter <= originalTo) {
      availabilitiesToCreate.push({
        examinerId: req.user.id,
        availableFrom: dayAfter,
        availableTo: originalTo
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