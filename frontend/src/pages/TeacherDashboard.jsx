import React, { useEffect, useState, useCallback } from 'react'; 
import keycloak from '../keycloak';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const TeacherDashboard = () => {
  const [sessions, setSessions] = useState([]);
  const [exams, setExams] = useState([]);
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
  const [examModal, setExamModal] = useState({ show: false, session: null, exam: null });

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
          const key = date.toISOString().split('T')[0];
          if (!newHighlightDates[key]) newHighlightDates[key] = [];
          newHighlightDates[key].push(session);
        });
      });
      setHighlightDates(newHighlightDates);
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  }, []);

  const fetchExams = useCallback(async () => {
    try {
      await keycloak.updateToken(5);
      const res = await fetch('http://localhost:5000/api/exams/mine', {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        setExams(data);
      }
    } catch (err) {
      console.error('Error fetching exams:', err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!keycloak.authenticated) {
        await keycloak.init({ onLoad: 'login-required' });
      }
      await fetchSessions();
      await fetchExams();
    };
    load();
  }, [fetchSessions, fetchExams]);

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
      await fetchExams();
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
      alert('Session created successfully! Exam has been scheduled automatically.');
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

  const formatDateTime = (dateString, timeString) => {
    const date = new Date(dateString);
    const options = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString(undefined, options) + ' ' + timeString;
  };

  const handleCancel = async (sessionId) => {
    if (!window.confirm('Are you sure you want to cancel this session? This will also cancel the associated exam.')) return;
    try {
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/training-sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`
        }
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Session and exam canceled successfully');
      await fetchSessions();
      await fetchExams();
    } catch (err) {
      console.error('Error canceling session:', err);
      alert(err.message);
    }
  };

  const handleCancelExam = async (examId) => {
    if (!window.confirm('Are you sure you want to cancel this exam?')) return;
    try {
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/exams/${examId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`
        }
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Exam canceled successfully');
      await fetchSessions();
      await fetchExams();
    } catch (err) {
      console.error('Error canceling exam:', err);
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
      alert('Session rescheduled successfully. Exam has been automatically rescheduled.');
      setShowRescheduleCalendar(false);
      await fetchSessions();
      await fetchExams();
    } catch (err) {
      console.error('Error rescheduling session:', err);
      alert(err.message);
    }
  };

  const handleCreateExam = async (sessionId) => {
    try {
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/training-sessions/${sessionId}/create-exam`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) throw new Error(await res.text());
      
      const data = await res.json();
      alert('Exam created successfully!');
      await fetchSessions();
      await fetchExams();
    } catch (err) {
      console.error('Error creating exam:', err);
      alert(`Error creating exam: ${err.message}`);
    }
  };

  const handleViewExam = (session, exam) => {
    setExamModal({ show: true, session, exam });
  };

  const handleUpdateExam = async (examId, updateData) => {
    try {
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/exams/${examId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      if (!res.ok) throw new Error(await res.text());
      
      alert('Exam updated successfully!');
      setExamModal({ show: false, session: null, exam: null });
      await fetchExams();
    } catch (err) {
      console.error('Error updating exam:', err);
      alert(`Error updating exam: ${err.message}`);
    }
  };

  // Calendar tile styling for days with sessions
  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;
    const dateKey = date.toISOString().split('T')[0];
    return highlightDates[dateKey] ? 'relative bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200' : null;
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

  const getLastSessionDate = (classDates) => {
    if (!classDates || classDates.length === 0) return null;
    const sorted = [...classDates].sort((a, b) => new Date(b.date) - new Date(a.date));
    return sorted[0];
  };

  const calculateExamDate = (lastSession) => {
    if (!lastSession) return null;
    const examDate = new Date(lastSession.date);
    examDate.setDate(examDate.getDate() + 7);
    return examDate;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col">
      {/* Header Section */}
      <header className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 shadow-lg border-b border-blue-500/30">
        <div className="flex justify-between items-center p-6 text-white">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img 
                src="https://thumbs.dreamstime.com/b/education-logo-vector-icon-illustration-uniform-ceremony-people-graduating-graduation-success-study-hat-knowledge-graduate-diploma-169347309.jpg" 
                alt="Trainer" 
                className="h-12 w-12 object-contain rounded-xl bg-white/10 p-1 backdrop-blur-sm border border-white/20"
              />
              <div className="absolute -inset-1 bg-blue-400/20 rounded-xl blur-sm -z-10"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                Trainer Dashboard
              </h1>
              <p className="text-blue-100/80 text-sm">Manage your training sessions and exams</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="font-medium">{keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username}</p>
              <p className="text-blue-100/70 text-sm">Trainer</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 px-6 py-2 rounded-xl font-medium transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
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
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-1 mb-6">
            <div className="flex">
              <button
                className={`flex-1 py-3 px-6 font-semibold rounded-xl transition-all duration-200 ${
                  activeTab === 'create' 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
                onClick={() => setActiveTab('create')}
              >
                Create Session
              </button>
              <button
                className={`flex-1 py-3 px-6 font-semibold rounded-xl transition-all duration-200 ${
                  activeTab === 'view' 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
                onClick={() => setActiveTab('view')}
              >
                My Sessions
              </button>
              <button
                className={`flex-1 py-3 px-6 font-semibold rounded-xl transition-all duration-200 ${
                  activeTab === 'exams' 
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}
                onClick={() => setActiveTab('exams')}
              >
                Exams ({exams.length})
              </button>
            </div>
          </div>

          {activeTab === 'create' && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 overflow-hidden">
              <div className="p-8">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-2">
                  Create Training Session
                </h2>
                <p className="text-gray-600 mb-6">Schedule new training sessions for your students</p>

                {!showForm && (
                  <div className="text-center py-8">
                    <button
                      onClick={() => setShowForm(true)}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-4 px-8 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      <span className="flex items-center justify-center space-x-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span>Schedule New Class</span>
                      </span>
                    </button>
                  </div>
                )}

                {showForm && (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Title*</label>
                        <input
                          className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          placeholder="Enter session title"
                          value={newSession.title}
                          onChange={e => setNewSession({ ...newSession, title: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Session Type</label>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => setNewSession({ ...newSession, isLive: true })}
                            className={`flex-1 py-2 px-4 rounded-lg transition-all duration-200 border ${
                              newSession.isLive 
                                ? 'bg-green-500 text-white border-green-500 shadow-lg' 
                                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            Offline
                          </button>
                          <button
                            onClick={() => setNewSession({ ...newSession, isLive: false })}
                            className={`flex-1 py-2 px-4 rounded-lg transition-all duration-200 border ${
                              !newSession.isLive 
                                ? 'bg-blue-500 text-white border-blue-500 shadow-lg' 
                                : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                            }`}
                          >
                            Online
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Description*</label>
                      <textarea
                        className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm resize-none"
                        placeholder="Describe your training session..."
                        value={newSession.description}
                        onChange={e => setNewSession({ ...newSession, description: e.target.value })}
                        rows={3}
                      />
                    </div>

                    {newSession.isLive ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Location*</label>
                        <input
                          className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          placeholder="Enter class location"
                          value={newSession.location}
                          onChange={e => setNewSession({ ...newSession, location: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Meeting Link</label>
                        <input
                          className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          placeholder="https://meeting.us/j/..."
                          value={newSession.zoomLink}
                          onChange={e => setNewSession({ ...newSession, zoomLink: e.target.value })}
                        />
                      </div>
                    )}

                    <div className="grid md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (min)*</label>
                        <input
                          type="number"
                          min="1"
                          className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          value={selectedDuration}
                          onChange={e => setSelectedDuration(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
                        <DatePicker
                          selected={selectedDate}
                          onChange={date => setSelectedDate(date)}
                          minDate={new Date()}
                          className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          placeholderText="Select date"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
                        <input
                          type="time"
                          className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          value={selectedTime}
                          onChange={e => setSelectedTime(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Recurring Weeks</label>
                        <select
                          className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/50 backdrop-blur-sm"
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
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      Add Recurring Slots
                    </button>

                    {newSession.classDates.length > 0 && (
                      <div className="border border-gray-200 rounded-xl p-4 bg-white/50">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Scheduled Slots</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {newSession.classDates.map((slot, index) => (
                            <div key={index} className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-all duration-200">
                              <span className="text-sm font-medium text-gray-700">
                                {formatDate(slot.date)} - {slot.time} ({slot.duration} min)
                              </span>
                              <button
                                onClick={() => removeSlot(index)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors duration-200"
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

                    <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                      <button
                        onClick={() => setShowForm(false)}
                        className="text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreate}
                        disabled={loading || !newSession.title || !newSession.description || newSession.classDates.length === 0}
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-3 px-8 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      >
                        {loading ? (
                          <span className="flex items-center space-x-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Creating...</span>
                          </span>
                        ) : (
                          'Create Session'
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
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  My Training Sessions
                </h2>
                <p className="text-gray-600">Manage your scheduled training sessions</p>
              </div>
              
              {sessions.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-12 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No sessions yet</h3>
                    <p className="text-gray-500 mb-4">Get started by creating your first training session</p>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-2 px-6 rounded-lg font-medium hover:shadow-lg transition-all duration-200"
                    >
                      Create Session
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessions.map(session => {
                    const lastSession = getLastSessionDate(session.classDates);
                    const examDate = calculateExamDate(lastSession);
                    
                    return (
                    <div key={session._id} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-800">{session.title}</h3>
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                session.isLive 
                                  ? 'bg-green-100 text-green-800 border border-green-200' 
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}>
                                {session.isLive ? '📍 Offline' : '🌐 Online'}
                              </span>
                            </div>
                            <p className="text-gray-600 leading-relaxed">{session.description}</p>
                          </div>
                          <div className="flex space-x-2 ml-4">
                            <button
                              onClick={() => handleReschedule(session)}
                              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-2 rounded-lg hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                              title="Reschedule"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleCancel(session._id)}
                              className="bg-gradient-to-r from-red-500 to-pink-600 text-white p-2 rounded-lg hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                              title="Cancel"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6 mb-4">
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                              <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Scheduled Slots
                            </h4>
                            <div className="space-y-2">
                              {session.classDates.map((slot, i) => (
                                <div key={i} className="flex items-center text-sm text-gray-600 bg-white/50 p-2 rounded-lg">
                                  <span className="font-medium">{formatDate(slot.date)}</span>
                                  <span className="mx-2">•</span>
                                  <span>{slot.time} ({slot.duration} min)</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2 flex items-center">
                              <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              Enrolled Students ({session.enrolledStudents?.length || 0})
                            </h4>
                            {session.enrolledStudents?.length > 0 ? (
                              <div className="space-y-1">
                                {session.enrolledStudents.map((student, i) => (
                                  <div key={i} className="text-sm text-gray-600 bg-white/50 p-2 rounded-lg">
                                    👤 {student}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 italic">No students enrolled yet</p>
                            )}
                          </div>
                        </div>

                        {/* Exam Information */}
                        <div className="border-t border-gray-200 pt-4 mt-4">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-gray-700 flex items-center">
                              <svg className="w-4 h-4 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Exam Information
                            </h4>
                            {!session.scheduledExam && (
                              <button
                                onClick={() => handleCreateExam(session._id)}
                                className="bg-gradient-to-r from-purple-500 to-pink-600 text-white py-1 px-3 rounded-lg text-sm font-medium hover:shadow-lg transition-all duration-200"
                              >
                                Create Exam
                              </button>
                            )}
                          </div>
                          
                          {session.scheduledExam ? (
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-sm text-gray-700">
                                    <span className="font-medium">Scheduled for:</span>{' '}
                                    {formatDateTime(session.scheduledExam.date, session.scheduledExam.time)}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Mode:</span>{' '}
                                    {session.scheduledExam.isOnline ? 'Online' : 'Offline'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Examiner:</span>{' '}
                                    {session.scheduledExam.assignedExaminer}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleViewExam(session, session.scheduledExam)}
                                  className="bg-gradient-to-r from-purple-500 to-pink-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:shadow-lg transition-all duration-200"
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          ) : examDate ? (
                            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                              <p className="text-sm text-yellow-800">
                                <span className="font-medium">Exam will be scheduled automatically</span> for {formatDate(examDate.toISOString())}
                                {lastSession && ` (1 week after last session on ${formatDate(lastSession.date)})`}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">No exam information available</p>
                          )}
                        </div>

                        {!session.isLive && session.zoomLink && (
                          <div className="mt-4">
                            <a 
                              href={session.zoomLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:shadow-lg transition-all duration-200"
                            >
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                              Join Meeting
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          )}

          {activeTab === 'exams' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
                  Scheduled Exams
                </h2>
                <p className="text-gray-600">Manage your scheduled exams</p>
              </div>
              
              {exams.length === 0 ? (
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-12 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">No exams scheduled</h3>
                    <p className="text-gray-500 mb-4">Exams are automatically scheduled when you create training sessions</p>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="bg-gradient-to-r from-purple-500 to-pink-600 text-white py-2 px-6 rounded-lg font-medium hover:shadow-lg transition-all duration-200"
                    >
                      Create Session
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {exams.map(exam => (
                    <div key={exam._id} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 overflow-hidden">
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-xl font-bold text-gray-800">{exam.sessionId?.title}</h3>
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                exam.isOnline 
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                                  : 'bg-green-100 text-green-800 border border-green-200'
                              }`}>
                                {exam.isOnline ? '🌐 Online Exam' : '📍 Offline Exam'}
                              </span>
                            </div>
                            <p className="text-gray-600 leading-relaxed">{exam.sessionId?.description}</p>
                          </div>
                          <button
                            onClick={() => handleCancelExam(exam._id)}
                            className="bg-gradient-to-r from-red-500 to-pink-600 text-white p-2 rounded-lg hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ml-4"
                            title="Cancel Exam"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">Exam Details</h4>
                            <div className="space-y-2">
                              <div className="flex items-center text-sm text-gray-600 bg-white/50 p-2 rounded-lg">
                                <span className="font-medium w-24">Date:</span>
                                <span>{formatDate(exam.date)}</span>
                              </div>
                              <div className="flex items-center text-sm text-gray-600 bg-white/50 p-2 rounded-lg">
                                <span className="font-medium w-24">Time:</span>
                                <span>{exam.time} ({exam.duration} min)</span>
                              </div>
                              <div className="flex items-center text-sm text-gray-600 bg-white/50 p-2 rounded-lg">
                                <span className="font-medium w-24">Examiner:</span>
                                <span>{exam.assignedExaminer}</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold text-gray-700 mb-2">Exam Location</h4>
                            <div className="text-sm text-gray-600 bg-white/50 p-3 rounded-lg">
                              {exam.isOnline ? (
                                <div>
                                  <p className="font-medium">Online Exam</p>
                                  {exam.onlineLink && (
                                    <a href={exam.onlineLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                                      {exam.onlineLink}
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <p className="font-medium">Offline Exam</p>
                                  <p>{exam.location}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => handleViewExam(exam.sessionId, exam)}
                            className="bg-gradient-to-r from-purple-500 to-pink-600 text-white py-2 px-6 rounded-lg font-medium hover:shadow-lg transition-all duration-200"
                          >
                            Edit Exam Details
                          </button>
                        </div>
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
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-white/20 p-6 sticky top-6">
            <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4">
              Calendar Overview
            </h2>
            <div className="bg-white rounded-xl shadow-inner border border-gray-200 p-4">
              <Calendar
                tileClassName={tileClassName}
                tileContent={tileContent}
                onClickDay={handleDayClick}
                className="border-0"
              />
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>Click on highlighted dates to view scheduled sessions</p>
            </div>
            
            {/* Exams Summary */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h3 className="font-semibold text-gray-700 mb-2">Exams Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Exams:</span>
                  <span className="font-medium">{exams.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Online Exams:</span>
                  <span className="font-medium text-blue-600">{exams.filter(e => e.isOnline).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Offline Exams:</span>
                  <span className="font-medium text-green-600">{exams.filter(e => !e.isOnline).length}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Reschedule Modal */}
      {showRescheduleCalendar && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-white/20 max-w-md w-full transform transition-all duration-300 scale-100">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Reschedule Session</h3>
              <p className="text-gray-600 mb-4">Select new date and time for your session</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Date</label>
                  <DatePicker
                    selected={selectedDate}
                    onChange={date => setSelectedDate(date)}
                    minDate={new Date()}
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Time</label>
                    <input
                      type="time"
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={selectedTime}
                      onChange={e => setSelectedTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Duration (min)</label>
                    <input
                      type="number"
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={selectedDuration}
                      onChange={e => setSelectedDuration(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowRescheduleCalendar(false)}
                  className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNewReschedule}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white py-2 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exam Modal */}
      {examModal.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-white/20 max-w-md w-full transform transition-all duration-300 scale-100">
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-2">Exam Details</h3>
              <p className="text-gray-600 mb-4">Update exam information</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Examiner Name</label>
                  <input
                    type="text"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    value={examModal.exam.assignedExaminer}
                    onChange={(e) => setExamModal(prev => ({
                      ...prev,
                      exam: { ...prev.exam, assignedExaminer: e.target.value }
                    }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Exam Date</label>
                  <input
                    type="date"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    value={examModal.exam.date.split('T')[0]}
                    onChange={(e) => setExamModal(prev => ({
                      ...prev,
                      exam: { ...prev.exam, date: e.target.value }
                    }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Exam Time</label>
                  <input
                    type="time"
                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    value={examModal.exam.time}
                    onChange={(e) => setExamModal(prev => ({
                      ...prev,
                      exam: { ...prev.exam, time: e.target.value }
                    }))}
                  />
                </div>
                
                {examModal.exam.isOnline ? (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Online Link</label>
                    <input
                      type="url"
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={examModal.exam.onlineLink}
                      onChange={(e) => setExamModal(prev => ({
                        ...prev,
                        exam: { ...prev.exam, onlineLink: e.target.value }
                      }))}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                      value={examModal.exam.location}
                      onChange={(e) => setExamModal(prev => ({
                        ...prev,
                        exam: { ...prev.exam, location: e.target.value }
                      }))}
                    />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setExamModal({ show: false, session: null, exam: null })}
                  className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUpdateExam(examModal.exam._id, {
                    assignedExaminer: examModal.exam.assignedExaminer,
                    date: examModal.exam.date,
                    time: examModal.exam.time,
                    onlineLink: examModal.exam.onlineLink,
                    location: examModal.exam.location
                  })}
                  className="bg-gradient-to-r from-purple-500 to-pink-600 text-white py-2 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  Update Exam
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