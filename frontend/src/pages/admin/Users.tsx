import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users, UserPlus, Search, Edit2, Trash2, HardDrive,
  ChevronDown, ChevronUp, CheckCircle, XCircle
} from "lucide-react";
import { listUsers, deactivateUser, getAdminStats, type AdminUser } from "../../api/adminApi.ts";
import { useToastStore, useAuthStore } from "../../store/index.ts";
import { formatMailDate } from "../../lib/utils.ts";
import CreateUserModal from "./CreateUserModal.tsx";
import EditUserModal from "./EditUserModal.tsx";

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { addToast } = useToastStore();
  const { email: adminEmail } = useAuthStore();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [sortBy, setSortBy] = useState<"email" | "created">("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: listUsers,
    refetchInterval: 30_000,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: getAdminStats,
    refetchInterval: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (email: string) => deactivateUser(email),
    onSuccess: (_, email) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      addToast(`User ${email} deactivated`, "info");
    },
    onError: (e: Error) => addToast(e.message || "Failed to deactivate user", "error"),
  });

  const filtered = users
    .filter(u => !search || u.email.includes(search.toLowerCase()) || (u.displayName?.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => {
      let v = 0;
      if (sortBy === "email")   v = a.email.localeCompare(b.email);
      if (sortBy === "created") v = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? v : -v;
    });

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
            <h1 className="text-xl font-semibold text-[#202124]">Users</h1>
            <p className="text-sm text-[#5f6368] mt-0.5">Manage email accounts for your domain</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            disabled={stats ? stats.slotsRemaining <= 0 : false}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus size={16} /> New User
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-600 bg-blue-50" },
              { label: "Active Users", value: stats.activeUsers, icon: CheckCircle, color: "text-green-600 bg-green-50" },
              { label: "Slots Remaining", value: stats.slotsRemaining, icon: UserPlus, color: stats.slotsRemaining > 0 ? "text-purple-600 bg-purple-50" : "text-red-600 bg-red-50" },
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
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="relative mb-4 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-full text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">
                  <SortHeader col="email" label="User" />
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">
                  <span className="flex items-center gap-1"><HardDrive size={12} /> Quota</span>
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">
                  <SortHeader col="created" label="Created" />
                </th>
                <th className="text-left px-5 py-3 text-xs font-medium text-[#5f6368] uppercase tracking-wider">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-12 text-[#5f6368] text-sm">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <Users size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-sm text-[#5f6368]">{search ? "No users match your search" : "No users yet — create your first one"}</p>
                  </td>
                </tr>
              )}
              {filtered.map(u => (
                <tr key={u._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-semibold text-sm uppercase">
                        {(u.displayName || u.email)[0]}
                      </div>
                      <div>
                        {u.displayName && <p className="text-sm font-medium text-[#202124]">{u.displayName}</p>}
                        <p className={`text-xs ${u.displayName ? "text-[#5f6368]" : "text-sm font-medium text-[#202124]"}`}>{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#5f6368]">
                    {u.quotaMb >= 1024 ? `${(u.quotaMb / 1024).toFixed(1)} GB` : `${u.quotaMb} MB`}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#5f6368]">{formatMailDate(u.createdAt)}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      u.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.active ? "bg-green-500" : "bg-gray-400"}`} />
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditing(u)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (u.email === adminEmail) { addToast("Cannot deactivate your own account", "error"); return; }
                          if (confirm(`Deactivate user "${u.email}"?`)) deleteMutation.mutate(u.email);
                        }}
                        disabled={u.email === adminEmail}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
      {editing   && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
