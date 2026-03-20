import axios from "axios";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Building2, Users, HardDrive, ToggleLeft, ToggleRight } from "lucide-react";
import { updateTenant, type Tenant } from "../../api/superadminApi.ts";
import { useToastStore } from "../../store/index.ts";

interface Props { tenant: Tenant; onClose: () => void; }

const MB_PRESETS = [256, 512, 1024, 2048, 5120, 10240, 20480, 51200, 102400];

function nearestPreset(v: number) {
  return MB_PRESETS.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a);
}

function mbLabel(mb: number) {
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB` : `${mb} MB`;
}

export default function EditTenantModal({ tenant, onClose }: Props) {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const minUsers = Math.max(1, tenant.currentUsers || 0);
  const [form, setForm] = useState({
    name: tenant.name,
    maxUsers: tenant.maxUsers,
    storagePerUserMb: nearestPreset(tenant.storagePerUserMb),
    active: tenant.active,
  });

  const mutation = useMutation({
    mutationFn: () => updateTenant(tenant.domain, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      addToast("Tenant updated", "success");
      onClose();
    },
    onError: (e: unknown) => addToast(
      axios.isAxiosError(e) ? (e.response?.data?.error ?? e.message) : (e instanceof Error ? e.message : "Update failed"),
      "error"
    ),
  });

  const clampUsers = (v: number) => Math.max(minUsers, Math.min(10000, v));
  const mbIdx = MB_PRESETS.indexOf(form.storagePerUserMb);
  const tooFewUsers = form.maxUsers < minUsers;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
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

        <form onSubmit={e => { e.preventDefault(); mutation.mutate(); }} className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Name */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
              <Building2 size={13} /> Company Name
            </label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required className="field-input" />
          </div>

          {/* User slots */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
              <Users size={13} /> Max User Accounts
            </label>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setForm(f => ({ ...f, maxUsers: clampUsers(f.maxUsers - 10) }))}
                className="px-2 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 font-medium">−10</button>
              <button type="button" onClick={() => setForm(f => ({ ...f, maxUsers: clampUsers(f.maxUsers - 1) }))}
                className="px-3 py-2 text-lg text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 font-medium leading-none">−</button>
              <input
                type="number" value={form.maxUsers} min={minUsers} max={10000}
                onChange={e => setForm(f => ({ ...f, maxUsers: clampUsers(parseInt(e.target.value) || minUsers) }))}
                className="flex-1 text-center text-base font-semibold border border-gray-200 rounded-lg py-2 outline-none focus:ring-2 focus:ring-blue-300"
              />
              <button type="button" onClick={() => setForm(f => ({ ...f, maxUsers: clampUsers(f.maxUsers + 1) }))}
                className="px-3 py-2 text-lg text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 font-medium leading-none">+</button>
              <button type="button" onClick={() => setForm(f => ({ ...f, maxUsers: clampUsers(f.maxUsers + 10) }))}
                className="px-2 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 font-medium">+10</button>
            </div>
            {tooFewUsers && <p className="text-xs text-red-500">Cannot go below current users ({minUsers})</p>}
          </div>

          {/* Storage stepper */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
              <HardDrive size={13} /> Storage per Mailbox
            </label>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <button type="button" onClick={() => mbIdx > 0 && setForm(f => ({ ...f, storagePerUserMb: MB_PRESETS[mbIdx - 1] }))}
                disabled={mbIdx <= 0}
                className="px-4 py-3 text-gray-500 hover:bg-gray-100 text-lg font-medium disabled:opacity-30 select-none leading-none">−</button>
              <div className="flex-1 text-center">
                <p className="text-base font-semibold text-[#202124]">{mbLabel(form.storagePerUserMb)}</p>
                <p className="text-xs text-[#5f6368]">per mailbox</p>
              </div>
              <button type="button" onClick={() => mbIdx < MB_PRESETS.length - 1 && setForm(f => ({ ...f, storagePerUserMb: MB_PRESETS[mbIdx + 1] }))}
                disabled={mbIdx >= MB_PRESETS.length - 1}
                className="px-4 py-3 text-gray-500 hover:bg-gray-100 text-lg font-medium disabled:opacity-30 select-none leading-none">+</button>
            </div>
            <p className="text-xs text-[#5f6368]">Options: 256 MB → 512 MB → 1 GB → 2 GB → 5 GB → 10 GB → 20 GB → 50 GB → 100 GB</p>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-3 text-xs text-[#5f6368] flex justify-between">
            <span>Users: <strong className="text-[#202124]">{tenant.currentUsers} / {form.maxUsers}</strong></span>
            <span>Total: <strong className="text-[#202124]">{((form.storagePerUserMb * form.maxUsers) / 1024).toFixed(1)} GB</strong></span>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 border border-gray-100 rounded-xl">
            <div>
              <p className="text-sm font-medium text-[#202124]">Tenant Status</p>
              <p className="text-xs text-[#5f6368]">{form.active ? "Active — users can log in" : "Inactive — all access disabled"}</p>
            </div>
            <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full transition-colors ${
                form.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}>
              {form.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {form.active ? "Active" : "Inactive"}
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={mutation.isPending || tooFewUsers} className="btn-primary">
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
