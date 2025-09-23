import React from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

function CalendarComponent({ highlightDates, onDateClick }) {
  return (
    <div className="mt-10 bg-white rounded-3xl shadow-2xl border-2 border-blue-200 p-10 w-full max-w-lg" style={{ minWidth: '370px' }}>
      <div className="text-blue-700 font-extrabold text-2xl mb-6 text-center tracking-wide">Calendar</div>
      <Calendar
        onClickDay={onDateClick}
        tileClassName={({ date }) => {
          const key = date.toLocaleDateString('en-CA');
          if (highlightDates[key]) {
            return 'dark-red-box';
          }
          return null;
        }}
      />
    </div>
  );
}

export default CalendarComponent;
