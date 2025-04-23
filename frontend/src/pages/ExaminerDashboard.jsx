import React, { useEffect, useState } from "react";
import "../styles/dashboard.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import keycloak from "../keycloak"; // Make sure Keycloak is correctly set up

const ExaminerDashboard = () => {
  const [examinerName, setExaminerName] = useState("Examiner");
  const [examinerId, setExaminerId] = useState(null);
  const [assignedExams, setAssignedExams] = useState([]);

  // Fetch and handle user info once Keycloak is authenticated
  useEffect(() => {
    if (keycloak.authenticated) {
      const userName = keycloak.tokenParsed?.name || "Examiner";
      const userId = keycloak.tokenParsed?.sub; // Assuming the user ID is the 'sub' claim in Keycloak
      setExaminerName(userName);
      setExaminerId(userId);
    } else {
      console.warn("⚠️ Not authenticated with Keycloak");
    }
  }, [keycloak.authenticated]);

  // Fetch assigned exams when examinerId changes
  useEffect(() => {
    if (examinerId) {
      const fetchAssignedExams = async () => {
        try {
          console.log("📡 Fetching assigned exams for:", examinerId);
          const response = await fetch(`http://localhost:5000/api/exam-bookings/examiner/${examinerId}`);
          const data = await response.json();
          console.log("📦 Assigned exams fetched:", data);
          setAssignedExams(data);
        } catch (error) {
          console.error("❌ Error fetching assigned exams:", error);
        }
      };
      fetchAssignedExams();
    }
  }, [examinerId]);

  // Handle the cancellation of an exam booking
  const handleCancel = async (bookingId) => {
    try {
      console.log("🚫 Cancelling booking with ID:", bookingId);
      const res = await fetch(`http://localhost:5000/api/exam-bookings/${bookingId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      alert(result.message); // Alert with cancellation result
      setAssignedExams((prev) => prev.filter((exam) => exam._id !== bookingId)); // Remove cancelled exam from state
    } catch (error) {
      console.error("❌ Error cancelling exam:", error);
    }
  };

  // Handle logout
  const handleLogout = () => {
    keycloak.logout({ redirectUri: window.location.origin });
  };

  return (
    <>
      {/* Header */}
      <header className="header">
        <section className="flex">
          <a href="/examiner" className="logo">DRONE</a>
          <form className="search-form">
            <input type="text" placeholder="Search..." />
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
            <h3 className="name">{examinerName}</h3>
            <p className="role">Examiner</p>
            <a href="/profile" className="btn">View Profile</a>
            <div className="flex-btn">
              <button onClick={handleLogout} className="option-btn">Logout</button>
            </div>
          </div>
        </section>
      </header>

      <div className="side-bar">
        <div id="close-btn"><i className="fas fa-times"></i></div>
        <div className="profile">
          <img src="/images/pic-1.jpg" className="image" alt="profile" />
          <h3 className="name">{examinerName}</h3>
          <p className="role">Examiner</p>
          <a href="/profile" className="btn">View Profile</a>
        </div>
        <nav className="navbar">
          <a href="/examiner"><i className="fas fa-home"></i><span>Home</span></a>
          <a href="/examiner/slots"><i className="fas fa-clock"></i><span>Set Exam Availability</span></a>
          <a href="/examiner/requests"><i className="fas fa-user-clock"></i><span>Exam Requests</span></a>
          <a href="/examiner/results"><i className="fas fa-poll"></i><span>Review Results</span></a>
          <a href="#assigned"><i className="fas fa-clipboard-check"></i><span>Assigned Exams</span></a>
          {/* Logout Button */}
          <button onClick={handleLogout} className="option-btn" style={{ marginTop: '1rem', marginLeft: '1rem' }}>
            <i className="fas fa-sign-out-alt"></i> Logout
          </button>
        </nav>
      </div>

      <section className="home-grid">
        <h1 className="heading">Examiner Quick Tools</h1>
        <div className="box-container">
          <div className="box">
            <h3 className="title">Actions</h3>
            <div className="flex">
              <a href="/examiner/slots"><i className="fas fa-clock"></i><span>Set Exam Availability</span></a>
              <a href="#"><i className="fas fa-file-alt"></i><span>Verify Attendance</span></a>
              <a href="#"><i className="fas fa-poll-h"></i><span>Publish Results</span></a>
            </div>
          </div>

          <div className="box" id="assigned">
            <h3 className="title"><i className="fas fa-clipboard-check"></i> Your Assigned Exams</h3>
            <ul style={{ paddingLeft: "1rem" }}>
              {assignedExams.length === 0 ? (
                <p>No assigned exams</p>
              ) : (
                assignedExams.map((exam) => (
                  <li key={exam._id} style={{ marginBottom: "1rem" }}>
                    <strong>📘 Course:</strong> {exam.courseId?.title || "N/A"}<br />
                    <strong>👤 Student:</strong> {exam.studentId?.name || "N/A"}<br />
                    <strong>⏰ Time:</strong> {new Date(exam.examTime).toLocaleString()}<br />
                    <button onClick={() => handleCancel(exam._id)} className="option-btn" style={{ marginTop: "0.5rem" }}>
                      Cancel Exam
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
};

export default ExaminerDashboard;
