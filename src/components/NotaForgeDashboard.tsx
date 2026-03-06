import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePublicNotes, Note, NoteType } from '@/hooks/usePublicNotes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NoteFormPanel } from '@/components/NoteFormPanel';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AdminLoginModal } from '@/components/AdminLoginModal';

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
  const { cats, totalMB, limitMB, pct } = data;
  const totalNotes = Object.values(cats).reduce((s, c) => s + c.count, 0);
  const barColor = pct < 50 ? ['#34d399','#10b981'] : pct < 75 ? ['#fbbf24','#f59e0b'] : pct < 90 ? ['#f97316','#ea580c'] : ['#f87171','#ef4444'];
  const barGlow  = pct < 50 ? 'rgba(52,211,153,0.5)' : pct < 75 ? 'rgba(251,191,36,0.5)' : pct < 90 ? 'rgba(249,115,22,0.5)' : 'rgba(248,113,113,0.5)';

  return (
    <>
      <div className="fixed inset-0 z-[55]" onClick={onClose} />
      <div
        className={`absolute top-11 z-[60] w-[290px] rounded-2xl overflow-hidden`}
        style={{
          right: alignRight ? 0 : 'auto',
          left:  alignRight ? 'auto' : 0,
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
              <div className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{fmtSize(totalMB)}</div>
              <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.3)' }}>of {fmtSize(limitMB)}</div>
            </div>
          </div>

          {/* Main bar */}
          <div className="relative h-2.5 w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: `linear-gradient(90deg, ${barColor[0]}, ${barColor[1]})`,
              boxShadow: `0 0 12px ${barGlow}`,
              borderRadius: '9999px',
              animation: 'bGrow 0.9s cubic-bezier(0.22,1,0.36,1)',
              minWidth: pct > 0 ? '4px' : '0',
            }} />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>{fmtSize(limitMB - totalMB)} free</span>
            <span className="text-[11px] font-bold" style={{ color: barColor[0] }}>{pct.toFixed(1)}%</span>
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
            {totalNotes} note{totalNotes !== 1 ? 's' : ''} total · Cloudinary storage
          </p>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Dashboard
