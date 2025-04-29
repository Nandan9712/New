import React, { useState, useEffect } from 'react';
import keycloak from '../keycloak';
import { FiLogOut, FiCalendar, FiClock, FiLink2, FiMapPin, FiCheckCircle } from 'react-icons/fi';
import '../styles/CoordinatorDashboard.css';

export default function CoordinatorDashboard() {
  const [sessions, setSessions] = useState([]);
  const [suggest, setSuggest] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineLink, setOnlineLink] = useState('');
  const [location, setLocation] = useState('');
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('schedule');

  // fetch all training sessions
  useEffect(() => {
    const fetchData = async () => {
      await keycloak.updateToken(5);
      const res = await fetch('http://localhost:5000/api/coordinator/sessions', {
        headers: { 'Authorization': `Bearer ${keycloak.token}` }
      });
      setSessions(await res.json());
    };
    fetchData();
    fetchExams();
  }, []);

  // fetch scheduled exams
  const fetchExams = async () => {
    setLoading(true);
    await keycloak.updateToken(5);
    const res = await fetch('http://localhost:5000/api/coordinator/exams', {
      headers: { 'Authorization': `Bearer ${keycloak.token}` }
    });
    setExams(await res.json());
    setLoading(false);
  };

  // when session changes, fetch suggestion
  const onSessionChange = async sid => {
    setSessionId(sid);
    if (!sid) {
      setSuggest(null);
      return;
    }
    setLoading(true);
    await keycloak.updateToken(5);
    const res = await fetch(
      `http://localhost:5000/api/coordinator/exams/suggest-sessions/${sid}`, {
        headers: { 'Authorization': `Bearer ${keycloak.token}` }
      }
    );
    setSuggest(await res.json());
    setLoading(false);
  };

  const handleSchedule = async () => {
    if (!sessionId || !date || !time || (!isOnline && !location)) {
      alert('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await keycloak.updateToken(5);
      const body = { sessionId, date, time, isOnline, onlineLink, location };
      const res = await fetch('http://localhost:5000/api/coordinator/exams/schedule', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        alert('Error: ' + (err.message || 'Failed to schedule exam'));
      } else {
        fetchExams();
        setSessionId('');
        setDate('');
        setTime('');
        setIsOnline(false);
        setOnlineLink('');
        setLocation('');
        setSuggest(null);
      }
    } catch (error) {
      console.error('Error while scheduling exam:', error);
      alert('Unexpected error occurred');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      keycloak.logout({ redirectUri: window.location.origin });
    }
  };

  const formatDate = (dateString) => {
    const options = { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="coordinator-dashboard">
      <header className="dashboard-header">
        <h1 className="dashboard-title">
          <FiCalendar className="header-icon" />
          Coordinator Dashboard
        </h1>
        <button onClick={handleLogout} className="logout-btn">
          <FiLogOut /> Logout
        </button>
      </header>

      <nav className="dashboard-nav">
        <button
          className={`nav-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          Schedule Exam
        </button>
        <button
          className={`nav-btn ${activeTab === 'exams' ? 'active' : ''}`}
          onClick={() => setActiveTab('exams')}
        >
          View Exams
        </button>
      </nav>

      <main className="dashboard-content">
        {activeTab === 'schedule' && (
          <section className="schedule-section">
            <h2 className="section-title">Schedule New Exam</h2>
            
            <div className="form-group">
              <label className="form-label">Training Session</label>
              <select
                value={sessionId}
                onChange={e => onSessionChange(e.target.value)}
                className="form-select"
                disabled={loading}
              >
                <option value="">– Select a session –</option>
                {sessions.map(s => (
                  <option key={s._id} value={s._id}>{s.title}</option>
                ))}
              </select>
            </div>

            {suggest && (
              <div className="suggestion-box">
                <h4 className="suggestion-title">Session Details</h4>
                <div className="suggestion-details">
                  <div className="detail-item">
                    <span className="detail-label">Total Students:</span>
                    <span className="detail-value">{suggest.totalStudents}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Online Slots (20/student):</span>
                    <span className="detail-value">{suggest.onlineSessions}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Offline Slots (30/student):</span>
                    <span className="detail-value">{suggest.offlineSessions}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date</label>
                <div className="input-with-icon">
                  <FiCalendar className="input-icon" />
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Time</label>
                <div className="input-with-icon">
                  <FiClock className="input-icon" />
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Exam Mode</label>
              <div className="mode-options">
                <label className={`mode-option ${isOnline ? 'active' : ''}`}>
                  <input
                    type="radio"
                    checked={isOnline}
                    onChange={() => setIsOnline(true)}
                    disabled={loading}
                  />
                  <span>Online Exam</span>
                </label>
                <label className={`mode-option ${!isOnline ? 'active' : ''}`}>
                  <input
                    type="radio"
                    checked={!isOnline}
                    onChange={() => setIsOnline(false)}
                    disabled={loading}
                  />
                  <span>Offline Exam</span>
                </label>
              </div>
            </div>

            {isOnline ? (
              <div className="form-group">
                <label className="form-label">Online Link</label>
                <div className="input-with-icon">
                  <FiLink2 className="input-icon" />
                  <input
                    type="text"
                    placeholder="https://example.com/meeting"
                    value={onlineLink}
                    onChange={e => setOnlineLink(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  />
                </div>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Location</label>
                <div className="input-with-icon">
                  <FiMapPin className="input-icon" />
                  <input
                    type="text"
                    placeholder="Exam venue address"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="form-input"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <div className="form-actions">
              <button
                onClick={handleSchedule}
                disabled={loading || !sessionId || !date || !time || (!isOnline && !location)}
                className="submit-btn"
              >
                {loading ? 'Scheduling...' : 'Schedule Exam'}
              </button>
            </div>
          </section>
        )}

        {activeTab === 'exams' && (
          <section className="exams-section">
            <div className="section-header">
              <h2 className="section-title">Scheduled Exams</h2>
              <div className="exam-count">
                {exams.length} exam{exams.length !== 1 ? 's' : ''}
              </div>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Loading exams...</p>
              </div>
            ) : exams.length === 0 ? (
              <div className="empty-state">
                <FiCalendar className="empty-icon" />
                <p>No exams scheduled yet</p>
              </div>
            ) : (
              <div className="exams-grid">
                {exams.map(ex => (
  <div key={ex._id} className="exam-card">
    <div className="card-header">
      <h3 className="exam-title">
        {ex.sessionId?.title || 'Session not found'}
      </h3>
      <span className={`exam-mode ${ex.isOnline ? 'online' : 'offline'}`}>
        {ex.isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
                    
                    <div className="exam-details">
                      <div className="detail-item">
                        <FiCalendar className="detail-icon" />
                        <span>{formatDate(ex.date)}</span>
                      </div>
                      <div className="detail-item">
                        <FiClock className="detail-icon" />
                        <span>{ex.time}</span>
                      </div>
                      {ex.isOnline ? (
                        <div className="detail-item">
                          <FiLink2 className="detail-icon" />
                          <a href={ex.onlineLink} target="_blank" rel="noopener noreferrer">
                            Join Exam
                          </a>
                        </div>
                      ) : (
                        <div className="detail-item">
                          <FiMapPin className="detail-icon" />
                          <span>{ex.location}</span>
                        </div>
                      )}
                    </div>

                    <div className="exam-meta">
                      <div className="meta-item">
                        <span className="meta-label">Examiner:</span>
                        <span className="meta-value">{ex.assignedExaminer || 'Not assigned'}</span>
                      </div>
                      <div className="meta-item">
                        <span className="meta-label">Status:</span>
                        <span className="meta-value">Pending</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}