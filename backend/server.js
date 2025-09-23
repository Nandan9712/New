// server.js
const express = require('express');
require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');
const { sendEmail } = require('./utils/emailService');
const session = require('express-session');
const { keycloak, memoryStore } = require('./keycloak-config');
const trainingSessionsRoutes = require('./routes/trainingSessions');
const studentRoutes = require('./routes/student');
const examRoutes = require('./routes/exams');
const availabilityRoutes = require('./routes/availability');
const coordinatorRoutes = require('./routes/coordinator');
 // Load .env


const app = express();

// CORS
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// JSON parser
app.use(express.json());

// session for keycloak-connect
app.use(session({
  secret: '9df3c06d1c1d553c934105cef7469f8cfb835236fc18a1b42e6349e992b7d5a3',
  resave: false,
  saveUninitialized: true,
  store: memoryStore,
}));

// Keycloak
app.use(keycloak.middleware());

// Extract user info into req.user
app.use((req, res, next) => {
  if (req.kauth && req.kauth.grant) {
    const c = req.kauth.grant.access_token.content;
    req.user = {
      email: c.email,
      name: c.name,
      preferred_username: c.preferred_username,
      roles: c.realm_access?.roles || [],
    };
  }
  next();
});

// Connect MongoDB
mongoose.connect('mongodb://localhost:27017/drone_cert', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.set('strictQuery', true);
app.get('/ping', (req, res) => res.send('pong'));
// Routes

app.use('/api/training-sessions', trainingSessionsRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/coordinator', coordinatorRoutes);
app.use('/email', require('./routes/emailTest'));
// Start
app.listen(5000, () => {
  console.log('🚀 Server running on http://localhost:5000');
});
