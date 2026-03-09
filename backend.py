"""
EA Command Center — Python Backend
===================================
FastAPI backend that connects React frontend to Airtable + Trello.

Setup:
  1. pip install fastapi uvicorn httpx python-dotenv
  2. Copy .env.example → .env and fill in your API keys
  3. Run: uvicorn backend:app --reload --port 8000

Architecture:
  React Frontend (port 3000)  →  FastAPI Backend (port 8000)  →  Airtable / Trello APIs
"""

import os
import httpx
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# ─── CONFIG ───────────────────────────────────────────────────────────────────
AIRTABLE_API_KEY = os.getenv("AIRTABLE_API_KEY", "")
AIRTABLE_BASE_ID = os.getenv("AIRTABLE_BASE_ID", "")
TRELLO_API_KEY = os.getenv("TRELLO_API_KEY", "")
TRELLO_TOKEN = os.getenv("TRELLO_TOKEN", "")
TRELLO_BOARD_ID = os.getenv("TRELLO_BOARD_ID", "")

AIRTABLE_BASE_URL = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}"
TRELLO_BASE_URL = "https://api.trello.com/1"

app = FastAPI(title="EA Command Center API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── MODELS ───────────────────────────────────────────────────────────────────
class TaskCreate(BaseModel):
    title: str
    priority: str = "medium"     # high | medium | low
    category: str = "executive"  # executive | hr | operations | admin
    due: str = "Today"
    source: str = "trello"       # trello | airtable

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    priority: Optional[str] = None

class FollowUp(BaseModel):
    item: str
    contact: str
    due_date: str

class QuickNote(BaseModel):
    content: str
    tags: list[str] = []


# ─── AIRTABLE HELPERS ────────────────────────────────────────────────────────
def airtable_headers():
    return {
        "Authorization": f"Bearer {AIRTABLE_API_KEY}",
        "Content-Type": "application/json",
    }

async def airtable_get(table: str, params: dict = None):
    """Fetch records from an Airtable table."""
    if not AIRTABLE_API_KEY:
        raise HTTPException(status_code=503, detail="Airtable not configured. Add AIRTABLE_API_KEY to .env")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{AIRTABLE_BASE_URL}/{table}",
            headers=airtable_headers(),
            params=params or {},
        )
        resp.raise_for_status()
        return resp.json()

async def airtable_create(table: str, fields: dict):
    """Create a record in Airtable."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{AIRTABLE_BASE_URL}/{table}",
            headers=airtable_headers(),
            json={"records": [{"fields": fields}]},
        )
        resp.raise_for_status()
        return resp.json()

async def airtable_update(table: str, record_id: str, fields: dict):
    """Update a record in Airtable."""
    async with httpx.AsyncClient() as client:
        resp = await client.patch(
            f"{AIRTABLE_BASE_URL}/{table}",
            headers=airtable_headers(),
            json={"records": [{"id": record_id, "fields": fields}]},
        )
        resp.raise_for_status()
        return resp.json()


# ─── TRELLO HELPERS ──────────────────────────────────────────────────────────
def trello_params(extra: dict = None):
    base = {"key": TRELLO_API_KEY, "token": TRELLO_TOKEN}
    if extra:
        base.update(extra)
    return base

async def trello_get(endpoint: str, params: dict = None):
    """Fetch from Trello API."""
    if not TRELLO_API_KEY:
        raise HTTPException(status_code=503, detail="Trello not configured. Add TRELLO_API_KEY to .env")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{TRELLO_BASE_URL}{endpoint}",
            params=trello_params(params),
        )
        resp.raise_for_status()
        return resp.json()

async def trello_post(endpoint: str, params: dict = None):
    """Create in Trello API."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{TRELLO_BASE_URL}{endpoint}",
            params=trello_params(params),
        )
        resp.raise_for_status()
        return resp.json()


# ─── ROUTES: TASKS ───────────────────────────────────────────────────────────
@app.get("/api/tasks")
async def get_tasks():
    """
    Fetch tasks from both Airtable and Trello, unified into one list.

    Airtable table expected: "Tasks" with fields:
      - Title (text), Priority (single select), Category (single select),
        Due (text), Status (single select)

    Trello: pulls cards from configured board.
    """
    tasks = []

    # Pull from Airtable
    try:
        data = await airtable_get("Tasks")
        for rec in data.get("records", []):
            f = rec["fields"]
            tasks.append({
                "id": rec["id"],
                "title": f.get("Title", ""),
                "priority": f.get("Priority", "medium").lower(),
                "category": f.get("Category", "admin").lower(),
                "due": f.get("Due", ""),
                "status": f.get("Status", "todo").lower().replace(" ", "_"),
                "source": "airtable",
            })
    except Exception as e:
        print(f"[Airtable] Could not fetch tasks: {e}")

    # Pull from Trello
    try:
        lists = await trello_get(f"/boards/{TRELLO_BOARD_ID}/lists", {"cards": "open"})
        # Map Trello list names to statuses
        status_map = {"to do": "todo", "doing": "in_progress", "done": "done"}
        for lst in lists:
            list_status = status_map.get(lst["name"].lower(), "todo")
            for card in lst.get("cards", []):
                # Parse labels for priority/category
                labels = [l["name"].lower() for l in card.get("labels", [])]
                priority = "high" if "high" in labels else "low" if "low" in labels else "medium"
                category = next((c for c in ["executive", "hr", "operations", "admin"] if c in labels), "admin")
                tasks.append({
                    "id": card["id"],
                    "title": card["name"],
                    "priority": priority,
                    "category": category,
                    "due": card.get("due", ""),
                    "status": list_status,
                    "source": "trello",
                })
    except Exception as e:
        print(f"[Trello] Could not fetch tasks: {e}")

    return {"tasks": tasks, "count": len(tasks)}


