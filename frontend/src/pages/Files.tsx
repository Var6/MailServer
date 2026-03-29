import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Folder, FileText, Upload, ExternalLink, ChevronRight,
  Image, FileSpreadsheet, Presentation, FileCode, Film, Music, Pencil,
} from "lucide-react";
import { apiClient } from "../api/client.ts";
import { formatBytes } from "../lib/utils.ts";
import { useToastStore } from "../store/index.ts";

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

export default function FilesPage() {
  const [path, setPath]           = useState("/");
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const [uploadQueue, setUploadQueue] = useState<Array<{
    name: string;
    progress: number;
    status: "uploading" | "done" | "error";
  }>>([]);
  const { addToast }              = useToastStore();

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
    <div className="h-full bg-white flex flex-col" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1 text-sm">
          <button
            onClick={() => navigateTo(-1)}
            className="text-blue-600 hover:underline font-medium flex items-center gap-1"
          >
            <Folder size={16} className="text-amber-400" /> Files
          </button>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight size={14} className="text-gray-400" />
              <button
                onClick={() => navigateTo(i)}
                className={i === breadcrumbs.length - 1
                  ? "text-[#202124] font-medium"
                  : "text-blue-600 hover:underline"}
              >
                {crumb}
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={open}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700
                       border border-blue-200 hover:border-blue-400 rounded-full px-3 py-1.5 transition-colors"
          >
            <Upload size={14} /> Upload
          </button>
          <button
            onClick={() => openNextcloud("/index.php/apps/files/")}
            className="flex items-center gap-1.5 text-sm text-[#5f6368] hover:text-[#202124]
                       border border-gray-200 hover:border-gray-300 rounded-full px-3 py-1.5 transition-colors"
          >
            Open LibreOffice <ExternalLink size={12} />
          </button>
        </div>
      </div>

      <div className="px-6 py-2 border-b border-gray-100 bg-gray-50 text-xs text-[#5f6368]">
        {storageInfo?.driver === "local"
          ? (
            <>Files are stored on this system at <span className="font-medium text-[#202124]">{storageInfo.location}{path}</span>. LibreOffice web editor is available via Nextcloud.</>
          )
          : (
            <>Files are stored in Nextcloud at <span className="font-medium text-[#202124]">{storageInfo?.location ?? "/remote.php/dav/files/<your-email>/"}{path}</span></>
          )}
      </div>

      {uploadQueue.length > 0 && (
        <div className="px-6 py-3 border-b border-gray-100 bg-blue-50/50 space-y-2">
          {uploadQueue.map((upload) => (
            <div key={upload.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#202124] truncate pr-2">{upload.name}</span>
                <span className={upload.status === "error" ? "text-red-600" : "text-[#5f6368]"}>
                  {upload.status === "error" ? "Failed" : `${upload.progress}%`}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-blue-100 overflow-hidden mt-1">
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
                <div className="skeleton w-10 h-10 rounded-lg" />
                <div className="skeleton h-2.5 w-16 rounded" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
              <Folder size={36} className="opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#5f6368]">No files here</p>
              <p className="text-xs mt-1">Drag and drop to upload, or click Upload</p>
            </div>
          </div>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {(data as any[]).map((file: any, i: number) => (
              <div
                key={i}
                className="flex flex-col items-center p-3 rounded-xl hover:bg-gray-50 cursor-pointer
                           group transition-colors border border-transparent hover:border-gray-200 relative"
                onClick={() => file.isDirectory && navigate(file.name)}
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
                <span className="text-xs text-[#202124] text-center truncate w-full font-medium">
                  {file.name}
                </span>
                {!file.isDirectory && file.size != null && (
                  <span className="text-xs text-[#5f6368] mt-0.5">{formatBytes(file.size)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
