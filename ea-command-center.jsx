import { useState, useEffect, useCallback, useMemo } from "react";

// ─── MOCK DATA (Replace with Airtable/Trello API calls) ─────────────────────
const MOCK_INBOX = [
  { id: 1, from: "CEO", subject: "Q2 Board Deck Review", time: "9:15 AM", priority: "high", status: "unread", category: "executive" },
  { id: 2, from: "HR Director", subject: "Onboarding Docs - New Hire", time: "10:02 AM", priority: "medium", status: "unread", category: "hr" },
  { id: 3, from: "Vendor - AcmeCorp", subject: "Invoice #4421 Follow-up", time: "11:30 AM", priority: "low", status: "read", category: "operations" },
  { id: 4, from: "CTO", subject: "Meeting reschedule request", time: "1:45 PM", priority: "high", status: "unread", category: "executive" },
  { id: 5, from: "Legal", subject: "Compliance training reminder", time: "2:10 PM", priority: "medium", status: "read", category: "hr" },
];

const MOCK_CALENDAR = [
  { id: 1, title: "Leadership Standup", time: "9:00 AM", duration: "30m", type: "recurring", confirmed: true },
  { id: 2, title: "1:1 with CTO", time: "10:30 AM", duration: "45m", type: "meeting", confirmed: true },
  { id: 3, title: "Vendor Call - AcmeCorp", time: "1:00 PM", duration: "30m", type: "external", confirmed: false },
  { id: 4, title: "HR Onboarding Sync", time: "2:30 PM", duration: "30m", type: "meeting", confirmed: true },
  { id: 5, title: "Board Prep Review", time: "4:00 PM", duration: "1h", type: "prep", confirmed: false },
];

const MOCK_TASKS = [
  { id: 1, title: "Draft board meeting agenda", status: "in_progress", priority: "high", due: "Today", category: "executive", source: "trello" },
  { id: 2, title: "Send onboarding packet to new hire", status: "todo", priority: "high", due: "Today", category: "hr", source: "airtable" },
  { id: 3, title: "Confirm vendor delivery schedule", status: "todo", priority: "medium", due: "Tomorrow", category: "operations", source: "trello" },
  { id: 4, title: "Update compliance tracker", status: "in_progress", priority: "medium", due: "This week", category: "hr", source: "airtable" },
  { id: 5, title: "Research catering for offsite", status: "todo", priority: "low", due: "This week", category: "admin", source: "trello" },
  { id: 6, title: "File Q1 expense reports", status: "done", priority: "medium", due: "Done", category: "admin", source: "airtable" },
  { id: 7, title: "Book travel for CEO conference", status: "todo", priority: "high", due: "Tomorrow", category: "operations", source: "trello" },
  { id: 8, title: "Prepare internal memo draft", status: "todo", priority: "medium", due: "This week", category: "executive", source: "airtable" },
];

const MOCK_FOLLOWUPS = [
  { id: 1, item: "CEO sign-off on budget proposal", dueDate: "Today", contact: "CEO", status: "pending" },
  { id: 2, item: "HR doc return from new hire", dueDate: "Tomorrow", contact: "Jamie L.", status: "pending" },
  { id: 3, item: "AcmeCorp revised quote", dueDate: "Mar 11", contact: "AcmeCorp", status: "overdue" },
];

// ─── STYLE CONSTANTS ─────────────────────────────────────────────────────────
const COLORS = {
  bg: "#0C0F14",
  surface: "#141820",
  surfaceAlt: "#1A1F2B",
  border: "#252B3A",
  borderLight: "#2E3548",
  text: "#E8ECF4",
  textMuted: "#8892A8",
  textDim: "#5A6478",
  accent: "#3B82F6",
  accentGlow: "rgba(59,130,246,0.15)",
  high: "#EF4444",
  highBg: "rgba(239,68,68,0.12)",
  medium: "#F59E0B",
  mediumBg: "rgba(245,158,11,0.12)",
  low: "#22C55E",
  lowBg: "rgba(34,197,94,0.12)",
  done: "#6366F1",
  doneBg: "rgba(99,102,241,0.12)",
  executive: "#8B5CF6",
  hr: "#EC4899",
  operations: "#14B8A6",
  admin: "#6B7280",
};

