# Live Session Reporting System

Full-stack web application untuk melacak dan mengelola laporan live session dengan Telegram Bot integration.

## 📁 Project Structure

```
live-session-reporting/
├── frontend/         # React dashboard (Manager & Host)
├── backend/          # Express REST API + Telegram Bot
└── package.json      # Root workspace manager
```

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL 12+
- Telegram Bot Token
- OCR.Space API Key

### Installation

```bash
# Install all dependencies
npm run install:all

# Setup environment variables
cp backend/.env.example backend/.env
# Edit backend/.env dengan credentials Anda
```

### Database Setup

```bash
# Jalankan SQL schema
psql -U postgres -d live_session_db -f backend/src/config/database.sql

# Create Manager account
cd backend
node src/setup-manager-email.js
```

### Running Development

```bash
# Run frontend + backend bersamaan
npm run dev

# Atau jalankan secara terpisah:
npm run dev:frontend   # http://localhost:3000
npm run dev:backend    # http://localhost:5000
```

### Setup Telegram Webhook

```bash
cd backend
node src/setup-webhook.js
# Masukkan ngrok URL Anda
```

## 📦 Tech Stack

### Frontend
- React 19
- React Router v7
- TanStack Query (React Query)
- Axios
- CSS Modules

### Backend
- Express.js
- PostgreSQL
- JWT Authentication
- Telegram Bot API
- OCR.Space API
- bcryptjs

## 🔑 Environment Variables

Lihat `backend/.env.example` untuk daftar lengkap.

Key variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- `TELEGRAM_BOT_TOKEN`
- `OCRSPACE_API_KEY`

## 📱 Features

### Manager Dashboard
- ✅ View all reports (with filters)
- ✅ Approve/Reject reports
- ✅ Host management
- ✅ User approval
- ✅ Statistics & analytics

### Host Dashboard
- ✅ View own reports
- ✅ Statistics per month
- ✅ Auto-submit via Telegram Bot

### Telegram Bot
- ✅ OCR screenshot processing
- ✅ GMV extraction
- ✅ Live duration tracking
- ✅ User registration flow
- ✅ Email + Password setup
- ✅ Real-time notifications

## 🔒 Authentication

- **Login Type**: Email + Password
- **JWT Token**: 7 days expiry
- **Roles**: MANAGER, HOST

## 📊 API Documentation

Base URL: `http://localhost:5000/api`

### Auth
- `POST /auth/login` - Login
- `GET /auth/me` - Get current user

### Reports (Manager)
- `GET /reports` - All reports
- `GET /reports/statistics` - Stats
- `PUT /reports/:id/status` - Verify/Reject

### Reports (Host)
- `GET /reports/my-reports` - Own reports

### Hosts (Manager)
- `GET /hosts` - All hosts
- `POST /hosts` - Create host
- `PUT /hosts/:id` - Update host
- `DELETE /hosts/:id` - Delete host
- `PATCH /hosts/:id/toggle-status` - Activate/Deactivate

### Users (Manager)
- `GET /users/pending` - Pending approvals
- `PUT /users/:id/approve` - Approve user
- `DELETE /users/:id/reject` - Reject user

## 🧪 Testing

```bash
# Test database connection
cd backend
node src/test-db.js

# Test OCR service
node src/test-ocr.js
```

## 📝 License

ISC

## 👥 Author

Your Name