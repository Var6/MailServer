import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Users, HardDrive, Plus, ToggleLeft, ToggleRight,
  Edit2, Trash2, Search, ChevronDown, ChevronUp, AlertTriangle
} from "lucide-react";
import { listTenants, updateTenant, deleteTenant, createTenant, type Tenant } from "../../api/superadminApi.ts";
import { useToastStore } from "../../store/index.ts";
import { formatMailDate } from "../../lib/utils.ts";
import CreateTenantModal from "./CreateTenantModal.tsx";
import EditTenantModal from "./EditTenantModal.tsx";

export default function TenantsPage() {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "users" | "created">("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["tenants"],
    queryFn: listTenants,
    refetchInterval: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: (t: Tenant) => updateTenant(t.domain, { active: !t.active }),
    onSuccess: (_, t) => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      addToast(`Tenant ${t.active ? "deactivated" : "activated"}`, t.active ? "info" : "success");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (domain: string) => deleteTenant(domain),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenants"] });
      addToast("Tenant deactivated", "info");
    },
  });

  const filtered = tenants
    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.domain.includes(search))
    .sort((a, b) => {
      let v = 0;
      if (sortBy === "name")    v = a.name.localeCompare(b.name);
      if (sortBy === "users")   v = a.currentUsers - b.currentUsers;
      if (sortBy === "created") v = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? v : -v;
    });

  const totalUsers   = tenants.reduce((s, t) => s + t.currentUsers, 0);
  const activeTenants = tenants.filter(t => t.active).length;

  const SortHeader = ({ col, label }: { col: typeof sortBy; label: string }) => (
    <button
      onClick={() => { if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortBy(col); setSortDir("asc"); } }}
      className="flex items-center gap-1 hover:text-[#202124]"
    >
      {label}
      {sortBy === col ? (sortDir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />) : null}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-[#f6f8fc]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-[#202124]">Tenants</h1>
            <p className="text-sm text-[#5f6368] mt-0.5">Manage companies and their email domains</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Tenant
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Tenants",  value: tenants.length,  icon: Building2, color: "text-blue-600 bg-blue-50" },
            { label: "Active Tenants", value: activeTenants,   icon: ToggleRight, color: "text-green-600 bg-green-50" },
            { label: "Total Users",    value: totalUsers,       icon: Users, color: "text-purple-600 bg-purple-50" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
                <Icon size={18} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-[#202124]">{value}</p>
                <p className="text-xs text-[#5f6368]">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-auto p-6">
        {/* Search */}
        <div className="relative mb-4 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tenants..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-full text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">
                  <SortHeader col="name" label="Company" />
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">Domain</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">Admin</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">
                  <SortHeader col="users" label="Users" />
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">Storage</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">
                  <SortHeader col="created" label="Created" />
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-12 text-[#5f6368] text-sm">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-[#5f6368]">{search ? "No tenants match your search" : "No tenants yet — create your first one"}</p>
                  </td>
                </tr>
              )}
              {filtered.map(t => (
                <TenantRow
                  key={t._id}
                  tenant={t}
                  onToggle={() => toggleMutation.mutate(t)}
                  onEdit={() => setEditing(t)}
                  onDelete={() => {
                    if (confirm(`Deactivate tenant "${t.name}" and all its users?`)) deleteMutation.mutate(t.domain);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} />}
      {editing   && <EditTenantModal tenant={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TenantRow({ tenant: t, onToggle, onEdit, onDelete }: {
  tenant: Tenant;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const usagePct = Math.min(100, Math.round((t.currentUsers / t.maxUsers) * 100));
  const overLimit = t.currentUsers >= t.maxUsers;

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
      <td className="px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-semibold text-sm uppercase">
            {t.name[0]}
          </div>
          <span className="font-medium text-[#202124] text-sm">{t.name}</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-[#5f6368]">{t.domain}</code>
      </td>
      <td className="px-5 py-4 text-sm text-[#5f6368]">{t.adminEmail}</td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-[80px] bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${overLimit ? "bg-red-500" : "bg-blue-500"}`}
              style={{ width: `${usagePct}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${overLimit ? "text-red-600" : "text-[#5f6368]"}`}>
            {t.currentUsers}/{t.maxUsers}
          </span>
          {overLimit && <AlertTriangle size={12} className="text-red-500" />}
        </div>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-1 text-xs text-[#5f6368]">
          <HardDrive size={12} />
          {t.storagePerUserMb >= 1024 ? `${(t.storagePerUserMb/1024).toFixed(1)} GB` : `${t.storagePerUserMb} MB`}/user
        </div>
      </td>
      <td className="px-5 py-4 text-xs text-[#5f6368]">{formatMailDate(t.createdAt)}</td>
      <td className="px-5 py-4">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
          ${t.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${t.active ? "bg-green-500" : "bg-gray-400"}`} />
          {t.active ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-1">
          <button onClick={onEdit}   className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={14} /></button>
          <button onClick={onToggle} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-orange-500 transition-colors">
            {t.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          </button>
          <button onClick={onDelete} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
        </div>
      </td>
    </tr>
  );
}
