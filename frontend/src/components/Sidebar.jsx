import React from 'react';
import { Link } from 'react-router-dom';

const Sidebar = ({ role }) => {
  return (
    <div className="sidebar">
      <h3>{role}</h3>
      <nav>
        <Link to="/student">Dashboard</Link>
        <Link to="/student/courses">My Courses</Link>
        <Link to="/student/grades">Grades</Link>
      </nav>
    </div>
  );
};

export default Sidebar;
