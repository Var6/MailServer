import { useQuery } from "@tanstack/react-query";
import { useCallback, useState, useRef, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Folder, FileText, Upload, ExternalLink, ChevronRight,
  Image, FileSpreadsheet, Presentation, FileCode, Film, Music, Pencil,
  Plus, FolderPlus, FileType, Table, FileType2,
} from "lucide-react";
import { apiClient } from "../api/client.ts";
import { formatBytes } from "../lib/utils.ts";
import { useToastStore, useUiThemeStore } from "../store/index.ts";

function fileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function FileIcon({ name, contentType, isDir }: { name: string; contentType?: string; isDir?: boolean }) {
  if (isDir) return <Folder size={28} className="text-amber-400" />;
  const ext = fileExt(name);
  const t   = contentType ?? "";
  if (t.startsWith("image/"))                              return <Image       size={28} className="text-green-500" />;
  if (["xlsx","xls","ods","csv"].includes(ext) || t.includes("spreadsheet") || t.includes("excel"))
                                                           return <FileSpreadsheet size={28} className="text-green-600" />;
  if (["pptx","ppt","odp"].includes(ext) || t.includes("presentation") || t.includes("powerpoint"))
                                                           return <Presentation size={28} className="text-orange-500" />;
  if (t.includes("video/"))                               return <Film         size={28} className="text-purple-500" />;
  if (t.includes("audio/"))                               return <Music        size={28} className="text-pink-500" />;
  if (t.includes("text/") || t.includes("json") || t.includes("xml"))
                                                           return <FileCode     size={28} className="text-blue-400" />;
  return <FileText size={28} className="text-blue-500" />;
}

const OFFICE_TYPES = new Set(["doc","docx","odt","xls","xlsx","ods","ppt","pptx","odp"]);

function isOfficeFile(name: string) {
  return OFFICE_TYPES.has(name.split(".").pop()?.toLowerCase() ?? "");
}

// Opens Nextcloud with the user already logged in.
// 1. Calls backend (with JWT) to do server-side NC login → gets one-time token
// 2. Opens /api/files/nc-redirect?token=<token> in new tab — sets NC session cookies + redirects
async function openNextcloud(redirect = "/index.php/apps/files/") {
  try {
    const { data } = await apiClient.post<{ token: string }>("/files/nc-login", { redirect });
    window.open(`/api/files/nc-redirect?token=${data.token}`, "_blank");
  } catch {
    window.open(`/nextcloud${redirect}`, "_blank");
  }
}

async function openInCollabora(filePath: string) {
  const redirect = `/index.php/apps/files/?dir=${encodeURIComponent(filePath.substring(0, filePath.lastIndexOf("/")))}&openfile=${encodeURIComponent(filePath)}`;
  openNextcloud(redirect);
}

const DARK_TEXT_COLORS = ["#f3f4f6", "#f1f5f9", "#f3e8ff", "#e9d5ff", "#f0f9ff", "#f9fafb", "#fce7f3"];
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

function useTheme() {
  const appBg = useUiThemeStore((s) => s.appBg);
  const found = BG_THEMES.find(t => t.bg === appBg);
  const textColor = found?.text || "#1f2937";
  const isDark = DARK_TEXT_COLORS.includes(textColor);
  return { appBg, textColor, isDark };
}

const NEW_FILE_OPTIONS = [
  { ext: "folder", label: "New Folder", icon: FolderPlus },
  { ext: "txt", label: "Text Document", icon: FileText },
  { ext: "md", label: "Markdown", icon: FileType },
  { ext: "csv", label: "Spreadsheet (CSV)", icon: Table },
  { ext: "html", label: "HTML Page", icon: FileCode },
] as const;

