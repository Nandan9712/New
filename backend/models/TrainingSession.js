const mongoose = require('mongoose');

const classDateSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  time: { type: String, required: true },
  duration: { type: Number, required: true },
  durationFormatted: { type: String }
});

const trainingSessionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  zoomLink: { type: String },
  location: { type: String },
  classDates: [classDateSchema],
  isLive: { type: Boolean, default: false },
  createdBy: { type: String, required: true },
  enrolledStudents: [{ type: String, default: [] }],
  recurringWeeks: { type: Number, default: 1 },
  scheduledExam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
  examScheduled: { type: Boolean, default: false }
}, { timestamps: true });

trainingSessionSchema.methods.getLastSessionDate = function() {
  if (!this.classDates || this.classDates.length === 0) return null;
  const sortedDates = this.classDates.map(slot => new Date(slot.date)).sort((a, b) => b - a);
  return sortedDates[0];
};

trainingSessionSchema.methods.assignExaminer = async function(examDate, examTime, examDuration) {
  try {
    const Availability = mongoose.model('Availability');
    const Exam = mongoose.model('Exam');
    
    console.log('Starting examiner assignment...');
    console.log('Exam Date:', examDate);
    console.log('Exam Time:', examTime);
    console.log('Exam Duration:', examDuration);
    
    const [hours, minutes] = examTime.split(':').map(Number);
    const examStart = new Date(examDate);
    examStart.setHours(hours, minutes, 0, 0);
    const examEnd = new Date(examStart.getTime() + examDuration * 60000);
    
    console.log('Exam Start:', examStart);
    console.log('Exam End:', examEnd);
    
    // Find all examiners who are available during this time
    const availableExaminers = await Availability.find({
      availableFrom: { $lte: examStart },
      availableTo: { $gte: examEnd }
    });
    
    console.log('Available examiners found:', availableExaminers.length);
    
    if (availableExaminers.length === 0) {
      console.log('No examiners available for this time slot');
      // Return a default examiner or null to indicate no assignment
      return {
        examinerId: null,
        examinerName: 'To be assigned',
        examinerEmail: '',
        assignmentReason: 'No examiners available for this time slot'
      };
    }
    
    // Check each examiner's workload for the day
    const examinerWorkloads = [];
    
    for (const availability of availableExaminers) {
      const startOfDay = new Date(examDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(examDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      const examCount = await Exam.countDocuments({
        assignedExaminerId: availability.examinerId,
        date: { 
          $gte: startOfDay, 
          $lte: endOfDay 
        },
        status: 'scheduled'
      });
      
      examinerWorkloads.push({
        availability,
        examCount,
        maxExams: availability.maxExamsPerDay || 3,
        priority: availability.priority || 1
      });
    }
    
    console.log('Examiner workloads:', examinerWorkloads.map(e => ({
      name: e.availability.examinerName,
      exams: e.examCount,
      max: e.maxExams
    })));
    
    // Filter examiners who haven't reached their daily limit
    const eligibleExaminers = examinerWorkloads.filter(
      workload => workload.examCount < workload.maxExams
    );
    
    console.log('Eligible examiners after workload check:', eligibleExaminers.length);
    
    if (eligibleExaminers.length === 0) {
      console.log('All available examiners have reached their daily limit');
      return {
        examinerId: null,
        examinerName: 'To be assigned',
        examinerEmail: '',
        assignmentReason: 'All available examiners have reached their daily limit'
      };
    }
    
    // Sort by priority (lower first) and then by exam count (lower first)
    eligibleExaminers.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority; // Lower priority number = higher priority
      }
      return a.examCount - b.examCount; // Fewer exams = higher priority
    });
    
    const selectedExaminer = eligibleExaminers[0];
    console.log('Selected examiner:', selectedExaminer.availability.examinerName);
    console.log('Selected examiner workload:', selectedExaminer.examCount, '/', selectedExaminer.maxExams);
    
    return {
      examinerId: selectedExaminer.availability.examinerId,
      examinerName: selectedExaminer.availability.examinerName,
      examinerEmail: selectedExaminer.availability.examinerEmail,
      assignmentReason: `Automatically assigned: Priority ${selectedExaminer.priority}, Current load: ${selectedExaminer.examCount}/${selectedExaminer.maxExams} exams today`
    };
    
  } catch (error) {
    console.error('Error in assignExaminer method:', error);
    // Return default values in case of error
    return {
      examinerId: null,
      examinerName: 'To be assigned',
      examinerEmail: '',
      assignmentReason: 'Error during automatic assignment: ' + error.message
    };
  }
};

