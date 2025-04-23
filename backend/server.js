const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const { keycloak, memoryStore } = require('./keycloak-config');

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Parse JSON
app.use(express.json());

// Setup session (required for keycloak-connect)
app.use(
  session({
    secret: '9df3c06d1c1d553c934105cef7469f8cfb835236fc18a1b42e6349e992b7d5a3',
    resave: false,
    saveUninitialized: true,
    store: memoryStore,
  })
);

// Initialize Keycloak middleware
app.use(keycloak.middleware());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/drone_cert', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
mongoose.set('strictQuery', true);

// Middleware to extract user info and attach to request (including email)
app.use((req, res, next) => {
  if (req.kauth && req.kauth.grant) {
    const tokenContent = req.kauth.grant.access_token.content;
    req.user = {
      email: tokenContent.email,
      name: tokenContent.name,
      preferred_username: tokenContent.preferred_username,
      roles: tokenContent.realm_access?.roles || [],
    };
  }
  next();
});

// === ROUTES ===
app.use('/teacher', require('./routes/teacher'));
app.use('/student', require('./routes/student'));
app.use('/api', require('./routes/classSessionRoutes'));
app.use('/api/examiner', require('./routes/examinerSlots'));

// Protected route to add class session (Teacher only)
const ClassSession = require('./models/ClassSession');
app.post('/add-session', keycloak.protect('realm:teacher'), async (req, res) => {
  try {
    const { courseId, dateTime } = req.body;

    if (!courseId || !dateTime) {
      return res.status(400).json({ error: 'CourseId and dateTime are required' });
    }

    const newSession = new ClassSession({
      courseId,
      dateTime: new Date(dateTime),
    });

    await newSession.save();
    res.status(201).json({ message: 'Session added successfully' });
  } catch (error) {
    console.error('Error adding session:', error);
    res.status(500).json({ error: 'Failed to add session' });
  }
});

// Start server
app.listen(5000, () => {
  console.log('🚀 Server running at http://localhost:5000');
});
