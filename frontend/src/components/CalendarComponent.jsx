import React, { useState, useMemo } from 'react';
import { FaEdit, FaTrash, FaTimes, FaClock, FaCalendarCheck } from 'react-icons/fa';

const CalendarComponent = ({ highlightDates, onDateClick, onCustomize, onDeleteDay }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingTime, setEditingTime] = useState({ from: '09:00', to: '17:00' });

  // Process highlight dates to include full ranges
  const processedDates = useMemo(() => {
    const dates = {};
    
    if (highlightDates && typeof highlightDates === 'object') {
      Object.entries(highlightDates).forEach(([dateKey, availabilities]) => {
        if (Array.isArray(availabilities)) {
          availabilities.forEach(availability => {
            const start = new Date(availability.availableFrom);
            const end = new Date(availability.availableTo);
            
            // Mark all dates in the range
            const current = new Date(start);
            while (current <= end) {
              const dateStr = current.toLocaleDateString('en-CA');
              if (!dates[dateStr]) dates[dateStr] = [];
              if (!dates[dateStr].some(a => a._id === availability._id)) {
                dates[dateStr].push({
                  ...availability,
                  isStart: dateStr === start.toLocaleDateString('en-CA'),
                  isEnd: dateStr === end.toLocaleDateString('en-CA'),
                  date: new Date(current)
                });
              }
              current.setDate(current.getDate() + 1);
            }
          });
        }
      });
    }
    
    return dates;
  }, [highlightDates]);

  const getDateStatus = (date) => {
    const dateStr = date.toLocaleDateString('en-CA');
    const availabilities = processedDates[dateStr] || [];
    
    if (availabilities.length > 0) {
      return {
        type: 'available',
        count: availabilities.length,
        availabilities
      };
    }
    
    return { type: 'normal', count: 0, availabilities: [] };
  };

  const getDateClassName = (date, status) => {
    const baseClasses = "w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-200 font-medium text-sm relative";
    
    const isToday = date.toDateString() === new Date().toDateString();
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
    
    let colorClasses = "";
    
    switch (status.type) {
      case 'available':
        colorClasses = status.count > 1 
          ? "bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg scale-105"
          : "bg-green-100 text-green-800 border-2 border-green-300 hover:bg-green-200";
        break;
      default:
        colorClasses = "text-gray-700 hover:bg-blue-50";
    }
    
    const todayClass = isToday ? "ring-2 ring-blue-400 ring-offset-2" : "";
    const monthClass = isCurrentMonth ? "opacity-100" : "opacity-40";
    
    return `${baseClasses} ${colorClasses} ${todayClass} ${monthClass}`;
  };

  const handleDateClick = (date, event) => {
    const status = getDateStatus(date);
    
    if (status.type === 'available') {
      setSelectedDate(date);
      
      // Set default editing times based on first availability for that day
      if (status.availabilities.length > 0) {
        const firstAvailability = status.availabilities[0];
        const fromTime = new Date(firstAvailability.availableFrom);
        const toTime = new Date(firstAvailability.availableTo);
        
        setEditingTime({
          from: `${fromTime.getHours().toString().padStart(2, '0')}:${fromTime.getMinutes().toString().padStart(2, '0')}`,
          to: `${toTime.getHours().toString().padStart(2, '0')}:${toTime.getMinutes().toString().padStart(2, '0')}`
        });
      }
      
      setShowModal(true);
    }
    
    if (onDateClick) {
      onDateClick(date);
    }
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    
    const days = [];
    const totalDays = lastDay.getDate();
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push(date);
    }
    
    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Next month days
    const totalCells = 42; // 6 weeks
    const nextMonthDays = totalCells - days.length;
    for (let i = 1; i <= nextMonthDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleCustomizeDay = (availability) => {
    if (selectedDate && onCustomize && typeof onCustomize === 'function') {
      const targetDate = selectedDate.toISOString().split('T')[0];
      onCustomize(availability._id, targetDate, editingTime.from, editingTime.to);
    }
    setShowModal(false);
  };

  const handleDeleteDay = (availability) => {
    if (selectedDate && onDeleteDay && typeof onDeleteDay === 'function') {
      const targetDate = selectedDate.toISOString().split('T')[0];
      onDeleteDay(availability._id, targetDate);
    }
    setShowModal(false);
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const calendarDays = renderCalendar();

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-gray-600 hover:text-gray-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h3 className="text-xl font-bold text-gray-800">
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        
        <button
          onClick={() => navigateMonth(1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-gray-600 hover:text-gray-800"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {daysOfWeek.map(day => (
          <div key={day} className="text-center text-sm font-semibold text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((date, index) => {
          const status = getDateStatus(date);
          return (
            <button
              key={index}
              onClick={(e) => handleDateClick(date, e)}
              className={getDateClassName(date, status)}
            >
              {date.getDate()}
              {status.type === 'available' && status.count > 1 && (
                <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {status.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-100 border-2 border-green-300 rounded"></div>
            <span className="text-gray-600">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gradient-to-br from-green-400 to-green-600 rounded"></div>
            <span className="text-gray-600">Multiple Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 ring-2 ring-blue-400 ring-offset-2 rounded"></div>
            <span className="text-gray-600">Today</span>
          </div>
        </div>
      </div>

      {/* Centered Date Modal */}
      {showModal && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md max-h-[80vh] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <FaCalendarCheck className="text-blue-500" />
                  Manage Availability for {selectedDate.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 text-gray-500 hover:text-gray-700"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              </div>

              {/* Time Selection */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-3">Set Time for This Day:</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">From:</label>
                    <input
                      type="time"
                      value={editingTime.from}
                      onChange={(e) => setEditingTime({...editingTime, from: e.target.value})}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">To:</label>
                    <input
                      type="time"
                      value={editingTime.to}
                      onChange={(e) => setEditingTime({...editingTime, to: e.target.value})}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-64 overflow-y-auto">
                {getDateStatus(selectedDate).availabilities.map((availability, index) => (
                  <div key={availability._id || index} className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-green-800 flex items-center gap-2">
                        <FaClock className="text-green-600" />
                        Current Time Slot
                      </span>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        {availability.isStart && availability.isEnd ? 'Single Day' : 
                         availability.isStart ? 'Starts' : 
                         availability.isEnd ? 'Ends' : 'Within Range'}
                      </span>
                    </div>
                    <div className="text-sm text-green-700 space-y-1 mb-3">
                      <div><strong>Original Range:</strong> {new Date(availability.availableFrom).toLocaleDateString()} to {new Date(availability.availableTo).toLocaleDateString()}</div>
                      <div><strong>Time:</strong> {formatTime(availability.availableFrom)} - {formatTime(availability.availableTo)}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCustomizeDay(availability)}
                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <FaEdit className="w-3 h-3" />
                        Update This Day
                      </button>
                      <button
                        onClick={() => handleDeleteDay(availability)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <FaTrash className="w-3 h-3" />
                        Remove This Day
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {getDateStatus(selectedDate).availabilities.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FaCalendarCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No availability set for this date</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarComponent;