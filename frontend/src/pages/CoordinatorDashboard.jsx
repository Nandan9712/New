import React, { useState, useEffect } from 'react';
import keycloak from '../keycloak';
import { 
  FiLogOut, 
  FiClock, 
  FiLink2, 
  FiMapPin, 
  FiUser, 
  FiBook, 
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiUsers,
  FiCalendar,
  FiMail,
  FiAward,
  FiCheckCircle,
  FiAlertCircle,
  FiX,
  FiRefreshCw
} from 'react-icons/fi';
import { FaChalkboardTeacher, FaSignOutAlt, FaBars } from 'react-icons/fa';

export default function CoordinatorDashboard() {
  const [sessions, setSessions] = useState([]);
  const [exams, setExams] = useState([]);
  const [examiners, setExaminers] = useState([]);
  const [suggest, setSuggest] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('60');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineLink, setOnlineLink] = useState('');
  const [location, setLocation] = useState('');
  const [assignedExaminer, setAssignedExaminer] = useState('');
  const [instructions, setInstructions] = useState('Please bring your student ID and arrive 15 minutes early.');
  const [totalMarks, setTotalMarks] = useState('100');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('exams');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalExams: 0,
    totalStudents: 0,
    onlineExams: 0,
    offlineExams: 0
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  // Fetch all data
  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setError('');
      await keycloak.updateToken(5);
      
      console.log('Fetching coordinator data...');
      
      const [sessionsRes, examsRes, examinersRes] = await Promise.all([
        fetch('http://localhost:5000/api/coordinator/sessions', {
          headers: { 'Authorization': `Bearer ${keycloak.token}` }
        }),
        fetch('http://localhost:5000/api/coordinator/exams', {
          headers: { 'Authorization': `Bearer ${keycloak.token}` }
        }),
        fetch('http://localhost:5000/api/coordinator/examiners', {
          headers: { 'Authorization': `Bearer ${keycloak.token}` }
        })
      ]);

      if (!sessionsRes.ok) throw new Error(`Sessions fetch failed: ${sessionsRes.status}`);
      if (!examsRes.ok) throw new Error(`Exams fetch failed: ${examsRes.status}`);
      if (!examinersRes.ok) throw new Error(`Examiners fetch failed: ${examinersRes.status}`);

      const sessionsData = await sessionsRes.json();
      const examsData = await examsRes.json();
      const examinersData = await examinersRes.json();
      
      console.log('Data fetched:', {
        sessions: sessionsData.length,
        exams: examsData.length,
        examiners: examinersData.length
      });

      setSessions(sessionsData);
      setExams(examsData);
      setExaminers(examinersData);
      calculateStats(sessionsData, examsData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(`Failed to load data: ${error.message}`);
    }
  };

  // Calculate statistics
  const calculateStats = (sessionsData, examsData) => {
    const totalStudents = sessionsData.reduce((acc, session) => 
      acc + (session.enrolledStudents?.length || 0), 0
    );
    
    setStats({
      totalSessions: sessionsData.length,
      totalExams: examsData.length,
      totalStudents,
      onlineExams: examsData.filter(exam => exam.isOnline).length,
      offlineExams: examsData.filter(exam => !exam.isOnline).length
    });
  };

  // When session changes, fetch suggestion
  const onSessionChange = async (sid) => {
    setSessionId(sid);
    if (!sid) {
      setSuggest(null);
      return;
    }
    setLoading(true);
    try {
      await keycloak.updateToken(5);
      const res = await fetch(
        `http://localhost:5000/api/coordinator/exams/suggest-sessions/${sid}`, {
          headers: { 'Authorization': `Bearer ${keycloak.token}` }
        }
      );
      
      if (!res.ok) throw new Error('Failed to fetch suggestions');
      
      const suggestion = await res.json();
      setSuggest(suggestion);
      
      // Auto-fill form with suggestions only for new exams
      if (!editingExam) {
        if (suggestion.suggestedDate) setDate(suggestion.suggestedDate);
        if (suggestion.suggestedTime) setTime(suggestion.suggestedTime);
        setIsOnline(suggestion.sessionMode === 'online');
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setError('Failed to load session suggestions');
    }
    setLoading(false);
  };

  const handleSchedule = async () => {
    if (!sessionId || !date || !time || !assignedExaminer || (!isOnline && !location) || (isOnline && !onlineLink)) {
      alert('Please fill all required fields');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await keycloak.updateToken(5);
      const body = { 
        sessionId: editingExam ? editingExam.sessionId?._id : sessionId, 
        date, 
        time, 
        duration: selectedDuration, 
        isOnline, 
        onlineLink, 
        location,
        assignedExaminer,
        instructions,
        totalMarks
      };
      
      console.log('Sending request:', body);
      
      const url = editingExam 
        ? `http://localhost:5000/api/coordinator/exams/${editingExam._id}`
        : 'http://localhost:5000/api/coordinator/exams/schedule';
      
      const method = editingExam ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to schedule exam');
      }

      const examData = await res.json();
      
      if (editingExam) {
        setExams(exams.map(ex => ex._id === editingExam._id ? examData : ex));
        setSuccess('Exam updated successfully!');
      } else {
        setExams([...exams, examData]);
        setSuccess('Exam scheduled successfully!');
      }
      
      await fetchAllData();
      resetForm();
      
    } catch (error) {
      console.error('Error while scheduling exam:', error);
      setError(error.message);
    }
    setLoading(false);
  };

  // FIXED: Enhanced handleEditExam function with better debugging
  const handleEditExam = async (examId) => {
    console.log('Edit button clicked for exam:', examId);
    
    try {
      setError('');
      setDebugInfo(`Starting to fetch exam: ${examId}`);
      await keycloak.updateToken(5);
      
      // First try the regular endpoint
      let res = await fetch(`http://localhost:5000/api/coordinator/exams/${examId}`, {
        headers: { 'Authorization': `Bearer ${keycloak.token}` }
      });
      
      // If that fails, try the debug endpoint
      if (!res.ok) {
        console.log('Regular endpoint failed, trying debug endpoint');
        setDebugInfo('Regular endpoint failed, trying debug endpoint');
        res = await fetch(`http://localhost:5000/api/coordinator/exams-debug/${examId}`, {
          headers: { 'Authorization': `Bearer ${keycloak.token}` }
        });
      }
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Failed to fetch exam details:', errorText);
        setDebugInfo(`Failed to fetch: ${errorText}`);
        throw new Error(`Failed to fetch exam details: ${res.status} ${errorText}`);
      }
      
      const exam = await res.json();
      console.log('Exam details fetched successfully:', exam);
      setDebugInfo(`Exam fetched: ${exam._id}, Session: ${exam.sessionId?.title}`);
      
      // Set editing state first
      setEditingExam(exam);
      
      // Then set all the form fields
      setSessionId(exam.sessionId?._id || '');
      
      // Fix date formatting
      const examDate = new Date(exam.date);
      const formattedDate = examDate.toISOString().split('T')[0];
      setDate(formattedDate);
      
      setTime(exam.time || '');
      setSelectedDuration(exam.duration?.toString() || '60');
      setIsOnline(exam.isOnline || false);
      setOnlineLink(exam.onlineLink || '');
      setLocation(exam.location || '');
      setAssignedExaminer(exam.assignedExaminerId || exam.assignedExaminer || '');
      setInstructions(exam.instructions || 'Please bring your student ID and arrive 15 minutes early.');
      setTotalMarks(exam.totalMarks?.toString() || '100');
      
      // Switch to schedule tab
      setActiveTab('schedule');
      
      console.log('Form fields set for editing:', {
        date: formattedDate,
        time: exam.time,
        duration: exam.duration,
        isOnline: exam.isOnline,
        assignedExaminer: exam.assignedExaminerId || exam.assignedExaminer
      });
      
    } catch (error) {
      console.error('Error in handleEditExam:', error);
      setError(`Failed to load exam details: ${error.message}`);
      setDebugInfo(`Error: ${error.message}`);
    }
  };

  const handleDeleteExam = async (examId) => {
    if (!window.confirm('Are you sure you want to delete this exam?')) {
      return;
    }

    try {
      setError('');
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/coordinator/exams/${examId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${keycloak.token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to delete exam');
      }

      setExams(exams.filter(ex => ex._id !== examId));
      calculateStats(sessions, exams.filter(ex => ex._id !== examId));
      setSuccess('Exam deleted successfully!');
      
      await fetchAllData();
      
    } catch (error) {
      console.error('Error deleting exam:', error);
      setError(error.message);
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
    setAssignedExaminer('');
    setInstructions('Please bring your student ID and arrive 15 minutes early.');
    setTotalMarks('100');
    setSuggest(null);
    setEditingExam(null);
    setError('');
    setSuccess('');
    setDebugInfo('');
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      keycloak.logout({ redirectUri: window.location.origin });
    }
  };

  const formatDate = (dateString) => {
    try {
      const options = { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Auto-hide success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Debug: Log when editingExam changes
  useEffect(() => {
    console.log('editingExam state changed:', editingExam);
  }, [editingExam]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Mobile Sidebar Toggle */}
      <button
        className="lg:hidden fixed top-6 left-6 z-50 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 rounded-2xl shadow-2xl"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <FaBars size={20} />
      </button>

      <div className="flex">
        {/* Sidebar */}
        <div
          className={`fixed lg:static inset-y-0 left-0 z-40 w-80 bg-gradient-to-b from-blue-600 via-blue-700 to-purple-800 shadow-2xl transform transition-transform duration-300 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0`}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-8 border-b border-blue-500/30">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 flex items-center justify-center">
                  <FiUser className="text-white text-2xl" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {keycloak.tokenParsed?.name || 'Coordinator'}
                  </h2>
                  <p className="text-blue-200 text-sm">
                    {keycloak.tokenParsed?.email || 'coordinator@university.edu'}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-6 border-b border-blue-500/30">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <FiAward className="w-5 h-5" />
                Dashboard Overview
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-blue-100">
                  <span className="text-sm">Training Sessions</span>
                  <span className="font-bold text-white">{stats.totalSessions}</span>
                </div>
                <div className="flex justify-between items-center text-blue-100">
                  <span className="text-sm">Scheduled Exams</span>
                  <span className="font-bold text-white">{stats.totalExams}</span>
                </div>
                <div className="flex justify-between items-center text-blue-100">
                  <span className="text-sm">Total Students</span>
                  <span className="font-bold text-white">{stats.totalStudents}</span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-6">
              <div className="space-y-2">
                <button
                  onClick={() => { setActiveTab('exams'); setSidebarOpen(false); resetForm(); }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-left transition-all duration-200 ${
                    activeTab === 'exams'
                      ? 'bg-white text-blue-800 shadow-lg'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <FiBook className="w-5 h-5" />
                  <span className="font-semibold">Manage Exams</span>
                </button>

                <button
                  onClick={() => { setActiveTab('sessions'); setSidebarOpen(false); resetForm(); }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-left transition-all duration-200 ${
                    activeTab === 'sessions'
                      ? 'bg-white text-blue-800 shadow-lg'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <FaChalkboardTeacher className="w-5 h-5" />
                  <span className="font-semibold">All Sessions</span>
                </button>

                <button
                  onClick={() => { setActiveTab('schedule'); setSidebarOpen(false); resetForm(); }}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-left transition-all duration-200 ${
                    activeTab === 'schedule'
                      ? 'bg-white text-blue-800 shadow-lg'
                      : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <FiPlus className="w-5 h-5" />
                  <span className="font-semibold">Schedule Exam</span>
                </button>
              </div>
            </nav>

            {/* Footer */}
            <div className="p-6 border-t border-blue-500/30">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-white/10 backdrop-blur-sm text-white rounded-2xl hover:bg-white/20 transition-all duration-200 border border-white/20"
              >
                <FaSignOutAlt className="w-4 h-4" />
                <span className="font-semibold">Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 lg:ml-0">
          {/* Overlay for mobile sidebar */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <div className="p-6 lg:p-8">
            {/* Header */}
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 p-8 mb-8">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                    Exam Coordinator Dashboard
                  </h1>
                  <p className="text-gray-600 text-lg">
                    Manage training sessions and schedule exams efficiently
                  </p>
                </div>
                <div className="mt-4 lg:mt-0 flex items-center gap-4">
                  <button
                    onClick={fetchAllData}
                    className="bg-white text-blue-600 px-4 py-3 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 border border-blue-200 flex items-center space-x-2"
                  >
                    <FiRefreshCw className="w-5 h-5" />
                    <span>Refresh</span>
                  </button>
                  <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-2xl shadow-lg">
                    <p className="text-sm opacity-90">Welcome back,</p>
                    <p className="font-semibold">{keycloak.tokenParsed?.name}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Debug Info */}
            {debugInfo && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FiAlertCircle className="text-yellow-500 w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-yellow-700 font-semibold">Debug Info</p>
                      <p className="text-yellow-600 text-sm">{debugInfo}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDebugInfo('')}
                    className="text-yellow-500 hover:text-yellow-700"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FiCheckCircle className="text-green-500 w-5 h-5 flex-shrink-0" />
                  <p className="text-green-700">{success}</p>
                </div>
                <button
                  onClick={() => setSuccess('')}
                  className="text-green-500 hover:text-green-700"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FiAlertCircle className="text-red-500 w-5 h-5 flex-shrink-0" />
                  <p className="text-red-700">{error}</p>
                </div>
                <button
                  onClick={() => setError('')}
                  className="text-red-500 hover:text-red-700"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Schedule Exam Form */}
            {activeTab === 'schedule' && (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 p-8 mb-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">
                    {editingExam ? `Edit Exam: ${editingExam.sessionId?.title}` : 'Schedule New Exam'}
                  </h2>
                  {editingExam && (
                    <button
                      onClick={resetForm}
                      className="bg-gradient-to-r from-gray-500 to-gray-700 text-white px-6 py-3 rounded-2xl font-semibold hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                    >
                      <FiPlus className="w-4 h-4" />
                      New Exam
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {!editingExam && (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Training Session *
                        </label>
                        <select
                          value={sessionId}
                          onChange={e => onSessionChange(e.target.value)}
                          className="w-full p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          disabled={loading}
                        >
                          <option value="">– Select a training session –</option>
                          {sessions.length === 0 ? (
                            <option value="" disabled>No sessions available</option>
                          ) : (
                            sessions.map(s => (
                              <option key={s._id} value={s._id}>{s.title}</option>
                            ))
                          )}
                        </select>
                        {sessions.length === 0 && (
                          <p className="text-red-500 text-sm mt-2 flex items-center gap-2">
                            <FiAlertCircle className="w-4 h-4" />
                            No training sessions found. Please check if sessions exist in the system.
                          </p>
                        )}
                      </div>
                    )}

                    {editingExam && (
                      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                        <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                          <FiEdit className="w-4 h-4" />
                          Editing Exam
                        </h4>
                        <p className="text-blue-700 text-sm">
                          Session: <strong>{editingExam.sessionId?.title}</strong>
                        </p>
                        <p className="text-blue-600 text-sm mt-1">
                          Current: {formatDate(editingExam.date)} at {editingExam.time}
                        </p>
                        <p className="text-blue-600 text-sm">
                          Examiner: {editingExam.assignedExaminer}
                        </p>
                      </div>
                    )}

                    {suggest && !editingExam && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200">
                        <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                          <FiCalendar className="w-5 h-5" />
                          Session Insights
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-center p-3 bg-white rounded-xl">
                            <div className="text-blue-600 font-bold text-lg">{suggest.totalStudents}</div>
                            <div className="text-blue-800">Enrolled Students</div>
                          </div>
                          <div className="text-center p-3 bg-white rounded-xl">
                            <div className="text-purple-600 font-bold text-lg capitalize">{suggest.sessionMode}</div>
                            <div className="text-purple-800">Session Type</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Exam Date *
                        </label>
                        <div className="relative">
                          <FiCalendar className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                            className="w-full pl-12 p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Exam Time *
                        </label>
                        <div className="relative">
                          <FiClock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            type="time"
                            value={time}
                            onChange={e => setTime(e.target.value)}
                            className="w-full pl-12 p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Duration (minutes) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={selectedDuration}
                          onChange={e => setSelectedDuration(e.target.value)}
                          className="w-full p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Total Marks *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={totalMarks}
                          onChange={e => setTotalMarks(e.target.value)}
                          className="w-full p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Assign Examiner *
                      </label>
                      <select
                        value={assignedExaminer}
                        onChange={e => setAssignedExaminer(e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                      >
                        <option value="">– Select available examiner –</option>
                        {examiners.length === 0 ? (
                          <option value="" disabled>No examiners available</option>
                        ) : (
                          examiners.map(examiner => (
                            <option key={examiner.id} value={examiner.id}>
                              {examiner.name} - {examiner.specialization}
                              {examiner.available !== undefined && (
                                examiner.available ? ' ✅ Available' : ' ❌ Fully booked'
                              )}
                            </option>
                          ))
                        )}
                      </select>
                      <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                        <FiCheckCircle className="text-green-500" />
                        <span>{examiners.filter(e => e.available !== false).length} examiners available</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Exam Mode *
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => setIsOnline(true)}
                          className={`p-6 rounded-2xl border-2 transition-all duration-200 ${
                            isOnline
                              ? 'border-blue-500 bg-blue-50 shadow-lg'
                              : 'border-gray-300 hover:border-gray-400 bg-white'
                          }`}
                        >
                          <div className="text-center">
                            <FiLink2 className={`w-8 h-8 mx-auto mb-2 ${isOnline ? 'text-blue-600' : 'text-gray-400'}`} />
                            <div className={`font-semibold ${isOnline ? 'text-blue-800' : 'text-gray-700'}`}>
                              Online Exam
                            </div>
                            <div className="text-sm text-gray-600 mt-1">Remote proctoring</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsOnline(false)}
                          className={`p-6 rounded-2xl border-2 transition-all duration-200 ${
                            !isOnline
                              ? 'border-purple-500 bg-purple-50 shadow-lg'
                              : 'border-gray-300 hover:border-gray-400 bg-white'
                          }`}
                        >
                          <div className="text-center">
                            <FiMapPin className={`w-8 h-8 mx-auto mb-2 ${!isOnline ? 'text-purple-600' : 'text-gray-400'}`} />
                            <div className={`font-semibold ${!isOnline ? 'text-purple-800' : 'text-gray-700'}`}>
                              Offline Exam
                            </div>
                            <div className="text-sm text-gray-600 mt-1">Physical venue</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {isOnline ? (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Online Meeting Link *
                        </label>
                        <div className="relative">
                          <FiLink2 className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            type="url"
                            placeholder="https://meet.example.com/your-exam"
                            value={onlineLink}
                            onChange={e => setOnlineLink(e.target.value)}
                            className="w-full pl-12 p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                          Exam Location *
                        </label>
                        <div className="relative">
                          <FiMapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                          <input
                            type="text"
                            placeholder="Enter exam venue address"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                            className="w-full pl-12 p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-3">
                        Exam Instructions
                      </label>
                      <textarea
                        value={instructions}
                        onChange={e => setInstructions(e.target.value)}
                        rows="4"
                        className="w-full p-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white/50 backdrop-blur-sm resize-none"
                        placeholder="Enter detailed exam instructions for students..."
                      />
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        onClick={resetForm}
                        className="flex-1 px-8 py-4 border border-gray-300 text-gray-700 rounded-2xl font-semibold hover:bg-gray-50 transition-all duration-200 hover:shadow-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSchedule}
                        disabled={loading || !date || !time || !assignedExaminer || (!isOnline && !location) || (isOnline && !onlineLink) || (!editingExam && !sessionId)}
                        className={`flex-1 px-8 py-4 rounded-2xl font-semibold text-white transition-all duration-200 ${
                          loading || !date || !time || !assignedExaminer || (!isOnline && !location) || (isOnline && !onlineLink) || (!editingExam && !sessionId)
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:shadow-xl hover:scale-105'
                        }`}
                      >
                        {loading ? (
                          <div className="flex items-center justify-center space-x-2">
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            <span>Processing...</span>
                          </div>
                        ) : (
                          editingExam ? 'Update Exam' : 'Schedule Exam'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Manage Exams Tab */}
            {activeTab === 'exams' && (
              <div>
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 p-8 mb-8">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
                        Scheduled Exams
                      </h2>
                      <p className="text-gray-600">
                        Manage and monitor all scheduled examinations
                      </p>
                    </div>
                    <div className="flex items-center space-x-4 mt-4 lg:mt-0">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-2xl shadow-lg">
                        <div className="text-2xl font-bold">{exams.length}</div>
                        <div className="text-sm opacity-90">Total Exams</div>
                      </div>
                      <button
                        onClick={() => { setActiveTab('schedule'); resetForm(); }}
                        className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 border border-blue-200 flex items-center space-x-2"
                      >
                        <FiPlus className="w-5 h-5" />
                        <span>New Exam</span>
                      </button>
                    </div>
                  </div>
                </div>

                {exams.length === 0 ? (
                  <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 p-16 text-center">
                    <FiCalendar className="mx-auto text-6xl text-gray-300 mb-6" />
                    <h3 className="text-2xl font-bold text-gray-700 mb-4">No Exams Scheduled</h3>
                    <p className="text-gray-500 mb-8 max-w-md mx-auto">
                      Get started by scheduling your first examination for a training session
                    </p>
                    <button
                      onClick={() => { setActiveTab('schedule'); resetForm(); }}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-2xl font-semibold hover:shadow-xl transition-all duration-200 hover:scale-105"
                    >
                      Schedule Your First Exam
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {exams.map(exam => (
                      <div
                        key={exam._id}
                        className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 overflow-hidden group"
                      >
                        <div className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                                {exam.sessionId?.title || 'Session Not Found'}
                              </h3>
                              <p className="text-gray-600 text-sm line-clamp-2">
                                {exam.sessionId?.description || 'No description available'}
                              </p>
                            </div>
                            <span className={`ml-3 px-3 py-1 rounded-full text-xs font-medium ${
                              exam.isOnline 
                                ? 'bg-green-100 text-green-800 border border-green-200' 
                                : 'bg-purple-100 text-purple-800 border border-purple-200'
                            }`}>
                              {exam.isOnline ? '🌐 Online' : '📍 Offline'}
                            </span>
                          </div>

                          <div className="space-y-3 mb-4">
                            <div className="flex items-center text-sm text-gray-700 bg-gray-50/50 p-3 rounded-xl">
                              <FiCalendar className="mr-3 text-blue-500 w-4 h-4" />
                              <span className="font-medium">Date:</span>
                              <span className="ml-2">{formatDate(exam.date)}</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-700 bg-gray-50/50 p-3 rounded-xl">
                              <FiClock className="mr-3 text-green-500 w-4 h-4" />
                              <span className="font-medium">Time:</span>
                              <span className="ml-2">{exam.time} ({exam.duration} mins)</span>
                            </div>
                            <div className="flex items-center text-sm text-gray-700 bg-gray-50/50 p-3 rounded-xl">
                              <FiUser className="mr-3 text-purple-500 w-4 h-4" />
                              <span className="font-medium">Examiner:</span>
                              <span className="ml-2">{exam.assignedExaminer}</span>
                            </div>
                            {exam.isOnline ? (
                              <div className="flex items-center text-sm text-gray-700 bg-gray-50/50 p-3 rounded-xl">
                                <FiLink2 className="mr-3 text-blue-500 w-4 h-4" />
                                <a 
                                  href={exam.onlineLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline truncate"
                                >
                                  {exam.onlineLink}
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-center text-sm text-gray-700 bg-gray-50/50 p-3 rounded-xl">
                                <FiMapPin className="mr-3 text-red-500 w-4 h-4" />
                                <span className="truncate">{exam.location}</span>
                              </div>
                            )}
                          </div>

                          <div className="border-t border-gray-200 pt-4 mb-4">
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-gray-600">Total Marks:</span>
                              <span className="font-semibold text-gray-800">{exam.totalMarks}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Enrolled Students:</span>
                              <span className="font-semibold text-gray-800">
                                {exam.sessionId?.enrolledStudents?.length || 0}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditExam(exam._id)}
                              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2"
                            >
                              <FiEdit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteExam(exam._id)}
                              className="flex-1 bg-gradient-to-r from-red-500 to-pink-600 text-white py-3 px-4 rounded-xl font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2"
                            >
                              <FiTrash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* All Sessions Tab */}
            {activeTab === 'sessions' && (
              <div>
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 p-8 mb-8">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="text-2xl lg:text-3xl font-bold text-gray-800 mb-2">
                        All Training Sessions
                      </h2>
                      <p className="text-gray-600">
                        Overview of all training sessions and their details
                      </p>
                    </div>
                    <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-2xl shadow-lg mt-4 lg:mt-0">
                      <div className="text-2xl font-bold">{sessions.length}</div>
                      <div className="text-sm opacity-90">Total Sessions</div>
                    </div>
                  </div>
                </div>

                {sessions.length === 0 ? (
                  <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 p-16 text-center">
                    <FaChalkboardTeacher className="mx-auto text-6xl text-gray-300 mb-6" />
                    <h3 className="text-2xl font-bold text-gray-700 mb-4">No Training Sessions</h3>
                    <p className="text-gray-500">No training sessions available in the system</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {sessions.map(session => (
                      <div
                        key={session._id}
                        className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 overflow-hidden"
                      >
                        <div className="p-8">
                          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                            <div className="flex-1">
                              <div className="flex items-center gap-4 mb-4">
                                <h3 className="text-2xl font-bold text-gray-800">{session.title}</h3>
                                <div className="flex flex-wrap gap-2">
                                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                    session.isLive 
                                      ? 'bg-green-100 text-green-800 border border-green-200' 
                                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                                  }`}>
                                    {session.isLive ? '📍 Offline' : '🌐 Online'}
                                  </span>
                                  {session.scheduledExam && (
                                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                      Exam Scheduled
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <p className="text-gray-600 mb-6 leading-relaxed">{session.description}</p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div>
                                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <FiCalendar className="w-4 h-4 text-blue-500" />
                                    Session Schedule
                                  </h4>
                                  <div className="space-y-2">
                                    {session.classDates && session.classDates.map((slot, index) => (
                                      <div key={index} className="text-sm text-gray-600 bg-gray-50/50 p-3 rounded-xl">
                                        {formatDate(slot.date)} - {slot.time} ({slot.duration} mins)
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <FiUsers className="w-4 h-4 text-green-500" />
                                    Enrolled Students ({session.enrolledStudents?.length || 0})
                                  </h4>
                                  {session.enrolledStudents?.length > 0 ? (
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                      {session.enrolledStudents.map((student, index) => (
                                        <div key={index} className="text-sm text-gray-600 bg-gray-50/50 p-3 rounded-xl">
                                          👤 {student}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500 italic bg-gray-50/50 p-3 rounded-xl">
                                      No students enrolled yet
                                    </p>
                                  )}
                                </div>
                              </div>

                              <p className="text-sm text-gray-500">
                                Created by: {session.createdBy} • {session.classDates?.length || 0} session(s)
                              </p>
                            </div>
                          </div>

                          {session.scheduledExam && (
                            <div className="border-t border-gray-200 pt-6 mt-6">
                              <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <FiAward className="w-4 h-4 text-purple-500" />
                                Scheduled Exam
                              </h4>
                              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-200">
                                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                  <div>
                                    <p className="text-sm text-purple-800">
                                      <strong>Date:</strong> {formatDate(session.scheduledExam.date)} • 
                                      <strong> Time:</strong> {session.scheduledExam.time} • 
                                      <strong> Examiner:</strong> {session.scheduledExam.assignedExaminer}
                                    </p>
                                    <p className="text-sm text-purple-600 mt-1">
                                      <strong>Mode:</strong> {session.scheduledExam.isOnline ? 'Online' : 'Offline'} • 
                                      <strong> Duration:</strong> {session.scheduledExam.duration} minutes
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleEditExam(session.scheduledExam._id)}
                                    className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-lg transition-all duration-200 hover:scale-105"
                                  >
                                    Manage Exam
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}