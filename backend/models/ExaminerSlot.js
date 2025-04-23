// models/ExaminerSlot.js
const mongoose = require("mongoose");

const examinerSlotSchema = new mongoose.Schema({
  examinerId: {
    type: String,
    required: true,
  },
  examinerName: {
    type: String,
    required: true,
  },
  fromTime: {
    type: Date,
    required: true,
  },
  toTime: {
    type: Date,
    required: true,
  },
});

module.exports = mongoose.model("ExaminerSlot", examinerSlotSchema);
