'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Users,
  Phone,
  Mail,
  FileText,
} from 'lucide-react'
import { useMailStore } from '@/lib/store'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { Dialog } from '@/components/ui/Dialog'
import { getAvatarColor } from '@/lib/utils'
import type { Contact } from '@/lib/types'

interface ContactForm {
  name: string
  email: string
  phone: string
  notes: string
}

export function ContactsPanel() {
  const { contacts, setContacts, addToast } = useMailStore()
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const form = useForm<ContactForm>()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await api.getContacts()
        setContacts(data)
      } catch {
        addToast({ type: 'error', message: 'Failed to load contacts' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [setContacts, addToast])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const data = await api.getContacts(search || undefined)
        setContacts(data)
      } catch { /* silent */ }
    }, 300)
    return () => clearTimeout(timer)
  }, [search, setContacts])

  const openCreate = () => {
    setEditingContact(null)
    form.reset({ name: '', email: '', phone: '', notes: '' })
    setDialogOpen(true)
  }

  const openEdit = (contact: Contact) => {
    setEditingContact(contact)
    form.reset({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || '',
      notes: contact.notes || '',
    })
    setDialogOpen(true)
  }

  const handleSave = async (data: ContactForm) => {
    setSaving(true)
    try {
      if (editingContact) {
        const updated = await api.updateContact(editingContact.id, data)
        setContacts(contacts.map((c) => (c.id === editingContact.id ? updated : c)))
        addToast({ type: 'success', message: 'Contact updated' })
      } else {
        const created = await api.createContact(data)
        setContacts([...contacts, created])
        addToast({ type: 'success', message: 'Contact created' })
      }
      setDialogOpen(false)
      form.reset()
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save contact',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (contactId: string) => {
    setDeletingId(contactId)
    try {
      await api.deleteContact(contactId)
      setContacts(contacts.filter((c) => c.id !== contactId))
      addToast({ type: 'success', message: 'Contact deleted' })
    } catch {
      addToast({ type: 'error', message: 'Failed to delete contact' })
    } finally {
      setDeletingId(null)
    }
  }

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone || '').includes(q)
    )
  })

  return (
    <div className="h-full overflow-y-auto bg-[#f7f8fc]">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#2d3748]">Contacts</h1>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition-all hover:shadow-md"
            style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#718096]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts…"
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#e8ecf4] rounded-xl text-sm text-[#2d3748] placeholder-[#a0aec0] focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea]"
          />
        </div>

        {/* Contacts table */}
        <div className="bg-white rounded-xl border border-[#e8ecf4] overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#667eea]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-[#f0f4ff] flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-[#667eea]" />
              </div>
              <p className="text-sm font-medium text-[#2d3748] mb-1">
                {search ? 'No contacts found' : 'No contacts yet'}
              </p>
              <p className="text-xs text-[#718096]">
                {search ? `No results for "${search}"` : 'Add your first contact to get started'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f7f8fc] border-b border-[#e8ecf4]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#718096] uppercase tracking-wide">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#718096] uppercase tracking-wide">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#718096] uppercase tracking-wide">Phone</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#718096] uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8ecf4]">
                  {filtered.map((contact) => (
                    <tr key={contact.id} className="hover:bg-[#f7f8fc] transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={contact.name}
                            color={getAvatarColor(contact.email)}
                            size="sm"
                          />
                          <span className="font-medium text-[#2d3748]">{contact.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-[#718096]">
                          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                          <a
                            href={`mailto:${contact.email}`}
                            className="hover:text-[#667eea] transition-colors"
                          >
                            {contact.email}
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {contact.phone ? (
                          <div className="flex items-center gap-1.5 text-[#718096]">
                            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                            {contact.phone}
                          </div>
                        ) : (
                          <span className="text-[#c1c8d4]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(contact)}
                            className="p-1.5 rounded-lg text-[#718096] hover:text-[#667eea] hover:bg-[#f0f4ff] transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit contact"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(contact.id)}
                            disabled={deletingId === contact.id}
                            className="p-1.5 rounded-lg text-[#718096] hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                            title="Delete contact"
                          >
                            {deletingId === contact.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); form.reset() }}
        title={editingContact ? 'Edit Contact' : 'Add Contact'}
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => { setDialogOpen(false); form.reset() }}
              className="px-4 py-2 rounded-lg text-sm text-[#718096] hover:bg-[#f7f8fc] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={form.handleSubmit(handleSave)}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {editingContact ? 'Save Changes' : 'Add Contact'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              {...form.register('name', { required: 'Name is required' })}
              className="w-full px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea]"
              placeholder="Jane Smith"
            />
            {form.formState.errors.name && (
              <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              {...form.register('email', { required: 'Email is required' })}
              type="email"
              className="w-full px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea]"
              placeholder="jane@company.com"
            />
            {form.formState.errors.email && (
              <p className="text-red-500 text-xs mt-1">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
              Phone Number
            </label>
            <input
              {...form.register('phone')}
              type="tel"
              className="w-full px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea]"
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#2d3748] mb-1.5">
              Notes
            </label>
            <textarea
              {...form.register('notes')}
              rows={3}
              className="w-full px-3 py-2 border border-[#e8ecf4] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#667eea]/30 focus:border-[#667eea] resize-none"
              placeholder="Any notes about this contact…"
            />
          </div>
        </div>
      </Dialog>
    </div>
  )
}
