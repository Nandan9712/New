import React, { useEffect, useState, useCallback } from 'react'; 
import keycloak from '../keycloak';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../styles/TeacherDashboard.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const TeacherDashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [newSession, setNewSession] = useState({
    title: '',
    description: '',
    zoomLink: '',
    location: '',
    classDates: [],
    isLive: false,
  });
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('60'); // Default to 60 minutes
  const [activeTab, setActiveTab] = useState('create');
  const [showRescheduleCalendar, setShowRescheduleCalendar] = useState(false);
  const [selectedSessionToReschedule, setSelectedSessionToReschedule] = useState(null);

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
    if (!selectedDate || !selectedTime || !selectedDuration) return;
    const slot = { date: selectedDate.toISOString(), time: selectedTime, duration: selectedDuration };
    setNewSession(prev => ({
      ...prev,
      classDates: [...prev.classDates, slot]
    }));
    setSelectedDate(null);
    setSelectedTime('');
    setSelectedDuration('60'); // Reset to default value
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
  
    if (newSession.isLive && !newSession.location) {
      alert('Please enter a location for live sessions');
      return;
    }
  
    try {
      await keycloak.updateToken(5);
      setLoading(true);
      
      // Normalize dates before sending
      const payload = {
        ...newSession,
        classDates: newSession.classDates.map(slot => ({
          ...slot,
          date: new Date(slot.date).toISOString().split('T')[0] // YYYY-MM-DD format
        }))
      };
  
      const res = await fetch('http://localhost:5000/api/training-sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
  
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to create session');
      }
  
      // Refresh sessions and reset form
      await fetchSessions();
      setNewSession({ 
        title: '', 
        description: '', 
        zoomLink: '', 
        location: '', 
        classDates: [], 
        isLive: false 
      });
      alert('Session created successfully!');
    } catch (err) {
      console.error('Error creating session:', err);
      alert(`Error: ${err.message}`);
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

  const handleCancel = async (sessionId) => {
    if (!window.confirm('Are you sure you want to cancel this session?')) return;
    try {
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/training-sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`
        }
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Session canceled successfully');
      await fetchSessions();  // Refresh list
    } catch (err) {
      console.error('Error canceling session:', err);
      alert(err.message);
    }
  };

  const handleReschedule = (session) => {
    setSelectedSessionToReschedule(session);
    setShowRescheduleCalendar(true);
  };

  const handleNewReschedule = () => {
    if (!selectedDate || !selectedTime || !selectedDuration) return alert('Please select date, time, and duration.');

    const updatedDates = [{ date: selectedDate.toISOString(), time: selectedTime, duration: selectedDuration }];
    rescheduleSession(selectedSessionToReschedule._id, updatedDates, selectedSessionToReschedule.isLive ? selectedSessionToReschedule.location : selectedSessionToReschedule.zoomLink);
  };

  const rescheduleSession = async (sessionId, updatedClassDates, locationOrZoom) => {
    try {
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/training-sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          classDates: updatedClassDates,
          ...(locationOrZoom.startsWith('http') ? { zoomLink: locationOrZoom } : { location: locationOrZoom })
        })
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Session rescheduled successfully');
      setShowRescheduleCalendar(false);
      await fetchSessions(); // Refresh list
    } catch (err) {
      console.error('Error rescheduling session:', err);
      alert(err.message);
    }
  };

  return (
    <div className="teacher-dashboard">
      <header className="dashboard-header">
        <h1>Trainer Dashboard</h1>
        <div className="user-info">
          <span>{keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
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

            {newSession.isLive ? (
              <div className="form-group">
                <label>Location*</label>
                <input
                  placeholder="Enter class location"
                  value={newSession.location}
                  onChange={e => setNewSession({ ...newSession, location: e.target.value })}
                />
              </div>
            ) : (
              <div className="form-group">
                <label>Zoom Link*</label>
                <input
                  placeholder="https://zoom.us/j/..."
                  value={newSession.zoomLink}
                  onChange={e => setNewSession({ ...newSession, zoomLink: e.target.value })}
                />
              </div>
            )}

            <div className="form-group">
              <label>Duration (minutes)*</label>
              <input
                type="number"
                min="1"
                value={selectedDuration}
                onChange={e => setSelectedDuration(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Select Date</label>
              <Calendar
                value={selectedDate}
                onChange={setSelectedDate}
                minDate={new Date()}
              />
            </div>

            <div className="form-group">
              <label>Select Time</label>
              <input
                type="time"
                value={selectedTime}
                onChange={e => setSelectedTime(e.target.value)}
              />
            </div>

            <button onClick={addSlot}>Add Slot</button>

            <h3>Added Slots</h3>
            <ul>
              {newSession.classDates.map((slot, index) => (
                <li key={index}>
                  {formatDate(slot.date)} - {slot.time} ({slot.duration} min)
                  <button onClick={() => removeSlot(index)}>Remove</button>
                </li>
              ))}
            </ul>

            <button onClick={handleCreate} disabled={loading}>
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

            {session.isLive ? (
              <p className="card-location"><strong>Location:</strong> {session.location}</p>
            ) : (
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
                    {formatDate(slot.date)} at {slot.time} ({slot.duration} minutes)
                  </li>
                ))}
              </ul>
            </div>

            <div className="card-enrollment">
              <h4>Enrolled Students ({session.enrolledStudents?.length || 0}):</h4>
              {session.enrolledStudents?.length > 0 ? (
                <ul>
                  {session.enrolledStudents.map((student, i) => (
                    <li key={i}>{student}</li>
                  ))}
                </ul>
              ) : (
                <p>No students enrolled yet</p>
              )}
            </div>

            <div className="session-actions">
              <button onClick={() => handleReschedule(session)}>Reschedule</button>
              <button onClick={() => handleCancel(session._id)} className="cancel-btn">Cancel</button>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
)}
      </main>

      {showRescheduleCalendar && (
        <div className="reschedule-modal">
          <h3>Reschedule Session</h3>
          <Calendar value={selectedDate} onChange={setSelectedDate} minDate={new Date()} />
          <div className="form-group">
            <label>Select Time</label>
            <input
              type="time"
              value={selectedTime}
              onChange={e => setSelectedTime(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Duration (minutes)</label>
            <input
              type="number"
              value={selectedDuration}
              onChange={e => setSelectedDuration(e.target.value)}
            />
          </div>
          <button onClick={handleNewReschedule}>Save Reschedule</button>
          <button onClick={() => setShowRescheduleCalendar(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
