import { useState, useEffect, useRef } from 'react';
import { Note } from '@/hooks/usePublicNotes';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  X, Pencil, Download, ExternalLink, FileIcon, Trash2,
  Music, Video, Link2, FileText, ZoomIn, ZoomOut,
  RotateCw, ChevronLeft, ChevronRight, Check, Maximize2, Copy, Loader2
} from 'lucide-react';
import { format } from 'date-fns';

interface NoteDetailModalProps {
  note: Note;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (id: string, title: string, content: string) => Promise<Note | null>;
  onDelete: (id: string) => Promise<boolean>;
  onDownload: (url: string, filename: string) => void;
}

// Per-type accent palette — matches card accents from dashboard
const TYPE_ACCENT: Record<string, { border: string; glow: string; badge: string; badgeText: string; shimmer: string }> = {
  image:  { border: 'rgba(167,139,250,0.45)', glow: 'rgba(167,139,250,0.12)', badge: 'rgba(167,139,250,0.15)', badgeText: '#c4b5fd', shimmer: '#a78bfa' },
  link:   { border: 'rgba(251,191,36,0.45)',  glow: 'rgba(251,191,36,0.12)',  badge: 'rgba(251,191,36,0.15)',  badgeText: '#fde68a', shimmer: '#fbbf24' },
  file:   { border: 'rgba(96,165,250,0.45)',  glow: 'rgba(96,165,250,0.12)',  badge: 'rgba(96,165,250,0.15)',  badgeText: '#bfdbfe', shimmer: '#60a5fa' },
  pdf:    { border: 'rgba(96,165,250,0.45)',  glow: 'rgba(96,165,250,0.12)',  badge: 'rgba(96,165,250,0.15)',  badgeText: '#bfdbfe', shimmer: '#60a5fa' },
  video:  { border: 'rgba(244,114,182,0.45)', glow: 'rgba(244,114,182,0.12)', badge: 'rgba(244,114,182,0.15)', badgeText: '#fbcfe8', shimmer: '#f472b6' },
  audio:  { border: 'rgba(52,211,153,0.45)',  glow: 'rgba(52,211,153,0.12)',  badge: 'rgba(52,211,153,0.15)',  badgeText: '#a7f3d0', shimmer: '#34d399' },
  text:   { border: 'rgba(255,200,60,0.45)',  glow: 'rgba(255,200,60,0.10)',  badge: 'rgba(255,200,60,0.12)',  badgeText: 'rgba(255,220,80,0.9)', shimmer: 'rgba(255,200,60,0.8)' },
};
function getAccent(type: string) {
  return TYPE_ACCENT[type] ?? TYPE_ACCENT.text;
}

function formatTs(d: string) {
  return format(new Date(d), "d MMM yyyy '·' HH:mm");
}

