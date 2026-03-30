import { useQuery } from "@tanstack/react-query";
import { useCallback, useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Folder, FileText, Upload, ChevronRight, Image, FileSpreadsheet,
  Presentation, FileCode, Film, Music, Plus, FolderPlus, Table,
  Download, Trash2,
} from "lucide-react";
import { apiClient } from "../api/client.ts";
import { formatBytes } from "../lib/utils.ts";
import { useToastStore, useUiThemeStore } from "../store/index.ts";

const BG_THEMES = [
  { bg: "#eef2ff", text: "#1f2937" }, { bg: "#f5f7fb", text: "#1f2937" },
  { bg: "#e9f5ff", text: "#1f2937" }, { bg: "#f4efe6", text: "#1f2937" },
  { bg: "linear-gradient(120deg,#e0f2fe,#f5f3ff)", text: "#1f2937" },
  { bg: "linear-gradient(120deg,#fef3c7,#fde68a)", text: "#1f2937" },
  { bg: "linear-gradient(120deg,#dcfce7,#ccfbf1)", text: "#1f2937" },
  { bg: "linear-gradient(120deg,#fee2e2,#fecdd3)", text: "#1f2937" },
  { bg: "#1f2937", text: "#f3f4f6" }, { bg: "#0f172a", text: "#f1f5f9" },
  { bg: "#1e1b4b", text: "#f3e8ff" }, { bg: "#0c0a1e", text: "#e9d5ff" },
  { bg: "linear-gradient(120deg,#0f172a,#1e1b4b)", text: "#f0f9ff" },
  { bg: "linear-gradient(120deg,#1f2937,#111827)", text: "#f9fafb" },
  { bg: "linear-gradient(120deg,#1e293b,#0f172a)", text: "#f1f5f9" },
  { bg: "linear-gradient(120deg,#2d1b69,#0c0a1e)", text: "#fce7f3" },
];
const DARK_TEXTS = new Set(["#f3f4f6","#f1f5f9","#f3e8ff","#e9d5ff","#f0f9ff","#f9fafb","#fce7f3"]);

function useTheme() {
  const appBg = useUiThemeStore(s => s.appBg);
  const found = BG_THEMES.find(t => t.bg === appBg);
  const textColor = found?.text ?? "#1f2937";
  return { appBg, textColor, isDark: DARK_TEXTS.has(textColor) };
}

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

const NEW_OPTIONS = [
  { ext: "folder", label: "New Folder",       icon: FolderPlus },
  { ext: "txt",    label: "Text Document",     icon: FileText   },
  { ext: "md",     label: "Markdown",          icon: FileCode   },
  { ext: "csv",    label: "Spreadsheet (CSV)", icon: Table      },
  { ext: "html",   label: "HTML Page",         icon: FileCode   },
] as const;

type UploadEntry = { name: string; progress: number; status: "uploading" | "done" | "error" };

export default function FilesPage() {
  const [dirPath, setDirPath]             = useState("/");
  const [crumbs, setCrumbs]               = useState<string[]>([]);
  const [newOpen, setNewOpen]             = useState(false);
  const [newType, setNewType]             = useState<string | null>(null);
  const [newName, setNewName]             = useState("");
  const [hovered, setHovered]             = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
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

  const { data: storageInfo } = useQuery({
    queryKey: ["files-storage-info"],
    queryFn: () => apiClient.get("/files/storage-info").then(r => r.data as { location: string }),
    retry: false,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["files", dirPath],
    queryFn: () => apiClient.get("/files", { params: { path: dirPath } }).then(r => r.data as any[]),
    retry: false,
  });

  const navigate   = (name: string) => { setDirPath(p => p + name + "/"); setCrumbs(c => [...c, name]); };
  const navigateTo = (idx: number) => {
    if (idx < 0) { setDirPath("/"); setCrumbs([]); return; }
    const c = crumbs.slice(0, idx + 1);
    setCrumbs(c);
    setDirPath("/" + c.join("/") + "/");
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

  const handleDownload = (name: string) => {
    const url = `/api/files/download?path=${encodeURIComponent(dirPath + name)}`;
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
    <div className="h-full flex flex-col" style={{ background: appBg, color: textColor }} {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Toolbar */}
      <div className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: border }}>
        <div className="flex items-center gap-1 text-sm flex-1 min-w-0">
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
      </div>

      {/* Storage path bar */}
      <div className="px-6 py-1.5 border-b text-xs" style={{ borderColor: border, backgroundColor: isDark ? "#111827" : "#f9fafb", color: muted }}>
        Stored on this server at&nbsp;
        <span className="font-medium font-mono" style={{ color: textColor }}>
          {storageInfo?.location ?? "D:\\maildata\\files\\<user>"}{dirPath.replace(/\//g, "\\")}
        </span>
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
      {isDragActive && (
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

      {/* File grid */}
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
                    {!file.isDirectory && (
                      <button onClick={e => { e.stopPropagation(); handleDownload(file.name); }}
                        className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700" title="Download">
                        <Download size={11} />
                      </button>
                    )}
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
    </div>
  );
}
