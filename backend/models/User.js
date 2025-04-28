// models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  keycloakId: { type: String, required: true, unique: true }, // store Keycloak user ID
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher', 'examiner'], required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
