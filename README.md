# AI Diet Plan Application

A full-stack application for managing diet plan leads and health coach tasks with AI capabilities.

## Features

### Lead Management Module
- Upload Excel files with leads (name, phone number, email)
- Assign leads to health coaches
- View and manage uploaded leads
- Bulk assignment functionality

### Coach Dashboard Module
- Coach selection and management
- View assigned leads
- Task management with Kanban board
- Date-wise task organization
- Task statistics (total, completed, incomplete)
- Visual status representation (green for completed, red for incomplete)
- Micro-animations for task status changes

## Technology Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite
- **Excel Parsing**: xlsx library (SheetJS)
- **Animations**: Framer Motion

## Project Structure

```
ai-diet-plan/
├── frontend/          # React frontend application
├── backend/           # Node.js/Express backend API
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The backend server will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Leads
- `GET /api/leads` - Get all leads
- `GET /api/leads/:id` - Get lead by ID
- `PUT /api/leads/:id/assign` - Assign lead to coach
- `PUT /api/leads/bulk-assign` - Bulk assign leads
- `POST /api/upload/leads` - Upload Excel file

### Coaches
- `GET /api/coaches` - Get all coaches
- `GET /api/coaches/:id` - Get coach by ID
- `POST /api/coaches` - Create new coach
- `PUT /api/coaches/:id` - Update coach
- `GET /api/coaches/:id/leads` - Get leads assigned to coach

### Tasks
- `GET /api/tasks` - Get all tasks
- `GET /api/tasks/:id` - Get task by ID
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `PATCH /api/tasks/:id/status` - Update task status
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/stats/:coach_id` - Get task statistics
- `GET /api/tasks/by-date/:coach_id` - Get tasks grouped by date

## Excel File Format

The Excel file should have the following columns:
- `name` - Lead name
- `phone_number` or `phone` - Phone number
- `email` or `email_id` - Email address

## Database

The application uses SQLite database. The database file (`database.sqlite`) will be created automatically in the backend directory when you first run the application.

## Development

### Build for Production

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
```

## License

This project is licensed under the MIT License.
