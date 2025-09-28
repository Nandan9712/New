const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  sessionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'TrainingSession', 
    required: true 
  },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  isOnline: { type: Boolean, required: true },
  onlineLink: { type: String, default: '' },
  location: { type: String, default: '' },
  createdBy: { type: String, required: true },
  assignedExaminer: { type: String, default: 'To be assigned' },
  assignedExaminerName: { type: String, default: '' },
  assignedExaminerId: { type: String, default: null },
  assignedExaminerEmail: { type: String, default: '' },
  duration: { type: Number, required: true },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  assignmentReason: { type: String, default: '' }
}, { timestamps: true });

examSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

examSchema.set('toJSON', { virtuals: true });
examSchema.index({ sessionId: 1 });
examSchema.index({ createdBy: 1 });
examSchema.index({ date: 1 });
examSchema.index({ assignedExaminerId: 1 });
examSchema.index({ date: 1, assignedExaminerId: 1 });

module.exports = mongoose.model('Exam', examSchema);