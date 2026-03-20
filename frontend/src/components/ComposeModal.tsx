'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from 'react'
import {
  X,
  Maximize2,
  Minimize2,
  Send,
  Save,
  Paperclip,
  Trash2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Outdent,
  Indent,
  Link,
  Loader2,
  XCircle,
} from 'lucide-react'
import { useMailStore } from '@/lib/store'
import { api } from '@/lib/api'
import { isValidEmail } from '@/lib/utils'
import type { Contact } from '@/lib/types'

interface Chip {
  email: string
  valid: boolean
}

function ChipInput({
  chips,
  onChange,
  placeholder,
}: {
  chips: Chip[]
  onChange: (chips: Chip[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Contact[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const suggestRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const addChip = (value: string) => {
    const v = value.trim()
    if (!v) return
    onChange([...chips, { email: v, valid: isValidEmail(v) }])
    setInput('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === ' ') && input.trim()) {
      e.preventDefault()
      addChip(input)
    }
    if (e.key === 'Backspace' && !input && chips.length > 0) {
      onChange(chips.slice(0, -1))
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleInputChange = (v: string) => {
    setInput(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.length > 1) {
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await api.suggestContacts(v)
          setSuggestions(results)
          setShowSuggestions(results.length > 0)
        } catch { /* silent */ }
      }, 250)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  return (
    <div className="relative flex flex-wrap gap-1 items-center min-h-[34px] px-2 py-1">
      {chips.map((chip, i) => (
        <span
          key={i}
          className={`chip ${!chip.valid ? 'bg-red-100 text-red-700' : ''}`}
        >
          {chip.email}
          <button
            type="button"
            onClick={() => onChange(chips.filter((_, idx) => idx !== i))}
            aria-label={`Remove ${chip.email}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) addChip(input)
          setTimeout(() => setShowSuggestions(false), 150)
        }}
        placeholder={chips.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] outline-none text-sm text-[#2d3748] placeholder-[#a0aec0] bg-transparent"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestRef}
          className="absolute left-0 top-full z-50 w-full bg-white border border-[#e8ecf4] rounded-lg shadow-lg overflow-hidden"
        >
          {suggestions.slice(0, 6).map((c) => (
            <button
              key={c.id}
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#f7f8fc] transition-colors"
              onMouseDown={(e) => {
                e.preventDefault()
                addChip(c.email)
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                style={{ backgroundColor: '#667eea' }}
              >
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-medium text-[#2d3748]">{c.name}</p>
                <p className="text-xs text-[#718096]">{c.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ComposeModal() {
  const { composeData, closeCompose, addToast, user } = useMailStore()

  const [expanded, setExpanded] = useState(false)
  const [toChips, setToChips] = useState<Chip[]>(() =>
    (composeData?.to || []).map((e) => ({ email: e, valid: isValidEmail(e) }))
  )
  const [ccChips, setCcChips] = useState<Chip[]>([])
  const [bccChips, setBccChips] = useState<Chip[]>([])
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [subject, setSubject] = useState(composeData?.subject || '')
  const [attachments, setAttachments] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [showLinkDialog, setShowLinkDialog] = useState(false)

  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Populate body for reply/forward
  useEffect(() => {
    if (editorRef.current && composeData?.body) {
      editorRef.current.innerHTML = composeData.body
    } else if (editorRef.current && user?.signature) {
      editorRef.current.innerHTML = `<p></p><p></p><p>--</p>${user.signature}`
    }
  }, [composeData?.body, user?.signature])

  const execFormat = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
  }

  const insertLink = () => {
    if (!linkUrl.trim()) return
    execFormat('createLink', linkUrl)
    setLinkUrl('')
    setShowLinkDialog(false)
  }

  const getHtmlBody = () => editorRef.current?.innerHTML || ''
  const getTextBody = () => editorRef.current?.innerText || ''

  const handleSend = async () => {
    const to = toChips.map((c) => c.email).filter(Boolean)
    if (to.length === 0) {
      addToast({ type: 'error', message: 'Please add at least one recipient' })
      return
    }
    if (toChips.some((c) => !c.valid)) {
      addToast({ type: 'error', message: 'Some email addresses are invalid' })
      return
    }

    setSending(true)
    try {
      await api.sendEmail({
        to,
        cc: ccChips.map((c) => c.email),
        bcc: bccChips.map((c) => c.email),
        subject,
        body_html: getHtmlBody(),
        body_text: getTextBody(),
        reply_to: composeData?.replyTo,
        draft_id: composeData?.draftId,
        attachments,
      })
      addToast({ type: 'success', message: 'Email sent successfully' })
      closeCompose()
    } catch (err) {
      addToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send email',
      })
    } finally {
      setSending(false)
    }
  }

  const handleSaveDraft = async () => {
    setSavingDraft(true)
    try {
      await api.saveDraft({
        to: toChips.map((c) => c.email),
        cc: ccChips.map((c) => c.email),
        bcc: bccChips.map((c) => c.email),
        subject,
        body_html: getHtmlBody(),
        body_text: getTextBody(),
        draft_id: composeData?.draftId,
      })
      addToast({ type: 'success', message: 'Draft saved' })
    } catch {
      addToast({ type: 'error', message: 'Failed to save draft' })
    } finally {
      setSavingDraft(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachments((prev) => [...prev, ...files])
    e.target.value = ''
  }

  const removeAttachment = (i: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i))
  }

  const title =
    composeData?.mode === 'reply'
      ? 'Reply'
      : composeData?.mode === 'reply-all'
      ? 'Reply All'
      : composeData?.mode === 'forward'
      ? 'Forward'
      : 'New Message'

  return (
    <>
      {/* Overlay for expanded mode */}
      {expanded && (
        <div
          className="fixed inset-0 bg-black/20 z-[999]"
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        className={`compose-modal ${
          expanded
            ? 'fixed inset-4 right-4 left-4 max-w-none max-h-none rounded-xl z-[1000]'
            : ''
        }`}
        style={expanded ? { width: 'auto', maxWidth: 'none' } : {}}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-t-xl cursor-default select-none flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
        >
          <h3 className="text-white text-sm font-semibold">{title}</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              title={expanded ? 'Minimize' : 'Expand'}
            >
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={closeCompose}
              className="p-1.5 rounded text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Fields */}
        <div className="flex flex-col overflow-hidden flex-1">
          {/* To */}
          <div className="border-b border-[#e8ecf4] flex items-start">
            <span className="text-xs font-semibold text-[#718096] px-3 py-2.5 flex-shrink-0 w-10">
              To
            </span>
            <div className="flex-1">
              <ChipInput chips={toChips} onChange={setToChips} placeholder="Recipients…" />
            </div>
            <button
              type="button"
              onClick={() => setShowCcBcc(!showCcBcc)}
              className="text-xs text-[#667eea] px-3 py-2.5 hover:underline flex-shrink-0"
            >
              Cc/Bcc
            </button>
          </div>

          {/* CC/BCC */}
          {showCcBcc && (
            <>
              <div className="border-b border-[#e8ecf4] flex items-start">
                <span className="text-xs font-semibold text-[#718096] px-3 py-2.5 flex-shrink-0 w-10">
                  Cc
                </span>
                <div className="flex-1">
                  <ChipInput chips={ccChips} onChange={setCcChips} placeholder="CC…" />
                </div>
              </div>
              <div className="border-b border-[#e8ecf4] flex items-start">
                <span className="text-xs font-semibold text-[#718096] px-3 py-2.5 flex-shrink-0 w-10">
                  Bcc
                </span>
                <div className="flex-1">
                  <ChipInput chips={bccChips} onChange={setBccChips} placeholder="BCC…" />
                </div>
              </div>
            </>
          )}

          {/* Subject */}
          <div className="border-b border-[#e8ecf4] flex items-center">
            <span className="text-xs font-semibold text-[#718096] px-3 w-16 flex-shrink-0">
              Subject
            </span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject…"
              className="flex-1 px-2 py-2.5 text-sm text-[#2d3748] outline-none placeholder-[#a0aec0] bg-transparent"
            />
          </div>

          {/* Formatting toolbar */}
          <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#e8ecf4] flex-wrap flex-shrink-0">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execFormat('bold') }}
              className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors"
              title="Bold (Ctrl+B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execFormat('italic') }}
              className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors"
              title="Italic (Ctrl+I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execFormat('underline') }}
              className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors"
              title="Underline (Ctrl+U)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execFormat('strikeThrough') }}
              className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors"
              title="Strikethrough"
            >
              <Strikethrough className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-[#e8ecf4] mx-0.5" />

            <select
              onChange={(e) => {
                if (e.target.value === 'p') {
                  execFormat('formatBlock', 'p')
                } else {
                  execFormat('formatBlock', e.target.value)
                }
              }}
              defaultValue="p"
              className="text-xs text-[#718096] border-none outline-none bg-transparent px-1 py-1 rounded hover:bg-[#f7f8fc] cursor-pointer"
            >
              <option value="p">Normal</option>
              <option value="h1">Heading 1</option>
              <option value="h2">Heading 2</option>
              <option value="h3">Heading 3</option>
            </select>

            <div className="w-px h-4 bg-[#e8ecf4] mx-0.5" />

            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execFormat('insertUnorderedList') }}
              className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors"
              title="Bullet list"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execFormat('insertOrderedList') }}
              className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors"
              title="Numbered list"
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execFormat('outdent') }}
              className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors"
              title="Outdent"
            >
              <Outdent className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execFormat('indent') }}
              className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors"
              title="Indent"
            >
              <Indent className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-[#e8ecf4] mx-0.5" />

            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setShowLinkDialog(!showLinkDialog) }}
                className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors"
                title="Insert link"
              >
                <Link className="w-3.5 h-3.5" />
              </button>
              {showLinkDialog && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-[#e8ecf4] rounded-lg shadow-lg p-2 flex gap-1.5 w-56">
                  <input
                    autoFocus
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') insertLink() }}
                    placeholder="https://…"
                    className="flex-1 text-xs border border-[#e8ecf4] rounded px-2 py-1 outline-none focus:border-[#667eea]"
                  />
                  <button
                    type="button"
                    onClick={insertLink}
                    className="px-2 py-1 bg-[#667eea] text-white text-xs rounded"
                  >
                    OK
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <input
                type="color"
                onChange={(e) => execFormat('foreColor', e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-[#e8ecf4] p-0.5"
                title="Text color"
              />
            </div>

            <div className="w-px h-4 bg-[#e8ecf4] mx-0.5" />

            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execFormat('undo') }}
              className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors text-xs font-mono"
              title="Undo (Ctrl+Z)"
            >
              ↩
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execFormat('redo') }}
              className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors text-xs font-mono"
              title="Redo (Ctrl+Y)"
            >
              ↪
            </button>
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); execFormat('removeFormat') }}
              className="p-1.5 rounded hover:bg-[#f7f8fc] text-[#718096] hover:text-[#2d3748] transition-colors"
              title="Clear formatting"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Editor */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Write your message…"
            className="rich-editor flex-1 overflow-y-auto min-h-[140px]"
            style={{ maxHeight: expanded ? '60vh' : 200 }}
          />

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 py-2 border-t border-[#e8ecf4] flex-shrink-0">
              {attachments.map((file, i) => (
                <div key={i} className="attachment-chip">
                  <Paperclip className="w-3 h-3 text-[#718096]" />
                  <span className="text-xs text-[#2d3748] max-w-[100px] truncate">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="text-[#718096] hover:text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[#e8ecf4] flex-shrink-0">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 transition-all hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[#718096] hover:bg-[#f7f8fc] hover:text-[#2d3748] transition-colors"
            >
              {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Draft
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-[#718096] hover:bg-[#f7f8fc] hover:text-[#2d3748] transition-colors"
              title="Attach files"
            >
              <Paperclip className="w-4 h-4" />
              Attach
            </button>

            <div className="flex-1" />

            <button
              type="button"
              onClick={closeCompose}
              className="p-2 rounded-lg text-[#718096] hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Discard draft"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
