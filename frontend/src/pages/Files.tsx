import { useQuery } from "@tanstack/react-query";
import { useCallback, useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Folder, FileText, Upload, ChevronRight, Image, FileSpreadsheet,
  Presentation, FileCode, Film, Music, Plus, FolderPlus, Table,
  Download, Trash2, Pencil, Share2, X, Users, Eye, Edit3,
} from "lucide-react";
import { apiClient } from "../api/client.ts";
import { formatBytes } from "../lib/utils.ts";
import { useToastStore } from "../store/index.ts";
import { useTheme } from "../lib/themes.ts";

function fileExt(name: string) { return name.split(".").pop()?.toLowerCase() ?? ""; }

function FileIcon({ name, isDir }: { name: string; isDir?: boolean }) {
  if (isDir) return <Folder size={32} className="text-amber-400" />;
  const ext = fileExt(name);
  if (["jpg","jpeg","png","gif","webp","svg"].includes(ext)) return <Image size={32} className="text-green-500" />;
  if (["xlsx","xls","ods","csv"].includes(ext))              return <FileSpreadsheet size={32} className="text-green-600" />;
  if (["pptx","ppt","odp"].includes(ext))                    return <Presentation size={32} className="text-orange-500" />;
  if (["mp4","webm","mkv"].includes(ext))                    return <Film size={32} className="text-purple-500" />;
  if (["mp3","ogg","wav"].includes(ext))                     return <Music size={32} className="text-pink-500" />;
  if (["txt","md","html","json","xml","csv"].includes(ext))  return <FileCode size={32} className="text-blue-400" />;
  return <FileText size={32} className="text-blue-500" />;
}

const OFFICE_EXTS = new Set(["doc","docx","odt","xls","xlsx","ods","csv","ppt","pptx","odp","odg","odf"]);
function isOfficeFile(name: string) { return OFFICE_EXTS.has(fileExt(name)); }

const NEW_OPTIONS = [
  { ext: "folder", label: "New Folder",        icon: FolderPlus     },
  { ext: "docx",   label: "Word Document",     icon: FileText       },
  { ext: "xlsx",   label: "Excel Spreadsheet", icon: FileSpreadsheet },
  { ext: "pptx",   label: "PowerPoint",        icon: Presentation   },
  { ext: "txt",    label: "Text Document",     icon: FileText       },
  { ext: "csv",    label: "Spreadsheet (CSV)", icon: Table          },
  { ext: "md",     label: "Markdown",          icon: FileCode       },
  { ext: "html",   label: "HTML Page",         icon: FileCode       },
] as const;

type UploadEntry = { name: string; progress: number; status: "uploading" | "done" | "error" };

// ── Share Modal ───────────────────────────────────────────────────────────────
interface ShareModalProps {
  filePath: string;
  isDirectory: boolean;
  onClose: () => void;
  cardBg: string;
  border: string;
  textColor: string;
  muted: string;
  isDark: boolean;
}

