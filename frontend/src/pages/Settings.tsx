import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Lock, Camera, Check, X, Eye, EyeOff, ZoomIn, ZoomOut, Move, Download, Upload, HardDrive, AlertTriangle } from "lucide-react";
import { getProfile, updateProfile, updateAvatar, changePassword } from "../api/settingsApi.ts";
import { downloadBackup, restoreBackup } from "../api/mailApi.ts";
import { useAuthStore, useToastStore } from "../store/index.ts";
import { useTheme } from "../lib/themes.ts";
import { avatarColor } from "../lib/utils.ts";


export default function SettingsPage() {
  const { email, displayName: storedName, setAuth, setAvatar, accessToken, role, domain } = useAuthStore();
  const { addToast } = useToastStore();
  const { appBg, textColor, isDark } = useTheme();
  const qc = useQueryClient();

  const border = isDark ? "#374151" : "#e5e7eb";
  const cardBg = isDark ? "#1f2937" : "white";
  const mutedColor = isDark ? "#9ca3af" : "#6b7280";
  const inputBg = isDark ? "#111827" : "#f9fafb";

  // Profile
  const { data: profile } = useQuery({ queryKey: ["profile"], queryFn: getProfile });
  const [name, setName] = useState("");
  useEffect(() => { if (profile) { setName(profile.displayName); setAvatar(profile.avatar ?? null); } }, [profile]);

  const nameMutation = useMutation({
    mutationFn: () => updateProfile(name),
    onSuccess: (data) => {
      if (accessToken && email && role && domain) {
        setAuth(accessToken, { email, role, domain, displayName: data.displayName });
      }
      qc.invalidateQueries({ queryKey: ["profile"] });
      addToast("Display name updated", "success");
    },
    onError: () => addToast("Failed to update name", "error"),
  });

  // Avatar
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarMutation = useMutation({
    mutationFn: (dataUrl: string) => updateAvatar(dataUrl),
    onSuccess: (data: { avatar?: string }) => {
      if (data?.avatar) setAvatar(data.avatar);
      qc.invalidateQueries({ queryKey: ["profile"] });
      addToast("Profile photo updated", "success");
    },
    onError: () => addToast("Failed to update photo", "error"),
  });

  // Crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 });
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const cropDragging = useRef(false);
  const cropLastPos = useRef({ x: 0, y: 0 });

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { addToast("Please select an image file", "error"); return; }
    if (file.size > 2 * 1024 * 1024) { addToast("Image must be under 2 MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCropSrc(reader.result);
        setCropZoom(1);
        setCropPos({ x: 0, y: 0 });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const drawCropPreview = useCallback(() => {
    const canvas = cropCanvasRef.current;
    const img = cropImgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    const scale = cropZoom;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const fitScale = size / Math.min(imgW, imgH);
    const drawW = imgW * fitScale * scale;
    const drawH = imgH * fitScale * scale;
    const drawX = (size - drawW) / 2 + cropPos.x;
    const drawY = (size - drawH) / 2 + cropPos.y;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);
    ctx.restore();
  }, [cropZoom, cropPos]);

  useEffect(() => { drawCropPreview(); }, [drawCropPreview]);

  const handleCropConfirm = () => {
    const canvas = cropCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    avatarMutation.mutate(dataUrl);
    setCropSrc(null);
  };

  const handleCropMouseDown = (e: React.MouseEvent) => {
    cropDragging.current = true;
    cropLastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!cropDragging.current) return;
    const dx = e.clientX - cropLastPos.current.x;
    const dy = e.clientY - cropLastPos.current.y;
    cropLastPos.current = { x: e.clientX, y: e.clientY };
    setCropPos(p => ({ x: p.x + dx, y: p.y + dy }));
  };

  const handleCropMouseUp = () => { cropDragging.current = false; };

  const handleCropWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setCropZoom(z => Math.max(0.5, Math.min(5, z + (e.deltaY < 0 ? 0.1 : -0.1))));
  };

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const pwMutation = useMutation({
    mutationFn: () => changePassword(currentPw, newPw),
    onSuccess: () => {
      sessionStorage.setItem("mp", newPw);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      addToast("Password changed successfully", "success");
    },
    onError: (err: Error & { response?: { data?: { error?: string } } }) => {
      addToast(err.response?.data?.error || "Failed to change password", "error");
    },
  });

  const pwValid = currentPw.length > 0 && newPw.length >= 8 && newPw === confirmPw;

  // Backup & Restore
  const [backupPending, setBackupPending] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState<{ done: number; total: number } | null>(null);
  const [restoreResult, setRestoreResult] = useState<{ imported: number; skipped: number } | null>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setBackupPending(true);
    try {
      await downloadBackup();
      addToast("Backup downloaded", "success");
    } catch {
      addToast("Backup failed", "error");
    } finally {
      setBackupPending(false);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    let json: object;
    try {
      json = JSON.parse(await file.text());
    } catch {
      addToast("Invalid backup file — must be JSON", "error");
      return;
    }
    setRestoreResult(null);
    setRestoreProgress({ done: 0, total: 0 });
    try {
      const result = await restoreBackup(json, (done, total) => setRestoreProgress({ done, total }));
      setRestoreProgress(null);
      setRestoreResult(result);
      addToast(`Restored ${result.imported} message${result.imported !== 1 ? "s" : ""}`, "success");
    } catch {
      setRestoreProgress(null);
      addToast("Restore failed", "error");
    }
  };

  const initial = (storedName || email)?.[0]?.toUpperCase() ?? "?";
  const color = avatarColor(email ?? "");

  return (
    <div className="h-full overflow-y-auto" style={{ background: appBg, color: textColor }}>
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>

        {/* Profile Section */}
        <div className="rounded-xl border p-6 space-y-5" style={{ backgroundColor: cardBg, borderColor: border }}>
          <div className="flex items-center gap-2 mb-1">
            <User size={18} style={{ color: mutedColor }} />
            <h2 className="text-lg font-semibold">Profile</h2>
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              {profile?.avatar ? (
                <img src={profile.avatar} alt="avatar" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className={`avatar ${color} w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold`}>
                  {initial}
                </div>
              )}
              <div
                className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Camera size={20} className="text-white" />
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="font-medium">{storedName || email}</p>
              <p className="text-sm" style={{ color: mutedColor }}>{email}</p>
              <p className="text-xs mt-1 px-2 py-0.5 rounded-full inline-block" style={{ backgroundColor: isDark ? "#374151" : "#f3f4f6", color: mutedColor }}>
                {role} · {domain}
              </p>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Display Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-400"
                style={{ backgroundColor: inputBg, borderColor: border, color: textColor }}
                placeholder="Your name"
              />
              <button
                onClick={() => nameMutation.mutate()}
                disabled={!name.trim() || name === profile?.displayName || nameMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
              >
                <Check size={14} />
                Save
              </button>
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Email Address</label>
            <input
              type="email"
              value={email ?? ""}
              readOnly
              className="w-full rounded-lg border px-3 py-2 text-sm opacity-60 cursor-not-allowed"
              style={{ backgroundColor: inputBg, borderColor: border, color: textColor }}
            />
            <p className="text-xs mt-1" style={{ color: mutedColor }}>Email cannot be changed</p>
          </div>
        </div>

        {/* Password Section */}
        <div className="rounded-xl border p-6 space-y-5" style={{ backgroundColor: cardBg, borderColor: border }}>
          <div className="flex items-center gap-2 mb-1">
            <Lock size={18} style={{ color: mutedColor }} />
            <h2 className="text-lg font-semibold">Change Password</h2>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-blue-400"
                style={{ backgroundColor: inputBg, borderColor: border, color: textColor }}
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: mutedColor }}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none transition focus:ring-2 focus:ring-blue-400"
                style={{ backgroundColor: inputBg, borderColor: border, color: textColor }}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: mutedColor }}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {newPw && newPw.length < 8 && (
              <p className="text-xs text-red-500 mt-1">Password must be at least 8 characters</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-blue-400"
              style={{ backgroundColor: inputBg, borderColor: border, color: textColor }}
              placeholder="Repeat new password"
            />
            {confirmPw && newPw !== confirmPw && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            onClick={() => pwMutation.mutate()}
            disabled={!pwValid || pwMutation.isPending}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
          >
            <Lock size={14} />
            {pwMutation.isPending ? "Changing..." : "Change Password"}
          </button>
        </div>

        {/* Backup & Restore Section */}
        <div className="rounded-xl border p-6 space-y-5" style={{ backgroundColor: cardBg, borderColor: border }}>
          <div className="flex items-center gap-2 mb-1">
            <HardDrive size={18} style={{ color: mutedColor }} />
            <h2 className="text-lg font-semibold">Backup & Restore</h2>
          </div>
          <p className="text-sm" style={{ color: mutedColor }}>
            Backup exports all your emails from every folder (Inbox, Sent, Drafts, etc.) as a single JSON file.
            You can restore it later to re-import all messages back into your account.
          </p>

          {/* Backup */}
          <div className="flex items-start gap-4 p-4 rounded-lg border" style={{ borderColor: border, backgroundColor: isDark ? "#111827" : "#f9fafb" }}>
            <div className="flex-1">
              <p className="text-sm font-medium">Download Backup</p>
              <p className="text-xs mt-0.5" style={{ color: mutedColor }}>
                Downloads a <code className="px-1 rounded" style={{ backgroundColor: isDark ? "#374151" : "#e5e7eb" }}>.json</code> file containing all your raw email data.
              </p>
            </div>
            <button
              onClick={handleBackup}
              disabled={backupPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition flex-shrink-0"
            >
              <Download size={14} />
              {backupPending ? "Exporting…" : "Export"}
            </button>
          </div>

          {/* Restore */}
          <div className="flex items-start gap-4 p-4 rounded-lg border" style={{ borderColor: border, backgroundColor: isDark ? "#111827" : "#f9fafb" }}>
            <div className="flex-1">
              <p className="text-sm font-medium">Restore from Backup</p>
              <p className="text-xs mt-0.5" style={{ color: mutedColor }}>
                Select a previously exported backup file to re-import all messages. Existing messages are not removed.
              </p>
              {/* Progress bar */}
              {restoreProgress && restoreProgress.total > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: mutedColor }}>
                    <span>Restoring… {restoreProgress.done} / {restoreProgress.total}</span>
                    <span>{Math.round((restoreProgress.done / restoreProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? "#374151" : "#e5e7eb" }}>
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${Math.round((restoreProgress.done / restoreProgress.total) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {restoreProgress && restoreProgress.total === 0 && (
                <p className="text-xs mt-2 text-blue-500">Reading backup file…</p>
              )}
              {restoreResult && (
                <div className="mt-3 flex items-center gap-2 text-xs text-green-600">
                  <Check size={13} />
                  Restored {restoreResult.imported} message{restoreResult.imported !== 1 ? "s" : ""}
                  {restoreResult.skipped > 0 && <span style={{ color: mutedColor }}>· {restoreResult.skipped} skipped</span>}
                </div>
              )}
            </div>
            <div className="flex-shrink-0">
              <input ref={restoreFileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleRestoreFile} />
              <button
                onClick={() => restoreFileRef.current?.click()}
                disabled={!!restoreProgress}
                className="flex items-center gap-2 px-4 py-2 border text-sm font-medium rounded-lg transition disabled:opacity-50"
                style={{ borderColor: border, color: textColor, backgroundColor: isDark ? "#1f2937" : "white" }}
              >
                <Upload size={14} />
                {restoreProgress ? "Restoring…" : "Restore"}
              </button>
            </div>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 text-xs p-3 rounded-lg" style={{ backgroundColor: isDark ? "#292524" : "#fef9c3", color: isDark ? "#fbbf24" : "#92400e" }}>
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
            <span>Restore appends messages — it does not deduplicate. Running restore twice will create duplicates.</span>
          </div>
        </div>
      </div>

      {/* Hidden image for crop */}
      {cropSrc && (
        <img
          ref={cropImgRef}
          src={cropSrc}
          alt=""
          className="hidden"
          onLoad={drawCropPreview}
        />
      )}

      {/* Crop Modal */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="rounded-2xl shadow-2xl border p-6 w-[360px] space-y-4"
            style={{ backgroundColor: cardBg, borderColor: border }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: textColor }}>Crop Photo</h3>
              <button
                onClick={() => setCropSrc(null)}
                className="p-1 rounded-lg hover:bg-black/10 transition"
              >
                <X size={18} style={{ color: mutedColor }} />
              </button>
            </div>

            {/* Crop area */}
            <div
              className="relative mx-auto overflow-hidden rounded-full cursor-grab active:cursor-grabbing"
              style={{ width: 256, height: 256, backgroundColor: isDark ? "#111827" : "#f3f4f6" }}
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onMouseLeave={handleCropMouseUp}
              onWheel={handleCropWheel}
            >
              <canvas ref={cropCanvasRef} className="w-full h-full" />
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-3 px-2">
              <ZoomOut size={16} style={{ color: mutedColor }} />
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.05"
                value={cropZoom}
                onChange={e => setCropZoom(Number(e.target.value))}
                className="flex-1 accent-blue-600"
              />
              <ZoomIn size={16} style={{ color: mutedColor }} />
            </div>

            <p className="text-xs text-center flex items-center justify-center gap-1" style={{ color: mutedColor }}>
              <Move size={12} /> Drag to reposition &middot; Scroll to zoom
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setCropSrc(null)}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition"
                style={{ borderColor: border, color: textColor }}
              >
                Cancel
              </button>
              <button
                onClick={handleCropConfirm}
                disabled={avatarMutation.isPending}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
              >
                <Check size={14} />
                {avatarMutation.isPending ? "Saving..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
