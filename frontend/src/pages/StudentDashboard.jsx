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
import { TEMP_PROFILE_IMG } from '../constants';

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
    profileImg: TEMP_PROFILE_IMG,
    enrolledCount: 0,
    examsCount: 0,
  });

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
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
        <img src={profile.profileImg} alt="Profile" className="w-24 h-24 rounded-full border-4 border-blue-300 shadow-lg mb-4" />
        <div className="font-extrabold text-2xl text-blue-800 mb-1 text-center font-serif tracking-wide">{profile.name}</div>
        <div className="text-blue-600 text-sm mb-10 text-center font-medium">{profile.email}</div>
        
        <nav className="flex flex-col gap-4 w-full mb-10">
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`w-full text-left px-6 py-3 rounded-2xl font-bold text-lg transition tracking-wide flex items-center gap-3 ${activeTab === 'dashboard' ? 'bg-white text-blue-800 shadow-lg' : 'text-blue-600 hover:bg-blue-100 hover:shadow-md'}`}
          >
            <FaChalkboardTeacher /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('sessions')} 
            className={`w-full text-left px-6 py-3 rounded-2xl font-bold text-lg transition tracking-wide flex items-center gap-3 ${activeTab === 'sessions' ? 'bg-white text-blue-800 shadow-lg' : 'text-blue-600 hover:bg-blue-100 hover:shadow-md'}`}
          >
            <FaCalendarAlt /> Sessions
          </button>
          <button 
            onClick={() => setActiveTab('exams')} 
            className={`w-full text-left px-6 py-3 rounded-2xl font-bold text-lg transition tracking-wide flex items-center gap-3 ${activeTab === 'exams' ? 'bg-white text-blue-800 shadow-lg' : 'text-blue-600 hover:bg-blue-100 hover:shadow-md'}`}
          >
            <FaBook /> Exams
          </button>
          <button 
            onClick={() => setActiveTab('profile')} 
            className={`w-full text-left px-6 py-3 rounded-2xl font-bold text-lg transition tracking-wide flex items-center gap-3 ${activeTab === 'profile' ? 'bg-white text-blue-800 shadow-lg' : 'text-blue-600 hover:bg-blue-100 hover:shadow-md'}`}
          >
            <FaUserCircle /> Profile
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
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center py-6 gap-4">
          <h1 className="text-2xl font-extrabold text-blue-900 tracking-tight font-serif">
            {activeTab === 'dashboard' && 'Student Dashboard'}
            {activeTab === 'sessions' && 'Training Sessions'}
            {activeTab === 'exams' && 'Upcoming Exams'}
            {activeTab === 'profile' && 'My Profile'}
          </h1>
          
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Search sessions and exams..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FiSearch className="absolute left-3 top-2.5 text-gray-400" />
          </div>
        </header>

        {/* Dashboard Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 pb-8">
            {/* Upcoming Sessions */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h2 className="text-xl font-bold text-blue-800 mb-4">Your Upcoming Sessions</h2>
              {filteredMySessions.length === 0 ? (
                <div className="text-center py-8 text-blue-500">
                  <FaCalendarAlt className="mx-auto text-4xl mb-3" />
                  <p>No upcoming sessions</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMySessions.slice(0, 3).map(session => (
                    <div key={session._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition">
                      <div className="flex items-start">
                        <div className="bg-blue-100 p-3 rounded-full mr-4">
                          <FaCalendarAlt className="text-blue-600 text-xl" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">{session.title || "Untitled Session"}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {session.classDates?.[0]?.date 
                              ? new Date(session.classDates[0].date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) 
                              : "Date not set"} at {session.classDates?.[0]?.time || "Time not set"}
                          </p>
                          {session.isLive && (
                            <span className="inline-block mt-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Live Session</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Calendar Section */}
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-blue-800">Your Schedule</h2>
                <button 
                  onClick={() => setSelectedDate(new Date())}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Today
                </button>
              </div>
              <Calendar
                value={selectedDate}
                onChange={setSelectedDate}
                onClickDay={handleCalendarClick}
                tileContent={tileContent}
                tileClassName={tileClassName}
                className="border-0 w-full"
              />
              <div className="mt-4 flex justify-center gap-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span className="text-sm">Available</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm">Enrolled</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                  <span className="text-sm">Exam</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sessions Content */}
        {activeTab === 'sessions' && (
          <div className="pb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-extrabold text-blue-900 tracking-tight font-serif">
                Available Training Sessions
              </h2>
              <span className="text-sm text-blue-600">
                Showing {filteredAllSessions.length} session{filteredAllSessions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filteredAllSessions.length === 0 ? (
              <div className="text-center py-12 bg-blue-50 rounded-lg">
                <FaCalendarAlt className="mx-auto text-4xl text-blue-400 mb-4" />
                <p className="text-lg text-blue-700">No sessions available matching your search</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredAllSessions.map(session => {
                  const isEnrolled = mySessions.some(ms => ms._id === session._id);
                  const enrollmentCount = session.enrolledStudents?.length || 0;

                  return (
                    <div key={session._id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                      <div className="p-6 flex flex-col md:flex-row gap-6">
                        <div className="flex-shrink-0">
                          <img 
                            src="https://cdn.dribbble.com/userupload/8401360/file/still-2aab62b732c77245f4eeb7edf4c68c9e.gif?format=webp&resize=450x338&vertical=center" 
                            alt="Session" 
                            className="w-full md:w-48 h-32 rounded-md object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h3 className="text-xl font-bold text-gray-800">{session.title || "New Session"}</h3>
                            <div className="flex gap-2">
                              {session.isLive && (
                                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full">Live</span>
                              )}
                              <span className={`text-xs px-2 py-1 rounded-full ${isEnrolled ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                                {isEnrolled ? 'Enrolled' : 'Open'}
                              </span>
                            </div>
                          </div>

                          <p className="text-gray-600 mt-2">{session.description || "No description available for this session."}</p>

                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div className="flex items-center text-gray-700">
                              <FaUserCircle className="mr-2 text-blue-500" />
                              <span>Instructor: {session.createdBy || "Not specified"}</span>
                            </div>
                            {session.classDates?.length > 0 && (
                              <div className="flex items-center text-gray-700">
                                <FaCalendarAlt className="mr-2 text-blue-500" />
                                <span>
                                  {new Date(session.classDates[0].date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                  {session.classDates.length > 1 && (
                                    <span className="text-gray-500 ml-1">(+{session.classDates.length - 1} more)</span>
                                  )}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center text-gray-700">
                              <FaUsers className="mr-2 text-blue-500" />
                              <span>{enrollmentCount} student{enrollmentCount !== 1 ? 's' : ''} enrolled</span>
                            </div>
                          </div>

                          <div className="mt-6 flex justify-between items-center">
                            <span className="text-xs text-gray-500">Created: {new Date(session.createdAt).toLocaleDateString()}</span>
                            {isEnrolled ? (
                              <div className="flex items-center space-x-2">
                                <span className="text-green-600 flex items-center">
                                  <FaCheckCircle className="mr-1" /> Enrolled
                                </span>
                                {session.zoomLink && (
                                  <a 
                                    href={session.zoomLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center"
                                  >
                                    <FaVideo className="mr-2" /> Join Session
                                  </a>
                                )}
                              </div>
                            ) : (
                              <button 
                                onClick={() => enroll(session._id)} 
                                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                                disabled={isLoading}
                              >
                                {isLoading ? 'Enrolling...' : 'Enroll Now'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Exams Content */}
        {activeTab === 'exams' && (
          <div className="pb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-extrabold text-blue-900 tracking-tight font-serif">
                Your Upcoming Exams
              </h2>
              <button 
                onClick={() => setShowCalendar(!showCalendar)}
                className="lg:hidden bg-blue-500 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-600 transition"
              >
                {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
              </button>
            </div>

            {filteredExams.length === 0 ? (
              <div className="text-center py-12 bg-blue-50 rounded-lg">
                <FaBook className="mx-auto text-4xl text-blue-400 mb-4" />
                <p className="text-lg text-blue-700">No exams scheduled</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredExams.map(exam => (
                  <div key={exam._id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold text-gray-800">{exam.sessionId?.title || "Untitled Exam"}</h3>
                          <div className="flex items-center text-gray-600 mt-2">
                            <FaCalendarAlt className="mr-2 text-blue-500" />
                            <span>
                              {exam.date 
                                ? new Date(exam.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) 
                                : "Date not set"}
                            </span>
                          </div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${exam.isOnline ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                          {exam.isOnline ? 'Online' : 'Offline'}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center text-gray-700">
                          <FiClock className="mr-2 text-blue-500" />
                          <span>{exam.time || "Time not set"}</span>
                        </div>
                        <div className="flex items-center text-gray-700">
                          <FiMapPin className="mr-2 text-blue-500" />
                          <span>{exam.isOnline ? exam.onlineLink : exam.location || "Location not specified"}</span>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-gray-200">
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Examiner:</span>
                          <span className="font-medium">{exam.assignedExaminer || 'Not assigned yet'}</span>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600 mt-2">
                          <span>Status:</span>
                          <span className="font-medium text-yellow-600">Pending</span>
                        </div>
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
            <div className="bg-white rounded-lg shadow-md p-8 max-w-4xl mx-auto">
              <h2 className="text-2xl font-extrabold text-blue-900 tracking-tight font-serif mb-6">Your Profile</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                  <div className="bg-blue-50 rounded-xl p-6">
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
                      <div>
                        <p className="text-sm text-gray-500">Last Login</p>
                        <p className="font-medium text-gray-800">
                          {keycloak.tokenParsed?.auth_time 
                            ? new Date(keycloak.tokenParsed.auth_time * 1000).toLocaleString() 
                            : 'Not available'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white border border-blue-100 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-blue-800 mb-4">Academic Stats</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-xs text-blue-600 uppercase font-semibold">Enrolled Sessions</p>
                        <p className="text-2xl font-bold text-blue-800 mt-1">{profile.enrolledCount}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-xs text-purple-600 uppercase font-semibold">Upcoming Exams</p>
                        <p className="text-2xl font-bold text-purple-800 mt-1">{profile.examsCount}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-xs text-green-600 uppercase font-semibold">Completed</p>
                        <p className="text-2xl font-bold text-green-800 mt-1">0</p>
                      </div>
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-xs text-yellow-600 uppercase font-semibold">Attendance</p>
                        <p className="text-2xl font-bold text-yellow-800 mt-1">85%</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-blue-100 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-blue-800 mb-4">Account Actions</h3>
                    <div className="space-y-3">
                      <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition">
                        Edit Profile
                      </button>
                      <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg transition">
                        Change Password
                      </button>
                      <button 
                        onClick={handleLogout}
                        className="w-full bg-red-100 hover:bg-red-200 text-red-800 py-2 rounded-lg transition flex items-center justify-center gap-2"
                      >
                        <FaSignOutAlt /> Logout
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Section */}
      <div
        className={`fixed top-0 left-0 w-full h-screen bg-white z-50 transition-transform transform ${showCalendar ? 'translate-y-0' : '-translate-y-full'} lg:relative lg:translate-y-0 lg:w-[300px] lg:h-auto lg:bg-blue-50 lg:shadow-2xl lg:border-l lg:border-blue-100 lg:p-4 lg:flex lg:flex-col lg:z-30 lg:overflow-y-auto`}
      >
        {showCalendar && (
          <button
            className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg lg:hidden"
            onClick={() => setShowCalendar(false)}
          >
            Close
          </button>
        )}
        <div className="p-4">
          <h2 className="text-xl font-bold text-blue-800 mb-4">Your Schedule</h2>
          <Calendar
            value={selectedDate}
            onChange={setSelectedDate}
            onClickDay={handleCalendarClick}
            tileContent={tileContent}
            tileClassName={tileClassName}
            className="border-0 w-full"
          />
          <div className="mt-4 space-y-2">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <span className="text-sm">Available Sessions</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span className="text-sm">Enrolled Sessions</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
              <span className="text-sm">Exams</span>
            </div>
          </div>
        </div>
      </div>

      {/* Popup Component */}
      {popupData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-11/12 max-w-md max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-blue-800 mb-4">Events on {popupData.date}</h2>
            <div className="space-y-4">
              {popupData.events.map((event, index) => (
                <div key={index} className={`p-4 rounded-lg shadow-sm ${event.type === 'enrolled' ? 'bg-green-50 border border-green-200' : event.type === 'exam' ? 'bg-purple-50 border border-purple-200' : 'bg-blue-50 border border-blue-200'}`}>
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
                      className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-sm"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Enrolling...' : 'Enroll Now'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              className="mt-4 w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg"
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