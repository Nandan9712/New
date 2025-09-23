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
    recurringWeeks: 4
  });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('60');
  const [activeTab, setActiveTab] = useState('create');
  const [showRescheduleCalendar, setShowRescheduleCalendar] = useState(false);
  const [selectedSessionToReschedule, setSelectedSessionToReschedule] = useState(null);
  const [highlightDates, setHighlightDates] = useState({});

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
      const data = await res.json();
      setSessions(data);
      
      const newHighlightDates = {};
      data.forEach(session => {
        session.classDates.forEach(slot => {
          const date = new Date(slot.date);
          const key = date.toISOString().split('T')[0]; // Use ISO format for consistency
          if (!newHighlightDates[key]) newHighlightDates[key] = [];
          newHighlightDates[key].push(session);
        });
      });
      setHighlightDates(newHighlightDates);
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
    
    const slots = [];
    const weeks = newSession.recurringWeeks || 1;
    
    for (let i = 0; i < weeks; i++) {
      const date = new Date(selectedDate);
      date.setDate(date.getDate() + (i * 7)); // Add i weeks to the date
      
      slots.push({ 
        date: date.toISOString(), 
        time: selectedTime, 
        duration: selectedDuration 
      });
    }
    
    setNewSession(prev => ({
      ...prev,
      classDates: [...prev.classDates, ...slots]
    }));
    
    setSelectedDate(null);
    setSelectedTime('');
    setSelectedDuration('60');
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
      
      const payload = {
        ...newSession,
        classDates: newSession.classDates.map(slot => ({
          ...slot,
          date: new Date(slot.date).toISOString().split('T')[0]
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
  
      await fetchSessions();
      setNewSession({ 
        title: '', 
        description: '', 
        zoomLink: '', 
        location: '', 
        classDates: [], 
        isLive: false,
        recurringWeeks: 4
      });
      setShowForm(false);
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
      await fetchSessions();
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
      await fetchSessions();
    } catch (err) {
      console.error('Error rescheduling session:', err);
      alert(err.message);
    }
  };

  // Calendar tile styling for days with sessions
  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;
    const dateKey = date.toISOString().split('T')[0];
    return highlightDates[dateKey] ? 'bg-blue-50 relative' : null;
  };

  // Calendar content for days with sessions (blue dot indicator)
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const dateKey = date.toISOString().split('T')[0];
    return highlightDates[dateKey] ? (
      <div className="absolute top-1 right-1 h-2 w-2 bg-blue-500 rounded-full"></div>
    ) : null;
  };

  // Handle day click to show sessions on that day
  const handleDayClick = (date) => {
    const dateKey = date.toISOString().split('T')[0];
    if (highlightDates[dateKey]) {
      const formattedDate = date.toLocaleDateString(undefined, { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const sessionsList = highlightDates[dateKey]
        .map(s => `• ${s.title} (${s.isLive ? 'Offline' : 'Online'})`)
        .join('\n');
      alert(`Sessions on ${formattedDate}:\n\n${sessionsList}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-200 flex flex-col">
      {/* Header Section */}
      <header className="flex justify-between items-center p-6 bg-blue-600 text-white fixed top-0 left-0 w-full z-50">
        <div className="flex items-center space-x-4">
          <img 
            src="https://thumbs.dreamstime.com/b/education-logo-vector-icon-illustration-uniform-ceremony-people-graduating-graduation-success-study-hat-knowledge-graduate-diploma-169347309.jpg" 
            alt="Trainer" 
            className="h-10 w-10 object-contain"
          />
          <h1 className="text-2xl font-bold">Trainer Dashboard</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span>{keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username}</span>
          <button
            onClick={handleLogout}
            className="bg-red-500 px-4 py-2 rounded text-white hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Section */}
      <main className="flex flex-1 flex-col md:flex-row mt-24">
        {/* Left Column: Content */}
        <section className="flex-1 p-6">
          {/* Navigation Tabs */}
          <div className="flex mb-6 border-b border-gray-200">
            <button
              className={`py-2 px-4 font-medium ${activeTab === 'create' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab('create')}
            >
              Create Session
            </button>
            <button
              className={`py-2 px-4 font-medium ${activeTab === 'view' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab('view')}
            >
              My Sessions
            </button>
          </div>

          {activeTab === 'create' && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold mb-4">Create Training Session</h2>

              {!showForm && (
                <div className="text-center mb-4">
                  <button
                    onClick={() => setShowForm(true)}
                    className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
                  >
                    Schedule Class
                  </button>
                </div>
              )}

              {showForm && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title*</label>
                    <input
                      className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Session title"
                      value={newSession.title}
                      onChange={e => setNewSession({ ...newSession, title: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description*</label>
                    <textarea
                      className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Session description"
                      value={newSession.description}
                      onChange={e => setNewSession({ ...newSession, description: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="flex space-x-4">
                    <label className={`flex items-center space-x-2 p-2 rounded cursor-pointer ${newSession.isLive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>
                      <input
                        type="radio"
                        name="sessionType"
                        checked={newSession.isLive}
                        onChange={() => setNewSession({ ...newSession, isLive: true })}
                        className="focus:ring-blue-500"
                      />
                      <span>Offline</span>
                    </label>
                    <label className={`flex items-center space-x-2 p-2 rounded cursor-pointer ${!newSession.isLive ? 'bg-blue-100 text-blue-800' : 'bg-gray-100'}`}>
                      <input
                        type="radio"
                        name="sessionType"
                        checked={!newSession.isLive}
                        onChange={() => setNewSession({ ...newSession, isLive: false })}
                        className="focus:ring-blue-500"
                      />
                      <span>Online</span>
                    </label>
                  </div>

                  {newSession.isLive ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location*</label>
                      <input
                        className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter class location"
                        value={newSession.location}
                        onChange={e => setNewSession({ ...newSession, location: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                      <input
                        className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://meeting.us/j/..."
                        value={newSession.zoomLink}
                        onChange={e => setNewSession({ ...newSession, zoomLink: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)*</label>
                      <input
                        type="number"
                        min="1"
                        className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        value={selectedDuration}
                        onChange={e => setSelectedDuration(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                      <DatePicker
                        selected={selectedDate}
                        onChange={date => setSelectedDate(date)}
                        minDate={new Date()}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        placeholderText="Select a date"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Time</label>
                      <input
                        type="time"
                        className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        value={selectedTime}
                        onChange={e => setSelectedTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Number of Recurring Weeks</label>
                    <select
                      className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                      value={newSession.recurringWeeks}
                      onChange={e => setNewSession({ ...newSession, recurringWeeks: parseInt(e.target.value) })}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                        <option key={num} value={num}>{num} week{num !== 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={addSlot}
                    className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
                  >
                    Add Recurring Slots
                  </button>

                  {newSession.classDates.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium mb-2">Added Slots</h3>
                      <ul className="space-y-2">
                        {newSession.classDates.map((slot, index) => (
                          <li key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <span>
                              {formatDate(slot.date)} - {slot.time} ({slot.duration} min)
                            </span>
                            <button
                              onClick={() => removeSlot(index)}
                              className="text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => setShowForm(false)}
                      className="text-sm text-gray-500 underline"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={loading}
                      className={`py-2 px-4 rounded text-white ${loading ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {loading ? 'Creating...' : 'Create Session'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'view' && (
            <div>
              <h2 className="text-2xl font-bold text-blue-800 mb-6">My Training Sessions</h2>
              {sessions.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
                  No sessions created yet
                </div>
              ) : (
                <div className="space-y-6">
                  {sessions.map(session => (
                    <div key={session._id} className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-bold">{session.title}</h3>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            session.isLive ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {session.isLive ? 'Offline' : 'Online'}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleReschedule(session)}
                            className="bg-yellow-500 text-white py-1 px-3 rounded text-sm hover:bg-yellow-600"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => handleCancel(session._id)}
                            className="bg-red-500 text-white py-1 px-3 rounded text-sm hover:bg-red-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>

                      <p className="mt-2 text-gray-600">{session.description}</p>

                      {session.isLive ? (
                        <p className="mt-2"><strong>Location:</strong> {session.location}</p>
                      ) : (
                        <a 
                          href={session.zoomLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline mt-2 inline-block"
                        >
                          Join Meeting
                        </a>
                      )}

                      <div className="mt-4">
                        <h4 className="font-medium">Scheduled Slots:</h4>
                        <ul className="mt-2 space-y-1">
                          {session.classDates.map((slot, i) => (
                            <li key={i} className="text-sm">
                              {formatDate(slot.date)} at {slot.time} ({slot.duration} minutes)
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-4">
                        <h4 className="font-medium">Enrolled Students ({session.enrolledStudents?.length || 0}):</h4>
                        {session.enrolledStudents?.length > 0 ? (
                          <ul className="mt-2 space-y-1">
                            {session.enrolledStudents.map((student, i) => (
                              <li key={i} className="text-sm">
                                {student}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500 mt-1">No students enrolled yet</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Calendar */}
        <aside className="w-full md:w-1/3 p-6 bg-blue-100">
          <h2 className="text-xl font-bold mb-4">Calendar</h2>
          <div className="bg-white rounded-lg shadow p-4">
            <Calendar
              tileClassName={tileClassName}
              tileContent={tileContent}
              onClickDay={handleDayClick}
            />
          </div>
        </aside>
      </main>

      {/* Reschedule Modal */}
      {showRescheduleCalendar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Reschedule Session</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
                <DatePicker
                  selected={selectedDate}
                  onChange={date => setSelectedDate(date)}
                  minDate={new Date()}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Time</label>
                <input
                  type="time"
                  className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  value={selectedTime}
                  onChange={e => setSelectedTime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                  value={selectedDuration}
                  onChange={e => setSelectedDuration(e.target.value)}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowRescheduleCalendar(false)}
                  className="bg-gray-300 text-gray-800 py-2 px-4 rounded hover:bg-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNewReschedule}
                  className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;