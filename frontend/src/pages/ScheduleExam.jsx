// src/pages/ScheduleExam.jsx
import React, { useState, useEffect } from 'react';
import keycloak from '../keycloak';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import 'leaflet/dist/leaflet.css';
import LocationPicker from '../components/LocationPicker';

export default function ScheduleExam({ examId }) {
  const [sessionList, setSessionList] = useState([]);
  const [examData, setExamData] = useState({
    sessionId:  '',
    date:       null,
    time:       '',
    isOnline:   true,
    onlineLink: '',
    location:   '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // load sessions
    (async () => {
      await keycloak.updateToken(5);
      const res = await fetch(
        'http://localhost:5000/api/training-sessions/mines',
        { headers: { Authorization: `Bearer ${keycloak.token}` } }
      );
      if (!res.ok) throw new Error(await res.text());
      setSessionList(await res.json());
    })();

    // if editing, load exam
    if (examId) {
      (async () => {
        await keycloak.updateToken(5);
        const res = await fetch(
          `http://localhost:5000/api/exams/${examId}`,
          { headers: { Authorization: `Bearer ${keycloak.token}` } }
        );
        if (!res.ok) throw new Error(await res.text());
        setExamData(await res.json());
      })();
    }
  }, [examId]);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await keycloak.updateToken(5);
      const url    = examId
        ? `http://localhost:5000/api/exams/${examId}`
        : 'http://localhost:5000/api/exams';
      const method = examId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${keycloak.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(examData),
      });
      if (!res.ok) {
        console.error('Error status:', res.status);
        throw new Error(await res.text());
      }
      alert('✅ Exam saved');
    } catch (err) {
      console.error('Error scheduling exam:', err);
      alert('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        {examId ? 'Reschedule' : 'Schedule'} Exam
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Session */}
        <div>
          <label className="block mb-1">Select Session</label>
          <select
            className="border p-2 rounded w-full"
            value={examData.sessionId}
            onChange={e =>
              setExamData({ ...examData, sessionId: e.target.value })
            }
            required
          >
            <option value="">-- pick one --</option>
            {sessionList.map(s => (
              <option key={s._id} value={s._id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block mb-1">Select Date</label>
          <Calendar
            onChange={d =>
              setExamData({ ...examData, date: d.toISOString() })
            }
            value={examData.date ? new Date(examData.date) : new Date()}
          />
        </div>

        {/* Time */}
        <div>
          <label className="block mb-1">Select Time</label>
          <input
            type="time"
            className="border p-2 rounded w-full"
            value={examData.time}
            onChange={e =>
              setExamData({ ...examData, time: e.target.value })
            }
            required
          />
        </div>

        {/* Mode */}
        <div className="flex gap-4">
          <label>
            <input
              type="radio"
              checked={examData.isOnline}
              onChange={() =>
                setExamData({ ...examData, isOnline: true })
              }
            />{' '}
            Online
          </label>
          <label>
            <input
              type="radio"
              checked={!examData.isOnline}
              onChange={() =>
                setExamData({ ...examData, isOnline: false })
              }
            />{' '}
            Offline
          </label>
        </div>

        {/* Conditional Link / Map Picker */}
        {examData.isOnline ? (
          <div>
            <label className="block mb-1">Zoom Link</label>
            <input
              type="url"
              className="border p-2 rounded w-full"
              value={examData.onlineLink}
              onChange={e =>
                setExamData({ ...examData, onlineLink: e.target.value })
              }
              required
            />
          </div>
        ) : (
          <div>
            <label className="block mb-1">Location</label>
            <LocationPicker
              address={examData.location}
              setAddress={loc =>
                setExamData({ ...examData, location: loc })
              }
            />
            <div className="mt-2 text-sm">
              <strong>Address:</strong> {examData.location || 'n/a'}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`px-4 py-2 rounded text-white ${
            loading ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {loading ? 'Saving…' : 'Save Exam'}
        </button>
      </form>
    </div>
  );
}
