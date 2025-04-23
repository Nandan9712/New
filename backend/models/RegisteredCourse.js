const mongoose = require('mongoose');

const registeredCourseSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  courseTitle: { type: String, required: true },
  teacherEmail: { type: String, required: true }
 
});

const RegisteredCourse = mongoose.model('RegisteredCourse', registeredCourseSchema);

module.exports = RegisteredCourse;
