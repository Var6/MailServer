import axios from "axios";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, User, HardDrive, ToggleLeft, ToggleRight } from "lucide-react";
import { updateUser, type AdminUser } from "../../api/adminApi.ts";
import { useToastStore, useAuthStore } from "../../store/index.ts";

interface Props { user: AdminUser; onClose: () => void; }

export default function EditUserModal({ user, onClose }: Props) {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const { email: selfEmail } = useAuthStore();
  const [form, setForm] = useState({
    displayName: user.displayName ?? "",
    quotaMb: user.quotaMb,
    active: user.active,
  });

  const mutation = useMutation({
    mutationFn: () => updateUser(user.email, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      addToast("User updated", "success");
      onClose();
    },
    onError: (e: unknown) => addToast(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : (e instanceof Error ? e.message : "Update failed"), "error"),
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const isSelf = user.email === selfEmail;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-semibold text-sm uppercase">
              {(user.displayName || user.email)[0]}
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202124]">Edit User</h2>
              <p className="text-xs text-[#5f6368]">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="p-6 space-y-4">
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

          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
              <HardDrive size={13} /> Mailbox Quota (MB)
            </label>
            <input
              value={form.quotaMb}
              onChange={e => set("quotaMb", parseInt(e.target.value) || 100)}
              type="number" min={100} max={102400}
              className="field-input"
            />
            <p className="text-xs text-[#5f6368]">
              {form.quotaMb >= 1024 ? `${(form.quotaMb / 1024).toFixed(1)} GB` : `${form.quotaMb} MB`}
            </p>
          </div>

          {/* Active toggle — cannot deactivate self */}
          {!isSelf && (
            <div className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
              <div>
                <p className="text-sm font-medium text-[#202124]">Account Status</p>
                <p className="text-xs text-[#5f6368]">{form.active ? "Active" : "Deactivated — cannot log in"}</p>
              </div>
              <button
                type="button"
                onClick={() => set("active", !form.active)}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                  form.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {form.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                {form.active ? "Active" : "Inactive"}
              </button>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
