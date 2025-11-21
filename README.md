# Infosys Training & Examination Platform

A comprehensive full-stack *MERN application* designed for managing training sessions, examinations, and role-based access with Keycloak authentication.

![Banner](https://images.unsplash.com/photo-1516321318423-f06f85e504b3?ixlib=rb-4.0.1&auto=format&fit=crop&w=1200&q=80)

---

## 🚀 Features

### 🔐 Authentication & Authorization
- Keycloak Integration for secure authentication  
- Role-based access (Student, Teacher, Examiner, Coordinator)  
- JWT token management  
- Automatic token refresh  

---

## 👨‍🎓 Student Dashboard
- Browse & enroll in available training sessions  
- View enrolled sessions  
- View upcoming exams  
- Interactive calendar with highlights  
- Profile management  

---

## 👨‍🏫 Teacher Dashboard
- Create/manage training sessions  
- Recurring sessions  
- Track student enrollments  
- Reschedule sessions  
- Calendar overview  

---

## 👨‍⚖ Examiner Dashboard
- Manage availability slots  
- View assigned exams  
- Cancel / auto-reassign exams  
- Calendar-based slot management  

---

## 👨‍💼 Coordinator Dashboard
- Overview of all sessions/exams  
- Assign examiners  
- Schedule exams  
- Track system-wide metrics  

---

## 🛠 Tech Stack

### *Frontend*
- React 18  
- Tailwind CSS  
- React Icons  
- React Calendar  
- React DatePicker  
- Keycloak JS  

### *Backend*
- Express.js  
- MongoDB + Mongoose  
- Keycloak-Connect  
- Express Session  
- CORS  

### 🗂️ Project Directory Structure

```plaintext
drone-certification-platform/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CalendarComponent.jsx
│   │   │   └── ...
│   │   ├── dashboards/
│   │   │   ├── StudentDashboard.jsx
│   │   │   ├── TeacherDashboard.jsx
│   │   │   ├── ExaminerDashboard.jsx
│   │   │   └── CoordinatorDashboard.jsx
│   │   ├── keycloak.js
│   │   ├── constants.js
│   │   └── styles/
│   └── package.json
├── backend/
│   ├── models/
│   │   ├── Exam.js
│   │   ├── TrainingSession.js
│   │   ├── Availability.js
│   │   └── User.js
│   ├── routes/
│   │   ├── exams.js
│   │   ├── trainingSessions.js
│   │   ├── student.js
│   │   ├── availability.js
│   │   ├── coordinator.js
│   │   └── emailTest.js
│   ├── keycloak-config.js
│   ├── server.js
│   └── package.json
└── README.md
```

yaml
Copy code

---

# 🚀 Getting Started

## 🔧 Prerequisites
- Node.js (v16+)
- MongoDB Local or Atlas
- Keycloak running at *http://localhost:8080/*

---

# 🖥 Backend Setup

bash
cd backend
npm install
➤ Create .env
env
Copy code
MONGODB_URI=mongodb://localhost:27017/drone_cert
KEYCLOAK_REALM=drone-app
KEYCLOAK_AUTH_SERVER_URL=http://localhost:8080/
KEYCLOAK_CLIENT_ID=frontend-client
KEYCLOAK_CLIENT_SECRET=9df3c06d1c1d553c934105cef7469f8cfb835236fc18a1b42e6349e992b7d5a3
SESSION_SECRET=9df3c06d1c1d553c934105cef7469f8cfb835236fc18a1b42e6349e992b7d5a3
➤ Start Backend
bash
Copy code
npm run dev
Backend runs at: http://localhost:5000

🖼 Frontend Setup
bash
Copy code
cd frontend
npm install
npm run dev
Frontend runs at: http://localhost:5173

🔑 Keycloak Configuration
1️⃣ Create Realm
Copy code
drone-app
2️⃣ Create Client
Copy code
frontend-client
Protocol: openid-connect

Access Type: confidential

Redirect URI: http://localhost:5173/*

3️⃣ Create Roles
student

teacher

examiner

coordinator

4️⃣ Create Users & Assign Roles
📊 API Endpoints
🧪 Exams
```plaintext
Method	Endpoint	Description	Role
GET	/api/exams/mine	Get examiner’s assigned exams	Examiner
PUT	/api/exams/:id/cancel	Cancel/reassign exam	Examiner
GET	/api/exams/stats/mine	Examiner statistics	Examiner
```

📘 Training Sessions
Method	Endpoint	Description	Role
```plaintext
GET	/api/training-sessions/mine	Teacher’s sessions	Teacher
POST	/api/training-sessions	Create session	Teacher
PUT	/api/training-sessions/:id	Update	Teacher
DELETE	/api/training-sessions/:id	Cancel session	Teacher
```
👨‍🎓 Student
Method	Endpoint	Description	Role
GET	/api/student/sessions	Available sessions	Student
GET	/api/student/sessions/mine	Enrolled sessions	Student
POST	/api/student/sessions/:id/enroll	Enroll	Student
GET	/api/student/exams/mine	Student exams	Student

🧑‍⚖ Examiner Availability
Method	Endpoint	Description	Role
GET	/api/availability/mine	View availability	Examiner
POST	/api/availability	Add slot	Examiner
PUT	/api/availability/:id	Update slot	Examiner
DELETE	/api/availability/:id	Delete slot	Examiner

🧑‍💼 Coordinator
Method	Endpoint	Description
GET	/api/coordinator/sessions	All sessions
GET	/api/coordinator/exams	All exams
GET	/api/coordinator/examiners	All examiners
POST	/api/coordinator/exams/schedule	Schedule exam
PUT	/api/coordinator/exams/:id	Update exam

🔄 Core Functionalities
✔ Smart Exam Scheduling
Session-based exam ties

Auto date/time suggestions

Matches examiner availability

Prevents conflicts

✔ Availability Management
Custom time ranges

Modify specific days

Visual calendar view

✔ Real-Time Updates
Sessions update instantly

Enrollment sync

Exam status auto-updates

🎨 UI/UX Features
Mobile responsive

Sidebar navigation

Smooth animations

Highlight-based calendar

Loading skeletons

Error validation

🏗 Installation Details
MongoDB Setup
bash
Copy code
mongod
Or with Docker:

bash
Copy code
docker run -d -p 27017:27017 --name mongodb mongo:latest
Keycloak Setup
bash
Copy code
wget https://github.com/keycloak/keycloak/releases/download/21.0.0/keycloak-21.0.0.zip
unzip keycloak-21.0.0.zip
cd keycloak-21.0.0/bin
./standalone.sh -Djboss.socket.binding.port-offset=1000
🔧 Development Mode
bash
Copy code
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
🛠 Build for Production
bash
Copy code
cd frontend
npm run build

cd backend
npm start
🐛 Troubleshooting
🔹 Keycloak Errors
bash
Copy code
curl http://localhost:8080/auth/realms/drone-app
🔹 MongoDB Errors
bash
Copy code
sudo systemctl status mongod
docker ps | grep mongo
🔹 CORS Issues
Ensure frontend URL is added correctly

Check Vite proxy configuration

📈 Future Enhancements
Email notifications

Real-time chat

Video conferencing

Analytics dashboard

React Native mobile app

Payment system

Automated testing (Jest + Cypress)

Docker deployment

🤝 Contributing
bash
Copy code
git checkout -b feature/amazing-feature
git commit -m "Added amazing feature"
git push origin feature/amazing-feature