export function NoteDetailModal({ note, isAdmin, onClose, onSave, onDelete, onDownload }: NoteDetailModalProps) {
  const [isEditing, setIsEditing]     = useState(false);
  const [editTitle, setEditTitle]     = useState(note.title);
  const [editContent, setEditContent] = useState(note.content || '');
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [imgZoom, setImgZoom]         = useState(1);
  const [imgRotate, setImgRotate]     = useState(0);
  const [lightbox, setLightbox]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);
  const [videoLoaded, setVideoLoaded]   = useState(false);
  const [videoError, setVideoError]     = useState(false);
  const [pdfLoaded, setPdfLoaded]       = useState(false);
  const ac = getAccent(note.note_type);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightbox) { setLightbox(false); return; }
        if (isEditing) { setIsEditing(false); return; }
        onClose();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lightbox, isEditing, onClose]);

  // Reset media state when the selected note changes. Without this, opening
  // another video can inherit the previous video's loaded/error state.
  useEffect(() => {
    setVideoLoaded(false);
    setVideoError(false);
  }, [note.id, note.file_url]);

  const handleSave = async () => {
    setSaving(true);
    const updated = await onSave(note.id, editTitle, editContent);
    setSaving(false);
    if (updated) {
      setSaved(true);
      setIsEditing(false);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(true);
  };
  const performDelete = async () => {
    setConfirmDelete(false);
    await onDelete(note.id);
    onClose();
  };

  const handleCopy = async () => {
    if (!note.content) return;
    try {
      await navigator.clipboard.writeText(note.content);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = note.content;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isPdf = note.file_name?.toLowerCase().endsWith('.pdf');
  const isFile = note.note_type === 'file' || note.note_type === 'pdf';

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 z-50 animate-fade-in"
        style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(18px)' }}
        onClick={onClose}
      />

      {/* ── Panel ── */}
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 pointer-events-none"
      >
        <div
          className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden pointer-events-auto animate-scale-in"
          style={{
            background: 'linear-gradient(160deg, rgba(14,14,22,0.98) 0%, rgba(8,8,14,0.99) 100%)',
            border: `1.5px solid ${ac.border}`,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 32px 80px rgba(0,0,0,0.7), 0 0 60px ${ac.glow}`,
          }}
          onClick={e => e.stopPropagation()}
        >

          {/* Top shimmer line */}
          <div className="absolute top-0 left-8 right-8 h-px pointer-events-none"
               style={{ background: `linear-gradient(90deg, transparent, ${ac.shimmer}55, transparent)` }} />

          {/* ── Header ── */}
          <div className="flex items-start gap-3 px-5 sm:px-7 pt-5 pb-4 shrink-0"
               style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

            {/* Type badge + title */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-md"
                  style={{ background: ac.badge, color: ac.badgeText }}
                >
                  {note.note_type}
                </span>
                {saved && (
                  <span className="text-[10px] text-green-400 flex items-center gap-1 animate-fade-in">
                    <Check size={10} /> Saved
                  </span>
                )}
              </div>

              {isEditing ? (
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="text-lg sm:text-xl font-bold bg-white/5 border-white/10 text-white"
                  placeholder="Note title"
                  autoFocus
                />
              ) : (
                <h2 className="text-lg sm:text-xl font-bold text-white leading-snug break-words pr-4">
                  {note.title}
                </h2>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0 mt-1">
              {isAdmin && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                  aria-label="Edit"
                >
                  <Pencil size={14} />
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={handleDelete}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10"
                  style={{
                    color: confirmDelete ? '#f87171' : 'rgba(255,255,255,0.3)',
                    background: confirmDelete ? 'rgba(239,68,68,0.15)' : 'transparent',
                  }}
                  aria-label={confirmDelete ? 'Confirm delete' : 'Delete'}
                  title={confirmDelete ? 'Click again to confirm' : 'Delete note'}
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-white/10 ml-1"
                style={{ color: 'rgba(255,255,255,0.5)' }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 sm:px-7 py-5 space-y-5 min-h-0">

            {/* Text content */}
            {isEditing ? (
              <Textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="min-h-[120px] bg-white/5 border-white/10 text-white resize-y w-full"
                placeholder="Note content..."
              />
            ) : (
              note.content && (
                <div className="relative group/text">
                  <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words pr-9"
                     style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {note.content}
                  </p>
                  {/* Copy button — top-right, always visible on mobile, hover on desktop */}
                  <button
                    onClick={handleCopy}
                    className="absolute top-0 right-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all opacity-100 sm:opacity-0 sm:group-hover/text:opacity-100"
                    style={{
                      background: copied ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${copied ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.09)'}`,
                      color: copied ? '#34d399' : 'rgba(255,255,255,0.38)',
                    }}
                    aria-label={copied ? 'Copied!' : 'Copy to clipboard'}
                    title={copied ? 'Copied!' : 'Copy to clipboard'}
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              )
            )}

            {/* ── IMAGE ── */}
            {note.note_type === 'image' && note.file_url && (
              <div className="space-y-3">
                {/* Image viewer */}
                <div
                  className="relative w-full rounded-2xl overflow-hidden flex items-center justify-center cursor-zoom-in group"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(167,139,250,0.15)',
                    minHeight: '200px',
                    maxHeight: '420px',
                  }}
                  onClick={() => setLightbox(true)}
                >
                  <img
                    src={note.file_url}
                    alt={note.title}
                    style={{
                      transform: `scale(${imgZoom}) rotate(${imgRotate}deg)`,
                      transition: 'transform 0.2s ease',
                      maxWidth: '100%',
                      maxHeight: '420px',
                      objectFit: 'contain',
                    }}
                    draggable={false}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-xl px-3 py-1.5 flex items-center gap-2 text-white text-xs">
                      <Maximize2 size={12} /> Click to expand
                    </div>
                  </div>
                </div>

                {/* Image controls */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl p-1 border border-white/8"
                       style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <button onClick={() => setImgZoom(z => Math.max(0.5, z - 0.25))}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-white/60 hover:text-white">
                      <ZoomOut size={13} />
                    </button>
                    <span className="text-[11px] text-white/40 px-1 min-w-[36px] text-center">
                      {Math.round(imgZoom * 100)}%
                    </span>
                    <button onClick={() => setImgZoom(z => Math.min(3, z + 0.25))}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-white/60 hover:text-white">
                      <ZoomIn size={13} />
                    </button>
                  </div>
                  <button onClick={() => setImgRotate(r => r + 90)}
                          className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors text-white/60 hover:text-white border border-white/8"
                          style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <RotateCw size={13} />
                  </button>
                  <button onClick={() => { setImgZoom(1); setImgRotate(0); }}
                          className="text-[11px] text-white/30 hover:text-white/60 transition-colors px-2">
                    Reset
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => onDownload(note.file_url!, note.file_name || `${note.title}.jpg`)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all hover:bg-white/10 text-white/50 hover:text-white border border-white/8"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <Download size={12} /> Download
                  </button>
                </div>
              </div>
            )}

            {/* ── VIDEO ── */}
            {note.note_type === 'video' && note.file_url && (
              <div className="space-y-3">
                <div className="rounded-2xl overflow-hidden border border-white/8 relative"
                     style={{ background: '#000', minHeight: '200px' }}>
                  {/* Loading spinner — shown until metadata arrives */}
                  {!videoLoaded && !videoError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                      <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(244,114,182,0.7)' }} />
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading video…</span>
                    </div>
                  )}
                  {/* Error fallback */}
                  {videoError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <Video size={28} style={{ color: '#f472b6' }} />
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Preview unavailable</span>
                      <a href={note.file_url} target="_blank" rel="noopener noreferrer"
                         className="text-xs underline" style={{ color: '#f472b6' }}>
                        Open in new tab
                      </a>
                    </div>
                  )}
                  {!videoError && (
                    <video
                      src={note.file_url}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full"
                      style={{ maxHeight: '400px', display: videoLoaded ? 'block' : 'none' }}
                      onLoadedMetadata={() => setVideoLoaded(true)}
                      onError={() => setVideoError(true)}
                    />
                  )}
                </div>
                <DownloadRow url={note.file_url} name={note.file_name || 'video'} onDownload={onDownload} color="#f472b6" />
              </div>
            )}

            {/* ── AUDIO ── */}
            {note.note_type === 'audio' && note.file_url && (
              <div className="space-y-4">
                {/* Waveform visual */}
                <div className="rounded-2xl p-6 flex flex-col items-center gap-4"
                     style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.08),rgba(16,185,129,0.04))', border: '1px solid rgba(52,211,153,0.2)' }}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                       style={{ background: 'linear-gradient(145deg,rgba(52,211,153,0.3),rgba(16,185,129,0.15))', border: '1px solid rgba(52,211,153,0.35)', boxShadow: '0 0 24px rgba(52,211,153,0.2)' }}>
                    <Music size={28} style={{ color: '#34d399' }} />
                  </div>
                  <p className="text-sm text-white/50 truncate max-w-full">{note.file_name || 'Audio file'}</p>
                  <audio src={note.file_url} controls className="w-full" style={{ colorScheme: 'dark' }} />
                </div>
                <DownloadRow url={note.file_url} name={note.file_name || 'audio'} onDownload={onDownload} color="#34d399" />
              </div>
            )}

            {/* ── LINK ── */}
            {note.note_type === 'link' && note.link_url && (
              <div className="space-y-3">
                <a
                  href={note.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 p-4 rounded-2xl transition-all"
                  style={{
                    background: 'rgba(251,191,36,0.05)',
                    border: '1px solid rgba(251,191,36,0.2)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.05)')}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                       style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.25)' }}>
                    <ExternalLink size={14} style={{ color: '#fbbf24' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/30 mb-0.5">External link</p>
                    <p className="text-sm break-all leading-relaxed group-hover:underline" style={{ color: '#fde68a' }}>
                      {note.link_url}
                    </p>
                  </div>
                  <ExternalLink size={12} className="shrink-0 mt-1 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: '#fbbf24' }} />
                </a>
              </div>
            )}

            {/* ── PDF / FILE ── */}
            {isFile && note.file_url && (
              <div className="space-y-4">
                {isPdf ? (
                  <>
                    {/* PDF inline viewer with loading state */}
                    <div className="rounded-2xl overflow-hidden border border-white/10 relative"
                         style={{ background: '#1a1a2e', minHeight: '420px' }}>
                      {!pdfLoaded && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                          <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(96,165,250,0.7)' }} />
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading PDF…</span>
                          <a href={note.file_url} target="_blank" rel="noopener noreferrer"
                             className="text-xs underline mt-1" style={{ color: '#60a5fa' }}>
                            Open in new tab instead
                          </a>
                        </div>
                      )}
                      <iframe
                        src={note.file_url}
                        title={note.file_name || 'PDF'}
                        className="w-full"
                        style={{ height: '420px', border: 'none', display: pdfLoaded ? 'block' : 'none' }}
                        onLoad={() => setPdfLoaded(true)}
                      />
                    </div>
                    <DownloadRow url={note.file_url} name={note.file_name || 'document.pdf'} onDownload={onDownload} color="#60a5fa" />
                  </>
                ) : (
                  /* Generic file */
                  <div className="rounded-2xl p-6 flex items-center gap-4"
                       style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.2)' }}>
                    <div className="w-14 h-16 rounded-xl flex items-center justify-center shrink-0"
                         style={{ background: 'linear-gradient(145deg,rgba(96,165,250,0.25),rgba(59,130,246,0.12))', border: '1px solid rgba(96,165,250,0.3)', boxShadow: '0 4px 16px rgba(96,165,250,0.15)' }}>
                      <FileIcon size={24} style={{ color: '#60a5fa' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/80 truncate">{note.file_name || 'File'}</p>
                      <p className="text-xs text-white/30 mt-0.5">Attached file</p>
                    </div>
                    <button
                      onClick={() => onDownload(note.file_url!, note.file_name || 'file')}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:bg-blue-500/20 text-blue-300 border border-blue-500/20"
                    >
                      <Download size={14} /> Download
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* ── Footer ── */}
          <div className="px-5 sm:px-7 py-4 shrink-0 flex items-center justify-between gap-3"
               style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
              {formatTs(note.created_at)}
              {note.updated_at !== note.created_at && (
                <span className="ml-2 opacity-60">· edited {formatTs(note.updated_at)}</span>
              )}
            </p>

            {isEditing ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsEditing(false); setEditTitle(note.title); setEditContent(note.content || ''); }}
                  className="border-white/10 text-white/60 hover:text-white hover:bg-white/8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-white text-black hover:bg-white/90 text-xs font-semibold"
                >
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Copy button in footer — shown for any note with text content */}
                {note.content && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                    style={{
                      background: copied ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      color: copied ? '#34d399' : 'rgba(255,255,255,0.35)',
                    }}
                    aria-label={copied ? 'Copied!' : 'Copy text'}
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                )}
                {/* Type icon */}
                <div className="w-6 h-6 rounded-md flex items-center justify-center"
                     style={{ background: ac.badge }}>
                  {note.note_type === 'image'  && <ImageIcon size={11} style={{ color: ac.badgeText }} />}
                  {note.note_type === 'link'   && <Link2 size={11}     style={{ color: ac.badgeText }} />}
                  {(note.note_type === 'file' || note.note_type === 'pdf') && <FileText size={11} style={{ color: ac.badgeText }} />}
                  {note.note_type === 'video'  && <Video size={11}     style={{ color: ac.badgeText }} />}
                  {note.note_type === 'audio'  && <Music size={11}     style={{ color: ac.badgeText }} />}
                  {note.note_type === 'text'   && <FileText size={11}  style={{ color: ac.badgeText }} />}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Lightbox (image fullscreen) ── */}
      {lightbox && note.note_type === 'image' && note.file_url && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center animate-fade-in"
          style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(4px)' }}
          onClick={() => setLightbox(false)}
        >
          <img
            src={note.file_url}
            alt={note.title}
            className="max-w-[95vw] max-h-[95vh] object-contain rounded-2xl shadow-2xl"
            draggable={false}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-2xl flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
          >
            <X size={20} />
          </button>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              "{note.title}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={performDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Small reusable download row ──────────────────────────────────────────────
function DownloadRow({ url, name, onDownload, color }: { url: string; name: string; onDownload: (u: string, n: string) => void; color: string }) {
  return (
    <button
      onClick={() => onDownload(url, name)}
      className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
           style={{ background: `${color}22`, border: `1px solid ${color}44` }}>
        <Download size={13} style={{ color }} />
      </div>
      <span className="text-sm text-white/60 flex-1 truncate">{name}</span>
      <Download size={13} style={{ color: `${color}80` }} />
    </button>
  );
}

// mini icon used in footer
function ImageIcon({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21,15 16,10 5,21"/>
    </svg>
  );
}
