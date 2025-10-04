import React, { useState, useEffect, useCallback } from 'react';
import keycloak from '../keycloak';
import { 
  FaUserCircle, 
  FaChalkboardTeacher, 
  FaCalendarAlt, 
  FaSignOutAlt, 
  FaBars,
  FaPlus,
  FaTrash,
  FaTimes,
  FaEdit,
  FaExclamationTriangle,
  FaCheckCircle,
  FaClock,
  FaBan
} from 'react-icons/fa';
import { FiClock, FiAlertTriangle } from 'react-icons/fi';
import CalendarComponent from '../components/CalendarComponent';
import { TEMP_PROFILE_IMG } from '../constants';

const ExaminerDashboard = () => {
  // Availability Management State
  const [availabilities, setAvailabilities] = useState([]);
  const [newAvailability, setNewAvailability] = useState({
    availableFrom: '',
    availableTo: ''
  });
  const [editingAvailability, setEditingAvailability] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlightDates, setHighlightDates] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('exams');
  const [showAddForm, setShowAddForm] = useState(false);

  // Assigned Exams State
  const [assignedExams, setAssignedExams] = useState([]);
  const [stats, setStats] = useState({
    totalAssigned: 0,
    completed: 0,
    upcoming: 0
  });

  const [profile, setProfile] = useState({
    name: keycloak.tokenParsed?.name || 'Examiner',
    email: keycloak.tokenParsed?.email || 'examiner@example.com',
    profileImg: TEMP_PROFILE_IMG,
    availabilityCount: 0,
    assignedExamsCount: 0,
  });

  // Fetch Availabilities
  const fetchAvailabilities = useCallback(async () => {
    try {
      await keycloak.updateToken(5);
      const res = await fetch('http://localhost:5000/api/availability/mine', {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAvailabilities(data);
      setProfile(prev => ({ ...prev, availabilityCount: data.length }));

      // Prepare highlight dates for calendar
      const newHighlightDates = {};
      data.forEach(availability => {
        const start = new Date(availability.availableFrom);
        const end = new Date(availability.availableTo);
        
        // Mark all dates in the range
        const current = new Date(start);
        while (current <= end) {
          const dateStr = current.toLocaleDateString('en-CA');
          if (!newHighlightDates[dateStr]) newHighlightDates[dateStr] = [];
          if (!newHighlightDates[dateStr].some(a => a._id === availability._id)) {
            newHighlightDates[dateStr].push({
              ...availability,
              isStart: dateStr === start.toLocaleDateString('en-CA'),
              isEnd: dateStr === end.toLocaleDateString('en-CA')
            });
          }
          current.setDate(current.getDate() + 1);
        }
      });
      setHighlightDates(newHighlightDates);
    } catch (err) {
      console.error('Error fetching availabilities:', err);
    }
  }, []);

  // Fetch Assigned Exams
  const fetchAssignedExams = useCallback(async () => {
    try {
      setLoading(true);
      await keycloak.updateToken(5);
      const res = await fetch('http://localhost:5000/api/exams/mine', {
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAssignedExams(data);
      setProfile(prev => ({ ...prev, assignedExamsCount: data.length }));

      // Calculate stats
      const now = new Date();
      const upcoming = data.filter(exam => {
        const examDateTime = new Date(`${exam.date}T${exam.time}`);
        return examDateTime > now && exam.status === 'scheduled';
      }).length;

      const completed = data.filter(exam => {
        const examDateTime = new Date(`${exam.date}T${exam.time}`);
        return examDateTime < now || exam.status === 'completed';
      }).length;

      setStats({
        totalAssigned: data.length,
        completed,
        upcoming
      });

    } catch (err) {
      console.error('Error fetching assigned exams:', err);
      alert('Error fetching exams: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailabilities();
    fetchAssignedExams();
  }, [fetchAvailabilities, fetchAssignedExams]);

  // Availability Management Functions
  const handleAddAvailability = async () => {
    if (!newAvailability.availableFrom || !newAvailability.availableTo) {
      alert('Please fill in both dates.');
      return;
    }
    try {
      setLoading(true);
      await keycloak.updateToken(5);
      const res = await fetch('http://localhost:5000/api/availability', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAvailability)
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAvailabilities();
      setNewAvailability({ availableFrom: '', availableTo: '' });
      setShowAddForm(false);
    } catch (err) {
      console.error('Error adding availability:', err);
      alert('Error adding availability: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAvailability = async (availabilityId, updatedData) => {
    try {
      setLoading(true);
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/availability/${availabilityId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData)
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAvailabilities();
      setEditingAvailability(null);
      setShowAddForm(false);
    } catch (err) {
      console.error('Error updating availability:', err);
      alert('Error updating availability: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAvailability = async (id) => {
    if (!window.confirm('Are you sure you want to delete this availability?')) return;
    
    try {
      setLoading(true);
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/availability/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(await res.text());
      await fetchAvailabilities();
    } catch (err) {
      console.error('Error deleting availability:', err);
      alert('Error deleting availability: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomizeDay = async (availabilityId, targetDate, fromTime, toTime) => {
    if (!window.confirm('Update the time for this specific day?')) return;
    
    try {
      setLoading(true);
      await keycloak.updateToken(5);
      
      const requestBody = {
        targetDate: targetDate,
        newFromTime: fromTime,
        newToTime: toTime
      };
      
      const res = await fetch(`http://localhost:5000/api/availability/${availabilityId}/day`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      const responseText = await res.text();
      
      if (!res.ok) {
        throw new Error(responseText || 'Failed to update day');
      }
      
      const result = JSON.parse(responseText);
      await fetchAvailabilities();
      alert(result.message || 'Day availability updated successfully!');
    } catch (err) {
      console.error('Error updating day availability:', err);
      
      try {
        const errorData = JSON.parse(err.message);
        alert('Error updating day: ' + (errorData.message || err.message));
      } catch (parseError) {
        alert('Error updating day: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDay = async (availabilityId, targetDate) => {
    if (!window.confirm('Remove this specific day from your availability?')) return;
    
    try {
      setLoading(true);
      await keycloak.updateToken(5);
      
      const requestBody = { targetDate: targetDate };
      
      const res = await fetch(`http://localhost:5000/api/availability/${availabilityId}/day`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      const responseText = await res.text();
      
      if (!res.ok) {
        throw new Error(responseText || 'Failed to delete day');
      }
      
      const result = JSON.parse(responseText);
      await fetchAvailabilities();
      alert(result.message || 'Day removed from availability successfully!');
    } catch (err) {
      console.error('Error deleting day from availability:', err);
      
      try {
        const errorData = JSON.parse(err.message);
        alert('Error removing day: ' + (errorData.message || err.message));
      } catch (parseError) {
        alert('Error removing day: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Exam Management Functions
  const handleCancelExam = async (examId) => {
    if (!window.confirm('Are you sure you want to cancel this exam assignment? It will be automatically reassigned to another examiner.')) {
      return;
    }

    try {
      setLoading(true);
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/exams/${examId}/cancel`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }

      const result = await res.json();
      alert(result.message);
      await fetchAssignedExams(); // Refresh the list
    } catch (err) {
      console.error('Error cancelling exam:', err);
      
      try {
        const errorData = JSON.parse(err.message);
        alert('Error cancelling exam: ' + (errorData.message || err.message));
      } catch (parseError) {
        alert('Error cancelling exam: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    keycloak.logout({ redirectUri: window.location.origin });
  };

  // Formatting Functions
  const formatDateTime = (dateString) => {
    const options = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatExamDateTime = (dateString, timeString) => {
    const options = { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    };
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(undefined, options),
      time: timeString
    };
  };

  const getExamStatus = (exam) => {
    const now = new Date();
    const examDateTime = new Date(`${exam.date}T${exam.time}`);
    
    if (exam.status === 'reassigned') {
      return { type: 'reassigned', text: 'Reassigned', color: 'bg-gray-500' };
    }
    
    if (examDateTime < now) {
      return { type: 'completed', text: 'Completed', color: 'bg-green-500' };
    } else if (examDateTime < new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
      return { type: 'upcoming', text: 'Tomorrow', color: 'bg-orange-500' };
    } else {
      return { type: 'scheduled', text: 'Scheduled', color: 'bg-blue-500' };
    }
  };

  const handleCustomizeAvailability = (availability) => {
    setEditingAvailability(availability);
    setActiveSidebarTab('availability');
    setShowAddForm(true);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 font-sans">
      {/* Hamburger Menu for Sidebar */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 bg-blue-500 text-white p-3 rounded-xl shadow-lg hover:bg-blue-600 transition-colors"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <FaBars size={20} />
      </button>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-gradient-to-br from-blue-600 via-blue-500 to-blue-700 shadow-2xl flex flex-col items-center py-8 px-6 w-80 z-40 transition-transform duration-300 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <img src={profile.profileImg} alt="Profile" className="w-28 h-28 rounded-full border-4 border-white/20 shadow-2xl mb-6" />
        <div className="font-bold text-2xl text-white mb-2 text-center font-sans tracking-wide">{profile.name}</div>
        <div className="text-blue-100 text-sm mb-8 text-center font-medium">{profile.email}</div>
        
        <nav className="flex flex-col gap-3 w-full mb-8">
          <button 
            onClick={() => {
              setActiveSidebarTab('exams');
              setShowAddForm(false);
              setEditingAvailability(null);
            }}
            className={`w-full text-left px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center gap-3 ${
              activeSidebarTab === 'exams' 
                ? 'bg-white text-blue-700 shadow-lg transform scale-105' 
                : 'text-white/90 hover:bg-white/10 hover:shadow-md'
            }`}
          >
            <FaChalkboardTeacher className="text-lg" /> Assigned Exams
          </button>
          <button 
            onClick={() => {
              setActiveSidebarTab('availability');
              setShowAddForm(false);
              setEditingAvailability(null);
            }}
            className={`w-full text-left px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center gap-3 ${
              activeSidebarTab === 'availability' 
                ? 'bg-white text-blue-700 shadow-lg transform scale-105' 
                : 'text-white/90 hover:bg-white/10 hover:shadow-md'
            }`}
          >
            <FaCalendarAlt className="text-lg" /> My Availability
          </button>
          <button 
            onClick={() => {
              setActiveSidebarTab('availability');
              setShowAddForm(true);
              setEditingAvailability(null);
            }}
            className={`w-full text-left px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center gap-3 ${
              activeSidebarTab === 'add' 
                ? 'bg-white text-blue-700 shadow-lg transform scale-105' 
                : 'text-white/90 hover:bg-white/10 hover:shadow-md'
            }`}
          >
            <FaPlus className="text-lg" /> Add Availability
          </button>
        </nav>
        
        <div className="mt-auto w-full">
          <div className="bg-white/10 rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-white/80 text-sm mb-1">Assigned Exams</div>
                <div className="text-white text-2xl font-bold">{profile.assignedExamsCount}</div>
              </div>
              <div>
                <div className="text-white/80 text-sm mb-1">Availabilities</div>
                <div className="text-white text-2xl font-bold">{profile.availabilityCount}</div>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleLogout} 
            className="w-full bg-white/20 text-white font-semibold px-6 py-4 rounded-xl shadow-lg hover:bg-white/30 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3"
          >
            <FaSignOutAlt /> Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 sm:px-6 md:px-8 overflow-y-auto md:ml-80">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center py-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight font-sans">
              Examiner Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              {activeSidebarTab === 'exams' ? 'Manage your assigned exam sessions' : 
               activeSidebarTab === 'availability' ? 'Manage your availability schedule' : 
               'Add your availability'}
            </p>
          </div>
          
          <button 
            onClick={() => setShowCalendar(!showCalendar)}
            className="lg:hidden bg-blue-500 text-white px-6 py-3 rounded-xl shadow hover:bg-blue-600 transition-all duration-200 font-medium"
          >
            {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Assigned Exams Section */}
            {activeSidebarTab === 'exams' && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FaChalkboardTeacher className="text-blue-600 text-lg" />
                  </div>
                  Your Assigned Exams
                </h2>
                
                {loading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="text-gray-600 mt-4">Loading assigned exams...</p>
                  </div>
                ) : assignedExams.length === 0 ? (
                  <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl">
                    <FaChalkboardTeacher className="mx-auto text-5xl text-blue-400 mb-4" />
                    <p className="text-lg text-gray-700 mb-2">No exams assigned to you</p>
                    <p className="text-gray-500">You will see exams here when they are assigned to you</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {assignedExams.map((exam) => {
                      const formattedDateTime = formatExamDateTime(exam.date, exam.time);
                      const status = getExamStatus(exam);
                      
                      return (
                        <div key={exam._id} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-6 hover:shadow-md transition-all duration-200">
                          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <span className={`px-3 py-1 rounded-full text-white text-sm font-medium ${status.color}`}>
                                  {status.text}
                                </span>
                                {exam.sessionId?.isLive && (
                                  <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium">
                                    Live Session
                                  </span>
                                )}
                              </div>
                              
                              <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {exam.sessionId?.title || 'Untitled Session'}
                              </h3>
                              
                              <p className="text-gray-600 mb-4 line-clamp-2">
                                {exam.sessionId?.description || 'No description available'}
                              </p>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="flex items-center gap-2">
                                  <FaCalendarAlt className="text-blue-500" />
                                  <span className="text-gray-700 font-medium">{formattedDateTime.date}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FaClock className="text-blue-500" />
                                  <span className="text-gray-700 font-medium">{formattedDateTime.time}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FiAlertTriangle className="text-blue-500" />
                                  <span className="text-gray-700 font-medium">
                                    Duration: {exam.duration || 60} mins
                                  </span>
                                </div>
                              </div>
                              
                              {exam.location && (
                                <div className="mt-3">
                                  <p className="text-gray-600">
                                    <strong>Location:</strong> {exam.location}
                                  </p>
                                </div>
                              )}
                              
                              {exam.onlineLink && (
                                <div className="mt-2">
                                  <p className="text-gray-600">
                                    <strong>Online Link:</strong> 
                                    <a href={exam.onlineLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline ml-1">
                                      Join Session
                                    </a>
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col gap-3">
                              <button
                                onClick={() => handleCancelExam(exam._id)}
                                disabled={loading || status.type === 'completed' || status.type === 'reassigned'}
                                className={`px-6 py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow hover:shadow-lg ${
                                  loading || status.type === 'completed' || status.type === 'reassigned'
                                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                                    : 'bg-red-500 hover:bg-red-600 text-white'
                                }`}
                              >
                                <FaBan /> Cancel Assignment
                              </button>
                              
                              {status.type === 'reassigned' && (
                                <div className="text-center text-sm text-gray-500">
                                  This exam has been reassigned
                                </div>
                              )}
                              
                              {status.type === 'completed' && (
                                <div className="text-center text-sm text-green-600 font-medium">
                                  <FaCheckCircle className="inline mr-1" />
                                  Completed
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Availability Management Section */}
            {(activeSidebarTab === 'availability' || activeSidebarTab === 'add') && (
              <>
                {showAddForm && (
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FaPlus className="text-blue-600 text-lg" />
                      </div>
                      {editingAvailability ? 'Edit Availability' : 'Add New Availability'}
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="space-y-2">
                        <label className="block text-gray-700 font-semibold mb-3">Start Date & Time</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <FiClock className="text-gray-400 text-lg" />
                          </div>
                          <input
                            type="datetime-local"
                            value={editingAvailability ? 
                              new Date(editingAvailability.availableFrom).toISOString().slice(0, 16) : 
                              newAvailability.availableFrom
                            }
                            onChange={(e) => {
                              if (editingAvailability) {
                                setEditingAvailability({
                                  ...editingAvailability,
                                  availableFrom: e.target.value
                                });
                              } else {
                                setNewAvailability({ ...newAvailability, availableFrom: e.target.value });
                              }
                            }}
                            className="pl-12 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-gray-700 font-semibold mb-3">End Date & Time</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <FiClock className="text-gray-400 text-lg" />
                          </div>
                          <input
                            type="datetime-local"
                            value={editingAvailability ? 
                              new Date(editingAvailability.availableTo).toISOString().slice(0, 16) : 
                              newAvailability.availableTo
                            }
                            onChange={(e) => {
                              if (editingAvailability) {
                                setEditingAvailability({
                                  ...editingAvailability,
                                  availableTo: e.target.value
                                });
                              } else {
                                setNewAvailability({ ...newAvailability, availableTo: e.target.value });
                              }
                            }}
                            className="pl-12 w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-4">
                      <button
                        onClick={() => {
                          setShowAddForm(false);
                          setActiveSidebarTab('availability');
                          setEditingAvailability(null);
                        }}
                        className="px-8 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (editingAvailability) {
                            handleUpdateAvailability(editingAvailability._id, {
                              availableFrom: editingAvailability.availableFrom,
                              availableTo: editingAvailability.availableTo
                            });
                          } else {
                            handleAddAvailability();
                          }
                        }}
                        disabled={loading || 
                          (editingAvailability ? 
                            (!editingAvailability.availableFrom || !editingAvailability.availableTo) :
                            (!newAvailability.availableFrom || !newAvailability.availableTo)
                          )
                        }
                        className={`px-8 py-3 rounded-xl font-semibold text-white transition-all duration-200 ${
                          loading || 
                          (editingAvailability ? 
                            (!editingAvailability.availableFrom || !editingAvailability.availableTo) :
                            (!newAvailability.availableFrom || !newAvailability.availableTo)
                          )
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-blue-500 hover:bg-blue-600 shadow-lg hover:shadow-xl'
                        }`}
                      >
                        {loading ? (editingAvailability ? 'Updating...' : 'Adding...') : 
                         (editingAvailability ? 'Update Availability' : 'Add Availability')}
                      </button>
                    </div>
                  </div>
                )}

                {!showAddForm && (
                  <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FaCalendarAlt className="text-blue-600 text-lg" />
                      </div>
                      Your Availabilities
                    </h2>
                    
                    {availabilities.length === 0 ? (
                      <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl">
                        <FaCalendarAlt className="mx-auto text-5xl text-blue-400 mb-4" />
                        <p className="text-lg text-gray-700 mb-2">No availabilities added yet</p>
                        <p className="text-gray-500 mb-6">Start by adding your first availability slot</p>
                        <button
                          onClick={() => {
                            setActiveSidebarTab('availability');
                            setShowAddForm(true);
                          }}
                          className="bg-blue-500 text-white px-6 py-3 rounded-xl hover:bg-blue-600 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl"
                        >
                          Add Your First Availability
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {availabilities.map((availability) => (
                          <div key={availability._id} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-100 p-6 hover:shadow-md transition-all duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div>
                                <p className="text-sm text-gray-500 font-medium mb-2">START TIME</p>
                                <p className="font-semibold text-gray-800 text-lg">{formatDateTime(availability.availableFrom)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500 font-medium mb-2">END TIME</p>
                                <p className="font-semibold text-gray-800 text-lg">{formatDateTime(availability.availableTo)}</p>
                              </div>
                            </div>
                            <div className="mt-6 pt-4 border-t border-blue-200/50 flex justify-end gap-3">
                              <button
                                onClick={() => handleCustomizeAvailability(availability)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium shadow hover:shadow-lg"
                                disabled={loading}
                              >
                                <FaEdit /> Edit
                              </button>
                              <button
                                onClick={() => handleDeleteAvailability(availability._id)}
                                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium shadow hover:shadow-lg"
                                disabled={loading}
                              >
                                <FaTrash /> Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Calendar Section - Desktop */}
          <div className="hidden lg:block">
            <div className="sticky top-8">
              <CalendarComponent
                highlightDates={highlightDates}
                onDateClick={(date) => console.log('Date clicked:', date)}
                onCustomize={handleCustomizeDay}
                onDeleteDay={handleDeleteDay}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Section - Mobile */}
      {showCalendar && (
        <div className="lg:hidden fixed inset-0 bg-white z-50">
          <div className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Availability Calendar</h2>
              <button
                onClick={() => setShowCalendar(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <FaTimes className="w-6 h-6 text-gray-600" />
              </button>
            </div>
            <div className="flex-1">
              <CalendarComponent
                highlightDates={highlightDates}
                onDateClick={(date) => {
                  console.log('Date clicked:', date);
                  setShowCalendar(false);
                }}
                onCustomize={handleCustomizeDay}
                onDeleteDay={handleDeleteDay}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default ExaminerDashboard;