trainingSessionSchema.methods.scheduleExam = async function() {
  try {
    console.log('=== STARTING EXAM SCHEDULING PROCESS ===');
    console.log('Session Title:', this.title);
    console.log('Session ID:', this._id);
    
    const lastSessionDate = this.getLastSessionDate();
    if (!lastSessionDate) {
      throw new Error('No class dates available to schedule exam');
    }

    // Calculate exam date (1 week after last session)
    const examDate = new Date(lastSessionDate);
    examDate.setDate(examDate.getDate() + 7);
    
    console.log('Last session date:', lastSessionDate);
    console.log('Calculated exam date:', examDate);

    // Use the same time as the last session
    const lastSession = this.classDates.reduce((latest, current) => {
      const currentDate = new Date(current.date);
      return currentDate > latest.date ? { date: currentDate, data: current } : latest;
    }, { date: new Date(0), data: null }).data;

    if (!lastSession) {
      throw new Error('Could not find last session data');
    }

    console.log('Last session time:', lastSession.time);
    console.log('Last session duration:', lastSession.duration);

    const Exam = mongoose.model('Exam');
    
    // Automatically assign examiner
    console.log('Calling assignExaminer...');
    const examinerAssignment = await this.assignExaminer(examDate, lastSession.time, lastSession.duration);
    console.log('Examiner assignment result:', examinerAssignment);
    
    const examData = {
      sessionId: this._id,
      date: examDate,
      time: lastSession.time,
      duration: lastSession.duration,
      isOnline: !this.isLive,
      onlineLink: this.isLive ? '' : (this.zoomLink || 'To be provided'),
      location: this.isLive ? (this.location || 'To be determined') : 'Online',
      createdBy: this.createdBy,
      assignedExaminer: examinerAssignment.examinerName,
      assignedExaminerName: examinerAssignment.examinerName,
      assignedExaminerId: examinerAssignment.examinerId,
      assignedExaminerEmail: examinerAssignment.examinerEmail,
      assignmentReason: examinerAssignment.assignmentReason
    };

    console.log('Final exam data:', examData);

    const exam = new Exam(examData);
    await exam.save();
    
    // Update the session with exam reference
    this.scheduledExam = exam._id;
    this.examScheduled = true;
    await this.save();
    
    console.log('=== EXAM SCHEDULING COMPLETED SUCCESSFULLY ===');
    return exam;
    
  } catch (error) {
    console.error('=== EXAM SCHEDULING FAILED ===');
    console.error('Error in scheduleExam method:', error);
    
    // Create exam with "To be assigned" if automatic assignment fails
    try {
      const Exam = mongoose.model('Exam');
      const lastSessionDate = this.getLastSessionDate();
      const examDate = new Date(lastSessionDate);
      examDate.setDate(examDate.getDate() + 7);
      
      const lastSession = this.classDates.reduce((latest, current) => {
        const currentDate = new Date(current.date);
        return currentDate > latest.date ? { date: currentDate, data: current } : latest;
      }, { date: new Date(0), data: null }).data;

      const examData = {
        sessionId: this._id,
        date: examDate,
        time: lastSession.time,
        duration: lastSession.duration,
        isOnline: !this.isLive,
        onlineLink: this.isLive ? '' : (this.zoomLink || 'To be provided'),
        location: this.isLive ? (this.location || 'To be determined') : 'Online',
        createdBy: this.createdBy,
        assignedExaminer: 'To be assigned',
        assignedExaminerName: 'To be assigned',
        assignmentReason: 'Automatic assignment failed: ' + error.message
      };

      const exam = new Exam(examData);
      await exam.save();
      
      this.scheduledExam = exam._id;
      this.examScheduled = true;
      await this.save();
      
      console.log('Created exam with fallback assignment');
      return exam;
      
    } catch (fallbackError) {
      console.error('Fallback exam creation also failed:', fallbackError);
      throw error;
    }
  }
};

trainingSessionSchema.pre('save', function(next) {
  if (this.classDates && this.classDates.length > 0) {
    this.classDates.forEach(slot => {
      if (slot.duration && !slot.durationFormatted) {
        const hours = Math.floor(slot.duration / 60);
        const minutes = slot.duration % 60;
        slot.durationFormatted = `${hours}hr ${minutes}min`;
      }
    });
  }
  next();
});

trainingSessionSchema.post('save', async function(doc) {
  try {
    if (doc.isNew && !doc.examScheduled && doc.classDates && doc.classDates.length > 0) {
      console.log('Auto-scheduling exam for new training session:', doc.title);
      
      // Add a delay to ensure the document is fully saved
      setTimeout(async () => {
        try {
          const freshDoc = await mongoose.model('TrainingSession').findById(doc._id);
          if (freshDoc && !freshDoc.examScheduled) {
            console.log('Starting automatic exam scheduling...');
            await freshDoc.scheduleExam();
            console.log('Automatic exam scheduling completed for:', freshDoc.title);
          }
        } catch (error) {
          console.error('Error in post-save exam scheduling:', error);
        }
      }, 2000); // Increased delay to 2 seconds
    }
  } catch (error) {
    console.error('Error in post-save hook:', error);
  }
});

module.exports = mongoose.model('TrainingSession', trainingSessionSchema);