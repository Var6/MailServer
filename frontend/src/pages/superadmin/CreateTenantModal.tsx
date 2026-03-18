import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Building2, Globe, Mail, Lock, Users, HardDrive, Info } from "lucide-react";
import { createTenant } from "../../api/superadminApi.ts";
import { useToastStore } from "../../store/index.ts";
import axios from "axios";

interface Props { onClose: () => void; }

export default function CreateTenantModal({ onClose }: Props) {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const [form, setForm] = useState({
    name: "", domain: "", adminEmail: "", adminPassword: "",
    adminDisplayName: "", maxUsers: 10, storagePerUserMb: 512,
  });

  const mutation = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      addToast("Tenant created successfully", "success");
      onClose();
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.error ?? e.message
        : (e instanceof Error ? e.message : "Failed to create tenant");
      addToast(msg, "error");
    },
  });

  const set = (k: keyof typeof form, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202124]">New Tenant</h2>
              <p className="text-xs text-[#5f6368]">Create a new company and admin account</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Company */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#5f6368] uppercase tracking-wider">Company</p>
            <Field icon={<Building2 size={14} />} label="Company Name" required>
              <input
                value={form.name}
                onChange={e => set("name", e.target.value)}
                placeholder="Acme Corp"
                required
                className="field-input"
              />
            </Field>
            <Field icon={<Globe size={14} />} label="Mail Domain" required>
              <input
                value={form.domain}
                onChange={e => set("domain", e.target.value.toLowerCase().replace(/\s/g, ""))}
                placeholder="acme.com"
                required
                className="field-input"
              />
              <p className="text-xs text-[#5f6368] mt-0.5">
                Emails for this company will end in <code>@{form.domain || "acme.com"}</code>
              </p>
            </Field>
          </div>

          <hr className="border-gray-100" />

          {/* Admin account */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#5f6368] uppercase tracking-wider">Admin Account</p>

            <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-3 py-2.5">
              <Info size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                Admin logs in at <strong>this same URL</strong> using their email + password below.
                The email can be anything — it doesn't have to match the company domain.
              </p>
            </div>

            <Field icon={<Mail size={14} />} label="Admin Login Email" required>
              <input
                value={form.adminEmail}
                onChange={e => set("adminEmail", e.target.value.toLowerCase())}
                placeholder="john@gmail.com or admin@acme.com"
                required
                type="email"
                className="field-input"
              />
            </Field>
            <Field icon={<Users size={14} />} label="Admin Display Name">
              <input
                value={form.adminDisplayName}
                onChange={e => set("adminDisplayName", e.target.value)}
                placeholder="John Smith"
                className="field-input"
              />
            </Field>
            <Field icon={<Lock size={14} />} label="Admin Password" required>
              <input
                value={form.adminPassword}
                onChange={e => set("adminPassword", e.target.value)}
                type="password"
                minLength={8}
                required
                placeholder="Min. 8 characters"
                className="field-input"
              />
            </Field>
          </div>

          <hr className="border-gray-100" />

          {/* Limits */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#5f6368] uppercase tracking-wider">Limits</p>
            <div className="grid grid-cols-2 gap-3">
              <Field icon={<Users size={14} />} label="Max User Accounts" required>
                <Stepper
                  value={form.maxUsers}
                  min={1} max={10000} step={5}
                  onChange={v => set("maxUsers", v)}
                />
              </Field>
              <Field icon={<HardDrive size={14} />} label="Storage per Mailbox" required>
                <StepperMb
                  value={form.storagePerUserMb}
                  onChange={v => set("storagePerUserMb", v)}
                />
              </Field>
            </div>
            <p className="text-xs text-[#5f6368]">
              Total storage: <strong>{((form.storagePerUserMb * form.maxUsers) / 1024).toFixed(1)} GB</strong> allocated
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? "Creating…" : "Create Tenant"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reusable stepper for user count ───────────────────────────────────────────
function Stepper({ value, min, max, step, onChange }: {
  value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
      <button type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        className="px-3 py-2 text-gray-500 hover:bg-gray-100 font-medium text-sm select-none"
      >−</button>
      <input
        type="number" value={value} min={min} max={max}
        onChange={e => onChange(Math.min(max, Math.max(min, parseInt(e.target.value) || min)))}
        className="flex-1 text-center text-sm py-2 outline-none w-0"
      />
      <button type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        className="px-3 py-2 text-gray-500 hover:bg-gray-100 font-medium text-sm select-none"
      >+</button>
    </div>
  );
}

// ── Stepper for storage with smart increments ─────────────────────────────────
const MB_PRESETS = [256, 512, 1024, 2048, 5120, 10240, 20480, 51200, 102400];

function StepperMb({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const idx = MB_PRESETS.indexOf(value);
  const prev = idx > 0 ? MB_PRESETS[idx - 1] : null;
  const next = idx < MB_PRESETS.length - 1 ? MB_PRESETS[idx + 1] : null;

  const label = value >= 1024 ? `${(value / 1024).toFixed(value % 1024 === 0 ? 0 : 1)} GB` : `${value} MB`;

  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
      <button type="button"
        onClick={() => prev !== null && onChange(prev)}
        disabled={prev === null}
        className="px-3 py-2 text-gray-500 hover:bg-gray-100 font-medium text-sm disabled:opacity-30 select-none"
      >−</button>
      <span className="flex-1 text-center text-sm py-2 font-medium">{label}</span>
      <button type="button"
        onClick={() => next !== null && onChange(next)}
        disabled={next === null}
        className="px-3 py-2 text-gray-500 hover:bg-gray-100 font-medium text-sm disabled:opacity-30 select-none"
      >+</button>
    </div>
  );
}

function Field({ icon, label, required, children }: {
  icon: React.ReactNode; label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
        {icon} {label}{required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
