import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePublicNotes, Note, NoteType } from '@/hooks/usePublicNotes';
import { useFolders } from '@/hooks/useFolders';
import { MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } from '@/lib/telegram';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NoteFormPanel } from '@/components/NoteFormPanel';
import { PdfThumbnail } from '@/components/PdfThumbnail';
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  FileText,
  Trash2,
  Loader2,
  ExternalLink,
  Download,
  Pencil,
  X,
  FileIcon,
  Plus,
  HardDrive,
  Image as ImageIcon,
  Link as LinkIcon,
  File,
  Music,
  Video,
  Type,
  Copy,
  Check as CheckIcon,
  Home as HomeIcon,
  Folder as FolderIcon,
  FolderPlus,
} from 'lucide-react';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AdminLoginModal } from '@/components/AdminLoginModal';
import { NoteDetailModal } from '@/components/NoteDetailModal.tsx';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const NOTE_BORDER_COLOR = 'rgba(255, 200, 60, 0.35)';
const NOTE_GLOW_COLOR   = 'rgba(255, 200, 60, 0.10)';

/* ─────────────────────────────────────────────────────────────
   Storage Popup
───────────────────────────────────────────────────────────── */
interface StorageCat { count: number; mb: number }
interface StorageData {
  cats: { photos: StorageCat; docs: StorageCat; videos: StorageCat; audio: StorageCat; links: StorageCat; text: StorageCat };
  totalMB: number;
  limitMB: number;
  pct: number;
}

function fmtSize(mb: number) {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  if (mb >= 1)    return `${mb.toFixed(1)} MB`;
  return `${(mb * 1024).toFixed(0)} KB`;
}

const CATS_META = [
  { key: 'photos', label: 'Photos',      Icon: ImageIcon, color: '#a78bfa', glow: 'rgba(167,139,250,0.35)', bg: 'rgba(167,139,250,0.12)' },
  { key: 'docs',   label: 'Docs & PDFs', Icon: FileText,  color: '#60a5fa', glow: 'rgba(96,165,250,0.35)',  bg: 'rgba(96,165,250,0.12)'  },
  { key: 'videos', label: 'Videos',      Icon: Video,     color: '#f472b6', glow: 'rgba(244,114,182,0.35)', bg: 'rgba(244,114,182,0.12)' },
  { key: 'audio',  label: 'Audio',       Icon: Music,     color: '#34d399', glow: 'rgba(52,211,153,0.35)',  bg: 'rgba(52,211,153,0.12)'  },
  { key: 'links',  label: 'Links',       Icon: LinkIcon,  color: '#fbbf24', glow: 'rgba(251,191,36,0.35)',  bg: 'rgba(251,191,36,0.12)'  },
  { key: 'text',   label: 'Text Notes',  Icon: Type,      color: '#94a3b8', glow: 'rgba(148,163,184,0.35)', bg: 'rgba(148,163,184,0.12)' },
] as const;

