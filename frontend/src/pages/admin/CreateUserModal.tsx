import axios from "axios";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Mail, Lock, Users, HardDrive, User } from "lucide-react";
import { createUser } from "../../api/adminApi.ts";
import { useToastStore, useAuthStore } from "../../store/index.ts";

interface Props { onClose: () => void; }

export default function CreateUserModal({ onClose }: Props) {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const { domain } = useAuthStore();
  const [form, setForm] = useState({
    localPart: "", password: "", displayName: "", quotaMb: 512,
  });

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      addToast("User created successfully", "success");
      onClose();
    },
    onError: (e: unknown) => addToast(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : (e instanceof Error ? e.message : "Failed to create user"), "error"),
  });

  const set = (k: keyof typeof form, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      localPart: form.localPart.toLowerCase(),
      password: form.password,
      displayName: form.displayName || undefined,
      quotaMb: form.quotaMb,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202124]">New User</h2>
              <p className="text-xs text-[#5f6368]">Create email account for @{domain}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Email */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
              <Mail size={13} /> Email Address <span className="text-red-500">*</span>
            </label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-300">
              <input
                value={form.localPart}
                onChange={e => set("localPart", e.target.value.replace(/[^a-z0-9._+-]/gi, "").toLowerCase())}
                required
                placeholder="username"
                className="flex-1 px-3 py-2 text-sm outline-none"
              />
              <span className="px-3 py-2 text-sm bg-gray-50 text-[#5f6368] border-l border-gray-200">
                @{domain}
              </span>
            </div>
          </div>

          {/* Display name */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
              <User size={13} /> Display Name
            </label>
            <input
              value={form.displayName}
              onChange={e => set("displayName", e.target.value)}
              placeholder="Full Name"
              className="field-input"
            />
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
              <Lock size={13} /> Password <span className="text-red-500">*</span>
            </label>
            <input
              value={form.password}
              onChange={e => set("password", e.target.value)}
              type="password"
              minLength={8}
              required
              placeholder="Min. 8 characters"
              className="field-input"
            />
          </div>

          {/* Quota */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
              <HardDrive size={13} /> Mailbox Quota (MB) <span className="text-red-500">*</span>
            </label>
            <input
              value={form.quotaMb}
              onChange={e => set("quotaMb", parseInt(e.target.value) || 100)}
              type="number" min={100} max={102400} required
              className="field-input"
            />
            <p className="text-xs text-[#5f6368]">
              {form.quotaMb >= 1024 ? `${(form.quotaMb / 1024).toFixed(1)} GB` : `${form.quotaMb} MB`} mailbox storage
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