// ─── UTILITY COMPONENTS ──────────────────────────────────────────────────────
const Badge = ({ children, color, bg }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "2px 8px",
    borderRadius: "4px", fontSize: "10px", fontWeight: 600,
    letterSpacing: "0.05em", textTransform: "uppercase",
    color: color, background: bg,
  }}>{children}</span>
);

const PriorityDot = ({ priority }) => {
  const c = priority === "high" ? COLORS.high : priority === "medium" ? COLORS.medium : COLORS.low;
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />;
};

const CategoryTag = ({ category }) => {
  const map = {
    executive: { color: COLORS.executive, label: "EXEC" },
    hr: { color: COLORS.hr, label: "HR" },
    operations: { color: COLORS.operations, label: "OPS" },
    admin: { color: COLORS.admin, label: "ADMIN" },
  };
  const { color, label } = map[category] || map.admin;
  return <Badge color={color} bg={`${color}18`}>{label}</Badge>;
};

const SourceBadge = ({ source }) => (
  <span style={{
    fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em",
    color: source === "trello" ? "#0079BF" : "#18BFFF",
    opacity: 0.7,
  }}>{source === "trello" ? "TRL" : "AIR"}</span>
);

const IconBtn = ({ children, onClick, active, title }) => (
  <button onClick={onClick} title={title} style={{
    background: active ? COLORS.accentGlow : "transparent",
    border: `1px solid ${active ? COLORS.accent : "transparent"}`,
    color: active ? COLORS.accent : COLORS.textMuted,
    borderRadius: "6px", padding: "6px 8px", cursor: "pointer",
    fontSize: "13px", transition: "all 0.2s",
  }}>{children}</button>
);

// ─── SECTION PANEL ───────────────────────────────────────────────────────────
const Panel = ({ title, icon, count, children, actions, style = {} }) => (
  <div style={{
    background: COLORS.surface, border: `1px solid ${COLORS.border}`,
    borderRadius: "10px", overflow: "hidden",
    display: "flex", flexDirection: "column", ...style,
  }}>
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 18px", borderBottom: `1px solid ${COLORS.border}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "15px" }}>{icon}</span>
        <span style={{ fontSize: "13px", fontWeight: 700, color: COLORS.text, letterSpacing: "0.02em" }}>{title}</span>
        {count != null && (
          <span style={{
            fontSize: "10px", fontWeight: 700, color: COLORS.accent,
            background: COLORS.accentGlow, borderRadius: "4px", padding: "1px 6px",
          }}>{count}</span>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: "4px" }}>{actions}</div>}
    </div>
    <div style={{ flex: 1, overflow: "auto" }}>{children}</div>
  </div>
);

// ─── QUICK ACTIONS BAR ───────────────────────────────────────────────────────
const QuickActions = ({ onAction }) => {
  const actions = [
    { key: "draft", icon: "✉️", label: "Draft Email" },
    { key: "schedule", icon: "📅", label: "Schedule" },
    { key: "task", icon: "✓", label: "New Task" },
    { key: "note", icon: "📝", label: "Quick Note" },
    { key: "followup", icon: "🔔", label: "Follow-up" },
  ];
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      {actions.map(a => (
        <button key={a.key} onClick={() => onAction(a.key)} style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
          borderRadius: "8px", padding: "8px 14px", cursor: "pointer",
          color: COLORS.text, fontSize: "12px", fontWeight: 500,
          transition: "all 0.2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.accent; e.currentTarget.style.background = COLORS.accentGlow; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.background = COLORS.surfaceAlt; }}
        >
          <span style={{ fontSize: "14px" }}>{a.icon}</span>{a.label}
        </button>
      ))}
    </div>
  );
};

