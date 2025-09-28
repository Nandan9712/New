const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  examinerId: { type: String, required: true },
  examinerName: { type: String, required: true },
  examinerEmail: { type: String, required: true },
  availableFrom: { type: Date, required: true },
  availableTo: { type: Date, required: true },
  maxExamsPerDay: { type: Number, default: 3 },
  priority: { type: Number, default: 1 }
}, { timestamps: true });

availabilitySchema.index({ examinerId: 1 });
availabilitySchema.index({ availableFrom: 1, availableTo: 1 });

module.exports = mongoose.model('Availability', availabilitySchema);