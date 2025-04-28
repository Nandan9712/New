import React, { useState, useEffect, useCallback } from 'react';
import keycloak from '../keycloak';
import { FiCalendar, FiClock, FiTrash2, FiLogOut, FiPlus } from 'react-icons/fi';
import '../styles/ExaminerDashboard.css';

const ExaminerDashboard = () => {
  const [availabilities, setAvailabilities] = useState([]);
  const [newAvailability, setNewAvailability] = useState({
    availableFrom: '',
    availableTo: ''
  });
  const [loading, setLoading] = useState(false);

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
      setAvailabilities(await res.json());
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
      setAvailabilities(availabilities.filter(a => a._id !== id));
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
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <div className="examiner-dashboard">
      <header className="dashboard-header">
        <h1 className="dashboard-title">
          <FiCalendar className="header-icon" />
          Examiner Dashboard
        </h1>
        <button onClick={handleLogout} className="logout-btn">
          <FiLogOut /> Logout
        </button>
      </header>

      <main className="dashboard-content">
        <section className="add-availability-section">
          <h2 className="section-title">
            <FiPlus className="section-icon" />
            Add Availability
          </h2>
          
          <div className="availability-form">
            <div className="form-group">
              <label className="form-label">
                <FiClock className="input-icon" />
                From:
              </label>
              <input
                type="datetime-local"
                value={newAvailability.availableFrom}
                onChange={(e) => setNewAvailability({ ...newAvailability, availableFrom: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                <FiClock className="input-icon" />
                To:
              </label>
              <input
                type="datetime-local"
                value={newAvailability.availableTo}
                onChange={(e) => setNewAvailability({ ...newAvailability, availableTo: e.target.value })}
                className="form-input"
              />
            </div>

            <button
              onClick={handleAddAvailability}
              disabled={loading || !newAvailability.availableFrom || !newAvailability.availableTo}
              className="submit-btn"
            >
              {loading ? 'Saving...' : 'Add Availability'}
            </button>
          </div>
        </section>

        <section className="availability-list-section">
          <h2 className="section-title">
            <FiCalendar className="section-icon" />
            Your Availabilities
          </h2>
          
          {availabilities.length === 0 ? (
            <div className="empty-state">
              <p>No availabilities added yet</p>
              <p>Add your available time slots above</p>
            </div>
          ) : (
            <ul className="availability-list">
              {availabilities.map((availability) => (
                <li key={availability._id} className="availability-card">
                  <div className="availability-details">
                    <div className="time-range">
                      <span className="time-label">From:</span>
                      <span>{formatDateTime(availability.availableFrom)}</span>
                    </div>
                    <div className="time-range">
                      <span className="time-label">To:</span>
                      <span>{formatDateTime(availability.availableTo)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAvailability(availability._id)}
                    className="delete-btn"
                    disabled={loading}
                  >
                    <FiTrash2 /> Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
};

export default ExaminerDashboard;