export default function FilesPage() {
  const [path, setPath]           = useState("/");
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileType, setNewFileType] = useState<string | null>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<{
    name: string;
    progress: number;
    status: "uploading" | "done" | "error";
  }>>([]);
  const { addToast }              = useToastStore();
  const { appBg, textColor, isDark } = useTheme();
  const border = isDark ? "#374151" : "#e5e7eb";
  const mutedColor = isDark ? "#9ca3af" : "#6b7280";
  const cardBg = isDark ? "#1f2937" : "#ffffff";

  // Close new-file menu on outside click
  useEffect(() => {
    if (!newMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
        setNewFileType(null);
        setNewFileName("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [newMenuOpen]);

  const handleCreateFile = async (ext: string, name: string) => {
    try {
      if (ext === "folder") {
        await apiClient.post("/files/create-folder", { path: path + name + "/" });
        addToast(`Folder "${name}" created`, "success");
      } else {
        const filePath = path + name + "." + ext;
        await apiClient.post("/files/create", { path: filePath });
        addToast(`File "${name}.${ext}" created`, "success");
      }
      setNewMenuOpen(false);
      setNewFileType(null);
      setNewFileName("");
      refetch();
    } catch {
      addToast("Failed to create file", "error");
    }
  };

  const { data: storageInfo } = useQuery({
    queryKey: ["files-storage-info"],
    queryFn: () => apiClient.get("/files/storage-info").then(r => r.data as { driver: "local" | "nextcloud"; location: string }),
    retry: false,
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["files", path],
    queryFn:  () => apiClient.get("/files", { params: { path } }).then(r => r.data as any[]),
    retry: false,
  });

  const navigate = (name: string) => {
    const newPath = path + name + "/";
    setPath(newPath);
    setBreadcrumbs(b => [...b, name]);
  };

  const navigateTo = (idx: number) => {
    if (idx < 0) { setPath("/"); setBreadcrumbs([]); return; }
    const newCrumbs = breadcrumbs.slice(0, idx + 1);
    setBreadcrumbs(newCrumbs);
    setPath("/" + newCrumbs.join("/") + "/");
  };

  const onDrop = useCallback(async (files: File[]) => {
    setUploadQueue(files.map((file) => ({ name: file.name, progress: 0, status: "uploading" })));

    const updateUpload = (name: string, patch: Partial<{ progress: number; status: "uploading" | "done" | "error" }>) => {
      setUploadQueue((prev) => prev.map((entry) => (
        entry.name === name ? { ...entry, ...patch } : entry
      )));
    };

    for (const file of files) {
      try {
        const buf = await file.arrayBuffer();
        await apiClient.post(`/files/upload?path=${encodeURIComponent(path + file.name)}`, buf, {
          headers: { "Content-Type": file.type || "application/octet-stream" },
          onUploadProgress: (event) => {
            if (event.total && event.total > 0) {
              updateUpload(file.name, {
                progress: Math.round((event.loaded / event.total) * 100),
                status: "uploading",
              });
            }
          },
        });
        updateUpload(file.name, { progress: 100, status: "done" });
        addToast(`Uploaded ${file.name}`, "success");
      } catch {
        updateUpload(file.name, { status: "error" });
        addToast(`Failed to upload ${file.name}`, "error");
      }
    }

    setTimeout(() => {
      setUploadQueue((prev) => prev.filter((entry) => entry.status !== "done"));
    }, 1800);

    refetch();
  }, [path, refetch, addToast]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ onDrop, noClick: true });

  return (
    <div className="h-full flex flex-col" style={{ background: appBg, color: textColor }} {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Header */}
      <div className="px-6 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: border }}>
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => navigateTo(-1)}
            className="text-blue-600 hover:underline font-medium flex items-center gap-1"
          >
            <Folder size={16} className="text-amber-400" /> Files
          </button>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={14} style={{ color: mutedColor }} />
              <button
                onClick={() => navigateTo(i)}
                className={i === breadcrumbs.length - 1 ? "font-medium" : "text-blue-600 hover:underline"}
                style={i === breadcrumbs.length - 1 ? { color: textColor } : undefined}
              >
                {crumb}
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* New file dropdown */}
          <div ref={newMenuRef} className="relative">
            <button
              onClick={() => setNewMenuOpen(v => !v)}
              className="flex items-center gap-1.5 text-sm font-medium rounded-full px-3 py-1.5 transition-colors bg-blue-600 text-white hover:bg-blue-700"
            >
              <Plus size={14} /> New
            </button>
            {newMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-56 rounded-xl border shadow-lg overflow-hidden z-50"
                style={{ backgroundColor: cardBg, borderColor: border }}
              >
                {newFileType ? (
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-medium" style={{ color: mutedColor }}>
                      {newFileType === "folder" ? "Folder name" : "File name"}
                    </p>
                    <input
                      autoFocus
                      value={newFileName}
                      onChange={e => setNewFileName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && newFileName.trim()) handleCreateFile(newFileType, newFileName.trim());
                        if (e.key === "Escape") { setNewFileType(null); setNewFileName(""); }
                      }}
                      placeholder={newFileType === "folder" ? "My Folder" : "Untitled"}
                      className="w-full rounded-lg border px-2.5 py-1.5 text-sm outline-none"
                      style={{ backgroundColor: isDark ? "#111827" : "#f9fafb", borderColor: border, color: textColor }}
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setNewFileType(null); setNewFileName(""); }}
                        className="text-xs px-2.5 py-1 rounded-lg transition"
                        style={{ color: mutedColor }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => newFileName.trim() && handleCreateFile(newFileType, newFileName.trim())}
                        disabled={!newFileName.trim()}
                        className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white disabled:opacity-50 transition"
                      >
                        Create
                      </button>
                    </div>
                  </div>
                ) : (
                  NEW_FILE_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.ext}
                        onClick={() => { setNewFileType(opt.ext); setNewFileName(""); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                        style={{ color: textColor }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? "#374151" : "#f3f4f6")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                      >
                        <Icon size={16} style={{ color: mutedColor }} />
                        {opt.label}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <button
            onClick={open}
            className="flex items-center gap-1.5 text-sm rounded-full px-3 py-1.5 transition-colors border"
            style={{ color: isDark ? "#93c5fd" : "#2563eb", borderColor: isDark ? "#374151" : "#bfdbfe" }}
          >
            <Upload size={14} /> Upload
          </button>
          <button
            onClick={() => openNextcloud("/index.php/apps/files/")}
            className="flex items-center gap-1.5 text-sm rounded-full px-3 py-1.5 transition-colors border"
            style={{ color: mutedColor, borderColor: border }}
          >
            Open LibreOffice <ExternalLink size={12} />
          </button>
        </div>
      </div>

      <div className="px-6 py-2 border-b text-xs" style={{ borderColor: border, backgroundColor: isDark ? "#111827" : "#f9fafb", color: mutedColor }}>
        {storageInfo?.driver === "local"
          ? (
            <>Files are stored on this system at <span className="font-medium" style={{ color: textColor }}>{storageInfo.location}{path}</span>. LibreOffice web editor is available via Nextcloud.</>
          )
          : (
            <>Files are stored in Nextcloud at <span className="font-medium" style={{ color: textColor }}>{storageInfo?.location ?? "/remote.php/dav/files/<your-email>/"}{path}</span></>
          )}
      </div>

      {uploadQueue.length > 0 && (
        <div className="px-6 py-3 border-b space-y-2" style={{ borderColor: border, backgroundColor: isDark ? "#111827" : "#eff6ff" }}>
          {uploadQueue.map((upload) => (
            <div key={upload.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="truncate pr-2" style={{ color: textColor }}>{upload.name}</span>
                <span className={upload.status === "error" ? "text-red-500" : ""} style={upload.status !== "error" ? { color: mutedColor } : undefined}>
                  {upload.status === "error" ? "Failed" : `${upload.progress}%`}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full overflow-hidden mt-1" style={{ backgroundColor: isDark ? "#374151" : "#dbeafe" }}>
                <div
                  className={`h-full transition-all ${upload.status === "error" ? "bg-red-500" : "bg-blue-600"}`}
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drop overlay */}
      {isDragActive && (
        <div className="absolute inset-0 bg-blue-50/90 border-2 border-dashed border-blue-400 z-10
                        flex flex-col items-center justify-center gap-3">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <Upload size={28} className="text-blue-600" />
          </div>
          <p className="text-blue-700 font-semibold text-lg">Drop files to upload</p>
          <p className="text-blue-600 text-sm">to {path}</p>
        </div>
      )}

      {/* Files grid */}
      <div className="flex-1 overflow-auto scrollbar-thin p-4">
        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="flex flex-col items-center p-4 gap-2">
                <div className="rounded-lg" style={{ width: 40, height: 40, backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
                <div className="rounded" style={{ width: 64, height: 10, backgroundColor: isDark ? "#374151" : "#e5e7eb" }} />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: isDark ? "#374151" : "#f3f4f6" }}>
              <Folder size={36} className="opacity-40" style={{ color: mutedColor }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium" style={{ color: mutedColor }}>No files here</p>
              <p className="text-xs mt-1" style={{ color: isDark ? "#6b7280" : "#9ca3af" }}>Drag and drop to upload, or click Upload</p>
            </div>
          </div>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {(data as any[]).map((file: any, i: number) => (
              <div
                key={i}
                className="flex flex-col items-center p-3 rounded-xl cursor-pointer group transition-colors border border-transparent"
                style={{ color: textColor }}
                onClick={() => file.isDirectory && navigate(file.name)}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = isDark ? "#374151" : "#f3f4f6";
                  e.currentTarget.style.borderColor = border;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.borderColor = "transparent";
                }}
              >
                <div className="mb-2 relative">
                  <FileIcon name={file.name} contentType={file.contentType} isDir={file.isDirectory} />
                  {!file.isDirectory && isOfficeFile(file.name) && storageInfo?.driver === "nextcloud" && (
                    <button
                      onClick={e => { e.stopPropagation(); openInCollabora(path + file.name); }}
                      className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center
                                 w-5 h-5 bg-blue-600 text-white rounded-full shadow"
                      title="Open in LibreOffice"
                    >
                      <Pencil size={10} />
                    </button>
                  )}
                </div>
                <span className="text-xs text-center truncate w-full font-medium" style={{ color: textColor }}>
                  {file.name}
                </span>
                {!file.isDirectory && file.size != null && (
                  <span className="text-xs mt-0.5" style={{ color: mutedColor }}>{formatBytes(file.size)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
