const express = require('express');
const router = express.Router();
const ExaminerSlot = require('../models/ExaminerSlot');
const { protectRole } = require('../keycloak-config'); // Ensure this exists

// POST: Add or update an examiner's availability slot
router.post('/set-availability', protectRole('examiner'), async (req, res) => {
  console.log("🔐 Set Availability called");
  console.log("📥 Request body:", req.body);
    try {
      const { examinerId, examinerName, fromTime, toTime } = req.body;
  
      if (!examinerId || !examinerName || !fromTime || !toTime) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
  
      const existingSlot = await ExaminerSlot.findOne({ examinerId });
  
      if (existingSlot) {
        existingSlot.fromTime = fromTime;
        existingSlot.toTime = toTime;
        await existingSlot.save();
        return res.json({ message: 'Slot updated successfully' });
      }
  
      const newSlot = new ExaminerSlot({ examinerId, examinerName, fromTime, toTime });
      await newSlot.save();
  
      res.status(201).json({ message: 'Slot added successfully' });
    } catch (error) {
      console.error('❌ Error saving examiner slot:', error); // More detailed log
      res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
  });
  

module.exports = router;
