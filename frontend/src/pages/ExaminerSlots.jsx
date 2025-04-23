// src/pages/ExaminerSlots.jsx
import React, { useEffect, useState } from "react";
import keycloak from "../keycloak";
import "../styles/dashboard.css";

const ExaminerSlots = () => {
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [message, setMessage] = useState("");
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    if (keycloak.authenticated) {
      const tokenParsed = keycloak.tokenParsed;
      const name = tokenParsed?.name || "Examiner";
      const id = tokenParsed?.sub;
      const roles = tokenParsed?.realm_access?.roles || [];

      if (!roles.includes("examiner")) {
        console.warn("Access denied: Not an examiner");
        setMessage("❌ Access denied: Not an examiner.");
        return;
      }

      setUserInfo({ id, name });
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(""); // Reset message
  
    if (!userInfo) {
      console.error("❌ User info not loaded.");
      setMessage("❌ User info not loaded.");
      return;
    }
  
    if (!keycloak.token) {
      console.error("❌ Keycloak token missing.");
      setMessage("❌ Authentication token not found. Try re-logging in.");
      return;
    }
  
    const now = new Date();
    const from = new Date(fromTime);
    const to = new Date(toTime);
  
    if (from <= now) {
      setMessage("❌ 'From Time' must be in the future.");
      return;
    }
  
    if (to <= from) {
      setMessage("❌ 'To Time' must be after 'From Time'.");
      return;
    }
  
    try {
      console.log("📡 Sending request to backend...");
      const response = await fetch("http://localhost:5000/api/examiner/set-availability", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keycloak.token}`,
        },
        body: JSON.stringify({
          examinerId: userInfo.id,
          examinerName: userInfo.name,
          fromTime,
          toTime,
        }),
      });
  
      console.log("📬 Response status:", response.status); // Log response status
      const data = await response.json();
      console.log("📬 Response body:", data);
  
      if (response.ok) {
        setMessage(data.message.includes("updated")
          ? "🔄 Slot updated successfully."
          : "✅ Slot added successfully.");
        setFromTime("");
        setToTime("");
      } else {
        setMessage(`❌ ${data.message || "Failed to add slot."}`);
      }
    } catch (err) {
      console.error("❌ Network error:", err);
      setMessage("❌ Network or server error. Please try again.");
    }
  };
  

  return (
    <div className="container">
      <section className="home-grid">
        <h1 className="heading">Add Your Exam Slot Availability</h1>
        <form onSubmit={handleSubmit} className="form">
          <label>From Time:</label>
          <input
            type="datetime-local"
            value={fromTime}
            onChange={(e) => setFromTime(e.target.value)}
            required
          />

          <label>To Time:</label>
          <input
            type="datetime-local"
            value={toTime}
            onChange={(e) => setToTime(e.target.value)}
            required
          />

          <button type="submit" className="inline-btn">Add Slot</button>
          {message && (
            <p style={{ marginTop: "1rem", color: message.startsWith("❌") ? "red" : "green" }}>
              {message}
            </p>
          )}
        </form>
      </section>
    </div>
  );
};

export default ExaminerSlots;
