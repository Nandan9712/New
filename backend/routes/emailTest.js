const express = require('express');
const router = express.Router();
const { sendEmail } = require('../utils/emailService');

router.get('/test', async (req, res) => {
  try {
    await sendEmail(
      'recipient@example.com',
      'Test Email',
      'This email is working!'
    );
    res.send('Email sent!');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;