const mongoose = require("mongoose");

const classSessionSchema = new mongoose.Schema({
  teacherEmail: {
    type: String,
    required: true,
  },
  courseTitle: {
    type: String,
    required: true,
  },
  dateTime: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model("ClassSession", classSessionSchema);
