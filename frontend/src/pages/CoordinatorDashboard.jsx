import React, { useState, useEffect } from 'react';
import keycloak from '../keycloak';
import { FiLogOut, FiCalendar, FiClock, FiLink2, FiMapPin, FiUser, FiBook, FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import { FaChalkboardTeacher, FaSignOutAlt, FaBars } from 'react-icons/fa';
import CalendarComponent from '../components/CalendarComponent';

export default function CoordinatorDashboard() {
  const [sessions, setSessions] = useState([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [suggest, setSuggest] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('60');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineLink, setOnlineLink] = useState('');
  const [location, setLocation] = useState('');
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('exams');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlightDates, setHighlightDates] = useState({});
  const [popupData, setPopupData] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [editingExam, setEditingExam] = useState(null);

  // fetch all data
  useEffect(() => {
    const fetchData = async () => {
      await keycloak.updateToken(5);
      const [sessionsRes, examsRes] = await Promise.all([
        fetch('http://localhost:5000/api/coordinator/sessions', {
          headers: { 'Authorization': `Bearer ${keycloak.token}` }
        }),
        fetch('http://localhost:5000/api/coordinator/exams', {
          headers: { 'Authorization': `Bearer ${keycloak.token}` }
        })
      ]);
      setSessions(await sessionsRes.json());
      const examsData = await examsRes.json();
      setExams(examsData);
      prepareHighlightDates(examsData);
    };
    fetchData();
  }, []);

  // prepare dates to highlight in calendar
  const prepareHighlightDates = (examsData) => {
    const dates = {};
    examsData.forEach(exam => {
      if (exam.date) {
        const dateKey = new Date(exam.date).toLocaleDateString('en-CA');
        if (!dates[dateKey]) dates[dateKey] = [];
        dates[dateKey].push(exam);
      }
    });
    setHighlightDates(dates);
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
      const body = { 
        sessionId, 
        date, 
        time, 
        duration: selectedDuration, 
        isOnline, 
        onlineLink, 
        location,
        examId: editingExam?._id 
      };
      
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
        const newExam = await res.json();
        if (editingExam) {
          // Update existing exam
          setExams(exams.map(ex => ex._id === editingExam._id ? newExam : ex));
        } else {
          // Add new exam
          setExams([...exams, newExam]);
        }
        prepareHighlightDates([...exams.filter(ex => ex._id !== editingExam?._id), newExam]);
        resetForm();
        alert(editingExam ? 'Exam rescheduled successfully!' : 'Exam scheduled successfully!');
      }
    } catch (error) {
      console.error('Error while scheduling exam:', error);
      alert('Unexpected error occurred');
    }
    setLoading(false);
  };

  const handleEditExam = async (examId) => {
    try {
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/coordinator/exams/${examId}`, {
        headers: { 'Authorization': `Bearer ${keycloak.token}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch exam details');
      }
      
      const exam = await res.json();
      setEditingExam(exam);
      setSessionId(exam.sessionId._id);
      setDate(exam.date);
      setTime(exam.time);
      setSelectedDuration(exam.duration.toString());
      setIsOnline(exam.isOnline);
      setOnlineLink(exam.onlineLink || '');
      setLocation(exam.location || '');
      setShowScheduleForm(true);
      
      // Fetch suggestions for this session
      onSessionChange(exam.sessionId._id);
      
    } catch (error) {
      console.error('Error fetching exam details:', error);
      alert('Failed to load exam details');
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam?')) {
      return;
    }

    try {
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/coordinator/exams/${examId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${keycloak.token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        alert('Error: ' + (err.message || 'Failed to delete exam'));
      } else {
        setExams(exams.filter(ex => ex._id !== examId));
        prepareHighlightDates(exams.filter(ex => ex._id !== examId));
        alert('Exam deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting exam:', error);
      alert('Failed to delete exam');
    }
  };

  const resetForm = () => {
    setSessionId('');
    setDate('');
    setTime('');
    setSelectedDuration('60');
    setIsOnline(false);
    setOnlineLink('');
    setLocation('');
    setSuggest(null);
    setEditingExam(null);
    setShowScheduleForm(false);
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

  const handleCalendarClick = (date) => {
    const key = date.toLocaleDateString('en-CA');
    if (highlightDates[key]) {
      setPopupData({
        date: key,
        exams: highlightDates[key],
      });
    }
  };

  const closePopup = () => {
    setPopupData(null);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white font-sans">
      {/* Hamburger Menu for Sidebar */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 bg-blue-500 text-white p-2 rounded-full shadow-lg"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <FaBars size={24} />
      </button>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-gradient-to-b from-blue-100 via-blue-50 to-white shadow-2xl border-r border-blue-300 flex flex-col items-center py-10 px-6 w-[260px] z-40 transition-transform transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="w-24 h-24 rounded-full border-4 border-blue-300 shadow-lg mb-4 bg-blue-200 flex items-center justify-center">
          <FiUser className="text-blue-600 text-4xl" />
        </div>
        <div className="font-extrabold text-2xl text-blue-800 mb-1 text-center font-serif tracking-wide">
          {keycloak.tokenParsed?.name || 'Coordinator'}
        </div>
        <div className="text-blue-600 text-sm mb-10 text-center font-medium">
          {keycloak.tokenParsed?.email || 'coordinator@example.com'}
        </div>
        
        <nav className="flex flex-col gap-4 w-full mb-10">
          <button 
            onClick={() => setActiveTab('exams')} 
            className={`w-full text-left px-6 py-3 rounded-2xl font-bold text-lg transition tracking-wide flex items-center gap-3 ${activeTab === 'exams' ? 'bg-white text-blue-800 shadow-lg' : 'text-blue-600 hover:bg-blue-100 hover:shadow-md'}`}
          >
            <FiBook /> View Exams
          </button>
          <button 
            onClick={() => setActiveTab('schedule')} 
            className={`w-full text-left px-6 py-3 rounded-2xl font-bold text-lg transition tracking-wide flex items-center gap-3 ${activeTab === 'schedule' ? 'bg-white text-blue-800 shadow-lg' : 'text-blue-600 hover:bg-blue-100 hover:shadow-md'}`}
          >
            <FiCalendar /> Schedule Exam
          </button>
        </nav>
        
        <button 
          onClick={handleLogout} 
          className="mt-auto mb-8 w-11/12 bg-white text-blue-800 font-bold px-6 py-3 rounded-2xl shadow-lg hover:bg-blue-100 hover:shadow-xl transition tracking-wide flex items-center justify-center gap-3"
        >
          <FaSignOutAlt /> Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 sm:px-6 md:px-8 overflow-y-auto md:ml-[260px]">
        {activeTab === 'schedule' && (
          <div className="py-8">
            <h2 className="text-3xl font-extrabold text-blue-900 mb-6 tracking-tight text-center font-serif">
              {editingExam ? 'Reschedule Exam' : 'Schedule New Exam'}
            </h2>
            
            <div className="bg-white rounded-lg shadow-md p-6 max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label className="block text-blue-800 font-semibold mb-2">Training Session</label>
                  <select
                    value={sessionId}
                    onChange={e => onSessionChange(e.target.value)}
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={loading || !!editingExam}
                  >
                    <option value="">– Select a session –</option>
                    {sessions.map(s => (
                      <option key={s._id} value={s._id}>{s.title}</option>
                    ))}
                  </select>
                </div>

                {suggest && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="text-blue-800 font-bold mb-3">Session Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-blue-700">Total Students:</span>
                        <span className="font-semibold">{suggest.totalStudents}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Online Slots:</span>
                        <span className="font-semibold">{suggest.onlineSessions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Offline Slots:</span>
                        <span className="font-semibold">{suggest.offlineSessions}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                <div className="form-group">
                  <label className="block text-blue-800 font-semibold mb-2">Date</label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-3.5 text-blue-500" />
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full pl-10 p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="block text-blue-800 font-semibold mb-2">Time</label>
                  <div className="relative">
                    <FiClock className="absolute left-3 top-3.5 text-blue-500" />
                    <input
                      type="time"
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      className="w-full pl-10 p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="block text-blue-800 font-semibold mb-2">Duration (minutes)</label>
                  <input
                    type="number"
                    min="1"
                    value={selectedDuration}
                    onChange={e => setSelectedDuration(e.target.value)}
                    className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-blue-800 font-semibold mb-3">Exam Mode</label>
                <div className="flex gap-4">
                  <label className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer ${isOnline ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                    <input
                      type="radio"
                      checked={isOnline}
                      onChange={() => setIsOnline(true)}
                      className="text-blue-600 focus:ring-blue-500"
                      disabled={loading}
                    />
                    <span>Online Exam</span>
                  </label>
                  <label className={`flex items-center space-x-2 p-3 border rounded-lg cursor-pointer ${!isOnline ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                    <input
                      type="radio"
                      checked={!isOnline}
                      onChange={() => setIsOnline(false)}
                      className="text-blue-600 focus:ring-blue-500"
                      disabled={loading}
                    />
                    <span>Offline Exam</span>
                  </label>
                </div>
              </div>

              {isOnline ? (
                <div className="mt-6">
                  <label className="block text-blue-800 font-semibold mb-2">Online Link</label>
                  <div className="relative">
                    <FiLink2 className="absolute left-3 top-3.5 text-blue-500" />
                    <input
                      type="text"
                      placeholder="https://example.com/meeting"
                      value={onlineLink}
                      onChange={e => setOnlineLink(e.target.value)}
                      className="w-full pl-10 p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={loading}
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <label className="block text-blue-800 font-semibold mb-2">Location</label>
                  <div className="relative">
                    <FiMapPin className="absolute left-3 top-3.5 text-blue-500" />
                    <input
                      type="text"
                      placeholder="Exam venue address"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      className="w-full pl-10 p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-center gap-4">
                <button
                  onClick={resetForm}
                  className="px-8 py-3 rounded-xl font-bold text-blue-800 bg-white border border-blue-300 hover:bg-blue-50 transition shadow-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={loading || !sessionId || !date || !time || (!isOnline && !location)}
                  className={`px-8 py-3 rounded-xl font-bold text-white ${loading || !sessionId || !date || !time || (!isOnline && !location) ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} transition shadow-lg`}
                >
                  {loading ? 'Processing...' : (editingExam ? 'Reschedule Exam' : 'Schedule Exam')}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="py-8">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-extrabold text-blue-900 tracking-tight font-serif">
                Scheduled Exams
              </h2>
              <div className="flex gap-4">
                <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-semibold">
                  {exams.length} exam{exams.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                  <FiPlus /> New Exam
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : exams.length === 0 ? (
              <div className="text-center py-16">
                <FiCalendar className="mx-auto text-6xl text-blue-300 mb-4" />
                <p className="text-xl text-blue-700">No exams scheduled yet</p>
                <button
                  onClick={() => setActiveTab('schedule')}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Schedule First Exam
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map(ex => (
                  <div key={ex._id} className="bg-white rounded-xl shadow-md overflow-hidden border border-blue-100 hover:shadow-lg transition">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-bold text-blue-900">
                          {ex.sessionId?.title || 'Session not found'}
                        </h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${ex.isOnline ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                          {ex.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>

                      <div className="space-y-3 mb-6">
                        <div className="flex items-center text-blue-700">
                          <FiCalendar className="mr-2 text-blue-500" />
                          <span>{formatDate(ex.date)}</span>
                        </div>
                        <div className="flex items-center text-blue-700">
                          <FiClock className="mr-2 text-blue-500" />
                          <span>{ex.time}</span>
                        </div>
                        {ex.isOnline ? (
                          <div className="flex items-center text-blue-700">
                            <FiLink2 className="mr-2 text-blue-500" />
                            <a href={ex.onlineLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              Join Exam
                            </a>
                          </div>
                        ) : (
                          <div className="flex items-center text-blue-700">
                            <FiMapPin className="mr-2 text-blue-500" />
                            <span>{ex.location}</span>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-gray-200 pt-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Examiner:</span>
                          <span className="font-medium">{ex.assignedExaminer || 'Not assigned'}</span>
                        </div>
                        <div className="flex justify-between text-sm mt-2">
                          <span className="text-gray-600">Status:</span>
                          <span className="font-medium text-yellow-600">Scheduled</span>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleEditExam(ex._id)}
                          className="flex-1 bg-yellow-500 text-white py-2 px-3 rounded text-sm hover:bg-yellow-600 transition flex items-center justify-center gap-1"
                        >
                          <FiEdit /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteExam(ex._id)}
                          className="flex-1 bg-red-500 text-white py-2 px-3 rounded text-sm hover:bg-red-600 transition flex items-center justify-center gap-1"
                        >
                          <FiTrash2 /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Calendar Section */}
      <div className={`fixed top-0 left-0 w-full h-screen bg-white z-50 transition-transform transform ${showCalendar ? 'translate-y-0' : '-translate-y-full'} lg:relative lg:translate-y-0 lg:w-[300px] lg:h-auto lg:bg-blue-50 lg:shadow-2xl lg:border-l lg:border-blue-100 lg:p-4 lg:flex lg:flex-col lg:z-30 lg:overflow-y-auto`}>
        {showCalendar && (
          <button
            className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg lg:hidden"
            onClick={() => setShowCalendar(false)}
          >
            Close
          </button>
        )}
        <h3 className="text-xl font-bold text-blue-800 mb-4 text-center">Exam Calendar</h3>
        <CalendarComponent
          highlightDates={highlightDates}
          onDateClick={handleCalendarClick}
        />
      </div>

      {/* Calendar Toggle for Small Screens */}
      <button
        className={`block md:hidden fixed bottom-6 right-6 z-50 bg-blue-500 text-white p-3 rounded-full shadow-lg ${showCalendar ? 'hidden' : ''}`}
        onClick={() => setShowCalendar(true)}
      >
        <FiCalendar size={24} />
      </button>

      {/* Popup Component */}
      {popupData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-11/12 max-w-md">
            <h2 className="text-xl font-bold text-blue-800 mb-4">Exams on {popupData.date}</h2>
            <ul className="space-y-3">
              {popupData.exams.map((exam, index) => (
                <li key={index} className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-blue-900 font-semibold">{exam.sessionId?.title || 'Untitled Exam'}</p>
                  <p className="text-sm text-blue-700">
                    {exam.time} • {exam.isOnline ? 'Online' : 'Offline'}
                  </p>
                  {exam.isOnline ? (
                    <p className="text-sm text-blue-600 mt-1">
                      <a href={exam.onlineLink} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {exam.onlineLink}
                      </a>
                    </p>
                  ) : (
                    <p className="text-sm text-blue-700 mt-1">{exam.location}</p>
                  )}
                </li>
              ))}
            </ul>
            <button
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
              onClick={closePopup}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}