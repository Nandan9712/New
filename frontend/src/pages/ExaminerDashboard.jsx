import React, { useState, useEffect, useCallback } from 'react';
import keycloak from '../keycloak';
import { 
  FaUserCircle, 
  FaChalkboardTeacher, 
  FaCalendarAlt, 
  FaSignOutAlt, 
  FaBars,
  FaPlus,
  FaTrash
} from 'react-icons/fa';
import { FiClock } from 'react-icons/fi';
import CalendarComponent from '../components/CalendarComponent';
import { TEMP_PROFILE_IMG } from '../constants';

const ExaminerDashboard = () => {
  const [availabilities, setAvailabilities] = useState([]);
  const [newAvailability, setNewAvailability] = useState({
    availableFrom: '',
    availableTo: ''
  });
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [highlightDates, setHighlightDates] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [popupData, setPopupData] = useState(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState('view');
  const [showAddForm, setShowAddForm] = useState(false);

  const [profile, setProfile] = useState({
    name: keycloak.tokenParsed?.name || 'Examiner',
    email: keycloak.tokenParsed?.email || 'examiner@example.com',
    profileImg: TEMP_PROFILE_IMG,
    availabilityCount: 0,
  });

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
        const fromDate = new Date(availability.availableFrom).toLocaleDateString('en-CA');
        const toDate = new Date(availability.availableTo).toLocaleDateString('en-CA');
        
        if (!newHighlightDates[fromDate]) newHighlightDates[fromDate] = [];
        newHighlightDates[fromDate].push(availability);
        
        if (fromDate !== toDate) {
          if (!newHighlightDates[toDate]) newHighlightDates[toDate] = [];
          newHighlightDates[toDate].push(availability);
        }
      });
      setHighlightDates(newHighlightDates);
    } catch (err) {
      console.error('Error fetching availabilities:', err);
    }
  }, []);

  useEffect(() => {
    fetchAvailabilities();
  }, [fetchAvailabilities]);

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
      setShowAddForm(false); // Close the form after successful submission
    } catch (err) {
      console.error('Error adding availability:', err);
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
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    keycloak.logout({ redirectUri: window.location.origin });
  };

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

  const handleCalendarClick = (date) => {
    const key = date.toLocaleDateString('en-CA');
    if (highlightDates[key]) {
      setPopupData({
        date: key,
        availabilities: highlightDates[key],
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
        <img src={profile.profileImg} alt="Profile" className="w-24 h-24 rounded-full border-4 border-blue-300 shadow-lg mb-4" />
        <div className="font-extrabold text-2xl text-blue-800 mb-1 text-center font-serif tracking-wide">{profile.name}</div>
        <div className="text-blue-600 text-sm mb-10 text-center font-medium">{profile.email}</div>
        
        <nav className="flex flex-col gap-4 w-full mb-10">
          <button 
            onClick={() => {
              setActiveSidebarTab('view');
              setShowAddForm(false);
            }}
            className={`w-full text-left px-6 py-3 rounded-2xl font-bold text-lg transition tracking-wide flex items-center gap-3 ${activeSidebarTab === 'view' ? 'bg-white text-blue-800 shadow-lg' : 'text-blue-600 hover:bg-blue-100 hover:shadow-md'}`}
          >
            <FaCalendarAlt /> View Availabilities
          </button>
          <button 
            onClick={() => {
              setActiveSidebarTab('add');
              setShowAddForm(true);
            }}
            className={`w-full text-left px-6 py-3 rounded-2xl font-bold text-lg transition tracking-wide flex items-center gap-3 ${activeSidebarTab === 'add' ? 'bg-white text-blue-800 shadow-lg' : 'text-blue-600 hover:bg-blue-100 hover:shadow-md'}`}
          >
            <FaPlus /> Add Availability
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
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center py-6 gap-4">
          <h1 className="text-2xl font-extrabold text-blue-900 tracking-tight font-serif">
            Examiner Dashboard
          </h1>
          
          <button 
            onClick={() => setShowCalendar(!showCalendar)}
            className="lg:hidden bg-blue-500 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-600 transition"
          >
            {showCalendar ? 'Hide Calendar' : 'Show Calendar'}
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Conditional rendering based on active sidebar tab */}
            {activeSidebarTab === 'add' && showAddForm && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <FaPlus className="text-blue-600" /> Add Availability
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="form-group">
                    <label className="block text-gray-700 font-medium mb-2">From</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiClock className="text-gray-400" />
                      </div>
                      <input
                        type="datetime-local"
                        value={newAvailability.availableFrom}
                        onChange={(e) => setNewAvailability({ ...newAvailability, availableFrom: e.target.value })}
                        className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="block text-gray-700 font-medium mb-2">To</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiClock className="text-gray-400" />
                      </div>
                      <input
                        type="datetime-local"
                        value={newAvailability.availableTo}
                        onChange={(e) => setNewAvailability({ ...newAvailability, availableTo: e.target.value })}
                        className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-4">
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setActiveSidebarTab('view');
                    }}
                    className="px-6 py-3 rounded-lg font-bold text-blue-800 bg-white border border-blue-300 hover:bg-blue-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddAvailability}
                    disabled={loading || !newAvailability.availableFrom || !newAvailability.availableTo}
                    className={`px-6 py-3 rounded-lg font-bold text-white ${loading || !newAvailability.availableFrom || !newAvailability.availableTo ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} transition`}
                  >
                    {loading ? 'Saving...' : 'Add Availability'}
                  </button>
                </div>
              </div>
            )}

            {/* Availability List Section - Always visible when in view mode */}
            {activeSidebarTab === 'view' && (
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <FaCalendarAlt className="text-blue-600" /> Your Availabilities
                </h2>
                
                {availabilities.length === 0 ? (
                  <div className="text-center py-8 bg-blue-50 rounded-lg">
                    <FaCalendarAlt className="mx-auto text-4xl text-blue-400 mb-4" />
                    <p className="text-lg text-blue-700">No availabilities added yet</p>
                    <button
                      onClick={() => {
                        setActiveSidebarTab('add');
                        setShowAddForm(true);
                      }}
                      className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                      Add Availability
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {availabilities.map((availability) => (
                      <div key={availability._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">From</p>
                            <p className="font-medium text-gray-800">{formatDateTime(availability.availableFrom)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">To</p>
                            <p className="font-medium text-gray-800">{formatDateTime(availability.availableTo)}</p>
                          </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end">
                          <button
                            onClick={() => handleDeleteAvailability(availability._id)}
                            className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-lg transition flex items-center gap-2"
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
          </div>

          {/* Calendar Section - Desktop */}
          <div className="hidden lg:block">
            <div className="bg-blue-50 rounded-xl shadow-md border border-blue-100 p-4 sticky top-4">
              <h2 className="text-lg font-bold text-blue-800 mb-4">Availability Calendar</h2>
              <CalendarComponent
                highlightDates={highlightDates}
                onDateClick={handleCalendarClick}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Section - Mobile */}
      <div
        className={`fixed top-0 left-0 w-full h-screen bg-white z-50 transition-transform transform ${showCalendar ? 'translate-y-0' : '-translate-y-full'} lg:hidden`}
      >
        {showCalendar && (
          <button
            className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full shadow-lg"
            onClick={() => setShowCalendar(false)}
          >
            Close
          </button>
        )}
        <div className="p-4">
          <h2 className="text-xl font-bold text-blue-800 mb-4">Availability Calendar</h2>
          <CalendarComponent
            highlightDates={highlightDates}
            onDateClick={handleCalendarClick}
          />
        </div>
      </div>

      {/* Popup Component */}
      {popupData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-11/12 max-w-md">
            <h2 className="text-xl font-bold text-blue-800 mb-4">Availability on {popupData.date}</h2>
            <ul className="space-y-2">
              {popupData.availabilities.map((availability, index) => (
                <li key={index} className="p-3 bg-blue-50 rounded-lg shadow-md">
                  <p className="text-blue-900 font-semibold">
                    {formatDateTime(availability.availableFrom)} - {formatDateTime(availability.availableTo)}
                  </p>
                </li>
              ))}
            </ul>
            <button
              className="mt-4 w-full bg-red-500 text-white py-2 rounded-lg hover:bg-red-600"
              onClick={closePopup}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExaminerDashboard;