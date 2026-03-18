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

  // derive whether admin email matches domain
  const emailMatchesDomain = form.domain && form.adminEmail
    ? form.adminEmail.endsWith(`@${form.domain}`)
    : true;

  const mutation = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      addToast("Tenant created successfully", "success");
      onClose();
    },
    onError: (e: unknown) => {
      // Extract the actual server error message if available
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.error ?? e.message
        : (e instanceof Error ? e.message : "Failed to create tenant");
      addToast(msg, "error");
    },
  });

  const set = (k: keyof typeof form, v: string | number) =>
    setForm(f => ({ ...f, [k]: v }));

  // Auto-fill adminEmail whenever domain changes
  const handleDomainChange = (val: string) => {
    const d = val.toLowerCase();
    setForm(f => ({
      ...f,
      domain: d,
      // only auto-fill if user hasn't customised it yet (or it still matches old domain)
      adminEmail: !f.adminEmail || f.adminEmail === `admin@${f.domain}`
        ? (d ? `admin@${d}` : "")
        : f.adminEmail,
    }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailMatchesDomain) return;
    mutation.mutate(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
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

        <form onSubmit={submit} className="p-6 space-y-4">
          {/* Company info */}
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
            <Field icon={<Globe size={14} />} label="Domain" required>
              <input
                value={form.domain}
                onChange={e => handleDomainChange(e.target.value)}
                placeholder="acme.com"
                required
                className="field-input"
              />
              <p className="text-xs text-[#5f6368] mt-0.5">
                Use any domain — real or made-up (e.g. <code>acme.local</code>)
              </p>
            </Field>
          </div>

          <hr className="border-gray-100" />

          {/* Admin account */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#5f6368] uppercase tracking-wider">Admin Account</p>

            {/* Login hint */}
            <div className="flex items-start gap-2 bg-blue-50 rounded-xl px-3 py-2.5">
              <Info size={13} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                The admin logs in at <strong>this same URL</strong> using this email + password.
                They'll land on the Users page to manage their company.
              </p>
            </div>

            <Field icon={<Mail size={14} />} label="Admin Email" required>
              <input
                value={form.adminEmail}
                onChange={e => set("adminEmail", e.target.value.toLowerCase())}
                placeholder={`admin@${form.domain || "acme.com"}`}
                required
                type="email"
                className={`field-input ${!emailMatchesDomain ? "border-red-400 ring-1 ring-red-300" : ""}`}
              />
              {!emailMatchesDomain && (
                <p className="text-xs text-red-500 mt-0.5">
                  Must end with <code>@{form.domain}</code>
                </p>
              )}
            </Field>
            <Field icon={<Users size={14} />} label="Display Name">
              <input
                value={form.adminDisplayName}
                onChange={e => set("adminDisplayName", e.target.value)}
                placeholder="Admin User"
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
              <Field icon={<Users size={14} />} label="Max Users" required>
                <input
                  value={form.maxUsers}
                  onChange={e => set("maxUsers", parseInt(e.target.value) || 1)}
                  type="number" min={1} max={10000} required
                  className="field-input"
                />
              </Field>
              <Field icon={<HardDrive size={14} />} label="Storage / User" required>
                <div className="relative">
                  <input
                    value={form.storagePerUserMb}
                    onChange={e => set("storagePerUserMb", parseInt(e.target.value) || 100)}
                    type="number" min={100} max={102400} required
                    className="field-input pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">MB</span>
                </div>
              </Field>
            </div>
            <p className="text-xs text-[#5f6368]">
              Total: {((form.storagePerUserMb * form.maxUsers) / 1024).toFixed(1)} GB allocated
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
            <button
              type="submit"
              disabled={mutation.isPending || !emailMatchesDomain}
              className="btn-primary"
            >
              {mutation.isPending ? "Creating…" : "Create Tenant"}
            </button>
          </div>
        </form>
      </div>
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
