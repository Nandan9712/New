import React, { useEffect, useState, useCallback } from 'react'; 
import keycloak from '../keycloak';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
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
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedSessionToReschedule, setSelectedSessionToReschedule] = useState(null);
  const [highlightDates, setHighlightDates] = useState({});
  const [editType, setEditType] = useState('full-course');
  const [selectedSessionIndex, setSelectedSessionIndex] = useState(0);
  const [newRescheduleDate, setNewRescheduleDate] = useState(null);
  const [newRescheduleTime, setNewRescheduleTime] = useState('');
  const [newRescheduleDuration, setNewRescheduleDuration] = useState('60');

  // Helper function to create date in local timezone (fixes calendar sync issue)
  const createLocalDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    // Create a new date using local timezone components
    return new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );
  };

  // Helper function to format date in local timezone
  const formatDateLocal = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Helper function to format date and time in local timezone
  const formatDateTimeLocal = (dateString, timeString) => {
    if (!dateString || !timeString) return '';
    
    // Parse the date and time
    const date = new Date(dateString);
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Create a new date with the time in local timezone
    const dateTime = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      hours,
      minutes
    );
    
    return dateTime.toLocaleString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Helper function to prepare date for API (YYYY-MM-DD format)
  const prepareDateForAPI = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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
      
      // Update highlight dates using local dates
      const newHighlightDates = {};
      data.forEach(session => {
        session.classDates.forEach(slot => {
          const date = createLocalDate(slot.date);
          if (date) {
            const key = date.toISOString().split('T')[0];
            if (!newHighlightDates[key]) newHighlightDates[key] = [];
            newHighlightDates[key].push(session);
          }
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
      date.setDate(date.getDate() + (i * 7));
      
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
          date: prepareDateForAPI(new Date(slot.date))
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
    setEditType('full-course');
    setSelectedSessionIndex(0);
    setNewRescheduleDate(null);
    setNewRescheduleTime('');
    setNewRescheduleDuration('60');
    setShowRescheduleModal(true);
  };

  const handleRescheduleSubmit = async () => {
    if (!selectedSessionToReschedule) return;

    try {
      await keycloak.updateToken(5);
      
      let payload = {
        editType: editType
      };

      if (editType === 'full-course') {
        if (!newRescheduleDate || !newRescheduleTime) {
          alert('Please select new date and time for the first session');
          return;
        }

        // Calculate new dates for all sessions based on the first session's new date
        const newClassDates = selectedSessionToReschedule.classDates.map((slot, index) => {
          const newDate = new Date(newRescheduleDate);
          newDate.setDate(newDate.getDate() + (index * 7));
          
          return {
            date: prepareDateForAPI(newDate),
            time: newRescheduleTime,
            duration: newRescheduleDuration || slot.duration
          };
        });

        payload.classDates = newClassDates;

      } else if (editType === 'specific-session') {
        if (!newRescheduleDate || !newRescheduleTime) {
          alert('Please select new date and time for the session');
          return;
        }
        
        payload.sessionIndex = selectedSessionIndex;
        payload.newDate = prepareDateForAPI(newRescheduleDate);
        payload.newTime = newRescheduleTime;
        payload.newDuration = newRescheduleDuration;
      }

      const res = await fetch(`http://localhost:5000/api/training-sessions/${selectedSessionToReschedule._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to reschedule session');
      }

      alert('Session rescheduled successfully!');
      setShowRescheduleModal(false);
      await fetchSessions();
    } catch (err) {
      console.error('Error rescheduling session:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Calendar tile styling for days with sessions
  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;
    const dateKey = date.toISOString().split('T')[0];
    return highlightDates[dateKey] ? 'relative bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg' : null;
  };

  // Calendar content for days with sessions (blue dot indicator)
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const dateKey = date.toISOString().split('T')[0];
    return highlightDates[dateKey] ? (
      <div className="absolute top-1 right-1 h-2 w-2 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full shadow-sm"></div>
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col">
      {/* Header Section */}
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 shadow-2xl border-b border-blue-500/30 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="relative flex justify-between items-center p-6 text-white">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="h-14 w-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl">
                <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div className="absolute -inset-1 bg-blue-400/20 rounded-2xl blur-sm -z-10"></div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent drop-shadow-lg">
                Trainer Dashboard
              </h1>
              <p className="text-blue-100/80 text-sm font-medium">Manage your training sessions with ease</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="font-semibold text-lg">{keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username}</p>
              <p className="text-blue-100/70 text-sm">Professional Trainer</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 px-6 py-3 rounded-xl font-semibold transition-all duration-300 hover:scale-105 active:scale-95 shadow-2xl hover:shadow-3xl hover:bg-white/30"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Section */}
      <main className="flex-1 flex flex-col lg:flex-row p-6 gap-6 max-w-7xl mx-auto w-full">
        {/* Left Column: Content */}
        <section className="flex-1">
          {/* Navigation Tabs */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-1 mb-6">
            <div className="flex">
              <button
                className={`flex-1 py-4 px-6 font-bold rounded-xl transition-all duration-300 ${
                  activeTab === 'create' 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-2xl transform scale-105' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/60 transform hover:scale-102'
                }`}
                onClick={() => setActiveTab('create')}
              >
                <span className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Create Session</span>
                </span>
              </button>
              <button
                className={`flex-1 py-4 px-6 font-bold rounded-xl transition-all duration-300 ${
                  activeTab === 'view' 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-2xl transform scale-105' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/60 transform hover:scale-102'
                }`}
                onClick={() => setActiveTab('view')}
              >
                <span className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>My Sessions ({sessions.length})</span>
                </span>
              </button>
            </div>
          </div>

          {activeTab === 'create' && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden transform transition-all duration-300 hover:shadow-3xl">
              <div className="p-8">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                      Create Training Session
                    </h2>
                    <p className="text-gray-600">Schedule new training sessions for your students</p>
                  </div>
                </div>

                {!showForm && (
                  <div className="text-center py-12">
                    <div className="max-w-md mx-auto">
                      <div className="h-24 w-24 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                        <svg className="h-12 w-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-700 mb-3">Ready to Create?</h3>
                      <p className="text-gray-500 mb-6">Start scheduling your training sessions and reach more students</p>
                      <button
                        onClick={() => setShowForm(true)}
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-4 px-8 rounded-xl font-bold shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 active:scale-95 transform"
                      >
                        <span className="flex items-center justify-center space-x-3">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          <span className="text-lg">Schedule New Class</span>
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {showForm && (
                  <div className="space-y-8">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Title*</label>
                        <input
                          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm shadow-inner"
                          placeholder="Enter session title"
                          value={newSession.title}
                          onChange={e => setNewSession({ ...newSession, title: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Session Type</label>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => setNewSession({ ...newSession, isLive: true })}
                            className={`flex-1 py-3 px-4 rounded-xl transition-all duration-300 border-2 font-semibold ${
                              newSession.isLive 
                                ? 'bg-green-500 text-white border-green-500 shadow-2xl transform scale-105' 
                                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 transform hover:scale-102'
                            }`}
                          >
                            📍 Offline
                          </button>
                          <button
                            onClick={() => setNewSession({ ...newSession, isLive: false })}
                            className={`flex-1 py-3 px-4 rounded-xl transition-all duration-300 border-2 font-semibold ${
                              !newSession.isLive 
                                ? 'bg-blue-500 text-white border-blue-500 shadow-2xl transform scale-105' 
                                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 transform hover:scale-102'
                            }`}
                          >
                            🌐 Online
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-3">Description*</label>
                      <textarea
                        className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm shadow-inner resize-none"
                        placeholder="Describe your training session..."
                        value={newSession.description}
                        onChange={e => setNewSession({ ...newSession, description: e.target.value })}
                        rows={4}
                      />
                    </div>

                    {newSession.isLive ? (
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Location*</label>
                        <input
                          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm shadow-inner"
                          placeholder="Enter class location"
                          value={newSession.location}
                          onChange={e => setNewSession({ ...newSession, location: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Meeting Link</label>
                        <input
                          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm shadow-inner"
                          placeholder="https://meeting.us/j/..."
                          value={newSession.zoomLink}
                          onChange={e => setNewSession({ ...newSession, zoomLink: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Duration (min)*</label>
                        <input
                          type="number"
                          min="1"
                          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm shadow-inner"
                          value={selectedDuration}
                          onChange={e => setSelectedDuration(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Date</label>
                        <DatePicker
                          selected={selectedDate}
                          onChange={date => setSelectedDate(date)}
                          minDate={new Date()}
                          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm shadow-inner"
                          placeholderText="Select date"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Time</label>
                        <input
                          type="time"
                          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm shadow-inner"
                          value={selectedTime}
                          onChange={e => setSelectedTime(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-3">Recurring Weeks</label>
                        <select
                          className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 bg-white/50 backdrop-blur-sm shadow-inner"
                          value={newSession.recurringWeeks}
                          onChange={e => setNewSession({ ...newSession, recurringWeeks: parseInt(e.target.value) })}
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                            <option key={num} value={num}>{num} week{num !== 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      onClick={addSlot}
                      disabled={!selectedDate || !selectedTime}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-4 rounded-xl font-bold shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-[1.02] active:scale-95 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      <span className="flex items-center justify-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Add Recurring Slots</span>
                      </span>
                    </button>

                    {newSession.classDates.length > 0 && (
                      <div className="border border-gray-200 rounded-2xl p-6 bg-white/50 backdrop-blur-sm shadow-inner">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center space-x-2">
                          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Scheduled Slots ({newSession.classDates.length})</span>
                        </h3>
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                          {newSession.classDates.map((slot, index) => (
                            <div key={index} className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 hover:border-blue-300 transition-all duration-300 shadow-sm hover:shadow-md">
                              <span className="text-sm font-semibold text-gray-700">
                                {formatDateLocal(slot.date)} - {slot.time} ({slot.duration} min)
                              </span>
                              <button
                                onClick={() => removeSlot(index)}
                                className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors duration-300"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                      <button
                        onClick={() => setShowForm(false)}
                        className="text-gray-600 hover:text-gray-800 font-semibold transition-colors duration-300 py-2 px-4 rounded-lg hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreate}
                        disabled={loading || !newSession.title || !newSession.description || newSession.classDates.length === 0}
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-4 px-8 rounded-xl font-bold shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 active:scale-95 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        {loading ? (
                          <span className="flex items-center space-x-3">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Creating Session...</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Create Session</span>
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'view' && (
            <div>
              <div className="mb-6">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                      My Training Sessions
                    </h2>
                    <p className="text-gray-600">Manage your scheduled training sessions</p>
                  </div>
                </div>
              </div>
              
              {sessions.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-12 text-center transform transition-all duration-300 hover:shadow-3xl">
                  <div className="max-w-md mx-auto">
                    <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
                      <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-3">No sessions yet</h3>
                    <p className="text-gray-500 mb-6">Get started by creating your first training session</p>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-8 rounded-xl font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 active:scale-95"
                    >
                      Create Your First Session
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {sessions.map(session => (
                    <div key={session._id} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 hover:shadow-3xl transition-all duration-500 overflow-hidden transform hover:scale-[1.01]">
                      <div className="p-8">
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex-1">
                            <div className="flex items-center space-x-4 mb-3">
                              <h3 className="text-2xl font-bold text-gray-800">{session.title}</h3>
                              <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${
                                session.isLive 
                                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg' 
                                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                              }`}>
                                {session.isLive ? '📍 Offline' : '🌐 Online'}
                              </span>
                            </div>
                            <p className="text-gray-600 leading-relaxed text-lg">{session.description}</p>
                          </div>
                          <div className="flex space-x-3 ml-6">
                            <button
                              onClick={() => handleReschedule(session)}
                              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3 rounded-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg"
                              title="Reschedule"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleCancel(session._id)}
                              className="bg-gradient-to-r from-red-500 to-pink-600 text-white p-3 rounded-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-lg"
                              title="Cancel"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-8 mb-6">
                          <div>
                            <h4 className="font-bold text-gray-700 mb-4 flex items-center text-lg">
                              <svg className="w-5 h-5 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Scheduled Slots
                            </h4>
                            <div className="space-y-3">
                              {session.classDates.map((slot, i) => (
                                <div key={i} className="flex items-center text-base text-gray-600 bg-white/50 p-4 rounded-xl border border-gray-200 shadow-sm">
                                  <span className="font-semibold">Session {i + 1}:</span>
                                  <span className="mx-3 text-gray-400">•</span>
                                  <span>{formatDateTimeLocal(slot.date, slot.time)} ({slot.duration} min)</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-bold text-gray-700 mb-4 flex items-center text-lg">
                              <svg className="w-5 h-5 mr-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Enrolled Students ({session.enrolledStudents?.length || 0})
                            </h4>
                            {session.enrolledStudents?.length > 0 ? (
                              <div className="space-y-3">
                                {session.enrolledStudents.map((student, i) => (
                                  <div key={i} className="text-base text-gray-600 bg-white/50 p-4 rounded-xl border border-gray-200 shadow-sm">
                                    👤 {student}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-base text-gray-500 italic bg-white/50 p-4 rounded-xl border border-gray-200">No students enrolled yet</p>
                            )}
                          </div>
                        </div>

                        {!session.isLive && session.zoomLink && (
                          <div className="mt-6">
                            <a 
                              href={session.zoomLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-6 rounded-xl font-semibold shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105"
                            >
                              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Join Meeting
                            </a>
                          </div>
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
        <aside className="lg:w-96">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 p-6 sticky top-6 transform transition-all duration-300 hover:shadow-3xl">
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendar Overview
            </h2>
            <div className="bg-white rounded-2xl shadow-inner border border-gray-200 p-4">
              <Calendar
                tileClassName={tileClassName}
                tileContent={tileContent}
                onClickDay={handleDayClick}
                className="border-0"
              />
            </div>
            <div className="mt-4 text-sm text-gray-600 bg-blue-50/50 p-3 rounded-xl border border-blue-200">
              <p className="flex items-center">
                <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Click on highlighted dates to view scheduled sessions
              </p>
            </div>
            
            {/* Session Summary */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="font-bold text-gray-700 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Session Summary
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm bg-white/50 p-3 rounded-xl border border-gray-200">
                  <span className="text-gray-600 font-semibold">Total Sessions:</span>
                  <span className="font-bold text-blue-600 text-lg">{sessions.length}</span>
                </div>
                <div className="flex justify-between items-center text-sm bg-white/50 p-3 rounded-xl border border-gray-200">
                  <span className="text-gray-600 font-semibold">Online Sessions:</span>
                  <span className="font-bold text-blue-500">{sessions.filter(s => !s.isLive).length}</span>
                </div>
                <div className="flex justify-between items-center text-sm bg-white/50 p-3 rounded-xl border border-gray-200">
                  <span className="text-gray-600 font-semibold">Offline Sessions:</span>
                  <span className="font-bold text-green-500">{sessions.filter(s => s.isLive).length}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedSessionToReschedule && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-3xl border border-white/20 max-w-2xl w-full transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Reschedule Session</h3>
              <p className="text-gray-600 mb-6">Choose how you want to reschedule "{selectedSessionToReschedule.title}"</p>
              
              <div className="space-y-6">
                {/* Edit Type Selection */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Reschedule Type</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setEditType('full-course')}
                      className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                        editType === 'full-course'
                          ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-blue-500 shadow-2xl transform scale-105'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 transform hover:scale-102'
                      }`}
                    >
                      <span className="font-semibold">Full Course</span>
                      <p className="text-sm mt-1 opacity-90">Reschedule all sessions</p>
                    </button>
                    <button
                      onClick={() => setEditType('specific-session')}
                      className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                        editType === 'specific-session'
                          ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border-green-500 shadow-2xl transform scale-105'
                          : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 transform hover:scale-102'
                      }`}
                    >
                      <span className="font-semibold">Specific Session</span>
                      <p className="text-sm mt-1 opacity-90">Reschedule only one session</p>
                    </button>
                  </div>
                </div>

                {/* Session Selection for Specific Session Editing */}
                {editType === 'specific-session' && (
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">Select Session to Reschedule</label>
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {selectedSessionToReschedule.classDates.map((slot, index) => (
                        <div
                          key={index}
                          onClick={() => setSelectedSessionIndex(index)}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                            selectedSessionIndex === index
                              ? 'bg-blue-50 border-blue-500 shadow-lg transform scale-105'
                              : 'bg-white border-gray-200 hover:border-gray-300 transform hover:scale-102'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-800">Session {index + 1}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                              selectedSessionIndex === index
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}>
                              {selectedSessionIndex === index ? 'Selected' : 'Select'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {formatDateTimeLocal(slot.date, slot.time)} ({slot.duration} min)
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Date/Time Selection */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">
                      {editType === 'full-course' ? 'New Start Date' : 'New Date'}
                    </label>
                    <DatePicker
                      selected={newRescheduleDate}
                      onChange={date => setNewRescheduleDate(date)}
                      minDate={new Date()}
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 shadow-inner"
                      placeholderText="Select date"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-3">
                      {editType === 'full-course' ? 'New Start Time' : 'New Time'}
                    </label>
                    <input
                      type="time"
                      className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 shadow-inner"
                      value={newRescheduleTime}
                      onChange={e => setNewRescheduleTime(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-3">Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300 shadow-inner"
                    value={newRescheduleDuration}
                    onChange={e => setNewRescheduleDuration(e.target.value)}
                    placeholder="Enter duration in minutes"
                  />
                </div>

                {/* Preview for Full Course */}
                {editType === 'full-course' && newRescheduleDate && newRescheduleTime && (
                  <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200">
                    <h4 className="font-bold text-blue-800 mb-3 flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      New Schedule Preview
                    </h4>
                    <div className="space-y-2 text-sm text-blue-700">
                      {selectedSessionToReschedule.classDates.map((_, index) => {
                        const newDate = new Date(newRescheduleDate);
                        newDate.setDate(newDate.getDate() + (index * 7));
                        return (
                          <div key={index} className="flex justify-between">
                            <span>Session {index + 1}:</span>
                            <span>{formatDateLocal(newDate.toISOString())} - {newRescheduleTime}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-8 py-3 text-gray-600 hover:text-gray-800 font-semibold transition-colors duration-300 rounded-xl hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRescheduleSubmit}
                  disabled={!newRescheduleDate || !newRescheduleTime}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-8 rounded-xl font-bold shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 active:scale-95 transform disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Save Changes
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