function ShareModal({ filePath, isDirectory, onClose, cardBg, border, textColor, muted, isDark }: ShareModalProps) {
  const [emailInput, setEmailInput]       = useState("");
  const [permission, setPermission]       = useState<"view"|"edit">("view");
  const [suggestions, setSuggestions]     = useState<any[]>([]);
  const [sharedWith, setSharedWith]       = useState<string[]>([]);
  const [saving, setSaving]               = useState(false);
  const { addToast } = useToastStore();
  const inputBg = isDark ? "#111827" : "#f9fafb";

  // Load existing share
  useEffect(() => {
    apiClient.get("/files/shares").then(r => {
      const existing = (r.data as any[]).find((s: any) => s.path === filePath);
      if (existing) {
        setSharedWith(existing.sharedWith ?? []);
        setPermission(existing.permission ?? "view");
      }
    }).catch(() => {});
  }, [filePath]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q) { setSuggestions([]); return; }
    try {
      const r = await apiClient.get("/mail/contacts/suggestions", { params: { q } });
      setSuggestions((r.data as any[]).slice(0, 6));
    } catch { setSuggestions([]); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(emailInput), 200);
    return () => clearTimeout(t);
  }, [emailInput, fetchSuggestions]);

  const addEmail = (email: string) => {
    const e = email.trim().toLowerCase();
    if (!e || sharedWith.includes(e)) return;
    setSharedWith(prev => [...prev, e]);
    setEmailInput("");
    setSuggestions([]);
  };

  const removeEmail = (email: string) => setSharedWith(prev => prev.filter(e => e !== email));

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.post("/files/share", { path: filePath, sharedWith, permission, isDirectory });
      addToast("Share updated", "success");
      onClose();
    } catch { addToast("Failed to save share", "error"); }
    finally { setSaving(false); }
  };

  const handleUnshare = async () => {
    try {
      await apiClient.delete("/files/share", { params: { path: filePath } });
      addToast("Unshared", "success");
      onClose();
    } catch { addToast("Failed to unshare", "error"); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="rounded-2xl shadow-2xl w-full max-w-md" style={{ backgroundColor: cardBg, color: textColor }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: border }}>
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-blue-500" />
            <span className="font-semibold text-sm">Share</span>
            <span className="text-xs truncate max-w-[200px]" style={{ color: muted }}>{filePath}</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/10"><X size={15} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Permission toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: muted }}>Permission:</span>
            <button
              onClick={() => setPermission("view")}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition ${permission === "view" ? "bg-blue-600 text-white border-blue-600" : ""}`}
              style={permission !== "view" ? { borderColor: border, color: muted } : undefined}
            >
              <Eye size={11} /> View
            </button>
            <button
              onClick={() => setPermission("edit")}
              className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition ${permission === "edit" ? "bg-green-600 text-white border-green-600" : ""}`}
              style={permission !== "edit" ? { borderColor: border, color: muted } : undefined}
            >
              <Edit3 size={11} /> Edit
            </button>
          </div>

          {/* Email input */}
          <div className="relative">
            <input
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addEmail(emailInput); }}
              placeholder="Add email address..."
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
              style={{ backgroundColor: isDark ? "#111827" : "#f9fafb", borderColor: border, color: textColor }}
            />
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 rounded-xl border shadow-lg z-10 overflow-hidden"
                style={{ backgroundColor: cardBg, borderColor: border }}>
                {suggestions.map((s: any, i) => (
                  <button key={i} onClick={() => addEmail(s.email || s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-black/10 flex items-center gap-2">
                    <span style={{ color: textColor }}>{s.name || s.email || s}</span>
                    {s.name && <span className="text-xs" style={{ color: muted }}>{s.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recipients list */}
          {sharedWith.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium" style={{ color: muted }}>Shared with:</p>
              {sharedWith.map(email => (
                <div key={email} className="flex items-center justify-between rounded-lg px-3 py-1.5"
                  style={{ backgroundColor: isDark ? "#111827" : "#f3f4f6" }}>
                  <span className="text-sm" style={{ color: textColor }}>{email}</span>
                  <button onClick={() => removeEmail(email)} className="p-0.5 rounded hover:bg-black/10">
                    <X size={12} style={{ color: muted }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {sharedWith.length === 0 && (
            <p className="text-xs text-center py-2" style={{ color: muted }}>No recipients yet. Add emails above.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-5 gap-3">
          <button onClick={handleUnshare} className="text-xs px-3 py-1.5 rounded-lg border text-red-500 border-red-400 hover:bg-red-50/20 transition">
            Remove share
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg border transition"
              style={{ borderColor: border, color: muted }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FilesPage() {
  const [dirPath, setDirPath]             = useState("/");
  const [crumbs, setCrumbs]               = useState<string[]>([]);
  const [newOpen, setNewOpen]             = useState(false);
  const [newType, setNewType]             = useState<string | null>(null);
  const [newName, setNewName]             = useState("");
  const [hovered, setHovered]             = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [shareTarget, setShareTarget]     = useState<{ path: string; isDirectory: boolean } | null>(null);
  const [view, setView]                   = useState<"mine" | "shared">("mine");
  // For browsing inside a shared folder
  const [sharedOwner, setSharedOwner]     = useState<string | null>(null);
  const [sharedPath, setSharedPath]       = useState("/");
  const [sharedCrumbs, setSharedCrumbs]   = useState<string[]>([]);

  const newRef   = useRef<HTMLDivElement>(null);
  const [uploads, setUploads]             = useState<UploadEntry[]>([]);
  const { addToast }                      = useToastStore();
  const { appBg, textColor, isDark }      = useTheme();
  const border   = isDark ? "#374151" : "#e5e7eb";
  const muted    = isDark ? "#9ca3af" : "#6b7280";
  const cardBg   = isDark ? "#1f2937" : "#ffffff";
  const hoverBg  = isDark ? "#374151" : "#f3f4f6";

  useEffect(() => {
    if (!newOpen) return;
    const h = (e: MouseEvent) => {
      if (newRef.current && !newRef.current.contains(e.target as Node)) {
        setNewOpen(false); setNewType(null); setNewName("");
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [newOpen]);

const { data, isLoading, refetch } = useQuery({
    queryKey: ["files", dirPath],
    queryFn: () => apiClient.get("/files", { params: { path: dirPath } }).then(r => r.data as any[]),
    retry: false,
    enabled: view === "mine" && !sharedOwner,
  });

  const { data: sharedWithMe, isLoading: sharedLoading } = useQuery({
    queryKey: ["shared-with-me"],
    queryFn: () => apiClient.get("/files/shared-with-me").then(r => r.data as any[]),
    retry: false,
    enabled: view === "shared" && !sharedOwner,
  });

  const { data: sharedBrowse, isLoading: sharedBrowseLoading, refetch: refetchSharedBrowse } = useQuery({
    queryKey: ["shared-browse", sharedOwner, sharedPath],
    queryFn: () => apiClient.get("/files/shared-browse", { params: { owner: sharedOwner, path: sharedPath } }).then(r => r.data as any[]),
    retry: false,
    enabled: view === "shared" && !!sharedOwner,
  });

  const navigate   = (name: string) => { setDirPath(p => p + name + "/"); setCrumbs(c => [...c, name]); };
  const navigateTo = (idx: number) => {
    if (idx < 0) { setDirPath("/"); setCrumbs([]); return; }
    const c = crumbs.slice(0, idx + 1);
    setCrumbs(c);
    setDirPath("/" + c.join("/") + "/");
  };

  const sharedNavigate = (name: string) => {
    setSharedPath(p => p + name + "/");
    setSharedCrumbs(c => [...c, name]);
  };
  const sharedNavigateTo = (idx: number) => {
    if (idx < 0) { setSharedPath("/"); setSharedCrumbs([]); return; }
    const c = sharedCrumbs.slice(0, idx + 1);
    setSharedCrumbs(c);
    setSharedPath("/" + c.join("/") + "/");
  };

  const handleCreate = async (ext: string, name: string) => {
    try {
      if (ext === "folder") {
        await apiClient.post("/files/mkdir", { path: dirPath + name });
      } else {
        await apiClient.post("/files/create", { path: dirPath + name + "." + ext });
      }
      addToast(`Created "${name}${ext === "folder" ? "" : "." + ext}"`, "success");
      setNewOpen(false); setNewType(null); setNewName("");
      refetch();
    } catch { addToast("Failed to create", "error"); }
  };

  const handleDelete = async (name: string) => {
    try {
      await apiClient.delete("/files", { params: { path: dirPath + name } });
      addToast(`Deleted "${name}"`, "success");
      setDeleteConfirm(null);
      refetch();
    } catch { addToast("Failed to delete", "error"); }
  };

  const handleEdit = async (name: string) => {
    try {
      const filePath = dirPath + name;
      const { data } = await apiClient.post(`/wopi/token?path=${encodeURIComponent(filePath)}`);
      const wopiSrc    = encodeURIComponent(data.wopiSrc);
      const token      = encodeURIComponent(data.token);
      const ttl        = data.tokenTtl;
      const editorPath = data.editorPath ?? "/browser/dist/cool.html";
      const url = `${window.location.origin}${editorPath}?WOPISrc=${wopiSrc}&access_token=${token}&access_token_ttl=${ttl}`;
      window.open(url, "_blank", "noopener");
    } catch {
      addToast("Could not open editor", "error");
    }
  };

  const handleSharedEdit = async (ownerEmail: string, filePath: string) => {
    try {
      const { data } = await apiClient.post(`/wopi/shared-token?owner=${encodeURIComponent(ownerEmail)}&path=${encodeURIComponent(filePath)}`);
      const wopiSrc    = encodeURIComponent(data.wopiSrc);
      const token      = encodeURIComponent(data.token);
      const ttl        = data.tokenTtl;
      const editorPath = data.editorPath ?? "/browser/dist/cool.html";
      const url = `${window.location.origin}${editorPath}?WOPISrc=${wopiSrc}&access_token=${token}&access_token_ttl=${ttl}`;
      window.open(url, "_blank", "noopener");
    } catch {
      addToast("Could not open editor", "error");
    }
  };

  const handleDownload = (name: string) => {
    const url = `/api/files/download?path=${encodeURIComponent(dirPath + name)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleSharedDownload = (ownerEmail: string, filePath: string, name: string) => {
    const url = `/api/files/shared-download?owner=${encodeURIComponent(ownerEmail)}&path=${encodeURIComponent(filePath)}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const onDrop = useCallback(async (files: File[]) => {
    setUploads(files.map(f => ({ name: f.name, progress: 0, status: "uploading" })));
    const update = (name: string, patch: Partial<UploadEntry>) =>
      setUploads(prev => prev.map(e => e.name === name ? { ...e, ...patch } : e));
    for (const file of files) {
      try {
        const buf = await file.arrayBuffer();
        await apiClient.post(`/files/upload?path=${encodeURIComponent(dirPath + file.name)}`, buf, {
          headers: { "Content-Type": file.type || "application/octet-stream" },
          onUploadProgress: ev => { if (ev.total) update(file.name, { progress: Math.round(ev.loaded / ev.total * 100) }); },
        });
        update(file.name, { progress: 100, status: "done" });
        addToast(`Uploaded ${file.name}`, "success");
      } catch {
        update(file.name, { status: "error" });
        addToast(`Failed to upload ${file.name}`, "error");
      }
    }
    setTimeout(() => setUploads(prev => prev.filter(e => e.status !== "done")), 2000);
    refetch();
  }, [dirPath, refetch, addToast]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ onDrop, noClick: true });

  return (
    <div className="h-full flex flex-col" style={{ background: appBg, color: textColor }} {...(view === "mine" ? getRootProps() : {})}>
      {view === "mine" && <input {...getInputProps()} />}

      {/* Toolbar */}
      <div className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: border }}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* View tabs */}
          <div className="flex items-center rounded-lg border overflow-hidden text-xs flex-shrink-0" style={{ borderColor: border }}>
            <button
              onClick={() => { setView("mine"); setSharedOwner(null); setSharedPath("/"); setSharedCrumbs([]); }}
              className="px-3 py-1.5 transition"
              style={view === "mine"
                ? { backgroundColor: "#2563eb", color: "#fff" }
                : { color: muted, backgroundColor: "transparent" }}
            >
              My Files
            </button>
            <button
              onClick={() => { setView("shared"); setSharedOwner(null); setSharedPath("/"); setSharedCrumbs([]); }}
              className="px-3 py-1.5 flex items-center gap-1 transition"
              style={view === "shared"
                ? { backgroundColor: "#2563eb", color: "#fff" }
                : { color: muted, backgroundColor: "transparent" }}
            >
              <Users size={12} /> Shared with me
            </button>
          </div>

          {/* Breadcrumbs — My Files */}
          {view === "mine" && (
            <div className="flex items-center gap-1 text-sm min-w-0">
              <button onClick={() => navigateTo(-1)} className="text-blue-500 hover:underline font-medium flex items-center gap-1 flex-shrink-0">
                <Folder size={15} className="text-amber-400" /> Files
              </button>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  <ChevronRight size={13} style={{ color: muted }} />
                  <button onClick={() => navigateTo(i)}
                    className={`truncate max-w-[120px] ${i < crumbs.length - 1 ? "text-blue-500 hover:underline" : "font-medium"}`}
                    style={i === crumbs.length - 1 ? { color: textColor } : undefined}>{c}</button>
                </span>
              ))}
            </div>
          )}

          {/* Breadcrumbs — Shared browsing */}
          {view === "shared" && sharedOwner && (
            <div className="flex items-center gap-1 text-sm min-w-0">
              <button onClick={() => { setSharedOwner(null); setSharedPath("/"); setSharedCrumbs([]); }}
                className="text-blue-500 hover:underline font-medium flex items-center gap-1 flex-shrink-0">
                <Users size={15} className="text-blue-400" /> Shared
              </button>
              <span className="flex items-center gap-1 min-w-0">
                <ChevronRight size={13} style={{ color: muted }} />
                <button onClick={() => sharedNavigateTo(-1)} className="text-blue-500 hover:underline flex-shrink-0 max-w-[120px] truncate">
                  {sharedOwner.split("@")[0]}
                </button>
              </span>
              {sharedCrumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  <ChevronRight size={13} style={{ color: muted }} />
                  <button onClick={() => sharedNavigateTo(i)}
                    className={`truncate max-w-[120px] ${i < sharedCrumbs.length - 1 ? "text-blue-500 hover:underline" : "font-medium"}`}
                    style={i === sharedCrumbs.length - 1 ? { color: textColor } : undefined}>{c}</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right toolbar — only show for My Files view */}
        {view === "mine" && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div ref={newRef} className="relative">
              <button onClick={() => setNewOpen(v => !v)}
                className="flex items-center gap-1.5 text-sm font-medium rounded-full px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 transition">
                <Plus size={14} /> New
              </button>
              {newOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border shadow-lg overflow-hidden z-50"
                  style={{ backgroundColor: cardBg, borderColor: border }}>
                  {newType ? (
                    <div className="p-3 space-y-2">
                      <p className="text-xs font-medium" style={{ color: muted }}>{newType === "folder" ? "Folder name" : "File name"}</p>
                      <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && newName.trim()) handleCreate(newType, newName.trim());
                          if (e.key === "Escape") { setNewType(null); setNewName(""); }
                        }}
                        placeholder={newType === "folder" ? "My Folder" : "Untitled"}
                        className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                        style={{ backgroundColor: isDark ? "#111827" : "#f9fafb", borderColor: border, color: textColor }}
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setNewType(null); setNewName(""); }} className="text-xs px-2.5 py-1 rounded-lg" style={{ color: muted }}>Cancel</button>
                        <button onClick={() => newName.trim() && handleCreate(newType, newName.trim())} disabled={!newName.trim()}
                          className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white disabled:opacity-50">Create</button>
                      </div>
                    </div>
                  ) : NEW_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button key={opt.ext} onClick={() => { setNewType(opt.ext); setNewName(""); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors" style={{ color: textColor }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = hoverBg}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}>
                        <Icon size={15} style={{ color: muted }} />{opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button onClick={open}
              className="flex items-center gap-1.5 text-sm rounded-full px-3 py-1.5 border transition"
              style={{ color: isDark ? "#93c5fd" : "#2563eb", borderColor: isDark ? "#374151" : "#bfdbfe" }}>
              <Upload size={14} /> Upload
            </button>
          </div>
        )}
      </div>


      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="px-6 py-2 border-b space-y-1.5" style={{ borderColor: border, backgroundColor: isDark ? "#111827" : "#eff6ff" }}>
          {uploads.map(u => (
            <div key={u.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="truncate pr-2" style={{ color: textColor }}>{u.name}</span>
                <span className={u.status === "error" ? "text-red-500" : ""} style={u.status !== "error" ? { color: muted } : undefined}>
                  {u.status === "error" ? "Failed" : `${u.progress}%`}
                </span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden mt-0.5" style={{ backgroundColor: isDark ? "#374151" : "#dbeafe" }}>
                <div className={`h-full transition-all ${u.status === "error" ? "bg-red-500" : "bg-blue-500"}`} style={{ width: `${u.progress}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drag overlay */}
      {isDragActive && view === "mine" && (
        <div className="absolute inset-0 bg-blue-50/90 border-2 border-dashed border-blue-400 z-10 flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Upload size={28} className="text-blue-600" />
          </div>
          <p className="text-blue-700 font-semibold text-lg">Drop files to upload</p>
          <p className="text-blue-500 text-sm">into {dirPath}</p>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="rounded-2xl p-6 w-80 shadow-2xl" style={{ backgroundColor: cardBg, color: textColor }}>
            <p className="font-semibold mb-1">Delete "{deleteConfirm}"?</p>
            <p className="text-sm mb-5" style={{ color: muted }}>This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-1.5 rounded-lg text-sm border" style={{ borderColor: border, color: textColor }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-1.5 rounded-lg text-sm bg-red-600 text-white hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {shareTarget && (
        <ShareModal
          filePath={shareTarget.path}
          isDirectory={shareTarget.isDirectory}
          onClose={() => setShareTarget(null)}
          cardBg={cardBg}
          border={border}
          textColor={textColor}
          muted={muted}
          isDark={isDark}
        />
      )}

      {/* ── My Files grid ── */}
      {view === "mine" && (
        <div className="flex-1 overflow-auto scrollbar-thin p-5">
          {isLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {[...Array(16)].map((_, i) => (
                <div key={i} className="flex flex-col items-center p-3 gap-2">
                  <div className="rounded-xl" style={{ width: 40, height: 40, backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
                  <div className="rounded" style={{ width: 56, height: 8, backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
                </div>
              ))}
            </div>
          )}
          {!isLoading && (!data || data.length === 0) && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: isDark ? "#374151" : "#f3f4f6" }}>
                <Folder size={36} className="opacity-30" style={{ color: muted }} />
              </div>
              <p className="text-sm" style={{ color: muted }}>Empty — drop files or click Upload</p>
            </div>
          )}
          {!isLoading && data && data.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {data.map((file: any, i: number) => (
                <div key={i}
                  className="relative flex flex-col items-center p-3 rounded-xl cursor-pointer transition-all border border-transparent"
                  style={{ color: textColor }}
                  onMouseEnter={e => { setHovered(file.name); e.currentTarget.style.backgroundColor = hoverBg; e.currentTarget.style.borderColor = border; }}
                  onMouseLeave={e => { setHovered(null); e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                  onClick={() => { if (file.isDirectory) navigate(file.name); }}
                >
                  <div className="mb-2"><FileIcon name={file.name} isDir={file.isDirectory} /></div>
                  <span className="text-xs text-center truncate w-full font-medium">{file.name}</span>
                  {!file.isDirectory && <span className="text-[10px] mt-0.5" style={{ color: muted }}>{formatBytes(file.size)}</span>}
                  {hovered === file.name && (
                    <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                      {!file.isDirectory && isOfficeFile(file.name) && (
                        <button onClick={e => { e.stopPropagation(); handleEdit(file.name); }}
                          className="p-1 rounded-lg bg-green-600 text-white hover:bg-green-700" title="Edit online">
                          <Pencil size={11} />
                        </button>
                      )}
                      {!file.isDirectory && (
                        <button onClick={e => { e.stopPropagation(); handleDownload(file.name); }}
                          className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700" title="Download">
                          <Download size={11} />
                        </button>
                      )}
                      <button onClick={e => {
                        e.stopPropagation();
                        const filePath = dirPath + file.name + (file.isDirectory ? "/" : "");
                        setShareTarget({ path: filePath, isDirectory: !!file.isDirectory });
                      }}
                        className="p-1 rounded-lg bg-purple-600 text-white hover:bg-purple-700" title="Share">
                        <Share2 size={11} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); setDeleteConfirm(file.name); }}
                        className="p-1 rounded-lg bg-red-500 text-white hover:bg-red-600" title="Delete">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Shared with me — top-level list ── */}
      {view === "shared" && !sharedOwner && (
        <div className="flex-1 overflow-auto scrollbar-thin p-5">
          {sharedLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex flex-col items-center p-3 gap-2">
                  <div className="rounded-xl" style={{ width: 40, height: 40, backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
                  <div className="rounded" style={{ width: 56, height: 8, backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
                </div>
              ))}
            </div>
          )}
          {!sharedLoading && (!sharedWithMe || sharedWithMe.length === 0) && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: isDark ? "#374151" : "#f3f4f6" }}>
                <Users size={36} className="opacity-30" style={{ color: muted }} />
              </div>
              <p className="text-sm" style={{ color: muted }}>Nothing shared with you yet</p>
            </div>
          )}
          {!sharedLoading && sharedWithMe && sharedWithMe.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {sharedWithMe.map((item: any, i: number) => (
                <div key={i}
                  className="relative flex flex-col items-center p-3 rounded-xl cursor-pointer transition-all border border-transparent"
                  style={{ color: textColor }}
                  onMouseEnter={e => { setHovered(`shared-${i}`); e.currentTarget.style.backgroundColor = hoverBg; e.currentTarget.style.borderColor = border; }}
                  onMouseLeave={e => { setHovered(null); e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                  onClick={() => {
                    if (item.isDirectory) {
                      setSharedOwner(item.ownerEmail);
                      setSharedPath(item.path);
                      setSharedCrumbs(item.path.replace(/^\/|\/$/g, "").split("/").filter(Boolean));
                    }
                  }}
                >
                  <div className="mb-2"><FileIcon name={item.name} isDir={item.isDirectory} /></div>
                  <span className="text-xs text-center truncate w-full font-medium">{item.name}</span>
                  <span className="text-[10px] mt-0.5 truncate w-full text-center" style={{ color: muted }}>{item.ownerEmail}</span>
                  {/* Permission badge */}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full mt-0.5 ${item.permission === "edit" ? "bg-green-600/20 text-green-500" : "bg-blue-600/20 text-blue-400"}`}>
                    {item.permission}
                  </span>
                  {hovered === `shared-${i}` && (
                    <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                      {!item.isDirectory && item.permission === "edit" && isOfficeFile(item.name) && (
                        <button onClick={e => { e.stopPropagation(); handleSharedEdit(item.ownerEmail, item.path); }}
                          className="p-1 rounded-lg bg-green-600 text-white hover:bg-green-700" title="Edit online">
                          <Pencil size={11} />
                        </button>
                      )}
                      {!item.isDirectory && (
                        <button onClick={e => { e.stopPropagation(); handleSharedDownload(item.ownerEmail, item.path, item.name); }}
                          className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700" title="Download">
                          <Download size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Shared folder browse ── */}
      {view === "shared" && sharedOwner && (
        <div className="flex-1 overflow-auto scrollbar-thin p-5">
          {sharedBrowseLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="flex flex-col items-center p-3 gap-2">
                  <div className="rounded-xl" style={{ width: 40, height: 40, backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
                  <div className="rounded" style={{ width: 56, height: 8, backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
                </div>
              ))}
            </div>
          )}
          {!sharedBrowseLoading && (!sharedBrowse || sharedBrowse.length === 0) && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: isDark ? "#374151" : "#f3f4f6" }}>
                <Folder size={36} className="opacity-30" style={{ color: muted }} />
              </div>
              <p className="text-sm" style={{ color: muted }}>Empty folder</p>
            </div>
          )}
          {!sharedBrowseLoading && sharedBrowse && sharedBrowse.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {sharedBrowse.map((file: any, i: number) => (
                <div key={i}
                  className="relative flex flex-col items-center p-3 rounded-xl cursor-pointer transition-all border border-transparent"
                  style={{ color: textColor }}
                  onMouseEnter={e => { setHovered(`browse-${i}`); e.currentTarget.style.backgroundColor = hoverBg; e.currentTarget.style.borderColor = border; }}
                  onMouseLeave={e => { setHovered(null); e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
                  onClick={() => { if (file.isDirectory) sharedNavigate(file.name); }}
                >
                  <div className="mb-2"><FileIcon name={file.name} isDir={file.isDirectory} /></div>
                  <span className="text-xs text-center truncate w-full font-medium">{file.name}</span>
                  {!file.isDirectory && <span className="text-[10px] mt-0.5" style={{ color: muted }}>{formatBytes(file.size)}</span>}
                  {hovered === `browse-${i}` && (
                    <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                      {!file.isDirectory && isOfficeFile(file.name) && (
                        <button onClick={e => {
                          e.stopPropagation();
                          handleSharedEdit(sharedOwner, sharedPath + file.name);
                        }}
                          className="p-1 rounded-lg bg-green-600 text-white hover:bg-green-700" title="Edit online">
                          <Pencil size={11} />
                        </button>
                      )}
                      {!file.isDirectory && (
                        <button onClick={e => {
                          e.stopPropagation();
                          handleSharedDownload(sharedOwner, sharedPath + file.name, file.name);
                        }}
                          className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700" title="Download">
                          <Download size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
