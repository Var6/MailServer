'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  Users,
  ShieldCheck,
  HardDrive,
  Mail,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  X,
  Check,
  TrendingUp,
} from 'lucide-react'
import { useMailStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { formatBytes, formatDate, getAvatarColor } from '@/lib/utils'
import type { User, ServerStats } from '@/lib/types'

interface CreateUserForm {
  display_name: string
  email: string
  password: string
  is_admin: boolean
}

interface StatsCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color: string
}

function StatsCard({ label, value, icon, color }: StatsCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#e8ecf4] p-5 flex items-center gap-4">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold text-[#2d3748]">{value}</p>
        <p className="text-sm text-[#718096]">{label}</p>
      </div>
    </div>
  )
}

export function AdminPanel() {
  const { addToast } = useMailStore()

  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<ServerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const createForm = useForm<CreateUserForm>({
    defaultValues: { is_admin: false },
  })

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [usersData, statsData] = await Promise.all([
          api.getAdminUsers(),
          api.getServerStats(),
        ])
        setUsers(usersData)
        setStats(statsData)
      } catch {
        addToast({ type: 'error', message: 'Failed to load admin data' })
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [addToast])

  const handleCreateUser = async (data: CreateUserForm) => {
    setCreating(true)
    try {
      const newUser = await api.createAdminUser(data)
      setUsers([...users, newUser])
      setCreateDialogOpen(false)
      createForm.reset()
      addToast({ type: 'success', message: 'User created successfully' })
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to create user',
      })
    } finally {
      setCreating(false)
    }
  }

  const handleToggleAdmin = async (user: User) => {
    try {
      const updated = await api.updateAdminUser(user.id, {
        is_admin: !user.is_admin,
      })
      setUsers(users.map((u) => (u.id === user.id ? updated : u)))
      addToast({ type: 'success', message: `User ${updated.is_admin ? 'promoted to' : 'removed from'} admin` })
    } catch {
      addToast({ type: 'error', message: 'Failed to update user' })
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      const updated = await api.updateAdminUser(user.id, {
        is_active: !user.is_active,
      })
      setUsers(users.map((u) => (u.id === user.id ? updated : u)))
      addToast({ type: 'success', message: `User ${updated.is_active ? 'activated' : 'deactivated'}` })
    } catch {
      addToast({ type: 'error', message: 'Failed to update user' })
    }
  }

  const handleDeleteUser = async (userId: string) => {
    setDeletingId(userId)
    try {
      await api.deleteAdminUser(userId)
      setUsers(users.filter((u) => u.id !== userId))
      addToast({ type: 'success', message: 'User deleted' })
    } catch {
      addToast({ type: 'error', message: 'Failed to delete user' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f7f8fc]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[#2d3748]">Admin Panel</h1>
          <button
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-[#e8ecf4] p-5 h-24 skeleton" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatsCard
              label="Total Users"
              value={stats.total_users}
              icon={<Users className="w-6 h-6" />}
              color="#667eea"
            />
            <StatsCard
              label="Active Users"
              value={stats.active_users}
              icon={<Check className="w-6 h-6" />}
              color="#48bb78"
            />
            <StatsCard
              label="Total Emails"
              value={stats.total_emails.toLocaleString()}
              icon={<Mail className="w-6 h-6" />}
              color="#764ba2"
            />
            <StatsCard
              label="Total Storage"
              value={formatBytes(stats.total_storage_bytes)}
              icon={<HardDrive className="w-6 h-6" />}
              color="#ed8936"
            />
          </div>
        ) : null}

        {/* Users table */}
        <div className="bg-white rounded-xl border border-[#e8ecf4] overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#e8ecf4]">
            <Users className="w-5 h-5 text-[#667eea]" />
            <h2 className="text-base font-semibold text-[#2d3748]">Users</h2>
            <span className="text-sm text-[#718096]">({users.length})</span>
          </div>

          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[#667eea]" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f7f8fc] border-b border-[#e8ecf4]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#718096] uppercase tracking-wide">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#718096] uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#718096] uppercase tracking-wide">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#718096] uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#718096] uppercase tracking-wide">Storage</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#718096] uppercase tracking-wide">Last Login</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#718096] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8ecf4]">
                  {users.map((user) => {
                    const usedPct = Math.round((user.used_bytes / Math.max(user.quota_bytes, 1)) * 100)
                    const storageColor = usedPct >= 90 ? '#fc8181' : usedPct >= 80 ? '#ed8936' : '#48bb78'
                    return (
                      <tr key={user.id} className="hover:bg-[#f7f8fc] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar
                              name={user.display_name || user.email}
                              color={user.avatar_color || getAvatarColor(user.email)}
                              size="sm"
                            />
                            <span className="font-medium text-[#2d3748]">
                              {user.display_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#718096]">{user.email}</td>
                        <td className="px-4 py-3">
                          <Badge
                            label={user.is_admin ? 'Admin' : 'User'}
                            variant={user.is_admin ? 'admin' : 'muted'}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                              user.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                user.is_active ? 'bg-green-500' : 'bg-red-400'
                              }`}
                            />
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 min-w-[100px]">
                            <span className="text-xs text-[#718096]">
                              {formatBytes(user.used_bytes)} / {formatBytes(user.quota_bytes)}
                            </span>
                            <div className="h-1.5 bg-[#e8ecf4] rounded-full overflow-hidden w-24">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.min(usedPct, 100)}%`,
                                  backgroundColor: storageColor,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#718096]">
                          {user.last_login ? formatDate(user.last_login) : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleToggleAdmin(user)}
                              className="p-1.5 rounded-lg text-[#718096] hover:text-[#667eea] hover:bg-[#f0f4ff] transition-colors"
                              title={user.is_admin ? 'Remove admin' : 'Make admin'}
                            >
                              <ShieldCheck className={`w-4 h-4 ${user.is_admin ? 'text-[#667eea]' : ''}`} />
                            </button>
                            <button
                              onClick={() => handleToggleActive(user)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                user.is_active
                                  ? 'text-[#718096] hover:text-red-500 hover:bg-red-50'
                                  : 'text-green-500 hover:text-green-600 hover:bg-green-50'
                              }`}
                              title={user.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {user.is_active ? (
                                <X className="w-4 h-4" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={deletingId === user.id}
                              className="p-1.5 rounded-lg text-[#718096] hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                              title="Delete user"
                            >
                              {deletingId === user.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {users.length === 0 && !loading && (
                <div className="py-12 text-center text-sm text-[#718096]">
                  No users found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => { setCreateDialogOpen(false); createForm.reset() }}
        title="Add New User"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => { setCreateDialogOpen(false); createForm.reset() }}
              className="px-4 py-2 rounded-lg text-sm text-[#718096] hover:bg-[#f7f8fc] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={createForm.handleSubmit(handleCreateUser)}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create User
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
              Display Name
            </label>
            <input
              {...createForm.register('display_name', { required: 'Name is required' })}
              className="w-full px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea]"
              placeholder="John Doe"
            />
            {createForm.formState.errors.display_name && (
              <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.display_name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
              Email Address
            </label>
            <input
              {...createForm.register('email', { required: 'Email is required' })}
              type="email"
              className="w-full px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea]"
              placeholder="john@company.com"
            />
            {createForm.formState.errors.email && (
              <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
              Password
            </label>
            <input
              {...createForm.register('password', { required: 'Password is required', minLength: { value: 6, message: 'Minimum 6 characters' } })}
              type="password"
              className="w-full px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea]"
              placeholder="••••••••"
            />
            {createForm.formState.errors.password && (
              <p className="text-red-500 text-xs mt-1">{createForm.formState.errors.password.message}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              {...createForm.register('is_admin')}
              type="checkbox"
              id="is_admin"
              className="w-4 h-4 rounded border-[#e8ecf4] text-[#667eea] focus:ring-[#667eea]"
            />
            <label htmlFor="is_admin" className="text-sm text-[#2d3748] cursor-pointer">
              Grant admin privileges
            </label>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
