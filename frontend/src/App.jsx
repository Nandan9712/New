import React, { useEffect, useState } from 'react';
import keycloak from './keycloak';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ExaminerDashboard from './pages/ExaminerDashboard';
import Login from './pages/Login';
import ExaminerSlots from './pages/ExaminerSlots';

const App = () => {
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    keycloak.init({ onLoad: 'login-required' }).then((auth) => {
      setAuthenticated(auth);
    });
  }, []);

  if (!authenticated) return <div>Loading...</div>;

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<ProtectedRoute role="student" />}>
          <Route path="/student" element={<StudentDashboard keycloak={keycloak} />} />
        </Route>
        <Route element={<ProtectedRoute role="teacher" />}>
          <Route path="/teacher" element={<TeacherDashboard keycloak={keycloak} />} />
        </Route>
        <Route element={<ProtectedRoute role="examiner" />}>
          <Route path="/examiner" element={<ExaminerDashboard keycloak={keycloak} />} />
          <Route path="/examiner/slots" element={<ExaminerSlots keycloak={keycloak} />} />
        </Route>
      </Routes>
    </Router>
  );
};

export default App;
