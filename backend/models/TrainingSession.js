// models/TrainingSession.js
const mongoose = require('mongoose');

const classDateSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  time: { type: String, required: true },  // Format: "HH:mm" (e.g., "14:30")
});

const trainingSessionSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  zoomLink:    { type: String },
  classDates:  [classDateSchema],  // Updated to use `classDateSchema`
  isLive:      { type: Boolean, default: false },
  createdBy:   { type: String, required: true },   // Using plain string for teacher name/email
  enrolledStudents: [{ type: String, default: [] }],
}, { timestamps: true });

module.exports = mongoose.model('TrainingSession', trainingSessionSchema);
