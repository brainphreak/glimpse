"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Pencil, X, Check, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { useWidgetSettings } from "@/components/WidgetWrapper";

interface Link {
  id: number;
  title: string;
  url: string;
  icon: string;
  category: string;
  sort_order: number;
}

type Align = "flex-start" | "center" | "flex-end";

const BLANK: Omit<Link, "id"> = { title: "", url: "", icon: "", category: "General", sort_order: 0 };

function normalizeUrl(url: string) {
  const u = url.trim();
  if (u && !/^https?:\/\//i.test(u)) return "https://" + u;
  return u;
}

function Favicon({ url, title }: { url: string; title: string }) {
  const [err, setErr] = useState(false);
  try {
    const domain = new URL(url).hostname;
    if (!err) {
      return <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" width={16} height={16} onError={() => setErr(true)} style={{ borderRadius: 3 }} />;
    }
  } catch {}
  return <span style={{ fontSize: 14 }}>{title.charAt(0).toUpperCase()}</span>;
}

export default function LinksWidget({
  config = {},
  onConfigChange,
}: {
  config?: { align?: Align; showCategories?: boolean };
  onConfigChange?: (c: Record<string, unknown>) => void;
}) {
  const [links, setLinks] = useState<Link[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(BLANK);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({ title: "", url: "", category: "" });
  const align: Align = config.align ?? "flex-start";
  const showCategories = config.showCategories !== false;

  const dragId = useRef<number | null>(null);

  const load = () => fetch("/api/links").then((r) => r.json()).then(setLinks);
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!draft.title || !draft.url) return;
    await fetch("/api/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, url: normalizeUrl(draft.url) }) });
    setAdding(false);
    setDraft(BLANK);
    load();
  };

  const startEdit = (link: Link) => {
    setEditingId(link.id);
    setEditDraft({ title: link.title, url: link.url, category: link.category });
  };

  const saveEdit = async (link: Link) => {
    await fetch(`/api/links/${link.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...link, title: editDraft.title, url: normalizeUrl(editDraft.url), category: editDraft.category.trim() || "General" }),
    });
    setEditingId(null);
    load();
  };

  const del = async (id: number) => {
    await fetch(`/api/links/${id}`, { method: "DELETE" });
    setEditingId(null);
    load();
  };

  const fieldStyle: React.CSSProperties = { width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", color: "var(--text-primary)", fontSize: 12, outline: "none", boxSizing: "border-box" };

  useWidgetSettings(
    <>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
        Edit links
        <button onClick={() => { setEditMode((v) => !v); setEditingId(null); }} style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", background: editMode ? "var(--accent)" : "var(--border)", position: "relative", flexShrink: 0 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: editMode ? 19 : 3, transition: "left 0.15s" }} />
        </button>
      </label>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: -6 }}>When on, click a link to change its name, URL, or group, drag to reorder, or delete it.</div>

      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Alignment</div>
        <div style={{ display: "flex", gap: 6 }}>
          {([["flex-start", <AlignLeft key="l" size={13} />, "Left"], ["center", <AlignCenter key="c" size={13} />, "Center"], ["flex-end", <AlignRight key="r" size={13} />, "Right"]] as [Align, React.ReactNode, string][]).map(([val, icon, lbl]) => (
            <button key={val} onClick={() => onConfigChange?.({ ...config, align: val })} title={lbl} style={{
              display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 10px", borderRadius: 6,
              border: "1px solid var(--border)", cursor: "pointer",
              background: align === val ? "var(--accent)" : "transparent",
              color: align === val ? "#fff" : "var(--text-secondary)",
            }}>{icon}</button>
          ))}
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>
        Show category labels
        <button onClick={() => onConfigChange?.({ ...config, showCategories: !showCategories })} style={{ width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer", background: showCategories ? "var(--accent)" : "var(--border)", position: "relative", flexShrink: 0 }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: showCategories ? 19 : 3, transition: "left 0.15s" }} />
        </button>
      </label>
      <div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Add link</div>
        {!adding ? (
          <button onClick={() => setAdding(true)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--accent)", cursor: "pointer" }}>
            <Plus size={12} /> Add link
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input placeholder="Title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={fieldStyle} />
            <input placeholder="URL" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} style={fieldStyle} />
            <input placeholder="Category" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={fieldStyle} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => { setAdding(false); setDraft(BLANK); }} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={14} /></button>
              <button onClick={create} style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer" }}><Check size={14} /></button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // Drag-to-reorder within each category (edit mode only)
  const onDragStart = (id: number) => { dragId.current = id; };

  const onDrop = async (targetId: number) => {
    const fromId = dragId.current;
    if (fromId === null || fromId === targetId) return;
    dragId.current = null;

    const from = links.find((l) => l.id === fromId);
    const to = links.find((l) => l.id === targetId);
    if (!from || !to || from.category !== to.category) return;

    const cat = from.category;
    const catLinks = links.filter((l) => l.category === cat);
    const fromIdx = catLinks.findIndex((l) => l.id === fromId);
    const toIdx = catLinks.findIndex((l) => l.id === targetId);
    const reordered = [...catLinks];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, from);

    const updated = links.map((l) => {
      const idx = reordered.findIndex((r) => r.id === l.id);
      return idx >= 0 ? { ...l, sort_order: idx } : l;
    });
    setLinks(updated);

    await Promise.all(
      reordered.map((l, i) =>
        fetch(`/api/links/${l.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...l, sort_order: i }),
        })
      )
    );
  };

  const renderLink = (link: Link) => {
    if (editMode && editingId === link.id) {
      return (
        <div key={link.id} style={{ display: "flex", flexDirection: "column", gap: 5, padding: 8, borderRadius: 8, border: "1px solid var(--accent)", background: "rgba(255,255,255,0.03)", width: 220 }}>
          <input placeholder="Title" value={editDraft.title} onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })} style={fieldStyle} />
          <input placeholder="URL" value={editDraft.url} onChange={(e) => setEditDraft({ ...editDraft, url: e.target.value })} style={fieldStyle} />
          <input placeholder="Category" value={editDraft.category} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })} style={fieldStyle} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => del(link.id)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 11 }}><Trash2 size={12} /> Delete</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={14} /></button>
              <button onClick={() => saveEdit(link)} style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer" }}><Check size={14} /></button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div
        key={link.id}
        draggable={editMode}
        onDragStart={editMode ? () => onDragStart(link.id) : undefined}
        onDragOver={editMode ? (e) => e.preventDefault() : undefined}
        onDrop={editMode ? () => onDrop(link.id) : undefined}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)", cursor: editMode ? "grab" : "pointer" }}
      >
        <Favicon url={link.url} title={link.title} />
        {editMode ? (
          <>
            <span onClick={() => startEdit(link)} style={{ fontSize: 12, color: "var(--text-secondary)", cursor: "pointer" }}>{link.title}</span>
            <button onClick={() => startEdit(link)} title="Edit" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, lineHeight: 1 }}><Pencil size={11} /></button>
            <button onClick={() => del(link.id)} title="Delete" style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 0, lineHeight: 1 }}><Trash2 size={11} /></button>
          </>
        ) : (
          <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--text-secondary)", textDecoration: "none" }}>
            {link.title}
          </a>
        )}
      </div>
    );
  };

  const categories = [...new Set(links.map((l) => l.category))];
  const sorted = [...links].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflow: "auto" }}>
        {links.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", paddingTop: 20 }}>No links yet — open the gear (settings) and use Add link</div>
        )}
        {showCategories ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.map((cat) => (
              <div key={cat}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.06em", marginBottom: 4, textAlign: align === "flex-start" ? "left" : align === "flex-end" ? "right" : "center" }}>{cat}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: align }}>
                  {sorted.filter((l) => l.category === cat).map(renderLink)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: align }}>
            {sorted.map(renderLink)}
          </div>
        )}
      </div>
    </div>
  );
}
