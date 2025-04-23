import React, { useEffect, useState } from "react";
import "../styles/dashboard.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import keycloak from "../keycloak"; // Make sure this is correctly set up

const StudentDashboard = () => {
  const [studentName, setStudentName] = useState("");
  const [studentRole, setStudentRole] = useState("Student");
  const [registeredCourses, setRegisteredCourses] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [classSessions, setClassSessions] = useState([]);

  // Fetch student info, registered courses, and available courses after keycloak authentication
  useEffect(() => {
    if (keycloak.authenticated) {
      const name = keycloak.tokenParsed.name || "Student";
      const email = keycloak.tokenParsed?.email;
      if (!email) {
        console.error("Email not found in Keycloak token");
        return;
      }

      const role = keycloak.tokenParsed.realm_access?.roles[0] || "student";

      setStudentName(name);
      setStudentRole(role.charAt(0).toUpperCase() + role.slice(1));
      fetchClassSessions(); // fetch all, not email specific
    }
  }, []);

  const fetchClassSessions = async () => {
    try {
      console.log("📡 Fetching class sessions from backend...");
      const res = await fetch(`http://localhost:5000/student/class-sessions`);
      const data = await res.json();

      console.log("Class sessions fetched from backend:", data);  // ✅ Debug log

      setClassSessions(data);

      const uniqueCoursesMap = {};
      data.forEach((session) => {
        if (!uniqueCoursesMap[session.courseTitle]) {
          uniqueCoursesMap[session.courseTitle] = {
            title: session.courseTitle,
            description: "Session available", // You can enhance this if needed
          };
        }
      });

      const courses = Object.values(uniqueCoursesMap);
      setAvailableCourses(courses);

    } catch (error) {
      console.error("Failed to fetch class sessions", error);
    }
  };

  const handleRegisterCourse = async (courseTitle) => {
    console.log("🔥 Register button clicked for:", courseTitle);

    const email = keycloak.tokenParsed?.email;
    if (!email) {
      console.error("❌ Email not found in Keycloak token");
      alert("No email found");
      return;
    }

    const matchingSession = classSessions.find(
      (session) => session.courseTitle === courseTitle
    );

    if (!matchingSession) {
      alert("No matching session found for this course.");
      return;
    }

    console.log("📦 Registering with data:", {
      userEmail: email,
      courseTitle,
      teacherEmail: matchingSession.teacherEmail,
      
    });

    try {
      const res = await fetch("http://localhost:5000/student/register-course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userEmail: email,
          courseTitle,
          teacherEmail: matchingSession.teacherEmail,
          
        }),
      });

      const data = await res.json();
      console.log("API Response:", data);

      if (res.ok) {
        alert("✅ Registered successfully");
      } else {
        alert(data.message || "❌ Failed to register");
      }
    } catch (error) {
      console.error("❗ Error registering for course:", error);
      alert("An error occurred. Check console.");
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
          <a href="/student" className="logo">DRONE</a>
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
            <h3 className="name">{studentName}</h3>
            <p className="role">{studentRole}</p>
            <a href="/profile" className="btn">View Profile</a>
            <div className="flex-btn">
              <button onClick={handleLogout} className="option-btn">Logout</button>
            </div>
          </div>
        </section>
      </header>

      {/* Sidebar */}
      <div className="side-bar">
        <div id="close-btn"><i className="fas fa-times"></i></div>
        <div className="profile">
          <img src="/images/pic-1.jpg" className="image" alt="profile" />
          <h3 className="name">{studentName}</h3>
          <p className="role">{studentRole}</p>
          <a href="/profile" className="btn">View Profile</a>
        </div>
        <nav className="navbar">
          <a href="/student"><i className="fas fa-home"></i><span>Home</span></a>
          <a href="/student/courses"><i className="fas fa-book"></i><span>My Courses</span></a>
          <a href="#available-courses"><i className="fas fa-calendar-alt"></i><span>Available Courses</span></a>
        </nav>
        <div className="sidebar-logout">
          <button onClick={handleLogout} className="btn logout-sidebar-btn">
            <i className="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>
      </div>

      {/* Dashboard Content */}
      <section className="home-grid">
        <h1 className="heading">Student Quick Actions</h1>
        <div className="box-container">
          <div className="box">
            <h3 className="title">Manage</h3>
            <div className="flex">
              <a href="/student/my-courses"><i className="fas fa-book"></i><span>My Courses</span></a>
              <a href="/student/completed-courses"><i className="fas fa-check-circle"></i><span>Completed Courses</span></a>
              <a href="/student/certificates"><i className="fas fa-certificate"></i><span>Certificates</span></a>
            </div>
          </div>
        </div>

        {/* Available Courses */}
        <div id="available-courses">
          <h2 className="heading">Available Courses</h2>
          <div className="box-container">
            {availableCourses.length === 0 ? (
              <p>No available courses to register for.</p>
            ) : (
              availableCourses.map((course) => (
                <div key={course.title} className="box">
                  <h3>{course.title}</h3>
                  <p>{course.description}</p>
                  <button
                    onClick={() => {
                      console.log("🟢 Register clicked for", course.title);
                      alert("Clicked " + course.title);
                      handleRegisterCourse(course.title);
                    }}
                    className="btn"
                  >
                    Register
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default StudentDashboard;
