const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema({
  examinerId: { type: String, required: true }, // examiner's ID or email from Keycloak token
  availableFrom: { type: Date, required: true },
  availableTo: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Availability', availabilitySchema);
