# Findr: A Campus Utility Web Application

Findr is a full-stack campus utility web application for University of San Carlos (USC) students, featuring:
- **Marketplace:** Create item listings, browse/search/filter available items, submit/confirm/decline/cancel buy requests, mark items as Sold, and automated seller email notifications.
- **Lost and Found:** Publish Lost/Found reports, search/filter active posts, submit `"This is Mine"` / `"I Found This"` claims, approve/decline claims, mark items as Returned, and automated poster email notifications.
- **Vacant Room Finder:** Automatic server-time (`Asia/Manila`) and custom day/time room availability checks, campus/building filters, and available time-slot modals.

## Tech Stack
- **Frontend:** React 19, Vite, React Router, Lucide Icons
- **Backend:** Node.js, Express 5, MySQL (`mysql2`), JWT, bcrypt, Multer, Nodemailer

## Setup & Installation

### 1. Database Setup
1. Create a MySQL database (e.g., `findr_db`).
2. Import your project SQL schema and reference data into the database.

### 2. Backend Setup
```bash
cd backend
npm install
```
Create `backend/.env` based on `backend/.env.example` and fill in your database, SMTP email, and `JWT_SECRET` values. Then start the backend server:
```bash
node server.js
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
By default, the frontend runs on `http://localhost:5173` and connects to the backend API.