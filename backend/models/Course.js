const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  title: String,
  description: String,
  teacherId: String, // keycloakId
});

module.exports = mongoose.model('Course', CourseSchema);