// ─── MODAL ───────────────────────────────────────────────────────────────────
const Modal = ({ title, onClose, children }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 1000,
    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center",
  }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{
      background: COLORS.surface, border: `1px solid ${COLORS.border}`,
      borderRadius: "12px", width: "90%", maxWidth: "480px",
      maxHeight: "80vh", overflow: "auto",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 20px", borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <span style={{ fontWeight: 700, color: COLORS.text, fontSize: "14px" }}>{title}</span>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: COLORS.textMuted,
          cursor: "pointer", fontSize: "18px",
        }}>×</button>
      </div>
      <div style={{ padding: "20px" }}>{children}</div>
    </div>
  </div>
);

const InputField = ({ label, value, onChange, type = "text", placeholder, options }) => (
  <div style={{ marginBottom: "14px" }}>
    <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: COLORS.textMuted, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
    {options ? (
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width: "100%", padding: "8px 12px", background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.border}`, borderRadius: "6px",
        color: COLORS.text, fontSize: "13px", outline: "none",
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    ) : (
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={{
          width: "100%", padding: "8px 12px", background: COLORS.surfaceAlt,
          border: `1px solid ${COLORS.border}`, borderRadius: "6px",
          color: COLORS.text, fontSize: "13px", outline: "none",
          boxSizing: "border-box",
        }} />
    )}
  </div>
);

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function EACommandCenter() {
  const [tasks, setTasks] = useState(MOCK_TASKS);
  const [inbox, setInbox] = useState(MOCK_INBOX);
  const [calendar] = useState(MOCK_CALENDAR);
  const [followups, setFollowups] = useState(MOCK_FOLLOWUPS);
  const [taskFilter, setTaskFilter] = useState("all");
  const [inboxFilter, setInboxFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [newTask, setNewTask] = useState({ title: "", priority: "medium", category: "executive", due: "Today", source: "trello" });
  const [searchQuery, setSearchQuery] = useState("");
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const filteredTasks = useMemo(() => {
    let t = tasks;
    if (taskFilter !== "all") t = t.filter(x => x.status === taskFilter);
    if (searchQuery) t = t.filter(x => x.title.toLowerCase().includes(searchQuery.toLowerCase()));
    return t.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    });
  }, [tasks, taskFilter, searchQuery]);

  const filteredInbox = useMemo(() => {
    if (inboxFilter === "all") return inbox;
    return inbox.filter(x => x.category === inboxFilter);
  }, [inbox, inboxFilter]);

  const stats = useMemo(() => ({
    unread: inbox.filter(x => x.status === "unread").length,
    todayTasks: tasks.filter(x => x.due === "Today" && x.status !== "done").length,
    overdue: followups.filter(x => x.status === "overdue").length,
    unconfirmed: calendar.filter(x => !x.confirmed).length,
    done: tasks.filter(x => x.status === "done").length,
    total: tasks.length,
  }), [inbox, tasks, followups, calendar]);

  const toggleTaskStatus = useCallback((id) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done" } : t
    ));
  }, []);

  const markRead = useCallback((id) => {
    setInbox(prev => prev.map(m => m.id === id ? { ...m, status: "read" } : m));
  }, []);

  const addTask = useCallback(() => {
    if (!newTask.title.trim()) return;
    const id = Math.max(...tasks.map(t => t.id)) + 1;
    setTasks(prev => [...prev, { ...newTask, id, status: "todo" }]);
    setNewTask({ title: "", priority: "medium", category: "executive", due: "Today", source: "trello" });
    setModal(null);
  }, [newTask, tasks]);

  const handleQuickAction = (key) => {
    if (key === "task") setModal("newTask");
    else if (key === "note") setModal("note");
    else if (key === "followup") setModal("followup");
    else setModal(key);
  };

  const greeting = time.getHours() < 12 ? "Good morning" : time.getHours() < 17 ? "Good afternoon" : "Good evening";
  const dateStr = time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeStr = time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div style={{
      minHeight: "100vh", background: COLORS.bg, color: COLORS.text,
      fontFamily: "'IBM Plex Sans', 'SF Pro Display', -apple-system, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header style={{
        padding: "20px 28px", borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: COLORS.surface,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: COLORS.accent, boxShadow: `0 0 8px ${COLORS.accent}`,
            }} />
            <span style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.01em" }}>
              Command Center
            </span>
            <span style={{
              fontSize: "9px", fontWeight: 600, color: COLORS.accent,
              background: COLORS.accentGlow, padding: "2px 8px", borderRadius: "4px",
              letterSpacing: "0.08em",
            }}>EA</span>
          </div>
          <div style={{ fontSize: "12px", color: COLORS.textMuted }}>
            {greeting} — {dateStr} · {timeStr}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ position: "relative" }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              style={{
                background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`,
                borderRadius: "8px", padding: "8px 14px 8px 32px",
                color: COLORS.text, fontSize: "12px", width: "200px", outline: "none",
              }}
            />
            <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: COLORS.textDim }}>⌕</span>
          </div>
          <div style={{
            display: "flex", gap: "6px", fontSize: "10px", fontWeight: 600,
            color: COLORS.textMuted,
          }}>
            <span style={{ color: "#0079BF" }}>● Trello</span>
            <span style={{ color: "#18BFFF" }}>● Airtable</span>
          </div>
        </div>
      </header>

      {/* ── STATUS BAR ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: "1px", background: COLORS.border,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        {[
          { label: "Unread", value: stats.unread, color: COLORS.accent },
          { label: "Tasks Today", value: stats.todayTasks, color: COLORS.medium },
          { label: "Overdue", value: stats.overdue, color: COLORS.high },
          { label: "Unconfirmed", value: stats.unconfirmed, color: COLORS.medium },
          { label: "Completed", value: `${stats.done}/${stats.total}`, color: COLORS.done },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, padding: "12px 16px", background: COLORS.surface,
            textAlign: "center",
          }}>
            <div style={{ fontSize: "20px", fontWeight: 700, color: s.color, fontFamily: "'IBM Plex Mono', monospace" }}>{s.value}</div>
            <div style={{ fontSize: "10px", color: COLORS.textDim, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "2px" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── QUICK ACTIONS ──────────────────────────────────────── */}
      <div style={{ padding: "16px 28px", borderBottom: `1px solid ${COLORS.border}` }}>
        <QuickActions onAction={handleQuickAction} />
      </div>

      {/* ── MAIN GRID ──────────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 340px",
        gridTemplateRows: "auto auto",
        gap: "1px",
        background: COLORS.border,
        minHeight: "calc(100vh - 230px)",
      }}>

        {/* ── TASKS ────────────────────────────────────────────── */}
        <Panel
          title="Task Board" icon="✓" count={filteredTasks.filter(t => t.status !== "done").length}
          actions={
            <div style={{ display: "flex", gap: "2px" }}>
              {["all", "todo", "in_progress", "done"].map(f => (
                <IconBtn key={f} active={taskFilter === f} onClick={() => setTaskFilter(f)}
                  title={f}>{f === "all" ? "All" : f === "todo" ? "To Do" : f === "in_progress" ? "Active" : "Done"}</IconBtn>
              ))}
            </div>
          }
          style={{ gridRow: "1 / 3" }}
        >
          <div style={{ padding: "4px 0" }}>
            {filteredTasks.map(task => (
              <div key={task.id} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 18px",
                borderBottom: `1px solid ${COLORS.border}`,
                opacity: task.status === "done" ? 0.5 : 1,
                transition: "all 0.2s",
                cursor: "pointer",
              }}
                onMouseEnter={e => e.currentTarget.style.background = COLORS.surfaceAlt}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <button
                  onClick={() => toggleTaskStatus(task.id)}
                  style={{
                    width: 18, height: 18, borderRadius: "4px", flexShrink: 0,
                    border: task.status === "done" ? "none" : `2px solid ${COLORS.borderLight}`,
                    background: task.status === "done" ? COLORS.done : "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: "10px",
                  }}
                >{task.status === "done" ? "✓" : ""}</button>
                <PriorityDot priority={task.priority} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "12px", fontWeight: 500, color: COLORS.text,
                    textDecoration: task.status === "done" ? "line-through" : "none",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{task.title}</div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "3px" }}>
                    <CategoryTag category={task.category} />
                    <span style={{ fontSize: "10px", color: COLORS.textDim }}>{task.due}</span>
                    <SourceBadge source={task.source} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ── INBOX ────────────────────────────────────────────── */}
        <Panel
          title="Inbox" icon="✉" count={stats.unread}
          actions={
            <div style={{ display: "flex", gap: "2px" }}>
              {["all", "executive", "hr", "operations"].map(f => (
                <IconBtn key={f} active={inboxFilter === f} onClick={() => setInboxFilter(f)}>
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1, 4)}
                </IconBtn>
              ))}
            </div>
          }
        >
          <div style={{ padding: "4px 0" }}>
            {filteredInbox.map(msg => (
              <div key={msg.id} onClick={() => markRead(msg.id)} style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
                padding: "10px 18px",
                borderBottom: `1px solid ${COLORS.border}`,
                cursor: "pointer",
                background: msg.status === "unread" ? COLORS.accentGlow : "transparent",
              }}
                onMouseEnter={e => { if (msg.status !== "unread") e.currentTarget.style.background = COLORS.surfaceAlt; }}
                onMouseLeave={e => { if (msg.status !== "unread") e.currentTarget.style.background = "transparent"; }}
              >
                <PriorityDot priority={msg.priority} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", fontWeight: msg.status === "unread" ? 700 : 400, color: COLORS.text }}>{msg.from}</span>
                    <span style={{ fontSize: "10px", color: COLORS.textDim }}>{msg.time}</span>
                  </div>
                  <div style={{
                    fontSize: "11px", color: COLORS.textMuted, marginTop: "2px",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{msg.subject}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        {/* ── CALENDAR ─────────────────────────────────────────── */}
        <Panel title="Today's Schedule" icon="◷" count={calendar.length}
          style={{ gridRow: "1 / 3" }}
        >
          <div style={{ padding: "8px 0" }}>
            {calendar.map(evt => (
              <div key={evt.id} style={{
                padding: "12px 18px",
                borderBottom: `1px solid ${COLORS.border}`,
                borderLeft: `3px solid ${
                  evt.type === "recurring" ? COLORS.done
                  : evt.type === "external" ? COLORS.operations
                  : evt.type === "prep" ? COLORS.medium
                  : COLORS.accent
                }`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: COLORS.text }}>{evt.title}</span>
                  {!evt.confirmed && (
                    <Badge color={COLORS.medium} bg={COLORS.mediumBg}>UNCONFIRMED</Badge>
                  )}
                </div>
                <div style={{ fontSize: "11px", color: COLORS.textMuted, marginTop: "4px" }}>
                  {evt.time} · {evt.duration}
                </div>
              </div>
            ))}
            <div style={{ padding: "14px 18px" }}>
              <div style={{
                width: "100%", height: "4px", background: COLORS.surfaceAlt,
                borderRadius: "2px", overflow: "hidden",
              }}>
                <div style={{
                  width: `${Math.min(100, (time.getHours() / 18) * 100)}%`,
                  height: "100%", background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.done})`,
                  borderRadius: "2px", transition: "width 1s",
                }} />
              </div>
              <div style={{ fontSize: "10px", color: COLORS.textDim, marginTop: "6px", textAlign: "center" }}>
                Day progress
              </div>
            </div>
          </div>
        </Panel>

        {/* ── FOLLOW-UPS ──────────────────────────────────────── */}
        <Panel title="Follow-ups" icon="⟳" count={followups.filter(f => f.status !== "done").length}>
          <div style={{ padding: "4px 0" }}>
            {followups.map(fu => (
              <div key={fu.id} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "10px 18px",
                borderBottom: `1px solid ${COLORS.border}`,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: fu.status === "overdue" ? COLORS.high : COLORS.medium,
                  boxShadow: fu.status === "overdue" ? `0 0 6px ${COLORS.high}` : "none",
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", fontWeight: 500, color: COLORS.text }}>{fu.item}</div>
                  <div style={{ fontSize: "10px", color: COLORS.textDim, marginTop: "2px" }}>
                    {fu.contact} · Due: {fu.dueDate}
                  </div>
                </div>
                {fu.status === "overdue" && <Badge color={COLORS.high} bg={COLORS.highBg}>OVERDUE</Badge>}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer style={{
        padding: "10px 28px", borderTop: `1px solid ${COLORS.border}`,
        background: COLORS.surface, display: "flex", justifyContent: "space-between",
        fontSize: "10px", color: COLORS.textDim,
      }}>
        <span>EA Command Center v1.0 — React + Python backend ready</span>
        <span>Integrations: Airtable · Trello · Google Calendar · Slack</span>
      </footer>

      {/* ── MODALS ─────────────────────────────────────────────── */}
      {modal === "newTask" && (
        <Modal title="New Task" onClose={() => setModal(null)}>
          <InputField label="Title" value={newTask.title} onChange={v => setNewTask(p => ({ ...p, title: v }))} placeholder="What needs to get done?" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <InputField label="Priority" value={newTask.priority} onChange={v => setNewTask(p => ({ ...p, priority: v }))}
              options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
            <InputField label="Category" value={newTask.category} onChange={v => setNewTask(p => ({ ...p, category: v }))}
              options={[{ value: "executive", label: "Executive" }, { value: "hr", label: "HR" }, { value: "operations", label: "Operations" }, { value: "admin", label: "Admin" }]} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <InputField label="Due" value={newTask.due} onChange={v => setNewTask(p => ({ ...p, due: v }))}
              options={[{ value: "Today", label: "Today" }, { value: "Tomorrow", label: "Tomorrow" }, { value: "This week", label: "This Week" }]} />
            <InputField label="Source" value={newTask.source} onChange={v => setNewTask(p => ({ ...p, source: v }))}
              options={[{ value: "trello", label: "Trello" }, { value: "airtable", label: "Airtable" }]} />
          </div>
          <button onClick={addTask} style={{
            width: "100%", padding: "10px", background: COLORS.accent,
            color: "#fff", border: "none", borderRadius: "8px",
            fontWeight: 600, fontSize: "13px", cursor: "pointer",
            marginTop: "8px",
          }}>Add Task</button>
        </Modal>
      )}
      {modal === "note" && (
        <Modal title="Quick Note" onClose={() => setModal(null)}>
          <textarea placeholder="Capture a quick note..." style={{
            width: "100%", minHeight: "120px", background: COLORS.surfaceAlt,
            border: `1px solid ${COLORS.border}`, borderRadius: "6px",
            color: COLORS.text, fontSize: "13px", padding: "12px", outline: "none",
            resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
          }} />
          <button onClick={() => setModal(null)} style={{
            width: "100%", padding: "10px", background: COLORS.accent,
            color: "#fff", border: "none", borderRadius: "8px",
            fontWeight: 600, fontSize: "13px", cursor: "pointer", marginTop: "12px",
          }}>Save Note</button>
        </Modal>
      )}
      {(modal === "draft" || modal === "schedule" || modal === "followup") && (
        <Modal title={modal === "draft" ? "Draft Email" : modal === "schedule" ? "Schedule Meeting" : "Add Follow-up"} onClose={() => setModal(null)}>
          <div style={{ color: COLORS.textMuted, fontSize: "13px", textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>{modal === "draft" ? "✉️" : modal === "schedule" ? "📅" : "🔔"}</div>
            <p>Connect your {modal === "draft" ? "email" : modal === "schedule" ? "Google Calendar" : "task tracker"} to enable this.</p>
            <p style={{ fontSize: "11px", marginTop: "8px", color: COLORS.textDim }}>
              Backend API endpoint: <code style={{ fontFamily: "'IBM Plex Mono', monospace", color: COLORS.accent }}>/api/{modal}</code>
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}