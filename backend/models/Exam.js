const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingSession', required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  isOnline: { type: Boolean, required: true },
  onlineLink: { type: String },
  location: { type: String },
  createdBy: { type: String, required: true },
  assignedExaminer:  { type: String, required: true },
  duration: { type: Number, required: true },
});

module.exports = mongoose.model('Exam', examSchema);
