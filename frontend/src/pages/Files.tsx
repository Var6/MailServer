import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Folder, FileText, Upload, ExternalLink, ChevronRight,
  Image, FileSpreadsheet, Presentation, FileCode, Film, Music,
  Pencil,
} from "lucide-react";
import { apiClient } from "../api/client.ts";
import { formatBytes } from "../lib/utils.ts";
import { useToastStore } from "../store/index.ts";

const ncUrl              = import.meta.env.VITE_NC_URL ?? "/nextcloud";
// Set VITE_COLLABORA_ENABLED=false in your .env to hide the "Open in Office" button
const collaboraEnabled   = import.meta.env.VITE_COLLABORA_ENABLED !== "false";

const OFFICE_TYPES = new Set([
  "docx","doc","odt","rtf",          // word processor
  "xlsx","xls","ods","csv",           // spreadsheet
  "pptx","ppt","odp",                 // presentation
  "pdf",                              // PDF (Collabora can view PDFs)
]);

function fileExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isOfficeFile(name: string) {
  return OFFICE_TYPES.has(fileExt(name));
}

function officeUrl(path: string, name: string) {
  // Opens the file in Nextcloud Files, which auto-launches Collabora for supported types
  const dir = path.endsWith("/") ? path.slice(0, -1) : path;
  return `${ncUrl}/index.php/apps/files/?dir=${encodeURIComponent(dir)}&scrollto=${encodeURIComponent(name)}`;
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

export default function FilesPage() {
  const [path, setPath]           = useState("/");
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const { addToast }              = useToastStore();

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
    for (const file of files) {
      try {
        const buf = await file.arrayBuffer();
        await apiClient.post(`/files/upload?path=${encodeURIComponent(path + file.name)}`, buf, {
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        addToast(`Uploaded ${file.name}`, "success");
      } catch {
        addToast(`Failed to upload ${file.name}`, "error");
      }
    }
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
          {collaboraEnabled && (
            <a
              href={`${ncUrl}/index.php/apps/files/`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-[#5f6368] hover:text-[#202124]
                         border border-gray-200 hover:border-gray-300 rounded-full px-3 py-1.5 transition-colors"
              title="Open LibreOffice Online via Nextcloud"
            >
              <Pencil size={13} /> Office
            </a>
          )}
          <button
            onClick={open}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700
                       border border-blue-200 hover:border-blue-400 rounded-full px-3 py-1.5 transition-colors"
          >
            <Upload size={14} /> Upload
          </button>
          <a
            href={`${ncUrl}/index.php/apps/files`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-[#5f6368] hover:text-[#202124]
                       border border-gray-200 hover:border-gray-300 rounded-full px-3 py-1.5 transition-colors"
          >
            Open Nextcloud <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* LibreOffice info banner */}
      {collaboraEnabled && (
        <div className="px-6 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2 flex-shrink-0">
          <Pencil size={13} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            Click <strong>Open in Office</strong> on any document to edit it in LibreOffice directly in the browser.
            Set <code className="bg-amber-100 px-1 rounded">VITE_COLLABORA_ENABLED=false</code> in your build to disable.
          </p>
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
                <div className="mb-2">
                  <FileIcon name={file.name} contentType={file.contentType} isDir={file.isDirectory} />
                </div>
                <span className="text-xs text-[#202124] text-center truncate w-full font-medium">
                  {file.name}
                </span>
                {!file.isDirectory && file.size != null && (
                  <span className="text-xs text-[#5f6368] mt-0.5">{formatBytes(file.size)}</span>
                )}

                {/* Open in Office button — appears on hover for document types */}
                {!file.isDirectory && collaboraEnabled && isOfficeFile(file.name) && (
                  <a
                    href={officeUrl(path, file.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100
                               bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-md
                               px-1.5 py-0.5 text-[10px] font-medium flex items-center gap-1
                               transition-opacity whitespace-nowrap"
                    title="Open in LibreOffice Online"
                  >
                    <Pencil size={9} /> Office
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
