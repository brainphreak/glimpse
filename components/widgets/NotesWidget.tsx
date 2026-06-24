"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Check, X, Bold, Italic, Underline, Link as LinkIcon, List, ListOrdered } from "lucide-react";

interface Note {
  id: number;
  title: string;
  content: string;
  color: string;
  sort_order: number;
  updated_at: string;
}

const DEFAULT_COLOR = "#1e293b";
const NEW_ID = -1;

// Legacy notes were stored as plain text. Render them safely with line breaks;
// notes created with the rich editor are already HTML and pass through as-is.
function contentToHtml(content: string): string {
  if (!content) return "";
  if (/<[a-z][\s\S]*>/i.test(content)) return content;
  return content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)", cursor: "pointer" }} onMouseDown={(e) => e.stopPropagation()}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title="Note color"
        style={{ width: 22, height: 22, padding: 0, border: "2px solid var(--border)", borderRadius: "50%", cursor: "pointer", background: "none", flexShrink: 0 }}
      />
      Color
    </label>
  );
}

function useMouseDrag(onDelta: (dx: number, dy: number) => void) {
  const active = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  return (e: React.MouseEvent) => {
    e.preventDefault();
    active.current = true;
    last.current = { x: e.clientX, y: e.clientY };
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!active.current) return;
      onDelta(ev.clientX - last.current.x, ev.clientY - last.current.y);
      last.current = { x: ev.clientX, y: ev.clientY };
    };
    const onUp = () => {
      active.current = false;
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
}

// contentEditable rich-text area. Uncontrolled (innerHTML set once on mount)
// to avoid caret jumps; emits HTML on every edit.
function RichEditor({ initialHtml, onChange, style }: { initialHtml: string; onChange: (html: string) => void; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={() => ref.current && onChange(ref.current.innerHTML)}
      data-placeholder="Note content…"
      className="note-rich-editor"
      style={{ outline: "none", overflow: "auto", ...style }}
    />
  );
}

function RichToolbar() {
  // execCommand operates on the focused contentEditable; preventDefault keeps the selection.
  const exec = (cmd: string, val?: string) => document.execCommand(cmd, false, val);
  const btn = (icon: React.ReactNode, action: () => void, title: string) => (
    <button
      title={title}
      onMouseDown={(e) => { e.preventDefault(); action(); }}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 24, background: "none", border: "1px solid transparent", borderRadius: 5, color: "var(--text-secondary)", cursor: "pointer" }}
    >
      {icon}
    </button>
  );
  return (
    <div style={{ display: "flex", gap: 2, alignItems: "center" }} onMouseDown={(e) => e.stopPropagation()}>
      {btn(<Bold size={14} />, () => exec("bold"), "Bold")}
      {btn(<Italic size={14} />, () => exec("italic"), "Italic")}
      {btn(<Underline size={14} />, () => exec("underline"), "Underline")}
      <div style={{ width: 1, height: 16, background: "var(--border)", margin: "0 2px" }} />
      {btn(<List size={14} />, () => exec("insertUnorderedList"), "Bullet list")}
      {btn(<ListOrdered size={14} />, () => exec("insertOrderedList"), "Numbered list")}
      {btn(<LinkIcon size={14} />, () => { const url = prompt("Link URL:"); if (url) exec("createLink", url); }, "Insert link")}
    </div>
  );
}

