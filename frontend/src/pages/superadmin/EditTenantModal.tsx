import axios from "axios";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Building2, Users, HardDrive, ToggleLeft, ToggleRight } from "lucide-react";
import { updateTenant, type Tenant } from "../../api/superadminApi.ts";
import { useToastStore } from "../../store/index.ts";

interface Props { tenant: Tenant; onClose: () => void; }

export default function EditTenantModal({ tenant, onClose }: Props) {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const [form, setForm] = useState({
    name: tenant.name,
    maxUsers: tenant.maxUsers,
    storagePerUserMb: tenant.storagePerUserMb,
    active: tenant.active,
  });

  const mutation = useMutation({
    mutationFn: () => updateTenant(tenant.domain, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      addToast("Tenant updated", "success");
      onClose();
    },
    onError: (e: unknown) => addToast(axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : (e instanceof Error ? e.message : "Update failed"), "error"),
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202124]">Edit Tenant</h2>
              <p className="text-xs text-[#5f6368]">{tenant.domain}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="p-6 space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
              <Building2 size={13} /> Company Name
            </label>
            <input
              value={form.name}
              onChange={e => set("name", e.target.value)}
              required
              className="field-input"
            />
          </div>

          {/* Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
                <Users size={13} /> Max Users
              </label>
              <input
                value={form.maxUsers}
                onChange={e => set("maxUsers", parseInt(e.target.value) || 1)}
                type="number" min={tenant.currentUsers || 1} max={10000}
                className="field-input"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
                <HardDrive size={13} /> Storage / User (MB)
              </label>
              <input
                value={form.storagePerUserMb}
                onChange={e => set("storagePerUserMb", parseInt(e.target.value) || 100)}
                type="number" min={100} max={102400}
                className="field-input"
              />
            </div>
          </div>

          {/* Current usage info */}
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-[#5f6368] space-y-1">
            <p>Current users: <span className="font-medium text-[#202124]">{tenant.currentUsers} / {form.maxUsers}</span></p>
            <p>Total allocation: <span className="font-medium text-[#202124]">
              {((form.storagePerUserMb * form.maxUsers) / 1024).toFixed(1)} GB
            </span></p>
            {form.maxUsers < tenant.currentUsers && (
              <p className="text-red-500 font-medium">⚠ Max users cannot be less than current user count ({tenant.currentUsers})</p>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
            <div>
              <p className="text-sm font-medium text-[#202124]">Tenant Status</p>
              <p className="text-xs text-[#5f6368]">{form.active ? "Active — users can log in" : "Inactive — all access disabled"}</p>
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

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button
              type="submit"
              disabled={mutation.isPending || form.maxUsers < (tenant.currentUsers || 0)}
              className="btn-primary"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
