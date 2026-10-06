# 📚 StudentFlow — Cloud-Based Student Productivity & Task Management System

A full-stack web application built for the **Agile Development Process and DevOps** course.

StudentFlow helps students organize their academic tasks, track deadlines, and measure their productivity.

---

## 🗂️ Project Structure

```
studentflow/
├── backend/               ← Node.js + Express REST API (port 5000)
│   ├── app.js             ← Express app setup (routes, CORS, middleware)
│   ├── server.js          ← Local server entry point (port listener)
│   ├── data/              ← JSON files acting as local database
│   ├── routes/            ← API route handlers (auth, tasks)
│   ├── middleware/        ← JWT authentication middleware
│   ├── utils/
│   │   ├── db.js          ← Database abstraction (delegates to JSON or DynamoDB)
│   │   └── dynamoDb.js    ← AWS DynamoDB repository (AWS SDK v3)
│   └── test/              ← API unit & integration tests
│
├── frontend/              ← React.js application (port 3000)
│   └── src/
│       ├── components/    ← Reusable UI components
│       ├── pages/         ← Full page views (Dashboard, Login, Register)
│       ├── context/       ← Global auth state
│       └── services/      ← API service (REACT_APP_API_URL configurable)
│
├── aws/                   ← AWS Cloud Infrastructure & Lambdas
│   ├── lambda/
│   │   ├── api/           ← StudentFlow-API Lambda (adapted via serverless-http)
│   │   └── automation/    ← StudentFlow-Automation Lambda (EventBridge + SNS)
│   ├── cloudformation/    ← CloudFormation stack template (DynamoDB, SNS, EventBridge)
│   ├── docs/              ← Architecture & deployment guides
│   ├── scripts/           ← Validation & packaging tools
│   └── dist/              ← Packaged deployment zip archives
│
├── .gitignore
└── README.md
```

---

## ✅ Features

| Feature | Status |
|---|---|
| User Registration | ✅ |
| User Login (JWT) | ✅ |
| Student Dashboard | ✅ |
| Create / Edit / Delete Tasks | ✅ |
| Mark Task as Completed | ✅ |
| Task Priority (Low / Medium / High) | ✅ |
| Task Categories (Assignment / Exam / Project / Personal) | ✅ |
| Due Dates | ✅ |
| Overdue Task Detection | ✅ |
| Search Tasks | ✅ |
| Filter by Status / Priority / Category | ✅ |
| Productivity Percentage | ✅ |
| Upcoming Deadlines (next 7 days) | ✅ |
| Responsive UI (Bootstrap) | ✅ |

---

## 🛠️ Technology Stack

**Frontend:** React.js, Bootstrap 5, Axios, React Router v6  
**Backend:** Node.js, Express.js, JWT, bcryptjs  
**Storage:** Local JSON files (easily replaceable with DynamoDB)

---

## 🚀 How to Install and Run