function StoragePopup({ data, onClose, alignRight }: { data: StorageData; onClose: () => void; alignRight: boolean }) {
  const { cats, totalMB } = data;
  const totalNotes = Object.values(cats).reduce((s, c) => s + c.count, 0);

  return (
    <>
      <div className="fixed inset-0 z-[55]" onClick={onClose} />
      <div
        className={`fixed z-[60] w-[290px] rounded-2xl overflow-hidden`}
        style={{
          top: '72px',
          right: alignRight ? '16px' : 'auto',
          left:  alignRight ? 'auto' : '16px',
          background: 'rgba(10,10,16,0.94)',
          backdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.07)',
          animation: 'spopIn 0.22s cubic-bezier(0.34,1.56,0.64,1) both',
          transformOrigin: alignRight ? 'top right' : 'top left',
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`
          @keyframes spopIn { from{opacity:0;transform:scale(0.82) translateY(-8px)} to{opacity:1;transform:scale(1) translateY(0)} }
          @keyframes bGrow  { from{width:0} }
          @keyframes fadeUp { from{opacity:0;transform:translateY(7px)} to{opacity:1;transform:translateY(0)} }
        `}</style>

        {/* Header */}
        <div className="px-4 pt-4 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <HardDrive size={13} style={{ color: 'rgba(255,255,255,0.55)' }} />
              </div>
              <span className="text-[13px] font-semibold tracking-tight" style={{ color: 'rgba(255,255,255,0.88)' }}>Storage</span>
            </div>
            <div className="text-right">
              <div className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>~{fmtSize(totalMB)}</div>
              <div className="text-[9px]" style={{ color: 'rgba(52,211,153,0.8)' }}>Unlimited</div>
            </div>
          </div>

          {/* Relative distribution bar */}
          <div className="relative h-2.5 w-full rounded-full overflow-hidden flex gap-px" style={{ background: 'rgba(255,255,255,0.08)' }}>
            {totalMB > 0 && (['photos','videos','docs','audio'] as const).map((k, i) => {
              const colors = ['#a78bfa','#f472b6','#60a5fa','#34d399'];
              const mb  = (cats as any)[k]?.mb ?? 0;
              const w   = mb > 0 ? Math.max((mb / totalMB) * 100, 2) : 0;
              return w > 0 ? (
                <div key={k} style={{ height: '100%', width: `${w}%`, background: colors[i], borderRadius: '9999px', animation: 'bGrow 0.9s cubic-bezier(0.22,1,0.36,1)' }} />
              ) : null;
            })}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>Estimates · actual may vary</span>
            <span className="text-[10px]" style={{ color: 'rgba(52,211,153,0.8)' }}>∞ Free</span>
          </div>
        </div>

        {/* Categories */}
        <div className="px-3 py-3 flex flex-col gap-0.5">
          {CATS_META.map(({ key, label, Icon, color, glow, bg }, i) => {
            const cat = (cats as any)[key] as StorageCat || { count: 0, mb: 0 };
            const catPct = totalMB > 0 ? Math.min((cat.mb / totalMB) * 100, 100) : 0;
            return (
              <div
                key={key}
                className="flex items-center gap-2.5 px-2 py-2 rounded-xl"
                style={{ animation: `fadeUp 0.28s ${0.06 + i * 0.05}s both` }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: bg }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium" style={{ color: cat.count > 0 ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.28)' }}>
                      {label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {cat.count > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: bg, color }}>
                          {cat.count}
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        {cat.count > 0 ? fmtSize(cat.mb) : '—'}
                      </span>
                    </div>
                  </div>
                  <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    {cat.count > 0 && (
                      <div style={{
                        height: '100%', width: `${catPct}%`,
                        background: color, boxShadow: `0 0 5px ${glow}`,
                        borderRadius: '9999px',
                        animation: `bGrow 0.7s ${0.12 + i * 0.07}s cubic-bezier(0.22,1,0.36,1) both`,
                        minWidth: '3px',
                      }} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <p className="text-[9px] text-center" style={{ color: 'rgba(255,255,255,0.22)' }}>
            {totalNotes} note{totalNotes !== 1 ? 's' : ''} total · Telegram storage · Unlimited
          </p>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Dashboard
───────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   CopyButton — inline copy with tick feedback
───────────────────────────────────────────────────────────── */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-lg transition-all hover:bg-white/10"
      style={{ color: copied ? '#34d399' : 'rgba(255,255,255,0.3)' }}
      aria-label={copied ? 'Copied!' : 'Copy text'}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
    >
      {copied ? <CheckIcon size={12} /> : <Copy size={12} />}
    </button>
  );
}

export function NotaForgeDashboard() {
  const { notes, loading, createNote, updateNote, deleteNote, uploadFile } = usePublicNotes();
  const { folders, createFolder, deleteFolder } = useFolders();
  const isMobile = useIsMobile();
  const { isAdmin, login, logout, loading: authLoading } = useAdminAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [storageOpen, setStorageOpen]       = useState(false);

  // Folder navigation: null = Home (all notes)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [formFolderId, setFormFolderId]         = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen]       = useState(false);
  const [newFolderName, setNewFolderName]       = useState('');
  const [folderToDelete, setFolderToDelete]     = useState<{ id: string; name: string } | null>(null);

  // Keep the form's default folder in sync with the active sidebar folder
  useEffect(() => { setFormFolderId(selectedFolderId); }, [selectedFolderId]);

  // Form state
  const [title, setTitle]               = useState('');
  const [content, setContent]           = useState('');
  const [noteType, setNoteType]         = useState<NoteType>('text');
  const [linkUrl, setLinkUrl]           = useState('');
  const [fileUrls, setFileUrls]         = useState<string[]>([]);
  const [fileNames, setFileNames]       = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading]   = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoErrors, setVideoErrors]   = useState<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const progressHistory = useRef<{ t: number; pct: number }[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isDragging, setIsDragging]     = useState(false);
  const [mobileFormOpen, setMobileFormOpen] = useState(false);


  // Close storage popup on Escape
  useEffect(() => {
    if (!storageOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setStorageOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [storageOpen]);

  // Storage stats — estimated from note counts (Telegram storage is unlimited)
  const storageData = useMemo((): StorageData => {
    const cats = {
      photos: { count: 0, mb: 0 }, docs:  { count: 0, mb: 0 },
      videos: { count: 0, mb: 0 }, audio: { count: 0, mb: 0 },
      links:  { count: 0, mb: 0 }, text:  { count: 0, mb: 0 },
    };
    notes.forEach(n => {
      if      (n.note_type === 'image')                         { cats.photos.count++; cats.photos.mb += 1.2; }
      else if (n.note_type === 'video')                         { cats.videos.count++; cats.videos.mb += 8.0; }
      else if (n.note_type === 'audio')                         { cats.audio.count++;  cats.audio.mb  += 3.5; }
      else if (n.note_type === 'file' || n.note_type === 'pdf') { cats.docs.count++;   cats.docs.mb   += 1.8; }
      else if (n.note_type === 'link')                          { cats.links.count++;  cats.links.mb  += 0.001; }
      else                                                       { cats.text.count++;   cats.text.mb   += 0.01; }
    });
    const totalMB = Object.values(cats).reduce((s, c) => s + c.mb, 0);
    return { cats, totalMB, limitMB: 0, pct: 0 }; // limitMB 0 = unlimited
  }, [notes]);

  const resetForm = () => {
    setTitle(''); setContent(''); setNoteType('text');
    setLinkUrl(''); setFileUrls([]); setFileNames([]);
  };

  const detectType = (file: File): NoteType => {
    const mime = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
    return 'file';
  };

  const processFileUpload = useCallback(async (files: File[], forcedType: NoteType | null = null) => {
    if (files.length === 0) return;
    const filesToUpload = files.slice(0, 5 - fileUrls.length);
    if (filesToUpload.length === 0) { alert('Maximum 5 files allowed'); return; }
    // Bug fix: use forcedType when provided (from button click context).
    // For drag-drop/paste, detect from first file MIME type.
    const firstType: NoteType = forcedType ?? detectType(filesToUpload[0]);
    for (const file of filesToUpload) {
      if (file.size > MAX_FILE_SIZE) { alert(`"${file.name}" exceeds ${MAX_FILE_SIZE_LABEL}`); return; }
    }
    setIsUploading(true); setUploadSuccess(false); setUploadProgress(0);
    setTimeRemaining(null);
    progressHistory.current = [];

    const trackProgress = (pct: number) => {
      const now = Date.now();
      const history = progressHistory.current;
      history.push({ t: now, pct });
      // Keep only the last 8 seconds of samples for a rolling-window estimate
      while (history.length > 1 && now - history[0].t > 8000) history.shift();
      // Need ≥2 samples, some elapsed time, and real progress to estimate
      if (history.length >= 2) {
        const oldest = history[0];
        const newest = history[history.length - 1];
        const elapsed = newest.t - oldest.t;
        const gained  = newest.pct - oldest.pct;
        if (elapsed > 800 && gained > 0) {
          const pctPerMs  = gained / elapsed;
          const remaining = 100 - pct;
          const msLeft    = remaining / pctPerMs;
          setTimeRemaining(Math.max(1, Math.round(msLeft / 1000)));
        }
      }
      setUploadProgress(pct);
    };

    const urls: string[] = [], names: string[] = [];
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const baseOffset = Math.round((i / filesToUpload.length) * 100);
      const url = await uploadFile(file, (pct) => {
        trackProgress(baseOffset + Math.round(pct / filesToUpload.length));
      });
      if (url) { urls.push(url); names.push(file.name); }
    }
    setUploadProgress(100);
    setTimeRemaining(null);
    setIsUploading(false);
    if (urls.length > 0) {
      setFileUrls(p => [...p, ...urls]); setFileNames(p => [...p, ...names]);
      setNoteType(firstType); setUploadSuccess(true);
      setTimeout(() => { setUploadSuccess(false); setUploadProgress(0); }, 3000);
    } else {
      setUploadProgress(0);
    }
  }, [uploadFile, fileUrls.length]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file' | 'video') => {
    const files = Array.from(e.target.files || []);
    // Bug fix: reset input so re-selecting the same file fires onChange again
    e.target.value = '';
    if (files.length === 0) return;
    // Bug fix: honour the 'type' param from the button clicked — don't let
    // detectType() override it. If user clicks the image button, force image type.
    // Only use detectType for drag-drop / paste where no button context exists.
    const forcedType: NoteType | null = type === 'image' ? 'image' : type === 'video' ? 'video' : null;
    await processFileUpload(files, forcedType);
  };

  const handleDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }, []);
  const handleDrop      = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) await processFileUpload(files);
  }, [processFileUpload]);

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const files: File[] = [];
      for (const item of Array.from(e.clipboardData?.items || [])) {
        if (item.kind === 'file') { const f = item.getAsFile(); if (f) files.push(f); }
      }
      if (files.length > 0) { e.preventDefault(); await processFileUpload(files); }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFileUpload]);

  // Bug fix: only clear linkUrl when NOT in link mode — user typed the URL
  // intentionally; "Remove All" shouldn't silently wipe it.
  const clearAttachment = () => {
    setFileUrls([]);
    setFileNames([]);
    if (noteType !== 'link') {
      setNoteType('text');
      setLinkUrl('');
    }
  };
  const removeImage = (idx: number) => {
    // Bug fix: use functional updater so we read next state, not stale closure
    setFileUrls(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) setNoteType('text');
      return next;
    });
    setFileNames(prev => prev.filter((_, i) => i !== idx));
  };


  const isPdfFile = (note: Note) => note.file_name?.toLowerCase().endsWith('.pdf');

  const handleSubmit = async () => {
    if (!title.trim() && !content.trim() && fileUrls.length === 0 && !linkUrl.trim()) return;
    setIsSubmitting(true);
    const folder_id = formFolderId ?? null;
    if (noteType === 'image' && fileUrls.length > 0) {
      for (let i = 0; i < fileUrls.length; i++) {
        await createNote({
          title: fileUrls.length > 1 ? `${title.trim() || 'Untitled'} (${i + 1})` : (title.trim() || 'Untitled'),
          content: content.trim() || null, note_type: noteType,
          file_url: fileUrls[i], file_name: fileNames[i], link_url: null,
          folder_id,
        });
      }
    } else {
      await createNote({
        title: title.trim() || 'Untitled', content: content.trim() || null,
        note_type: noteType, file_url: fileUrls[0] || null,
        file_name: fileNames[0] || null, link_url: linkUrl.trim() || null,
        folder_id,
      });
    }
    resetForm(); setIsSubmitting(false); setMobileFormOpen(false);
  };

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const handleDelete = (id: string, title?: string) => {
    setDeleteTarget({ id, title: title || 'this note' });
  };
  const confirmDeleteNote = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await deleteNote(id);
  };
  const formatTimestamp = (date: string) => format(new Date(date), 'dd/MM/yy · HH:mm');

  // Bug fix: fetch() fails silently on cross-origin file URLs due to CORS.
  // Direct anchor with download attribute works cross-origin without a fetch.
  // If the browser blocks it (some mobile), fallback to _blank open.
  const downloadFile = (url: string, filename: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'download';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(url, '_blank');
    }
  };

  // Per-type card accent
  const noteAccent = (type: string) => {
    switch (type) {
      case 'image': return { border: 'rgba(167,139,250,0.38)', glow: 'rgba(167,139,250,0.09)', shimmer: 'rgba(167,139,250,0.5)', dot: '#a78bfa', tag: 'rgba(167,139,250,0.15)', tagText: '#c4b5fd' };
      case 'link':  return { border: 'rgba(251,191,36,0.38)',  glow: 'rgba(251,191,36,0.09)',  shimmer: 'rgba(251,191,36,0.5)',  dot: '#fbbf24', tag: 'rgba(251,191,36,0.15)',  tagText: '#fde68a' };
      case 'file':
      case 'pdf':   return { border: 'rgba(96,165,250,0.38)',  glow: 'rgba(96,165,250,0.09)',  shimmer: 'rgba(96,165,250,0.5)',  dot: '#60a5fa', tag: 'rgba(96,165,250,0.15)',  tagText: '#bfdbfe' };
      case 'video': return { border: 'rgba(244,114,182,0.38)', glow: 'rgba(244,114,182,0.09)', shimmer: 'rgba(244,114,182,0.5)', dot: '#f472b6', tag: 'rgba(244,114,182,0.15)', tagText: '#fbcfe8' };
      default:      return { border: NOTE_BORDER_COLOR,        glow: NOTE_GLOW_COLOR,           shimmer: 'rgba(255,200,60,0.45)', dot: 'rgba(255,200,60,0.8)', tag: 'rgba(255,200,60,0.12)', tagText: 'rgba(255,220,80,0.9)' };
    }
  };

  const renderNoteContent = (note: Note) => {
    switch (note.note_type) {
      case 'image':
        return note.file_url ? (
          <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden"
               style={{ background: 'rgba(0,0,0,0.25)' }}>
            <img src={note.file_url} alt={note.title}
                 className="max-w-full max-h-full object-contain" />
          </div>
        ) : null;
      case 'link':
        return note.link_url ? (
          <div className="flex items-start gap-2 p-2.5 rounded-xl"
               style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.14)' }}>
            <ExternalLink size={12} className="shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
            <span className="text-xs break-all line-clamp-4" style={{ color: 'rgba(253,230,138,0.75)' }}>{note.link_url}</span>
          </div>
        ) : null;
      case 'video':
        return note.file_url ? (
          <div className="w-full h-full flex items-center justify-center rounded-xl overflow-hidden"
               style={{ background: 'rgba(0,0,0,0.45)' }}>
            {videoErrors.has(note.id) ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <Video size={20} style={{ color: '#f472b6' }} />
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Video</span>
              </div>
            ) : (
              <video
                src={note.file_url}
                className="max-w-full max-h-full"
                muted
                autoPlay
                loop
                playsInline
                preload="metadata"
                onError={() => setVideoErrors(prev => new Set([...prev, note.id]))}
              />
            )}
          </div>
        ) : null;
      case 'audio':
        return note.file_url ? (
          <div className="flex flex-col items-center justify-center h-full gap-2.5 px-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg"
                 style={{ background: 'linear-gradient(145deg,rgba(52,211,153,0.25),rgba(16,185,129,0.12))', border: '1px solid rgba(52,211,153,0.3)' }}>
              <Music size={20} style={{ color: '#34d399' }} />
            </div>
            <span className="text-[10px] truncate max-w-full text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>{note.file_name || 'Audio'}</span>
          </div>
        ) : null;
      case 'file':
      case 'pdf':
        return note.file_url ? (
          <div className="flex flex-col items-center justify-center h-full gap-2.5">
            {isPdfFile(note) ? (
              <PdfThumbnail
                url={note.file_url}
                fallback={
                  <>
                    <div className="w-12 h-15 rounded-xl flex flex-col items-center justify-center gap-1 shadow-lg"
                         style={{ background: 'linear-gradient(145deg,#ef4444,#b91c1c)', boxShadow: '0 4px 16px rgba(239,68,68,0.3)' }}>
                      <FileIcon size={18} className="text-white/80" />
                      <span className="text-white text-[9px] font-bold tracking-widest">PDF</span>
                    </div>
                    <span className="text-[10px] truncate max-w-full px-2 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>{note.file_name}</span>
                  </>
                }
              />
            ) : (
              <>
                <div className="w-12 h-14 rounded-xl flex items-center justify-center shadow-lg"
                     style={{ background: 'linear-gradient(145deg,rgba(96,165,250,0.25),rgba(59,130,246,0.12))', border: '1px solid rgba(96,165,250,0.25)', boxShadow: '0 4px 16px rgba(96,165,250,0.15)' }}>
                  <FileIcon size={22} style={{ color: '#60a5fa' }} />
                </div>
                <span className="text-[10px] truncate max-w-full px-2 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>{note.file_name || 'File'}</span>
              </>
            )}
          </div>
        ) : null;
      default:
        return note.content ? (
          <p className="text-xs sm:text-sm line-clamp-5 whitespace-pre-wrap leading-relaxed"
             style={{ color: 'rgba(255,255,255,0.52)' }}>
            {note.content}
          </p>
        ) : null;
    }
  };

  const sharedFormProps = {
    title, setTitle, content, setContent, noteType, setNoteType,
    fileUrls, fileNames, isSubmitting, isUploading,
    uploadSuccess, uploadProgress, timeRemaining, isDragging, handleDragOver, handleDragLeave,
    handleDrop, handleFileUpload, handleSubmit, clearAttachment, removeImage,
    folders, formFolderId, setFormFolderId,
  };

  // Notes shown in the grid — filtered by the active folder.
  // Home (null) shows only notes that aren't in any folder.
  const visibleNotes = useMemo(() => {
    if (selectedFolderId === null) return notes.filter(n => !n.folder_id);
    return notes.filter(n => n.folder_id === selectedFolderId);
  }, [notes, selectedFolderId]);

  const homeCount = useMemo(() => notes.filter(n => !n.folder_id).length, [notes]);

  const activeFolderName = selectedFolderId
    ? (folders.find(f => f.id === selectedFolderId)?.name ?? 'Folder')
    : 'Home';

  const submitNewFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    const created = await createFolder(name);
    setNewFolderName('');
    setNewFolderOpen(false);
    if (created) setSelectedFolderId(created.id);
  };

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    const id = folderToDelete.id;
    setFolderToDelete(null);
    if (selectedFolderId === id) setSelectedFolderId(null);
    await deleteFolder(id);
  };

  return (
    <div className="min-h-screen bg-transparent text-foreground flex flex-col relative">

      {/* ══ Navbar ══ */}
      <header className="sticky top-0 z-50 bg-transparent pt-3 sm:pt-4 pb-2 px-2 sm:px-4">

        {/* DESKTOP lg+ */}
        <div className="hidden lg:flex items-center">

          {/* Left — Made by Pratik — PURPLE glass */}
          <a
            href="https://xpratik.vercel.app/"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full px-4 py-2 ml-16 transition-all"
            style={{
              background: 'rgba(139,92,246,0.09)',
              border: '1px solid rgba(139,92,246,0.32)',
              backdropFilter: 'blur(14px)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.17)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.09)')}
          >
            <span className="text-sm font-medium" style={{ color: 'rgba(196,167,255,0.88)' }}>Made by Pratik</span>
            <img src="https://raw.githubusercontent.com/pratik11500/PratikPortfolio/refs/heads/replit-agent/assets/images/logo.png"
                 alt="Pratik" className="w-6 h-6 object-contain" />
          </a>

          {/* Center */}
          <div className="flex-1 flex justify-center">
            <div className="w-[60%] bg-secondary/80 backdrop-blur-sm border border-border rounded-full px-12 py-3 flex items-center justify-between">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8">
                <rect width="100" height="100" rx="20" fill="#000" stroke="#fff" strokeWidth="4"/>
                <path d="M30 70 L50 30 L70 70" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"/>
              </svg>
              <span className="font-semibold tracking-tight">NotaForge</span>
            </div>
          </div>

          {/* Right — storage icon + role toggle */}
          <div className="flex items-center gap-2 mr-16">

            {/* Storage — admin only */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setStorageOpen(v => !v)}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: storageOpen ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.11)',
                    backdropFilter: 'blur(14px)',
                  }}
                  title="Storage"
                  aria-label="View storage usage"
                >
                  <HardDrive size={15} style={{ color: 'rgba(255,255,255,0.56)' }} />
                </button>
                {storageOpen && <StoragePopup data={storageData} onClose={() => setStorageOpen(false)} alignRight />}
              </div>
            )}

            {/* Role toggle — GREEN glass for Public */}
            <button
              onClick={() => isAdmin ? logout() : setLoginModalOpen(true)}
              className="flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={isAdmin ? {
                background: 'rgba(217,119,6,0.78)',
                border: '1px solid rgba(245,158,11,0.45)',
                backdropFilter: 'blur(14px)',
              } : {
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.33)',
                backdropFilter: 'blur(14px)',
              }}
              onMouseEnter={e => { if (!isAdmin) (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.15)'; }}
              onMouseLeave={e => { if (!isAdmin) (e.currentTarget as HTMLElement).style.background = 'rgba(34,197,94,0.08)'; }}
            >
              <span className="text-sm" style={{ color: isAdmin ? '#fff' : 'rgba(134,239,172,0.94)' }}>
                {isAdmin ? 'Admin' : 'Public'}
              </span>
            </button>
          </div>
        </div>

        {/* MOBILE < lg */}
        <div className="flex lg:hidden items-center justify-between">

          {/* Left — purple glass logo */}
          <a
            href="https://xpratik.vercel.app/"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center rounded-full p-2 shrink-0 ml-10 sm:ml-16 md:ml-24"
            style={{
              background: 'rgba(139,92,246,0.09)',
              border: '1px solid rgba(139,92,246,0.32)',
              backdropFilter: 'blur(14px)',
            }}
          >
            <img src="https://raw.githubusercontent.com/pratik11500/PratikPortfolio/refs/heads/replit-agent/assets/images/logo.png"
                 alt="Pratik" className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
          </a>

          {/* Center */}
          <div className="bg-secondary/80 backdrop-blur-sm border border-border rounded-full px-5 sm:px-10 md:px-16 py-2 sm:py-3 flex items-center gap-6 sm:gap-14 md:gap-24 -ml-2 sm:ml-0 md:mr-[-8px]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-6 h-6 sm:w-8 sm:h-8">
              <rect width="100" height="100" rx="20" fill="#000" stroke="#fff" strokeWidth="4"/>
              <path d="M30 70 L50 30 L70 70" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round"/>
            </svg>
            <span className="text-sm sm:text-base font-semibold tracking-tight">NotaForge</span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setStorageOpen(v => !v)}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.11)',
                    backdropFilter: 'blur(14px)',
                  }}
                  aria-label="View storage usage"
                >
                  <HardDrive size={14} style={{ color: 'rgba(255,255,255,0.56)' }} />
                </button>
                {storageOpen && <StoragePopup data={storageData} onClose={() => setStorageOpen(false)} alignRight />}
              </div>
            )}
            <button
              onClick={() => isAdmin ? logout() : setLoginModalOpen(true)}
              className="flex items-center gap-1 rounded-full p-2 sm:px-3 sm:py-2 shrink-0 font-medium transition-all"
              style={isAdmin ? {
                background: 'rgba(217,119,6,0.78)',
                border: '1px solid rgba(245,158,11,0.45)',
                backdropFilter: 'blur(14px)',
              } : {
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.33)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <span className="text-xs sm:text-sm" style={{ color: isAdmin ? '#fff' : 'rgba(134,239,172,0.94)' }}>
                {isAdmin ? 'Admin' : 'Public'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* ══ Body ══ */}
      <div className="flex flex-1 overflow-y-auto overflow-x-hidden p-2 pt-2 gap-4 relative">

        {/* Desktop LEFT sidebar — note form */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col ml-4 fixed top-[88px] left-0 z-40">
          <NoteFormPanel {...sharedFormProps} />
        </aside>

        {/* Main grid */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-2 sm:px-4 md:px-6 pt-0 pb-20 lg:pb-4 lg:ml-[300px] lg:mr-[88px]">
          <h1 className="sr-only">NotaForge — Simple Note Sharing and Storage</h1>

          {/* Mobile folder chip bar */}
          <div className="lg:hidden mb-3 -mx-1 px-1 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1.5 min-w-max pb-1">
              <button
                onClick={() => setSelectedFolderId(null)}
                className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all shrink-0"
                style={{
                  background: selectedFolderId === null ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedFolderId === null ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  color: selectedFolderId === null ? '#fff' : 'rgba(255,255,255,0.55)',
                }}
              >
                <HomeIcon size={12} /> Home
              </button>
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFolderId(f.id)}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all shrink-0"
                  style={{
                    background: selectedFolderId === f.id ? 'rgba(255,200,60,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selectedFolderId === f.id ? 'rgba(255,200,60,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: selectedFolderId === f.id ? '#ffd966' : 'rgba(255,255,255,0.55)',
                  }}
                >
                  <FolderIcon size={12} /> {f.name}
                </button>
              ))}
              {isAdmin && (
                <button
                  onClick={() => setNewFolderOpen(true)}
                  className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium shrink-0"
                  style={{
                    background: 'rgba(139,92,246,0.1)',
                    border: '1px dashed rgba(139,92,246,0.4)',
                    color: 'rgba(196,167,255,0.9)',
                  }}
                >
                  <FolderPlus size={12} /> New
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : visibleNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText size={48} className="mb-4" />
              <p className="text-center px-4">
                {selectedFolderId === null
                  ? 'No notes yet. Add your first note!'
                  : `No notes in "${activeFolderName}" yet.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 w-full">
              {visibleNotes.map((note) => {
                const ac = noteAccent(note.note_type);
                return (
                  <div
                    key={note.id}
                    onClick={() => setSelectedNote(note)}
                    className="group relative rounded-2xl p-3 sm:p-4 flex flex-col gap-2 cursor-pointer h-[240px] sm:h-[280px] w-full overflow-hidden"
                    style={{
                      background: 'linear-gradient(150deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 60%, rgba(0,0,0,0.18) 100%)',
                      border: `1.5px solid ${ac.border}`,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
                      backdropFilter: 'blur(14px)',
                      transition: 'background 0.18s ease',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'linear-gradient(150deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 60%, rgba(0,0,0,0.12) 100%)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'linear-gradient(150deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 60%, rgba(0,0,0,0.18) 100%)';
                    }}
                  >
                    {/* Top shimmer */}
                    <div className="absolute top-0 left-5 right-5 h-px pointer-events-none"
                         style={{ background: `linear-gradient(90deg, transparent, ${ac.shimmer}, transparent)` }} />

                    {/* Header */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-[3px]" style={{ background: ac.dot, boxShadow: `0 0 5px ${ac.dot}` }} />
                        <h3 className="font-semibold truncate text-sm sm:text-[15px] leading-snug" style={{ color: 'rgba(255,255,255,0.88)' }}>
                          {note.title}
                        </h3>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 -mt-0.5">
                          <button
                            onClick={e => { e.stopPropagation(); setSelectedNote(note); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'rgba(255,255,255,0.38)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            aria-label={`Edit note ${note.title}`}
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(note.id, note.title); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'rgba(248,113,113,0.55)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            aria-label={`Delete note ${note.title}`}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-h-0 overflow-hidden rounded-xl">
                      {renderNoteContent(note)}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-1.5 pt-2"
                         style={{ borderTop: '1px solid rgba(255,255,255,0.055)' }}>
                      <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-medium capitalize"
                            style={{ background: ac.tag, color: ac.tagText }}>
                        {note.note_type}
                      </span>
                      <span className="text-[9px] sm:text-[10px] flex-1" style={{ color: 'rgba(255,255,255,0.22)' }}>
                        {formatTimestamp(note.created_at)}
                      </span>
                      {/* Copy button — text notes only, always visible */}
                      {note.note_type === 'text' && note.content && (
                        <CopyButton text={note.content} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* Desktop RIGHT sidebar — folder rail (icons only with hover labels) */}
        <aside
          className="hidden lg:flex w-[64px] shrink-0 flex-col items-center fixed top-[88px] right-3 z-40 rounded-full py-3 px-1.5 gap-1.5"
          style={{
            maxHeight: 'calc(100vh - 110px)',
            background: 'rgba(10,10,16,0.55)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(18px)',
          }}
        >
          <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col items-center gap-1.5 w-full">
            {/* Home */}
            <div className="group relative">
              <button
                onClick={() => setSelectedFolderId(null)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{
                  background: selectedFolderId === null ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)',
                  color: selectedFolderId === null ? '#fff' : 'rgba(255,255,255,0.65)',
                  border: selectedFolderId === null ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (selectedFolderId !== null) e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
                onMouseLeave={e => { if (selectedFolderId !== null) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                aria-label="Home"
              >
                <HomeIcon size={16} />
              </button>
              <span
                className="pointer-events-none absolute right-[52px] top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(20,20,28,0.95)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                Home <span style={{ color: 'rgba(255,255,255,0.45)' }}>· {homeCount}</span>
              </span>
            </div>

            {folders.map(f => {
              const count = notes.filter(n => n.folder_id === f.id).length;
              const active = selectedFolderId === f.id;
              const initial = (f.name?.trim()?.[0] ?? '?').toUpperCase();
              return (
                <div key={f.id} className="group relative">
                  <button
                    onClick={() => setSelectedFolderId(f.id)}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      background: active ? 'rgba(255,200,60,0.18)' : 'rgba(255,255,255,0.04)',
                      color: active ? '#ffd966' : 'rgba(255,255,255,0.7)',
                      border: active ? '1px solid rgba(255,200,60,0.45)' : '1px solid transparent',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    aria-label={f.name}
                  >
                    <span className="text-[13px] font-semibold">{initial}</span>
                  </button>
                  <span
                    className="pointer-events-none absolute right-[52px] top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5"
                    style={{ background: 'rgba(20,20,28,0.95)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <FolderIcon size={11} style={{ color: 'rgba(255,217,102,0.85)' }} />
                    {f.name} <span style={{ color: 'rgba(255,255,255,0.45)' }}>· {count}</span>
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => setFolderToDelete({ id: f.id, name: f.name })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(248,113,113,0.85)' }}
                      aria-label={`Delete folder ${f.name}`}
                      title="Delete folder"
                    >
                      <Trash2 size={9} style={{ color: '#fff' }} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {isAdmin && (
            <div className="group relative w-full flex justify-center pt-1.5 mt-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                onClick={() => setNewFolderOpen(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{
                  background: 'rgba(196,167,255,0.12)',
                  color: 'rgba(196,167,255,0.95)',
                  border: '1px dashed rgba(196,167,255,0.35)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(196,167,255,0.22)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(196,167,255,0.12)'; }}
                aria-label="Create new folder"
              >
                <FolderPlus size={16} />
              </button>
              <span
                className="pointer-events-none absolute right-[52px] top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(20,20,28,0.95)', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                New folder
              </span>
            </div>
          )}
        </aside>
      </div>


      {/* Mobile FAB */}
      <button
        onClick={() => setMobileFormOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform active:scale-95"
        aria-label="Add new note"
      >
        <Plus size={24} />
      </button>

      {/* Mobile Sheet */}
      <Sheet open={mobileFormOpen} onOpenChange={setMobileFormOpen}>
        <SheetContent side="bottom" className="h-[85vh] bg-secondary/70 backdrop-blur-xl border-t-2 border-x-2 border-purple-500/50 rounded-t-2xl p-4 flex flex-col">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-white text-left">Add New Note</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <NoteFormPanel inSheet {...sharedFormProps} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Note detail modal — new NoteDetailModal component */}
      {selectedNote && (
        <NoteDetailModal
          note={selectedNote}
          isAdmin={isAdmin}
          onClose={() => setSelectedNote(null)}
          onSave={async (id, title, content) => {
            const updated = await updateNote(id, { title, content });
            if (updated) setSelectedNote(updated);
            return updated;
          }}
          onDelete={async (id) => {
            const ok = await deleteNote(id);
            setSelectedNote(null);
            return ok;
          }}
          onDownload={downloadFile}
        />
      )}

      <AdminLoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} onLogin={login} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteNote}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Folder dialog — admin only */}
      <AlertDialog open={newFolderOpen} onOpenChange={(o) => { if (!o) { setNewFolderOpen(false); setNewFolderName(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create new folder</AlertDialogTitle>
            <AlertDialogDescription>
              Give your folder a name. Everyone will see it, but only admins can edit or delete folders.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            autoFocus
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitNewFolder(); } }}
            className="bg-secondary border-border text-white"
            maxLength={60}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitNewFolder} disabled={!newFolderName.trim()}>
              Create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete folder confirmation */}
      <AlertDialog open={!!folderToDelete} onOpenChange={(o) => !o && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this folder?</AlertDialogTitle>
            <AlertDialogDescription>
              "{folderToDelete?.name}" will be permanently deleted. Notes inside will move back to Home.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}