function NoteModal({ note, onClose, onSave, onDelete }: {
  note: Note;
  onClose: () => void;
  onSave: (n: Note) => void;
  onDelete: (id: number) => void;
}) {
  const [draft, setDraft] = useState(note);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 600, h: 480 });

  useEffect(() => {
    setPos({
      x: Math.max(0, Math.round(window.innerWidth / 2 - 300)),
      y: Math.max(0, Math.round(window.innerHeight / 2 - 240)),
    });
  }, []);

  const startDrag = useMouseDrag((dx, dy) => setPos((p) => ({ x: p.x + dx, y: p.y + dy })));
  const startResize = useMouseDrag((dx, dy) =>
    setSize((s) => ({ w: Math.max(300, s.w + dx), h: Math.max(240, s.h + dy) }))
  );

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: pos.x, top: pos.y, width: size.w, height: size.h, background: draft.color, border: "1px solid var(--border)", borderRadius: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.6)", display: "flex", flexDirection: "column", pointerEvents: "auto", overflow: "hidden" }}>
        <div onMouseDown={startDrag} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px 8px", cursor: "grab", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} onMouseDown={(e) => e.stopPropagation()} placeholder="Title…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 16, fontWeight: 700, cursor: "text", minWidth: 0 }} />
          <button onClick={onClose} onMouseDown={(e) => e.stopPropagation()} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}><X size={16} /></button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <RichToolbar />
        </div>
        <RichEditor
          initialHtml={contentToHtml(draft.content)}
          onChange={(html) => setDraft({ ...draft, content: html })}
          style={{ flex: 1, color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, padding: "12px 14px", minHeight: 0 }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px 10px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <ColorPicker value={draft.color} onChange={(c) => setDraft({ ...draft, color: c })} />
          <div style={{ flex: 1 }} />
          {draft.id !== NEW_ID && (
            <button onClick={() => onDelete(draft.id)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 12 }}><Trash2 size={13} /> Delete</button>
          )}
          <button onClick={() => onSave(draft)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, padding: "5px 14px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer" }}><Check size={13} /> Save</button>
        </div>
        <div onMouseDown={startResize} style={{ position: "absolute", bottom: 0, right: 0, width: 18, height: 18, cursor: "nwse-resize", background: "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.15) 50%)", borderBottomRightRadius: 14 }} />
      </div>
    </div>,
    document.body
  );
}

export default function NotesWidget() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editing, setEditing] = useState<Note | null>(null);
  const dragId = useRef<number | null>(null);

  const load = () => fetch("/api/notes").then((r) => r.json()).then(setNotes);
  useEffect(() => { load(); }, []);

  const newNote = () => setEditing({ id: NEW_ID, title: "", content: "", color: DEFAULT_COLOR, sort_order: notes.length, updated_at: new Date().toISOString() });

  const save = async (note: Note) => {
    if (note.id === NEW_ID) {
      await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: note.title, content: note.content, color: note.color }) });
    } else {
      await fetch(`/api/notes/${note.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(note) });
    }
    setEditing(null);
    load();
  };

  const del = async (id: number) => {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setEditing(null);
    load();
  };

  // Drag-to-reorder
  const onDragStart = (id: number) => { dragId.current = id; };
  const onDrop = async (targetId: number) => {
    const fromId = dragId.current;
    if (fromId === null || fromId === targetId) return;
    dragId.current = null;

    const fromIdx = notes.findIndex((n) => n.id === fromId);
    const toIdx = notes.findIndex((n) => n.id === targetId);
    const reordered = [...notes];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, notes[fromIdx]);

    setNotes(reordered.map((n, i) => ({ ...n, sort_order: i })));

    await Promise.all(
      reordered.map((n, i) =>
        fetch(`/api/notes/${n.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...n, sort_order: i }),
        })
      )
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
      <style>{`
        .note-rich-editor:empty:before { content: attr(data-placeholder); color: var(--text-muted); }
        .note-rich-editor a { color: var(--accent); }
        .note-rich-editor ul, .note-card-body ul { list-style: disc outside; padding-left: 22px; margin: 4px 0; }
        .note-rich-editor ol, .note-card-body ol { list-style: decimal outside; padding-left: 22px; margin: 4px 0; }
        .note-rich-editor li, .note-card-body li { display: list-item; }
        .note-card-body a { color: var(--accent); }
      `}</style>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={newNote} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", cursor: "pointer" }}>
          <Plus size={12} /> New Note
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))", gap: 8, alignContent: "start" }}>
        {notes.map((note) => (
          <div
            key={note.id}
            draggable
            onDragStart={() => onDragStart(note.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(note.id)}
            onClick={() => setEditing({ ...note })}
            style={{ background: note.color, border: "1px solid var(--border)", borderRadius: 10, padding: 10, cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, minHeight: 80 }}
          >
            {note.title && <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{note.title}</div>}
            <div className="note-card-body" style={{ fontSize: 11, color: "var(--text-secondary)", flex: 1, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: contentToHtml(note.content) }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{new Date(note.updated_at).toLocaleDateString([], { month: "short", day: "numeric" })}</span>
              <button onClick={(e) => { e.stopPropagation(); del(note.id); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}><Trash2 size={11} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <NoteModal note={editing} onClose={() => setEditing(null)} onSave={save} onDelete={del} />
      )}
    </div>
  );
}
