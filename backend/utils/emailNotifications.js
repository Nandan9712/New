const Enrollment = require('../models/Enrollment');
const { sendEmail } = require('./emailService');

// Function to send exam notifications to enrolled students AND examiner
async function sendExamNotifications(session, exam) {
  try {
    // Get all enrolled students for this session
    const enrollments = await Enrollment.find({ sessionId: session._id });
    
    if (enrollments.length === 0) {
      console.log('No enrolled students to notify for exam');
      return;
    }

    const examDate = new Date(exam.date);
    const formattedDate = examDate.toLocaleDateString();
    const formattedTime = examDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Send email to each enrolled student
    for (const enrollment of enrollments) {
      try {
        await sendEmail({
          to: 'vani.chillale@gmail.com',
          subject: `Exam Scheduled: ${session.title}`,
          html: `
            <h2>Exam Scheduled</h2>
            <p>An exam has been scheduled for the session: <strong>${session.title}</strong></p>
            <p><strong>Exam Date:</strong> ${formattedDate}</p>
            <p><strong>Exam Time:</strong> ${formattedTime}</p>
            <p><strong>Duration:</strong> ${exam.duration} minutes</p>
            <p><strong>Total Marks:</strong> ${exam.totalMarks}</p>
            ${exam.instructions ? `<p><strong>Instructions:</strong> ${exam.instructions}</p>` : ''}
            <br>
            <p>Please make sure to attend the exam on time.</p>
            <p>Best regards,<br>Training Team</p>
          `
        });
        console.log(`Exam notification sent to: ${enrollment.studentEmail}`);
      } catch (emailError) {
        console.error(`Failed to send exam email to ${enrollment.studentEmail}:`, emailError);
      }
    }

    // Also send email to examiner (session creator)
    try {
      await sendEmail({
        to: 'vani.chillale@gmail.com',
        subject: `EXAMINER FOR : ${session.title}`,
        html: `
          <p>Your examiner for the session "<strong>${session.title}</strong>" has been scheduled successfully.</p>
          <p><strong>Exam Date:</strong> ${formattedDate}</p>
          <p><strong>Exam Time:</strong> ${formattedTime}</p>
          <p><strong>Duration:</strong> ${exam.duration} minutes</p>
          <p><strong>Total Marks:</strong> ${exam.totalMarks}</p>
          <p><strong>Students Notified:</strong> ${enrollments.length} students</p>
          <br>
          <p>Exam notifications have been sent to all enrolled students.</p>
        `
      });
      console.log(`Exam confirmation sent to examiner: ${session.createdBy}`);
    } catch (examinerEmailError) {
      console.error(`Failed to send exam confirmation to examiner:`, examinerEmailError);
    }
  } catch (error) {
    console.error('Error sending exam notifications:', error);
  }
}

// Function to send enrollment confirmation to student AND teacher
async function sendEnrollmentNotifications(session, studentEmail, studentName) {
  try {
    const sessionDates = session.classDates.map(slot => 
      `${new Date(slot.date).toLocaleDateString()} at ${slot.time} (${slot.durationFormatted})`
    ).join('<br>');

    // 1. Send confirmation to student
    await sendEmail({
      to: 'vani.chillale@gmail.com',
      subject: `Enrollment Confirmation: ${session.title}`,
      html: `
        <h2>Enrollment Confirmed ✅</h2>
        <p>Dear <strong>${studentName}</strong>,</p>
        <p>You have been successfully enrolled in the session: <strong>${session.title}</strong></p>
        <p><strong>Session Description:</strong> ${session.description}</p>
        <p><strong>Session Schedule:</strong><br>${sessionDates}</p>
        <p><strong>Mode:</strong> ${session.isLive ? 'Live' : 'Online'}</p>
        ${session.isLive ? `<p><strong>Location:</strong> ${session.location}</p>` : ''}
        ${!session.isLive && session.zoomLink ? `<p><strong>Zoom Link:</strong> ${session.zoomLink}</p>` : ''}
        <br>
        <p>We will notify you when exams are scheduled for this session.</p>
        <p>Best regards,<br>Training Team</p>
      `
    });
    console.log(`Enrollment confirmation sent to student: ${studentEmail}`);

    // 2. Send notification to teacher
    await sendEmail({
      to: 'vani.chillale@gmail.com',
      subject: `New Student Enrollment: ${session.title}`,
      html: `
        <h2>New Student Enrollment</h2>
        <p>A new student has enrolled in your session: <strong>${session.title}</strong></p>
        <p><strong>Student Name:</strong> ${studentName}</p>
        <p><strong>Student Email:</strong> ${studentEmail}</p>
        <p><strong>Enrollment Time:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Total Enrollments:</strong> ${session.enrolledStudents ? session.enrolledStudents.length : 0} students</p>
        <br>
        <p>Session details:</p>
        <p><strong>Schedule:</strong><br>${sessionDates}</p>
        <p><strong>Mode:</strong> ${session.isLive ? 'Live' : 'Online'}</p>
      `
    });
    console.log(`Enrollment notification sent to teacher: ${session.createdBy}`);

  } catch (emailError) {
    console.error(`Failed to send enrollment emails:`, emailError);
  }
}

module.exports = {
  sendExamNotifications,
  sendEnrollmentNotifications
};