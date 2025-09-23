// src/App.jsx
import './App.css'
import React, { useEffect, useState } from 'react';
import keycloak from './keycloak';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ExaminerDashboard from './pages/ExaminerDashboard';
import ScheduleExam from './pages/ScheduleExam';
import CoordinatorDashboard from './pages/CoordinatorDashboard'; // ← new

const App = () => {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    keycloak.init({ onLoad: 'login-required' }).then((auth) => {
      if (auth) {
        setAuthenticated(true);
        console.log('User Info:', keycloak.tokenParsed);
        localStorage.setItem('user', JSON.stringify(keycloak.tokenParsed));
      }
    });
  }, []);

  if (!authenticated) return <div>Loading...</div>;

  return (
    <Router>
      <Routes>
        {/* Public/Login */}
        <Route path="/" element={<Login />} />

        {/* Student */}
        <Route element={<ProtectedRoute role="student" />}>
          <Route path="/student" element={<StudentDashboard keycloak={keycloak} />} />
        </Route>

        {/* Teacher */}
        <Route element={<ProtectedRoute role="teacher" />}>
          <Route path="/teacher" element={<TeacherDashboard keycloak={keycloak} />} />
        </Route>

        {/* Examiner */}
        <Route element={<ProtectedRoute role="examiner" />}>
          <Route path="/examiner" element={<ExaminerDashboard keycloak={keycloak} />} />
          <Route path="/exams/schedule" element={<ScheduleExam keycloak={keycloak} />} />
        </Route>

        {/* Coordinator */}
        <Route element={<ProtectedRoute role="coordinator" />}>
          <Route path="/coordinator" element={<CoordinatorDashboard keycloak={keycloak} />} />
          {/* You can add more coordinator routes here, e.g.: */}
          {/* <Route path="/coordinator/exams" element={<CoordinatorExamList keycloak={keycloak} />} /> */}
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
