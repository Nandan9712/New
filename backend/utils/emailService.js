const nodemailer = require('nodemailer');
require('dotenv').config();

// Verify .env is loading
console.log('Email user:', process.env.EMAIL_USER);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify connection on startup
transporter.verify((error) => {
  if (error) {
    console.error('SMTP Connection FAILED:', error);
  } else {
    console.log('SMTP Connection READY');
  }
});

module.exports = { 
  sendEmail: async ({ to, subject, text, html }) => {
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject,
        text: text || 'No text content',
        html: html || `<p>${text}</p>`
      });
      return true;
    } catch (error) {
      console.error('Email send error:', error);
      throw error;
    }
  }
};