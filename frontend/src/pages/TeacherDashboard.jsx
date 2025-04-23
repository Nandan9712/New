import React, { useEffect, useState } from "react";
import "../styles/dashboard.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import keycloak from "../keycloak"; // Import Keycloak config

const TeacherDashboard = () => {
  const [teacherName, setTeacherName] = useState("");
  const [teacherRole, setTeacherRole] = useState("Teacher");
  const [courseTitle, setCourseTitle] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [scheduledSessions, setScheduledSessions] = useState([]);

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user) {
      setTeacherName(user.name);
      setTeacherRole(user.role.charAt(0).toUpperCase() + user.role.slice(1));
      fetchScheduledSessions(user.email);
    }
  }, []);

  const fetchScheduledSessions = async (email) => {
    try {
      const res = await fetch(`http://localhost:5000/teacher/scheduled-classes?email=${email}`);
      const data = await res.json();
      setScheduledSessions(data);
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    }
  };

  const handleSchedule = async (e) => {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem("user"));

    // Check if we have a user
    if (!user) {
      console.log("No user found!");
      return;
    }

    try {
      const res = await fetch("http://localhost:5000/teacher/schedule-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherEmail: user.email,
          courseTitle,
          dateTime,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setScheduledSessions([...scheduledSessions, data]);
        setCourseTitle("");
        setDateTime("");
      } else {
        console.error("Failed to schedule class:", res.status);
      }
    } catch (error) {
      console.error("Error scheduling class:", error);
    }
  };

  const handleLogout = () => {
    keycloak.logout({ redirectUri: window.location.origin + '/login' }); // Redirect to the login page
  };

  return (
    <>
      {/* Header */}
      <header className="header">
        <section className="flex">
          <a href="/teacher" className="logo">DRONE</a>
          <form className="search-form">
            <input type="text" name="search_box" required placeholder="Search..." maxLength="100" />
            <button type="submit" className="fas fa-search"></button>
          </form>
          <div className="icons">
            <div id="menu-btn" className="fas fa-bars"></div>
            <div id="search-btn" className="fas fa-search"></div>
            <div id="user-btn" className="fas fa-user"></div>
            <div id="toggle-btn" className="fas fa-sun"></div>
          </div>
          <div className="profile">
            <img src="/images/pic-1.jpg" className="image" alt="profile" />
            <h3 className="name">{teacherName}</h3>
            <p className="role">{teacherRole}</p>
            <a href="/profile" className="btn">View Profile</a>
            
          </div>
        </section>
      </header>

      {/* Sidebar */}
      <div className="side-bar">
        <div id="close-btn"><i className="fas fa-times"></i></div>
        <div className="profile">
          <img src="/images/pic-1.jpg" className="image" alt="profile" />
          <h3 className="name">{teacherName}</h3>
          <p className="role">{teacherRole}</p>
          <a href="/profile" className="btn">View Profile</a>
        </div>
        <nav className="navbar">
          <a href="/teacher"><i className="fas fa-home"></i><span>Home</span></a>
          <a href="#"><i className="fas fa-users"></i><span>Course Roster</span></a>
          <a href="#schedule-section"><i className="fas fa-calendar-alt"></i><span>Schedule Classes</span></a>
        </nav>
      </div>
      <div className="flex-btn">
              <button onClick={handleLogout} className="option-btn">Logout</button>
            </div>
      {/* Main Dashboard */}
      <section className="home-grid">
        <h1 className="heading">Teacher Quick Actions</h1>
        <div className="box-container">
          <div className="box">
            <h3 className="title">Manage</h3>
            <div className="flex">
              <a href="#"><i className="fas fa-book"></i><span>Materials</span></a>
              <a href="#"><i className="fas fa-user-edit"></i><span>Attendance</span></a>
              <a href="#"><i className="fas fa-clipboard-check"></i><span>Assessments</span></a>
            </div>
          </div>
        </div>

        {/* Schedule Section */}
        <div id="schedule-section">
          <h2 className="heading">Schedule a Class</h2>
          <form onSubmit={handleSchedule} className="form-container">
            <input
              type="text"
              placeholder="Course Title"
              value={courseTitle}
              onChange={(e) => setCourseTitle(e.target.value)}
              required
            />
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
              required
            />
            <button type="submit" className="btn">Schedule</button>
          </form>

          <h2 className="heading">logout</h2>
          <div className="box-container">
            {scheduledSessions.length === 0 ? (
              <p>No scheduled classes yet.</p>
            ) : (
              scheduledSessions.map((session, idx) => (
                <div key={idx} className="box">
                  <h3>{session.courseTitle}</h3>
                  <p><strong>Date & Time:</strong> {new Date(session.dateTime).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default TeacherDashboard;
