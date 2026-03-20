'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  User,
  Lock,
  Tag,
  Save,
  Loader2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useMailStore } from '@/lib/store'
import { api } from '@/lib/api'
import type { Label } from '@/lib/types'

interface ProfileForm {
  display_name: string
  signature: string
}

interface PasswordForm {
  current_password: string
  new_password: string
  confirm_password: string
}

export function SettingsPanel() {
  const { user, setUser, labels, setLabels, addToast } = useMailStore()

  const [profileSaving, setProfileSaving] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [showCurrentPwd, setShowCurrentPwd] = useState(false)
  const [showNewPwd, setShowNewPwd] = useState(false)

  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#667eea')
  const [addingLabel, setAddingLabel] = useState(false)

  const profileForm = useForm<ProfileForm>({
    defaultValues: {
      display_name: user?.display_name || '',
      signature: user?.signature || '',
    },
  })

  const passwordForm = useForm<PasswordForm>()

  useEffect(() => {
    if (user) {
      profileForm.reset({
        display_name: user.display_name,
        signature: user.signature,
      })
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveProfile = async (data: ProfileForm) => {
    setProfileSaving(true)
    try {
      const updated = await api.updateProfile(data)
      setUser(updated)
      addToast({ type: 'success', message: 'Profile updated successfully' })
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update profile',
      })
    } finally {
      setProfileSaving(false)
    }
  }

  const handleUpdatePassword = async (data: PasswordForm) => {
    if (data.new_password !== data.confirm_password) {
      addToast({ type: 'error', message: 'New passwords do not match' })
      return
    }
    if (data.new_password.length < 6) {
      addToast({ type: 'error', message: 'Password must be at least 6 characters' })
      return
    }
    setPwdSaving(true)
    try {
      await api.updatePassword(data.current_password, data.new_password)
      addToast({ type: 'success', message: 'Password updated successfully' })
      passwordForm.reset()
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update password',
      })
    } finally {
      setPwdSaving(false)
    }
  }

  const handleAddLabel = async () => {
    if (!newLabelName.trim()) return
    setAddingLabel(true)
    try {
      const label = await api.createLabel(newLabelName.trim(), newLabelColor)
      setLabels([...labels, label])
      setNewLabelName('')
      addToast({ type: 'success', message: 'Label created' })
    } catch {
      addToast({ type: 'error', message: 'Failed to create label' })
    } finally {
      setAddingLabel(false)
    }
  }

  const handleDeleteLabel = async (label: Label) => {
    try {
      await api.deleteLabel(label.id)
      setLabels(labels.filter((l) => l.id !== label.id))
      addToast({ type: 'success', message: 'Label deleted' })
    } catch {
      addToast({ type: 'error', message: 'Failed to delete label' })
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f7f8fc]">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-[#2d3748] mb-8">Settings</h1>

        {/* Profile section */}
        <div className="bg-white rounded-xl border border-[#e8ecf4] overflow-hidden mb-6">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#e8ecf4]">
            <User className="w-5 h-5 text-[#667eea]" />
            <h2 className="text-base font-semibold text-[#2d3748]">Profile</h2>
          </div>
          <form
            onSubmit={profileForm.handleSubmit(handleSaveProfile)}
            className="px-5 py-5 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
                Display Name
              </label>
              <input
                {...profileForm.register('display_name', { required: 'Name is required' })}
                className="w-full px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm text-[#2d3748] focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea] transition-colors"
              />
              {profileForm.formState.errors.display_name && (
                <p className="text-red-500 text-xs mt-1">
                  {profileForm.formState.errors.display_name.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
                Email Address
              </label>
              <input
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm text-[#718096] bg-[#f7f8fc] cursor-not-allowed"
              />
              <p className="text-xs text-[#718096] mt-1">
                Email cannot be changed. Contact your administrator.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
                Email Signature
              </label>
              <textarea
                {...profileForm.register('signature')}
                rows={4}
                placeholder="Your signature…"
                className="w-full px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm text-[#2d3748] focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea] transition-colors resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={profileSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-all hover:shadow-md"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
              >
                {profileSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Profile
              </button>
            </div>
          </form>
        </div>

        {/* Password section */}
        <div className="bg-white rounded-xl border border-[#e8ecf4] overflow-hidden mb-6">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#e8ecf4]">
            <Lock className="w-5 h-5 text-[#667eea]" />
            <h2 className="text-base font-semibold text-[#2d3748]">Change Password</h2>
          </div>
          <form
            onSubmit={passwordForm.handleSubmit(handleUpdatePassword)}
            className="px-5 py-5 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
                Current Password
              </label>
              <div className="relative">
                <input
                  {...passwordForm.register('current_password', { required: 'Required' })}
                  type={showCurrentPwd ? 'text' : 'password'}
                  className="w-full px-3 py-2 pr-10 border border-[#e8ecf4] rounded-lg text-sm text-[#2d3748] focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096] hover:text-[#2d3748]"
                >
                  {showCurrentPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  {...passwordForm.register('new_password', { required: 'Required', minLength: { value: 6, message: 'Minimum 6 characters' } })}
                  type={showNewPwd ? 'text' : 'password'}
                  className="w-full px-3 py-2 pr-10 border border-[#e8ecf4] rounded-lg text-sm text-[#2d3748] focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPwd(!showNewPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718096] hover:text-[#2d3748]"
                >
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.new_password && (
                <p className="text-red-500 text-xs mt-1">
                  {passwordForm.formState.errors.new_password.message}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
                Confirm New Password
              </label>
              <input
                {...passwordForm.register('confirm_password', { required: 'Required' })}
                type="password"
                className="w-full px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm text-[#2d3748] focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea]"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={pwdSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-all hover:shadow-md"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
              >
                {pwdSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                Update Password
              </button>
            </div>
          </form>
        </div>

        {/* Labels section */}
        <div className="bg-white rounded-xl border border-[#e8ecf4] overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#e8ecf4]">
            <Tag className="w-5 h-5 text-[#667eea]" />
            <h2 className="text-base font-semibold text-[#2d3748]">Labels</h2>
          </div>
          <div className="px-5 py-4">
            {labels.length === 0 ? (
              <p className="text-sm text-[#718096] mb-4">No labels yet.</p>
            ) : (
              <div className="space-y-2 mb-5">
                {labels.map((label) => (
                  <div
                    key={label.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#f7f8fc] transition-colors"
                  >
                    <span
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="text-sm text-[#2d3748] flex-1">{label.name}</span>
                    <button
                      onClick={() => handleDeleteLabel(label)}
                      className="p-1.5 rounded-lg text-[#718096] hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete label"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new label */}
            <div className="flex items-center gap-2 pt-2 border-t border-[#e8ecf4]">
              <input
                type="color"
                value={newLabelColor}
                onChange={(e) => setNewLabelColor(e.target.value)}
                className="w-8 h-8 rounded-lg cursor-pointer border border-[#e8ecf4] p-0.5"
                title="Label color"
              />
              <input
                type="text"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddLabel() }}
                placeholder="New label name…"
                className="flex-1 px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm text-[#2d3748] focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea]"
              />
              <button
                onClick={handleAddLabel}
                disabled={addingLabel || !newLabelName.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60 transition-colors"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
              >
                {addingLabel ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