### Prerequisites
Make sure you have installed:
- [Node.js](https://nodejs.org/) (version 16 or higher)
- npm (comes with Node.js)

Check versions in your terminal:
```bash
node --version
npm --version
```

---

### Step 1 — Open Two Terminal Windows

You need **two separate terminals** — one for the backend and one for the frontend.

---

### Step 2 — Set Up and Start the Backend

In **Terminal 1**, run these commands one by one:

```bash
# Navigate to the backend folder
cd "C:\Users\Murali krishna\Downloads\Agile project\studentflow\backend"

# Install all backend dependencies
npm install

# Start the backend server
npm start
```

✅ You should see:
```
✅ StudentFlow backend is running on http://localhost:5000
📋 Health check: http://localhost:5000/api/health
```

---

### Step 3 — Set Up and Start the Frontend

In **Terminal 2**, run these commands one by one:

```bash
# Navigate to the frontend folder
cd "C:\Users\Murali krishna\Downloads\Agile project\studentflow\frontend"

# Install all frontend dependencies
npm install

# Start the React development server
npm start
```

✅ Your browser should automatically open at **http://localhost:3000**

---

## 🌐 What You Should See in the Browser

1. **http://localhost:3000** → Redirects to the Login page
2. Click **"Register here"** → Fill in your name, email, and password → Click **Create Account**
3. You will see a success message and be redirected back to Login
4. Log in with your credentials → You are taken to the **Dashboard**
5. On the Dashboard you can:
   - See your stats (Total, Completed, Pending, Overdue, Productivity %)
   - Click **➕ Add Task** to create a task
   - Check the checkbox on a task to mark it complete
   - Click ✏️ to edit or 🗑️ to delete a task
   - Use the search bar and dropdown filters to find tasks
   - See upcoming deadlines in the yellow banner

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Server health check |
| POST | `/api/auth/register` | Register new account |
| POST | `/api/auth/login` | Login and get token |
| GET | `/api/tasks` | Get all tasks (auth required) |
| POST | `/api/tasks` | Create new task (auth required) |
| PUT | `/api/tasks/:id` | Update task (auth required) |
| DELETE | `/api/tasks/:id` | Delete task (auth required) |
| PATCH | `/api/tasks/:id/complete` | Toggle completion (auth required) |

---

## 🧪 Quick Test — Verify Backend is Working

Open your browser and go to:  
**http://localhost:5000/api/health**

You should see:
```json
{ "status": "OK", "message": "StudentFlow backend is running!" }
```

---

## 📦 Dependencies Used

### Backend
| Package | Purpose |
|---|---|
| express | Web server framework |
| cors | Allow frontend to talk to backend |
| dotenv | Load .env variables |
| bcryptjs | Hash passwords securely |
| jsonwebtoken | Create/verify JWT tokens |
| uuid | Generate unique IDs |
| nodemon | Auto-restart during development |

### Frontend
| Package | Purpose |
|---|---|
| react | UI library |
| react-dom | Render React to browser |
| react-router-dom | Page navigation/routing |
| axios | Make HTTP requests to backend |
| bootstrap | CSS styling framework |

---

## ☁️ AWS Serverless Architecture

StudentFlow features a dual-Lambda cloud architecture separating real-time API traffic from scheduled batch automation:

### 1. StudentFlow-API (Synchronous REST API)
- **Lambda Function**: [`aws/lambda/api/index.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/aws/lambda/api/index.js)
- **Entry / Adapter**: Uses `serverless-http` to adapt the core Express application for Amazon API Gateway HTTP API.
- **Database**: Uses AWS SDK v3 DynamoDB repository [`backend/utils/dynamoDb.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/backend/utils/dynamoDb.js) against `StudentFlow-Users` and `StudentFlow-Tasks`.
- **Environment Variables**:
  - `USERS_TABLE`: DynamoDB users table name (default: `StudentFlow-Users`)
  - `TASKS_TABLE`: DynamoDB tasks table name (default: `StudentFlow-Tasks`)
  - `JWT_SECRET`: Secret key for authentication token signing
  - `FRONTEND_ORIGIN`: Configurable CORS origin (e.g. `http://localhost:3000` or CloudFront domain)
- **Full Guide**: [`aws/docs/AWS_API_GUIDE.md`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/aws/docs/AWS_API_GUIDE.md)

### 2. StudentFlow-Automation (Hourly Scheduled Automation)
- **Lambda Function**: [`aws/lambda/automation/index.js`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/aws/lambda/automation/index.js)
- **Trigger**: Amazon EventBridge Rule (`rate(1 hour)`).
- **Responsibilities**: Scans `StudentFlow-Tasks` for overdue tasks, publishes 24h reminders via Amazon SNS (`StudentFlow-Notifications`), and calculates student productivity scores.
- **Full Guide**: [`aws/docs/AWS_AUTOMATION_GUIDE.md`](file:///c:/Users/Murali%20krishna/Downloads/StudentFlow%20Project/Agile%20project/studentflow/aws/docs/AWS_AUTOMATION_GUIDE.md)

---

## 🧪 Testing & Packaging Commands

All tests execute completely offline without requiring real AWS credentials:

```bash
# 1. Run StudentFlow-API & Express unit/integration tests (24 tests):
npm run test:api

# 2. Run StudentFlow-Automation unit/pipeline tests (29 tests):
npm run test:automation

# 3. Run all test suites together (53 tests):
npm run test:all

# 4. Validate CloudFormation template:
node aws/scripts/validate-template.js

# 5. Build deployment packages (outputs to aws/dist/):
npm run package:api       # Builds aws/dist/studentflow-api.zip
npm run package:lambda    # Builds aws/dist/studentflow-automation.zip

# 6. Run local JSON database automation simulation:
npm run automation:local
```

---

## 👤 Author

Built for the Agile Development Process and DevOps course.

