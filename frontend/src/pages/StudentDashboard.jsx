import React, { useEffect, useState } from 'react';
import keycloak from '../keycloak';
import { 
  FaUserCircle, 
  FaChalkboardTeacher, 
  FaCalendarAlt, 
  FaSignOutAlt, 
  FaBars,
  FaVideo,
  FaUsers,
  FaBook,
  FaCheckCircle
} from 'react-icons/fa';
import { FiClock, FiMapPin, FiSearch } from 'react-icons/fi';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../styles/StudentDashboard.css';

// Session images for better visual appeal
const SESSION_IMAGES = [
  'https://images.unsplash.com/photo-1501504905252-473c47e087f8?ixlib=rb-4.0.1&auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.1&auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.1&auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?ixlib=rb-4.0.1&auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?ixlib=rb-4.0.1&auto=format&fit=crop&w=500&q=80'
];

// Profile images
const PROFILE_IMAGES = [
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.1&auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1494790108755-2616b612b786?ixlib=rb-4.0.1&auto=format&fit=crop&w=500&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.1&auto=format&fit=crop&w=500&q=80'
];

export default function StudentDashboard() {
  const [allSessions, setAllSessions] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [exams, setExams] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlightDates, setHighlightDates] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [popupData, setPopupData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [profile, setProfile] = useState({
    name: keycloak.tokenParsed?.name || 'Student',
    email: keycloak.tokenParsed?.email || 'student@example.com',
    profileImg: PROFILE_IMAGES[Math.floor(Math.random() * PROFILE_IMAGES.length)],
    enrolledCount: 0,
    examsCount: 0,
  });

  // Get random session image
  const getSessionImage = () => {
    return SESSION_IMAGES[Math.floor(Math.random() * SESSION_IMAGES.length)];
  };

  // Format instructor name to show full name
  const formatInstructorName = (email) => {
    if (!email) return 'Not specified';
    const namePart = email.split('@')[0];
    return namePart
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Fetch data functions
  useEffect(() => {
    const load = async () => {
      try {
        if (!keycloak.authenticated) {
          await keycloak.init({ onLoad: 'login-required' });
        }
        await keycloak.updateToken(5);

        const [resAll, resMine, resExams] = await Promise.all([
          fetch('http://localhost:5000/api/student/sessions', {
            headers: { Authorization: `Bearer ${keycloak.token}` }
          }),
          fetch('http://localhost:5000/api/student/sessions/mine', {
            headers: { Authorization: `Bearer ${keycloak.token}` }
          }),
          fetch('http://localhost:5000/api/student/exams/mine', {
            headers: { Authorization: `Bearer ${keycloak.token}` }
          })
        ]);

        const sessionsData = await resAll.json();
        const mySessionsData = await resMine.json();
        const examsData = await resExams.json();
        
        setAllSessions(sessionsData);
        setMySessions(mySessionsData);
        setExams(Array.isArray(examsData) ? examsData : []);
        setProfile(prev => ({
          ...prev,
          enrolledCount: mySessionsData.length,
          examsCount: examsData.length || 0
        }));

        // Prepare highlight dates for calendar
        const newHighlightDates = {};
        
        // Add all available sessions to calendar
        sessionsData.forEach(session => {
          session.classDates?.forEach(dateObj => {
            const date = new Date(dateObj.date);
            const key = date.toISOString().split('T')[0];
            if (!newHighlightDates[key]) newHighlightDates[key] = [];
            newHighlightDates[key].push({
              ...session,
              type: 'available',
              date: dateObj.date,
              time: dateObj.time
            });
          });
        });

        // Add enrolled sessions to calendar
        mySessionsData.forEach(session => {
          session.classDates?.forEach(dateObj => {
            const date = new Date(dateObj.date);
            const key = date.toISOString().split('T')[0];
            if (!newHighlightDates[key]) newHighlightDates[key] = [];
            newHighlightDates[key].push({
              ...session,
              type: 'enrolled',
              date: dateObj.date,
              time: dateObj.time
            });
          });
        });

        // Add exams to calendar
        examsData.forEach(exam => {
          const date = new Date(exam.date);
          const key = date.toISOString().split('T')[0];
          if (!newHighlightDates[key]) newHighlightDates[key] = [];
          newHighlightDates[key].push({
            ...exam,
            type: 'exam',
            date: exam.date,
            time: exam.time
          });
        });

        setHighlightDates(newHighlightDates);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const enroll = async (id) => {
    try {
      setIsLoading(true);
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/student/sessions/${id}/enroll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${keycloak.token}` }
      });
      
      if (res.ok) {
        const [updatedAll, updatedMine] = await Promise.all([
          fetch('http://localhost:5000/api/student/sessions', {
            headers: { Authorization: `Bearer ${keycloak.token}` }
          }),
          fetch('http://localhost:5000/api/student/sessions/mine', {
            headers: { Authorization: `Bearer ${keycloak.token}` }
          })
        ]);
        
        const allSessionsData = await updatedAll.json();
        const mySessionsData = await updatedMine.json();
        
        setAllSessions(allSessionsData);
        setMySessions(mySessionsData);
        setProfile(prev => ({ ...prev, enrolledCount: mySessionsData.length }));

        // Update calendar highlights
        const newHighlightDates = {...highlightDates};
        const enrolledSession = allSessionsData.find(s => s._id === id);
        
        if (enrolledSession) {
          enrolledSession.classDates?.forEach(dateObj => {
            const date = new Date(dateObj.date);
            const key = date.toISOString().split('T')[0];
            if (newHighlightDates[key]) {
              // Update existing entries for this date
              newHighlightDates[key] = newHighlightDates[key].map(item => 
                item._id === id ? { ...item, type: 'enrolled' } : item
              );
            }
          });
          setHighlightDates(newHighlightDates);
        }
      } else {
        const errorText = await res.text();
        alert(errorText);
      }
    } catch (error) {
      console.error('Enrollment error:', error);
      alert('Failed to enroll. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    keycloak.logout({ redirectUri: window.location.origin });
  };

  const handleCalendarClick = (date) => {
    const key = date.toISOString().split('T')[0];
    if (highlightDates[key]) {
      setPopupData({
        date: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        events: highlightDates[key],
      });
    }
  };

  const closePopup = () => {
    setPopupData(null);
  };

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const dateKey = date.toISOString().split('T')[0];
    return highlightDates[dateKey] ? (
      <div className="absolute top-1 right-1 flex">
        {highlightDates[dateKey].some(e => e.type === 'enrolled') && (
          <div className="h-2 w-2 bg-green-500 rounded-full"></div>
        )}
        {highlightDates[dateKey].some(e => e.type === 'available') && (
          <div className="h-2 w-2 bg-blue-500 rounded-full ml-1"></div>
        )}
        {highlightDates[dateKey].some(e => e.type === 'exam') && (
          <div className="h-2 w-2 bg-purple-500 rounded-full ml-1"></div>
        )}
      </div>
    ) : null;
  };

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;
    const dateKey = date.toISOString().split('T')[0];
    return highlightDates[dateKey] ? 'bg-blue-50 relative' : null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Filtering logic
  const filteredMySessions = mySessions.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAllSessions = allSessions.filter(s =>
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.createdBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredExams = exams.filter(ex =>
    ex.sessionId?.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderSessionCard = (session, isEnrolled) => (
    <div
      key={session._id}
      className="group bg-white rounded-2xl shadow-xl border border-blue-100 p-6 flex flex-col lg:flex-row gap-6 w-full max-w-full text-left hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 hover:border-blue-300 backdrop-blur-sm"
    >
      <div className="flex-shrink-0">
        <img
          src={getSessionImage()}
          alt="Session"
          className="w-32 h-32 object-cover rounded-xl shadow-lg group-hover:shadow-xl transition-shadow duration-300 border border-blue-50"
        />
      </div>
      <div className="flex flex-col flex-1 gap-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 group-hover:text-blue-900 transition-colors duration-300">{session.title || "New Session"}</h2>
          {isEnrolled ? (
            <span className="bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 text-sm font-bold px-4 py-2 rounded-full border border-emerald-200 shadow-sm">
              ✓ Enrolled
            </span>
          ) : (
            <button
              className="bg-gradient-to-r from-blue-500 to-blue-600 text-white font-bold px-6 py-3 rounded-full shadow-lg hover:from-blue-600 hover:to-blue-700 hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap"
              onClick={() => enroll(session._id)}
              disabled={isLoading}
            >
              {isLoading ? 'Enrolling...' : 'Enroll Now'}
            </button>
          )}
        </div>
        <p className="text-gray-700 leading-relaxed">{session.description || "No description available for this session."}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 text-gray-800 bg-blue-50 rounded-lg p-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-600">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17.93A8.59 8.59 0 0110 18c-.08 0-.16 0-.24 0a8.59 8.59 0 01-2.93-.07A8.05 8.05 0 015 17v1a1 1 0 001 1h8a1 1 0 001-1v-1a8.05 8.05 0 00-.07-.07z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium">Instructor</p>
              <p className="text-sm font-semibold truncate" title={formatInstructorName(session.createdBy)}>
                {formatInstructorName(session.createdBy) || "Not specified"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-gray-800 bg-blue-50 rounded-lg p-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-600">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium">Schedule</p>
              <p className="text-sm font-semibold">
                {session.classDates?.[0]?.date 
                  ? new Date(session.classDates[0].date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  : "Date not set"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-gray-800 bg-blue-50 rounded-lg p-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-600">
                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium">Students</p>
              <p className="text-sm font-semibold">{session.enrolledStudents?.length || 0} enrolled</p>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-100">
          <span className="text-gray-500 text-sm bg-gray-50 px-3 py-1 rounded-full">
            Created: {new Date(session.createdAt).toLocaleDateString()}
          </span>
          {session.isLive && (
            <span className="ml-3 inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Live Session</span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-slate-50 via-white to-blue-50 font-sans">
      {/* Hamburger Menu for Sidebar */}
      <button
        className="lg:hidden fixed top-6 left-6 z-50 bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 rounded-xl shadow-xl hover:shadow-2xl hover:from-blue-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-300"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <FaBars size={20} />
      </button>

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full bg-gradient-to-b from-white via-blue-50 to-blue-100 shadow-2xl border-r border-blue-200 flex flex-col items-center py-8 px-6 w-[280px] z-40 transition-transform transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 backdrop-blur-lg`}
      >
        <div className="relative mb-6">
          <img
            src={profile.profileImg}
            alt="Profile"
            className="w-28 h-28 rounded-full border-4 border-white shadow-xl ring-4 ring-blue-100 object-cover"
          />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-400 rounded-full border-4 border-white shadow-lg"></div>
        </div>
        <div className="font-bold text-2xl text-gray-900 mb-2 text-center tracking-tight">{profile.name}</div>
        <div className="text-blue-600 text-sm mb-8 text-center font-medium bg-blue-50 px-3 py-1 rounded-full">{profile.email}</div>
        
        <nav className="flex flex-col gap-3 w-full mb-8">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`w-full text-left px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 flex items-center gap-4 group ${activeTab === 'dashboard' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105' : 'text-gray-700 hover:bg-white hover:shadow-md hover:text-blue-600 hover:transform hover:scale-102'}`}
          >
            <FaChalkboardTeacher className={`transition-transform duration-300 ${activeTab === 'dashboard' ? 'scale-110' : 'group-hover:scale-110'}`} />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('sessions')} 
            className={`w-full text-left px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 flex items-center gap-4 group ${activeTab === 'sessions' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105' : 'text-gray-700 hover:bg-white hover:shadow-md hover:text-blue-600 hover:transform hover:scale-102'}`}
          >
            <FaCalendarAlt className={`transition-transform duration-300 ${activeTab === 'sessions' ? 'scale-110' : 'group-hover:scale-110'}`} />
            Sessions
          </button>
          <button 
            onClick={() => setActiveTab('exams')} 
            className={`w-full text-left px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 flex items-center gap-4 group ${activeTab === 'exams' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105' : 'text-gray-700 hover:bg-white hover:shadow-md hover:text-blue-600 hover:transform hover:scale-102'}`}
          >
            <FaBook className={`transition-transform duration-300 ${activeTab === 'exams' ? 'scale-110' : 'group-hover:scale-110'}`} />
            Exams
          </button>
          <button 
            onClick={() => setActiveTab('profile')} 
            className={`w-full text-left px-6 py-4 rounded-xl font-semibold text-base transition-all duration-300 flex items-center gap-4 group ${activeTab === 'profile' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105' : 'text-gray-700 hover:bg-white hover:shadow-md hover:text-blue-600 hover:transform hover:scale-102'}`}
          >
            <FaUserCircle className={`transition-transform duration-300 ${activeTab === 'profile' ? 'scale-110' : 'group-hover:scale-110'}`} />
            Profile
          </button>
        </nav>
        
        <button 
          onClick={handleLogout} 
          className="mt-auto mb-6 w-full bg-gradient-to-r from-red-500 to-red-600 text-white font-bold px-6 py-4 rounded-xl shadow-lg hover:from-red-600 hover:to-red-700 hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-3"
        >
          <FaSignOutAlt className="transition-transform duration-300 group-hover:scale-110" />
          Logout
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-6 lg:px-10 py-8 overflow-y-auto md:ml-[280px] w-full max-w-[60%]">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center py-6 gap-4 mb-8">
          <div className="text-center md:text-left">
            <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
              {activeTab === 'dashboard' && 'Student Dashboard'}
              {activeTab === 'sessions' && 'Training Sessions'}
              {activeTab === 'exams' && 'Upcoming Exams'}
              {activeTab === 'profile' && 'My Profile'}
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"></div>
          </div>
          
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search sessions and exams..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all duration-300"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FiSearch className="absolute left-3 top-3.5 text-gray-400" />
          </div>
        </header>

        {/* Dashboard Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-10 pb-8">
            {/* Upcoming Sessions */}
            <section className="space-y-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 tracking-wide">Your Upcoming Sessions</h3>
              </div>
              
              {filteredMySessions.length === 0 ? (
                <div className="text-center py-16 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaCalendarAlt className="text-blue-500 text-2xl" />
                  </div>
                  <p className="text-gray-600 text-lg font-medium">No upcoming sessions</p>
                  <p className="text-gray-500 text-sm mt-2">Browse available sessions to get started!</p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {filteredMySessions.slice(0, 3).map(session => renderSessionCard(session, true))}
                </div>
              )}
            </section>

          </div>
        )}

        {/* Sessions Content */}
        {activeTab === 'sessions' && (
          <div className="pb-8">
            <div className="text-center mb-10">
              <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-blue-600 mx-auto rounded-full"></div>
            </div>

            <section className="space-y-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 tracking-wide">Available Training Sessions</h3>
                </div>
                <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  Showing {filteredAllSessions.length} session{filteredAllSessions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {filteredAllSessions.length === 0 ? (
                <div className="text-center py-16 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl border border-gray-200">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaChalkboardTeacher className="text-gray-500 text-2xl" />
                  </div>
                  <p className="text-gray-600 text-lg font-medium">No sessions available matching your search</p>
                  <p className="text-gray-500 text-sm mt-2">Check back later for new training opportunities!</p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {filteredAllSessions.map(session => renderSessionCard(session, mySessions.some(ms => ms._id === session._id)))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Exams Content */}
        {activeTab === 'exams' && (
          <div className="pb-8">
            <div className="text-center mb-10">
              <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-600 mx-auto rounded-full"></div>
            </div>

            {filteredExams.length === 0 ? (
              <div className="text-center py-16 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaBook className="text-blue-500 text-2xl" />
                </div>
                <p className="text-gray-600 text-lg font-medium">No exams scheduled</p>
                <p className="text-gray-500">You'll see your upcoming exams here once they're scheduled.</p>
              </div>
            ) : (
              <div className="grid gap-6">
                {filteredExams.map((exam, idx) => (
                  <div key={exam._id || idx} className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6 hover:shadow-2xl transition-all duration-300 hover:border-blue-300">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
                      <div className="flex-shrink-0">
                        <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          {new Date(exam.date).getDate()}
                        </div>
                      </div>
                      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Date</p>
                          <p className="text-lg font-bold text-gray-900">
                            {exam.date ? new Date(exam.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : "Date not set"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Session</p>
                          <p className="text-lg font-semibold text-gray-800">{exam.sessionId?.title || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Time</p>
                          <p className="text-lg font-semibold text-gray-800">{exam.time || "Time not set"}</p>
                        </div>
                      </div>
                      <div className={`px-4 py-2 rounded-full text-sm font-medium ${exam.isOnline ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                        {exam.isOnline ? 'Online' : 'Offline'}
                      </div>
                    </div>
                    
                    <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center text-gray-700">
                        <FiMapPin className="mr-3 text-blue-500" />
                        <span>{exam.isOnline ? (exam.onlineLink || 'Online session') : (exam.location || 'Location not specified')}</span>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <FaUsers className="mr-3 text-blue-500" />
                        <span>Examiner: {exam.assignedExaminer || 'Not assigned yet'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Content */}
        {activeTab === 'profile' && (
          <div className="pb-8">
            <div className="bg-white rounded-3xl shadow-2xl border border-blue-100 p-12 flex flex-col items-center max-w-4xl w-full relative overflow-hidden">
              {/* Background decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-50 to-transparent rounded-full translate-y-12 -translate-x-12"></div>

              <div className="relative z-10 flex flex-col items-center w-full">
                <div className="relative mb-8">
                  <img
                    src={profile.profileImg}
                    alt="Profile"
                    className="w-36 h-36 rounded-full border-4 border-white shadow-2xl ring-4 ring-blue-100 object-cover"
                  />
                  <div className="absolute -bottom-3 -right-3 w-12 h-12 bg-green-400 rounded-full border-4 border-white shadow-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>

                <div className="font-bold text-3xl text-gray-900 mb-3 text-center tracking-tight">{profile.name}</div>
                <div className="text-blue-600 text-lg mb-10 text-center bg-blue-50 px-4 py-2 rounded-full font-medium">{profile.email}</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-8">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
                    <h3 className="text-lg font-bold text-blue-800 mb-4">Personal Information</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-500">Full Name</p>
                        <p className="font-medium text-gray-800">{profile.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="font-medium text-gray-800">{profile.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Username</p>
                        <p className="font-medium text-gray-800">{keycloak.tokenParsed?.preferred_username || 'Not available'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 text-center border border-blue-200 hover:shadow-lg transition-all duration-300 group">
                      <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                        <FaChalkboardTeacher className="text-white text-xl" />
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mb-2">{profile.enrolledCount}</div>
                      <div className="text-blue-700 font-semibold">Courses Enrolled</div>
                    </div>

                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-6 text-center border border-purple-200 hover:shadow-lg transition-all duration-300 group">
                      <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                        <FaBook className="text-white text-xl" />
                      </div>
                      <div className="text-3xl font-bold text-gray-900 mb-2">{profile.examsCount}</div>
                      <div className="text-purple-700 font-semibold">Upcoming Exams</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Toggle for Small Screens */}
      <button
        className={`block min-[1400px]:hidden fixed top-6 right-6 z-50 bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-3 rounded-xl shadow-xl hover:shadow-2xl hover:from-indigo-600 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 ${showCalendar ? 'hidden' : ''}`}
        onClick={() => setShowCalendar(true)}
      >
        <FaCalendarAlt size={20} />
      </button>

      {/* Calendar Section */}
      <div
        className={`fixed top-0 left-0 w-full h-screen bg-white z-50 transition-transform transform ${showCalendar ? 'translate-y-0' : '-translate-y-full'} min-[1400px]:relative min-[1400px]:translate-y-0 min-[1400px]:w-[420px] min-[1400px]:h-auto min-[1400px]:bg-gradient-to-b min-[1400px]:from-white min-[1400px]:via-blue-50 min-[1400px]:to-blue-100 min-[1400px]:shadow-2xl min-[1400px]:border-l min-[1400px]:border-blue-200 min-[1400px]:p-6 min-[1400px]:flex min-[1400px]:flex-col min-[1400px]:items-center min-[1400px]:z-30 min-[1400px]:overflow-y-auto min-[1400px]:ml-auto`}
      >
        {showCalendar && (
          <button
            className="absolute top-6 right-6 bg-gradient-to-r from-red-500 to-red-600 text-white p-3 rounded-xl shadow-lg hover:shadow-xl hover:from-red-600 hover:to-red-700 transform hover:scale-105 transition-all duration-300 min-[1400px]:hidden"
            onClick={() => setShowCalendar(false)}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        <div className="w-full max-w-sm mx-auto mt-16 min-[1400px]:mt-0">
          <div className="bg-white rounded-2xl shadow-xl border border-blue-100 p-6">
            <h2 className="text-xl font-bold text-blue-800 mb-4">Your Schedule</h2>
            <Calendar
              value={selectedDate}
              onChange={setSelectedDate}
              onClickDay={handleCalendarClick}
              tileContent={tileContent}
              tileClassName={tileClassName}
              className="border-0 w-full rounded-xl"
            />
            <div className="mt-4 space-y-2">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium">Available Sessions</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium">Enrolled Sessions</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                <span className="text-sm font-medium">Exams</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Popup Component */}
      {popupData && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 p-8 w-11/12 max-w-lg mx-4 transform scale-100 transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Events on {popupData.date}</h2>
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
                {popupData.events.length}
              </div>
            </div>
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {popupData.events.map((event, index) => (
                <div key={index} className={`p-4 rounded-xl border ${event.type === 'enrolled' ? 'bg-green-50 border-green-200' : event.type === 'exam' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'} hover:shadow-lg transition-all duration-300 group`}>
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-gray-800">
                      {event.title || event.sessionId?.title || 'Untitled Event'}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${event.type === 'enrolled' ? 'bg-green-100 text-green-800' : event.type === 'exam' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                      {event.type === 'enrolled' ? 'Enrolled' : event.type === 'exam' ? 'Exam' : 'Available'}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <FiClock className="mr-2" />
                      <span>{event.time || 'Time not specified'}</span>
                    </div>
                    {event.isOnline ? (
                      <div className="flex items-center mt-1">
                        <FaVideo className="mr-2" />
                        <span>Online: {event.zoomLink || event.onlineLink || 'Link not provided'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center mt-1">
                        <FiMapPin className="mr-2" />
                        <span>{event.location || 'Location not specified'}</span>
                      </div>
                    )}
                  </div>
                  {event.type === 'available' && (
                    <button
                      onClick={() => {
                        enroll(event._id);
                        closePopup();
                      }}
                      className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded-lg text-sm transition-all duration-300 transform hover:scale-105"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Enrolling...' : 'Enroll Now'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              className="mt-6 w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all duration-300 transform hover:scale-105"
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