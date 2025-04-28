import React, { useEffect, useState, useCallback } from 'react';
import keycloak from '../keycloak';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../styles/TeacherDashboard.css';

const TeacherDashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [newSession, setNewSession] = useState({
    title: '',
    description: '',
    zoomLink: '',
    classDates: [],
    isLive: false,
  });
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [activeTab, setActiveTab] = useState('create');

  const fetchSessions = useCallback(async () => {
    try {
      await keycloak.updateToken(5);
      const res = await fetch('http://localhost:5000/api/training-sessions/mine', {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error(await res.text());
      setSessions(await res.json());
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!keycloak.authenticated) {
        await keycloak.init({ onLoad: 'login-required' });
      }
      await fetchSessions();
    };
    load();
  }, [fetchSessions]);

  const addSlot = () => {
    if (!selectedDate || !selectedTime) return;
    const slot = { date: selectedDate.toISOString(), time: selectedTime };
    setNewSession(prev => ({
      ...prev,
      classDates: [...prev.classDates, slot]
    }));
    setSelectedDate(null);
    setSelectedTime('');
  };

  const removeSlot = (index) => {
    setNewSession(prev => ({
      ...prev,
      classDates: prev.classDates.filter((_, i) => i !== index)
    }));
  };

  const handleCreate = async () => {
    if (!newSession.title || !newSession.description || newSession.classDates.length === 0) {
      alert('Please fill all required fields');
      return;
    }

    try {
      await keycloak.updateToken(5);
      setLoading(true);
      const res = await fetch('http://localhost:5000/api/training-sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newSession)
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchSessions();
      setNewSession({ title: '', description: '', zoomLink: '', classDates: [], isLive: false });
    } catch (err) {
      console.error('Error creating session:', err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    keycloak.logout({ redirectUri: window.location.origin });
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="teacher-dashboard">
      <header className="dashboard-header">
        <h1>Teacher Dashboard</h1>
        
        <div className="user-info">
          <span>{keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username}</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button 
          className={`nav-btn ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Session
        </button>
        <button 
          className={`nav-btn ${activeTab === 'view' ? 'active' : ''}`}
          onClick={() => setActiveTab('view')}
        >
          My Sessions
        </button>
      </nav>

      <main className="dashboard-main">
        {activeTab === 'create' && (
          <section className="create-session">
            <h2>Create Training Session</h2>
            <div className="form-group">
              <label>Title*</label>
              <input
                placeholder="Session title"
                value={newSession.title}
                onChange={e => setNewSession({ ...newSession, title: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Description*</label>
              <textarea
                placeholder="Session description"
                value={newSession.description}
                onChange={e => setNewSession({ ...newSession, description: e.target.value })}
              />
            </div>

            <div className="session-type">
              <label className={`type-option ${newSession.isLive ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="sessionType"
                  checked={newSession.isLive}
                  onChange={() => setNewSession({ ...newSession, isLive: true })}
                />
                <span>Live (Physical)</span>
              </label>
              <label className={`type-option ${!newSession.isLive ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="sessionType"
                  checked={!newSession.isLive}
                  onChange={() => setNewSession({ ...newSession, isLive: false })}
                />
                <span>Online (Zoom)</span>
              </label>
            </div>

            {!newSession.isLive && (
              <div className="form-group">
                <label>Zoom Link</label>
                <input
                  placeholder="https://zoom.us/j/..."
                  value={newSession.zoomLink}
                  onChange={e => setNewSession({ ...newSession, zoomLink: e.target.value })}
                />
              </div>
            )}

            <div className="form-group">
              <label>Add Time Slots*</label>
              <div className="slot-picker">
                <Calendar
                  onChange={setSelectedDate}
                  value={selectedDate}
                  minDate={new Date()}
                />
                <div className="time-input">
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={e => setSelectedTime(e.target.value)}
                  />
                  <button onClick={addSlot} className="add-slot-btn">
                    Add Slot
                  </button>
                </div>
              </div>

              <div className="slot-list">
                {newSession.classDates.map((slot, i) => (
                  <div key={i} className="slot-item">
                    <span>{formatDate(slot.date)} at {slot.time}</span>
                    <button onClick={() => removeSlot(i)} className="remove-slot">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading}
              className="submit-btn"
            >
              {loading ? 'Creating...' : 'Create Session'}
            </button>
          </section>
        )}

        {activeTab === 'view' && (
          <section className="session-list">
            <h2>My Training Sessions</h2>
            {sessions.length === 0 ? (
              <div className="empty-state">
                <p>No sessions created yet</p>
              </div>
            ) : (
              <div className="sessions-grid">
                {sessions.map(session => (
                  <div key={session._id} className="session-card">
                    <div className="card-header">
                      <h3>{session.title}</h3>
                      <span className={`session-type ${session.isLive ? 'live' : 'online'}`}>
                        {session.isLive ? 'Live' : 'Online'}
                      </span>
                    </div>
                    <p className="card-description">{session.description}</p>
                    
                    {session.zoomLink && (
                      <div className="zoom-link">
                        <a href={session.zoomLink} target="_blank" rel="noopener noreferrer">
                          Join Zoom Meeting
                        </a>
                      </div>
                    )}

                    <div className="card-slots">
                      <h4>Scheduled Slots:</h4>
                      <ul>
                        {session.classDates.map((slot, i) => (
                          <li key={i}>
                            {formatDate(slot.date)} at {slot.time}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="card-enrollment">
                      <h4>Enrolled Students ({session.enrolledStudents.length}):</h4>
                      {session.enrolledStudents.length > 0 ? (
                        <ul>
                          {session.enrolledStudents.map((student, i) => (
                            <li key={i}>{student}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>No students enrolled yet</p>
                      )}
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
};

export default TeacherDashboard;