@app.post("/api/tasks")
async def create_task(task: TaskCreate):
    """Create a task in Airtable or Trello based on task.source."""
    if task.source == "airtable":
        result = await airtable_create("Tasks", {
            "Title": task.title,
            "Priority": task.priority.capitalize(),
            "Category": task.category.capitalize(),
            "Due": task.due,
            "Status": "Todo",
        })
        return {"created": result}

    elif task.source == "trello":
        # Find the "To Do" list on the board
        lists = await trello_get(f"/boards/{TRELLO_BOARD_ID}/lists")
        todo_list = next((l for l in lists if l["name"].lower() == "to do"), lists[0] if lists else None)
        if not todo_list:
            raise HTTPException(status_code=404, detail="No 'To Do' list found on Trello board")
        result = await trello_post("/cards", {
            "name": task.title,
            "idList": todo_list["id"],
            "due": task.due if task.due not in ["Today", "Tomorrow", "This week"] else None,
        })
        return {"created": result}


@app.patch("/api/tasks/{task_id}")
async def update_task(task_id: str, update: TaskUpdate):
    """Update a task status. Detects source by ID format."""
    # Airtable IDs start with 'rec', Trello IDs are 24-char hex
    if task_id.startswith("rec"):
        fields = {}
        if update.status:
            fields["Status"] = update.status.replace("_", " ").title()
        if update.title:
            fields["Title"] = update.title
        result = await airtable_update("Tasks", task_id, fields)
        return {"updated": result}
    else:
        # Trello — move card to appropriate list
        if update.status:
            lists = await trello_get(f"/boards/{TRELLO_BOARD_ID}/lists")
            status_map = {"todo": "to do", "in_progress": "doing", "done": "done"}
            target_name = status_map.get(update.status, "to do")
            target_list = next((l for l in lists if l["name"].lower() == target_name), None)
            if target_list:
                async with httpx.AsyncClient() as client:
                    await client.put(
                        f"{TRELLO_BASE_URL}/cards/{task_id}",
                        params=trello_params({"idList": target_list["id"]}),
                    )
        return {"updated": True}


# ─── ROUTES: FOLLOW-UPS ─────────────────────────────────────────────────────
@app.get("/api/followups")
async def get_followups():
    """Fetch follow-ups from Airtable 'Follow-ups' table."""
    try:
        data = await airtable_get("Follow-ups")
        followups = []
        for rec in data.get("records", []):
            f = rec["fields"]
            due_str = f.get("DueDate", "")
            status = "overdue" if due_str and due_str < datetime.now().strftime("%Y-%m-%d") else "pending"
            followups.append({
                "id": rec["id"],
                "item": f.get("Item", ""),
                "contact": f.get("Contact", ""),
                "dueDate": due_str,
                "status": status,
            })
        return {"followups": followups}
    except Exception as e:
        return {"followups": [], "error": str(e)}


@app.post("/api/followups")
async def create_followup(fu: FollowUp):
    """Create a follow-up in Airtable."""
    result = await airtable_create("Follow-ups", {
        "Item": fu.item,
        "Contact": fu.contact,
        "DueDate": fu.due_date,
    })
    return {"created": result}


# ─── ROUTES: NOTES ───────────────────────────────────────────────────────────
@app.post("/api/notes")
async def save_note(note: QuickNote):
    """Save a quick note to Airtable 'Notes' table."""
    result = await airtable_create("Notes", {
        "Content": note.content,
        "Tags": ", ".join(note.tags),
        "Timestamp": datetime.now().isoformat(),
    })
    return {"created": result}


# ─── ROUTES: DASHBOARD STATS ────────────────────────────────────────────────
@app.get("/api/stats")
async def get_stats():
    """Aggregate stats for the dashboard status bar."""
    tasks_data = await get_tasks()
    tasks = tasks_data.get("tasks", [])

    followups_data = await get_followups()
    followups = followups_data.get("followups", [])

    return {
        "total_tasks": len(tasks),
        "todo": len([t for t in tasks if t["status"] == "todo"]),
        "in_progress": len([t for t in tasks if t["status"] == "in_progress"]),
        "done": len([t for t in tasks if t["status"] == "done"]),
        "overdue_followups": len([f for f in followups if f["status"] == "overdue"]),
        "pending_followups": len([f for f in followups if f["status"] == "pending"]),
    }


# ─── HEALTH CHECK ───────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "airtable_configured": bool(AIRTABLE_API_KEY),
        "trello_configured": bool(TRELLO_API_KEY),
        "timestamp": datetime.now().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