───────────────────────────────────────────────────────────── */
export function NotaForgeDashboard() {
  const { notes, loading, createNote, updateNote, deleteNote, uploadFile } = usePublicNotes();
  const isMobile = useIsMobile();
  const { isAdmin, login, logout, loading: authLoading } = useAdminAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [storageOpen, setStorageOpen]       = useState(false);

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
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing]       = useState(false);
  const [editTitle, setEditTitle]       = useState('');
  const [editContent, setEditContent]   = useState('');
  const [isDragging, setIsDragging]     = useState(false);
  const [mobileFormOpen, setMobileFormOpen] = useState(false);

  // Close storage popup on Escape
  useEffect(() => {
    if (!storageOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setStorageOpen(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [storageOpen]);

  // Cloudinary real usage stats
  const [cloudinaryUsage, setCloudinaryUsage] = useState<{
    storage: { used_bytes: number; limit_bytes: number };
    resources: { images: number; videos: number; raw: number };
    plan: string;
  } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    supabase.functions.invoke('cloudinary-usage').then(({ data, error }) => {
      if (!error && data) setCloudinaryUsage(data);
    });
  }, [isAdmin]);

  // Storage stats — real Cloudinary data + local note counts
  const storageData = useMemo((): StorageData => {
    const cats = {
      photos: { count: 0, mb: 0 }, docs:  { count: 0, mb: 0 },
      videos: { count: 0, mb: 0 }, audio: { count: 0, mb: 0 },
      links:  { count: 0, mb: 0 }, text:  { count: 0, mb: 0 },
    };

    // Count notes by type from DB
    notes.forEach(n => {
      if      (n.note_type === 'image')                         { cats.photos.count++; }
      else if (n.note_type === 'video')                         { cats.videos.count++; }
      else if (n.note_type === 'audio')                         { cats.audio.count++;  }
      else if (n.note_type === 'file' || n.note_type === 'pdf') { cats.docs.count++;   }
      else if (n.note_type === 'link')                          { cats.links.count++;  }
      else                                                       { cats.text.count++;   }
    });

    if (cloudinaryUsage) {
      const usedMB = cloudinaryUsage.storage.used_bytes / (1024 * 1024);
      const limitMB = cloudinaryUsage.storage.limit_bytes / (1024 * 1024);
      const totalFiles = (cloudinaryUsage.resources.images || 0) + (cloudinaryUsage.resources.videos || 0) + (cloudinaryUsage.resources.raw || 0);
      // Distribute real storage proportionally by resource counts
      const imgRatio = totalFiles > 0 ? (cloudinaryUsage.resources.images / totalFiles) : 0;
      const vidRatio = totalFiles > 0 ? (cloudinaryUsage.resources.videos / totalFiles) : 0;
      const rawRatio = totalFiles > 0 ? (cloudinaryUsage.resources.raw / totalFiles) : 0;
      cats.photos.mb = usedMB * imgRatio;
      cats.videos.mb = usedMB * vidRatio;
      cats.docs.mb   = usedMB * rawRatio;
      cats.links.mb  = 0;
      cats.text.mb   = 0;
      return { cats, totalMB: usedMB, limitMB, pct: limitMB > 0 ? Math.min((usedMB / limitMB) * 100, 100) : 0 };
    }

    // Fallback: estimates
    notes.forEach(n => {
      if      (n.note_type === 'image')                         { cats.photos.mb += 1.2; }
      else if (n.note_type === 'video')                         { cats.videos.mb += 8.0; }
      else if (n.note_type === 'audio')                         { cats.audio.mb  += 3.5; }
      else if (n.note_type === 'file' || n.note_type === 'pdf') { cats.docs.mb   += 1.8; }
      else if (n.note_type === 'link')                          { cats.links.mb  += 0.001; }
      else                                                       { cats.text.mb   += 0.01; }
    });
    const totalMB = Object.values(cats).reduce((s, c) => s + c.mb, 0);
    const limitMB = 25 * 1024; // 25 GB Cloudinary free
    return { cats, totalMB, limitMB, pct: totalMB > 0 ? Math.min((totalMB / limitMB) * 100, 100) : 0 };
  }, [notes, cloudinaryUsage]);

  const resetForm = () => {
    setTitle(''); setContent(''); setNoteType('text');
    setLinkUrl(''); setFileUrls([]); setFileNames([]);
  };

  const processFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const filesToUpload = files.slice(0, 5 - fileUrls.length);
    if (filesToUpload.length === 0) { alert('Maximum 5 images allowed'); return; }
    const isImage = filesToUpload[0].type.startsWith('image/');
    const type: 'image' | 'file' = isImage ? 'image' : 'file';
    const maxSize = type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    for (const file of filesToUpload) {
      if (file.size > maxSize) { alert(`"${file.name}" exceeds ${type === 'image' ? '10MB' : '50MB'}`); return; }
    }
    setIsUploading(true); setUploadSuccess(false);
    const urls: string[] = [], names: string[] = [];
    for (const file of filesToUpload) {
      const url = await uploadFile(file);
      if (url) { urls.push(url); names.push(file.name); }
    }
    setIsUploading(false);
    if (urls.length > 0) {
      setFileUrls(p => [...p, ...urls]); setFileNames(p => [...p, ...names]);
      setNoteType(type); setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }
  }, [uploadFile, fileUrls.length]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await processFileUpload(files);
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

  const clearAttachment = () => { setFileUrls([]); setFileNames([]); setNoteType('text'); setLinkUrl(''); };
  const removeImage = (idx: number) => {
    setFileUrls(p => p.filter((_, i) => i !== idx));
    setFileNames(p => p.filter((_, i) => i !== idx));
    if (fileUrls.length <= 1) setNoteType('text');
  };

  const openEditModal = (note: Note) => {
    setSelectedNote(note); setEditTitle(note.title);
    setEditContent(note.content || ''); setIsEditing(true);
  };
  const handleSaveEdit = async () => {
    if (!selectedNote) return;
    const updated = await updateNote(selectedNote.id, { title: editTitle, content: editContent });
    if (updated) { setSelectedNote(updated); setIsEditing(false); }
  };
  const isPdfFile = (note: Note) => note.file_name?.toLowerCase().endsWith('.pdf');

  const handleSubmit = async () => {
    if (!title.trim() && !content.trim() && fileUrls.length === 0 && !linkUrl.trim()) return;
    setIsSubmitting(true);
    if (noteType === 'image' && fileUrls.length > 0) {
      for (let i = 0; i < fileUrls.length; i++) {
        await createNote({
          title: fileUrls.length > 1 ? `${title.trim() || 'Untitled'} (${i + 1})` : (title.trim() || 'Untitled'),
          content: content.trim() || null, note_type: noteType,
          file_url: fileUrls[i], file_name: fileNames[i], link_url: null,
        });
      }
    } else {
      await createNote({
        title: title.trim() || 'Untitled', content: content.trim() || null,
        note_type: noteType, file_url: fileUrls[0] || null,
        file_name: fileNames[0] || null, link_url: linkUrl.trim() || null,
      });
    }
    resetForm(); setIsSubmitting(false); setMobileFormOpen(false);
  };

  const handleDelete = async (id: string) => { await deleteNote(id); };
  const formatTimestamp = (date: string) => format(new Date(date), 'dd/MM/yy · HH:mm');

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
      case 'file':
      case 'pdf':
      case 'video':
      case 'audio':
        return note.file_url ? (
          <div className="flex flex-col items-center justify-center h-full gap-2.5">
            {isPdfFile(note) ? (
              <>
                <div className="w-12 h-15 rounded-xl flex flex-col items-center justify-center gap-1 shadow-lg"
                     style={{ background: 'linear-gradient(145deg,#ef4444,#b91c1c)', boxShadow: '0 4px 16px rgba(239,68,68,0.3)' }}>
                  <FileIcon size={18} className="text-white/80" />
                  <span className="text-white text-[9px] font-bold tracking-widest">PDF</span>
                </div>
                <span className="text-[10px] truncate max-w-full px-2 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>{note.file_name}</span>
              </>
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
    linkUrl, setLinkUrl, fileUrls, fileNames, isSubmitting, isUploading,
    uploadSuccess, isDragging, handleDragOver, handleDragLeave,
    handleDrop, handleFileUpload, handleSubmit, clearAttachment, removeImage,
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">

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

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col ml-4 fixed top-[88px] left-0 z-40">
          <NoteFormPanel {...sharedFormProps} />
        </aside>

        {/* Main grid */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto px-2 sm:px-4 md:px-6 pt-0 pb-20 lg:pb-4 lg:ml-[300px]">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText size={48} className="mb-4" />
              <p className="text-center px-4">No notes yet. Add your first note!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 w-full">
              {notes.map((note) => {
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
                            onClick={e => { e.stopPropagation(); openEditModal(note); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'rgba(255,255,255,0.38)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(note.id); }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'rgba(248,113,113,0.55)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
                      <span className="text-[9px] sm:text-[10px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                        {formatTimestamp(note.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
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

      {/* Note detail modal */}
      {selectedNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-2 sm:p-4 animate-fade-in"
          onClick={() => { setSelectedNote(null); setIsEditing(false); }}
        >
          <div
            className="w-full sm:w-[90%] md:w-[85%] lg:w-[70%] h-[90vh] sm:h-[85vh] lg:h-[70vh] max-w-4xl rounded-2xl p-4 sm:p-6 overflow-x-hidden overflow-y-auto flex flex-col animate-scale-in"
            style={{
              background: 'rgba(10,10,16,0.9)',
              backdropFilter: 'blur(32px)',
              border: `1.5px solid ${NOTE_BORDER_COLOR}`,
              boxShadow: `0 0 40px ${NOTE_GLOW_COLOR}, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 sm:gap-4 mb-4">
              {isEditing ? (
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                       className="text-lg sm:text-xl font-bold bg-secondary border-border text-white flex-1" placeholder="Note title" />
              ) : (
                <h2 className="text-lg sm:text-xl font-bold text-white flex-1 break-words">{selectedNote.title}</h2>
              )}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {!isEditing && isAdmin && (
                  <button onClick={() => openEditModal(selectedNote)} className="text-muted-foreground hover:text-white transition-colors p-1">
                    <Pencil size={18} />
                  </button>
                )}
                <button onClick={() => { setSelectedNote(null); setIsEditing(false); }} className="text-muted-foreground hover:text-white transition-colors p-1">
                  <X size={22} />
                </button>
              </div>
            </div>

            <div className="space-y-4 w-full flex-1 overflow-y-auto overflow-x-hidden">
              {isEditing ? (
                <Textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                          className="min-h-[150px] bg-secondary border-border text-white w-full" placeholder="Note content..." />
              ) : (
                selectedNote.content && (
                  <p className="text-muted-foreground whitespace-pre-wrap break-words w-full text-sm sm:text-base">{selectedNote.content}</p>
                )
              )}
              {selectedNote.note_type === 'image' && selectedNote.file_url && (
                <img src={selectedNote.file_url} alt={selectedNote.title}
                     className="w-full max-h-[300px] sm:max-h-[400px] object-contain rounded border border-border" />
              )}
              {selectedNote.note_type === 'link' && selectedNote.link_url && (
                <a href={selectedNote.link_url} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-2 text-white hover:underline p-3 bg-secondary rounded border border-border w-full overflow-hidden">
                  <ExternalLink size={18} className="shrink-0" />
                  <span className="break-all text-sm sm:text-base">{selectedNote.link_url}</span>
                </a>
              )}
              {(selectedNote.note_type === 'file' || selectedNote.note_type === 'pdf') && selectedNote.file_url && (
                <div className="space-y-4">
                  {isPdfFile(selectedNote) && (
                    <iframe src={selectedNote.file_url}
                            className="w-full h-[250px] sm:h-[400px] rounded border border-border bg-white" title="PDF Preview" />
                  )}
                  <a href={selectedNote.file_url} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 text-white hover:underline p-3 bg-secondary rounded border border-border">
                    <Download size={18} className="shrink-0" />
                    <span className="text-sm sm:text-base">{selectedNote.file_name || 'Download file'}</span>
                  </a>
                </div>
              )}
            </div>

            {isEditing && (
              <div className="mt-4 flex gap-2">
                <Button onClick={handleSaveEdit} className="bg-white text-black hover:bg-white/90 flex-1 sm:flex-none">Save Changes</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="border-border text-white hover:bg-secondary flex-1 sm:flex-none">Cancel</Button>
              </div>
            )}
            <div className="mt-4 sm:mt-6 pt-4 border-t border-border text-[10px] sm:text-xs text-muted-foreground">
              Created: {formatTimestamp(selectedNote.created_at)}
            </div>
          </div>
        </div>
      )}

      <AdminLoginModal open={loginModalOpen} onClose={() => setLoginModalOpen(false)} onLogin={login} />
    </div>
  );
}
