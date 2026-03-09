# EA Command Center — Setup Guide

## What You Get

A unified dashboard for your EA responsibilities:
- **Task Board** — Pulls tasks from both Airtable and Trello, filter by status/category
- **Inbox Monitor** — Track emails by priority and category (Executive, HR, Ops)
- **Calendar View** — Today's schedule with confirmation status
- **Follow-up Tracker** — Never miss a pending response, overdue alerts
- **Quick Actions** — One-click to draft emails, create tasks, schedule, take notes

---

## Quick Start (Local Dev)

### 1. Backend (Python)

```bash
cd backend
pip install fastapi uvicorn httpx python-dotenv
cp .env.example .env
# Fill in your Airtable + Trello credentials in .env
uvicorn backend:app --reload --port 8000
```

### 2. Frontend (React)

```bash
npx create-react-app ea-command-center
cd ea-command-center
# Replace src/App.js content with ea-command-center.jsx
npm start
```

Or with Vite (faster):
```bash
npm create vite@latest ea-command-center -- --template react
cd ea-command-center
# Copy ea-command-center.jsx → src/App.jsx
npm install
npm run dev
```

---

## Connecting to Real APIs

### Airtable Setup

1. Go to [airtable.com](https://airtable.com) and create a base
2. Create these tables:

   **Tasks table:**
   | Field    | Type          | Options                              |
   |----------|---------------|--------------------------------------|
   | Title    | Single line   |                                      |
   | Priority | Single select | High, Medium, Low                    |
   | Category | Single select | Executive, HR, Operations, Admin     |
   | Due      | Single line   |                                      |
   | Status   | Single select | Todo, In Progress, Done              |

   **Follow-ups table:**
   | Field    | Type        |
   |----------|-------------|
   | Item     | Single line |
   | Contact  | Single line |
   | DueDate  | Date        |

   **Notes table:**
   | Field     | Type        |
   |-----------|-------------|
   | Content   | Long text   |
   | Tags      | Single line |
   | Timestamp | Single line |

3. Get your Personal Access Token from airtable.com/account
4. Get your Base ID from the API docs page

### Trello Setup

1. Create a board with lists: **To Do**, **Doing**, **Done**
2. Create labels: High, Medium, Low (for priority) + Executive, HR, Operations, Admin (for category)
3. Get your API key from trello.com/power-ups/admin
4. Generate a token using the auth URL in .env.example
5. Get your board ID by adding `.json` to your board URL

---

## Wiring Frontend → Backend

In the React app, replace the mock data with API calls. Example:

```javascript
// In your React component, replace MOCK_TASKS with:
const [tasks, setTasks] = useState([]);

useEffect(() => {
  fetch('http://localhost:8000/api/tasks')
    .then(res => res.json())
    .then(data => setTasks(data.tasks))
    .catch(err => console.log('Backend not connected, using mock data'));
}, []);

// For creating tasks:
const addTask = async (task) => {
  const res = await fetch('http://localhost:8000/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  const data = await res.json();
  // Refresh task list
  fetchTasks();
};
```

---

## Next Steps / Roadmap

1. **Gmail integration** — Use Google API to pull inbox data
2. **Google Calendar** — Real calendar data via Google Calendar API
3. **Slack notifications** — Webhook for overdue follow-ups
4. **Deploy** — Vercel (frontend) + Railway/Render (backend)
5. **n8n automations** — Connect your existing workflows

---

## File Structure

```
ea-command-center/
├── ea-command-center.jsx   ← React frontend (the dashboard UI)
├── backend.py              ← FastAPI backend (Airtable + Trello)
├── .env.example            ← Environment variable template
└── README.md               ← This file
```
