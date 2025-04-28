const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  sessionId:   { type: mongoose.Schema.Types.ObjectId, ref: 'TrainingSession', required: true },
  studentEmail:{ type: String, required: true },
  enrolledAt:  { type: Date, default: Date.now }
});

module.exports = mongoose.model('Enrollment', enrollmentSchema);
