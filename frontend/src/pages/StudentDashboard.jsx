import React, { useEffect, useState } from 'react';
import keycloak from '../keycloak';
import '../styles/StudentDashboard.css';
import { 
  FiHome, 
  FiCalendar, 
  FiBook, 
  FiSettings, 
  FiLogOut,
  FiUser,
  FiClock,
  FiMapPin,
  FiSearch,
  FiUsers,
  FiVideo
} from 'react-icons/fi';

export default function StudentDashboard() {
  const [allSessions, setAllSessions] = useState([]);
  const [mySessions, setMySessions] = useState([]);
  const [exams, setExams] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

        setAllSessions(await resAll.json());
        setMySessions(await resMine.json());
        const examsData = await resExams.json();
        setExams(Array.isArray(examsData) ? examsData : []);
        
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
      await keycloak.updateToken(5);
      const res = await fetch(`http://localhost:5000/api/student/sessions/${id}/enroll`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${keycloak.token}` }
      });
      
      if (res.ok) {
        const updated = await fetch('http://localhost:5000/api/student/sessions/mine', {
          headers: { Authorization: `Bearer ${keycloak.token}` }
        });
        setMySessions(await updated.json());
      } else {
        const errorText = await res.text();
        alert(errorText);
      }
    } catch (error) {
      console.error('Enrollment error:', error);
      alert('Failed to enroll. Please try again.');
    }
  };

  const handleLogout = () => {
    keycloak.logout({ redirectUri: window.location.origin });
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
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

  // Filtering logic based on the search term
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
    <div className="dashboard-container">
      {/* Sidebar Toggle */}
      <button 
        className="sidebar-toggle" 
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? '' : 'closed'}`}>
        <div className="profile-section">
          <img 
            src="https://randomuser.me/api/portraits/lego/1.jpg" 
            alt="Profile" 
            className="profile-pic"
          />
          <h3 className="profile-name">
            {keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username || 'User'}
          </h3>
          <p className="profile-email">{keycloak.tokenParsed?.email || 'No email available'}</p>
        </div>

        <nav className="nav-menu">
          <button 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <FiHome className="nav-icon" />
            <span className="nav-text">Dashboard</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            <FiCalendar className="nav-icon" />
            <span className="nav-text">Sessions</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'exams' ? 'active' : ''}`}
            onClick={() => setActiveTab('exams')}
          >
            <FiBook className="nav-icon" />
            <span className="nav-text">Exams</span>
          </button>
          <button 
            className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <FiUser className="nav-icon" />
            <span className="nav-text">Profile</span>
          </button>
        </nav>

        <button className="logout-btn" onClick={handleLogout}>
          <FiLogOut className="nav-icon" />
          <span className="nav-text">Logout</span>
        </button>
      </div>

      {/* Main Content */}
      <div className={`main-content ${!sidebarOpen ? 'expanded' : ''}`}>
        <header className="header">
          <h1 className="page-title">
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'sessions' && 'Training Sessions'}
            {activeTab === 'exams' && 'Upcoming Exams'}
            {activeTab === 'profile' && 'My Profile'}
          </h1>

          {/* Search Bar */}
          <div className="search-container">
            <input
              type="text"
              className="search-input"
              placeholder="Search sessions and exams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FiSearch className="search-icon" />
          </div>
        </header>

        {/* Dashboard Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="card-title">Your Upcoming Sessions</h2>
              {filteredMySessions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FiCalendar className="mx-auto text-3xl mb-3" />
                  <p>No upcoming sessions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredMySessions.slice(0, 3).map(session => (
                    <div key={session._id} className="flex items-start p-4 border rounded-lg hover:bg-gray-50">
                      <div className="bg-blue-100 p-3 rounded-full mr-4">
                        <FiCalendar className="text-blue-600 text-xl" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800">{session.title || "Untitled Session"}</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {session.classDates?.[0]?.date 
                            ? new Date(session.classDates[0].date).toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                month: 'short', 
                                day: 'numeric' 
                              }) 
                            : "Date not set"} at {session.classDates?.[0]?.time || "Time not set"}
                        </p>
                        {session.isLive && (
                          <span className="inline-block mt-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                            Live Session
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="card-title">Upcoming Exams</h2>
              {filteredExams.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FiBook className="mx-auto text-3xl mb-3" />
                  <p>No upcoming exams</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredExams.slice(0, 3).map(exam => (
                    <div key={exam._id} className="flex items-start p-4 border rounded-lg hover:bg-gray-50">
                      <div className="bg-purple-100 p-3 rounded-full mr-4">
                        <FiBook className="text-purple-600 text-xl" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-800">{exam.sessionId?.title || "Untitled Exam"}</h3>
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <FiClock className="mr-2" />
                          <span>
                            {exam.date 
                              ? new Date(exam.date).toLocaleDateString('en-US', { 
                                  weekday: 'short', 
                                  month: 'short', 
                                  day: 'numeric' 
                                }) 
                              : "Date not set"} at {exam.time || "Time not set"}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <FiMapPin className="mr-2" />
                          <span>{exam.isOnline ? 'Online Exam' : exam.location || "Location not specified"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sessions Content */}
        {activeTab === 'sessions' && (
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="card-title">Available Training Sessions</h2>
              <span className="text-sm text-gray-500">
                Showing {filteredAllSessions.length} session{filteredAllSessions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filteredAllSessions.length === 0 ? (
              <div className="text-center py-">
                <FiCalendar className="mx-auto text-4xl text-gray-300 mb-3" />
                <p className="text-gray-500">No sessions available matching your search</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6 ">
                {filteredAllSessions.map(session => {
                  const teacherEmail = session.createdBy || "teacher@example.com";
                  const teacherNameParts = teacherEmail.split('@')[0].split('.');
                  const teacherFirstName = session.teacherFirstName || session.createdBy.split('@')[0].split('.')[0]; // Default to email split logic
                  const teacherLastName = session.teacherLastName || session.createdBy.split('@')[0].split('.')[1] || '';
              
                  // Capitalize first letters of the first and last name
                  const formattedTeacherFirstName = teacherFirstName.charAt(0).toUpperCase() + teacherFirstName.slice(1);
                  const formattedTeacherLastName = teacherLastName ? teacherLastName.charAt(0).toUpperCase() + teacherLastName.slice(1) : '';

                  const isEnrolled = mySessions.some(ms => ms._id === session._id);
                  const enrollmentCount = session.enrolledStudents?.length || 0;
                  
                  return (
                    <div key={session._id} className=" border-2 border-gray-300 rounded-lg p-10 hover:shadow-lg transition-all duration-200 bg-white flex gap-2 items-center">
                      <div>
                        <img src="https://cdn.dribbble.com/userupload/8401360/file/still-2aab62b732c77245f4eeb7edf4c68c9e.gif?format=webp&resize=450x338&vertical=center" alt="" className='h-40 w-40' />
                      </div>
                      <div>
                      {/* Session Header */}
                      <div className="flex justify-between items-start mb-3 max-w-[80%]">
                        <h3 className="font-bold text-lg text-gray-800 capitalize">
                          {session.title || "new session"}
                        </h3>
                        <div className="flex space-x-2">
                          {session.isLive && (
                            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full flex items-center">
                              <span className="w-2 h-2 bg-red-500 rounded-full mr-1 animate-pulse"></span>
                              Live
                            </span>
                          )}
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            isEnrolled ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {isEnrolled ? 'Enrolled' : 'Open'}
                          </span>
                        </div>
                      </div>

                      {/* Session Body */}
                      <div className="mb-4">
                        <p className="text-gray-600 mb-4 line-clamp-2">
                          {session.description || "No description available for this session."}
                        </p>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center text-gray-700">
                            <FiUser className="mr-2 text-gray-500" />
                            <span>Instructor: <span className="font-medium capitalize">{formattedTeacherFirstName}</span></span>
                          </div>
                          
                          {session.classDates?.length > 0 && (
                            <div className="flex items-center text-gray-700">
                              <FiCalendar className="mr-2 text-gray-500" />
                              <span>
                                {new Date(session.classDates[0].date).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric'
                                })}
                                {session.classDates.length > 1 && (
                                  <span className="text-gray-500 ml-1">
                                    (+{session.classDates.length - 1} more)
                                  </span>
                                )}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center text-gray-700">
                            <FiUsers className="mr-2 text-gray-500" />
                            <span>{enrollmentCount} student{enrollmentCount !== 1 ? 's' : ''} enrolled</span>
                          </div>
                        </div>
                      </div>

                      {/* Session Footer */}
                      <div className="flex justify-between items-center pt-3 border-t">
                        <span className="text-xs text-gray-500">
                          Created: {new Date(session.createdAt).toLocaleDateString()}
                        </span>
                        
                        {isEnrolled ? (
                          <div className="flex items-center space-x-2">
                            {session.zoomLink && (
                              <a href={session.zoomLink} target="_blank" rel="noopener noreferrer" 
                                className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-full flex items-center">
                                <FiVideo className="mr-1" /> Join
                              </a>
                            )}
                            <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full">
                              ✓ Enrolled
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => enroll(session._id)}
                            className="text-sm bg-blue-600 hover:bg-blue-700 text-black px-4 py-2 rounded-lg transition-colors"
                          >
                            Enroll Now
                          </button>
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

        {/* Exams Content */}
        {activeTab === 'exams' && (
          <div className="card">
            <h2 className="card-title">Your Upcoming Exams</h2>
            {filteredExams.length === 0 ? (
              <div className="text-center py-8">
                <FiBook className="mx-auto text-4xl text-gray-300 mb-3" />
                <p className="text-gray-500">No exams scheduled</p>
              </div>
            ) : (
              <div className="">
                {filteredExams.map(exam => (
                  <div key={exam._id} className="border rounded-lg p-5 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-lg text-gray-800">
                          {exam.sessionId?.title || "Untitled Exam"}
                        </h3>
                        <div className="flex items-center text-sm text-gray-600 mt-1">
                          <FiClock className="mr-2" />
                          <span>
                            {exam.date 
                              ? new Date(exam.date).toLocaleDateString('en-US', { 
                                  weekday: 'short', 
                                  month: 'short', 
                                  day: 'numeric' 
                                }) 
                              : "Date not set"} at {exam.time || "Time not set"}
                          </span>
                        </div>
                      </div>
                      <div className="bg-purple-100 p-2 rounded-full">
                        <FiBook className="text-purple-600 text-xl" />
                      </div>
                    </div>
                    
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center text-gray-700">
                        <FiMapPin className="mr-2" />
                        <span>{exam.isOnline ? 'Online Exam' : exam.location || "Location not specified"}</span>
                      </div>
                      
                      
                    </div>
                    
                    <div className="mt-4 pt-3 border-t flex justify-between items-center">
                      
                      <button className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-full">
                        View Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Content */}
        {activeTab === 'profile' && (
          <div className="card">
            <h2 className="card-title">Your Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="border-b pb-4">
                  <h3 className="font-medium text-gray-700 mb-3">Personal Information</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Full Name</p>
                      <p className="font-medium">{keycloak.tokenParsed?.name || 'Not available'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="font-medium">{keycloak.tokenParsed?.email || 'Not available'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Username</p>
                      <p className="font-medium">{keycloak.tokenParsed?.preferred_username || 'Not available'}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-700 mb-3">Account Details</h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Account Created</p>
                      <p className="font-medium">
                        {keycloak.tokenParsed?.createdTimestamp 
                          ? new Date(keycloak.tokenParsed.createdTimestamp * 1000).toLocaleDateString() 
                          : 'Not available'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Login</p>
                      <p className="font-medium">
                        {keycloak.tokenParsed?.auth_time 
                          ? new Date(keycloak.tokenParsed.auth_time * 1000).toLocaleString() 
                          : 'Not available'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700 mb-3">Your Statistics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-600">Enrolled Sessions</p>
                    <p className="text-2xl font-bold text-blue-800">{mySessions.length}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-purple-600">Upcoming Exams</p>
                    <p className="text-2xl font-bold text-purple-800">{exams.length}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600">Completed</p>
                    <p className="text-2xl font-bold text-green-800">0</p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-sm text-yellow-600">Attendance Rate</p>
                    <p className="text-2xl font-bold text-yellow-800">0%</p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <button className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 rounded-lg">
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}