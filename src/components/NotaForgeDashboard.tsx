import { useState, useCallback, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AdminLoginModal } from '@/components/AdminLoginModal';

// Unified fade yellow border color for all notes
const NOTE_BORDER_COLOR = 'rgba(255, 200, 60, 0.4)';
const NOTE_GLOW_COLOR = 'rgba(255, 200, 60, 0.15)';

export function NotaForgeDashboard() {
  const { notes, loading, createNote, updateNote, deleteNote, uploadFile } = usePublicNotes();
  const isMobile = useIsMobile();
  const { isAdmin, login, logout, loading: authLoading } = useAdminAuth();
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('text');
  const [linkUrl, setLinkUrl] = useState('');
  const [fileUrls, setFileUrls] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [mobileFormOpen, setMobileFormOpen] = useState(false);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setNoteType('text');
    setLinkUrl('');
    setFileUrls([]);
    setFileNames([]);
  };

  // Process multiple file uploads (up to 5 at once)
  const processFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    // Limit to 5 files max
    const filesToUpload = files.slice(0, 5 - fileUrls.length);
    if (filesToUpload.length === 0) {
      alert('Maximum 5 images allowed');
      return;
    }
    
    const isImage = filesToUpload[0].type.startsWith('image/');
    const type: 'image' | 'file' = isImage ? 'image' : 'file';
    
    // Check file size based on type (10MB for images, 50MB for files)
    const maxSize = type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    const maxSizeLabel = type === 'image' ? '10MB' : '50MB';
    
    // Validate all files
    for (const file of filesToUpload) {
      if (file.size > maxSize) {
        alert(`File "${file.name}" exceeds ${maxSizeLabel} limit`);
        return;
      }
    }

    setIsUploading(true);
    setUploadSuccess(false);
    
    const uploadedUrls: string[] = [];
    const uploadedNames: string[] = [];
    
    for (const file of filesToUpload) {
      const url = await uploadFile(file);
      if (url) {
        uploadedUrls.push(url);
        uploadedNames.push(file.name);
      }
    }
    
    setIsUploading(false);

    if (uploadedUrls.length > 0) {
      setFileUrls(prev => [...prev, ...uploadedUrls]);
      setFileNames(prev => [...prev, ...uploadedNames]);
      setNoteType(type);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }
  }, [uploadFile, fileUrls.length]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await processFileUpload(files);
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFileUpload(files);
    }
  }, [processFileUpload]);

  // Ctrl+V paste handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      const files: File[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }
      
      if (files.length > 0) {
        e.preventDefault();
        await processFileUpload(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFileUpload]);

  const clearAttachment = () => {
    setFileUrls([]);
    setFileNames([]);
    setNoteType('text');
    setLinkUrl('');
  };

  const removeImage = (index: number) => {
    setFileUrls(prev => prev.filter((_, i) => i !== index));
    setFileNames(prev => prev.filter((_, i) => i !== index));
    if (fileUrls.length <= 1) {
      setNoteType('text');
    }
  };

  const openEditModal = (note: Note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content || '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedNote) return;
    const updated = await updateNote(selectedNote.id, {
      title: editTitle,
      content: editContent,
    });
    if (updated) {
      setSelectedNote(updated);
      setIsEditing(false);
    }
  };

  const isPdfFile = (note: Note) => {
    return note.file_name?.toLowerCase().endsWith('.pdf');
  };

  // Estimate storage used: 1 note ~= a few KB of text; files counted by assumed average
  // We count image/file notes as approx 500KB each, others as 5KB
  const storageUsedMB = useMemo(() => {
    return notes.reduce((acc, note) => {
      if (note.note_type === 'image' || note.note_type === 'file' || note.note_type === 'pdf') {
        return acc + 0.5; // ~500KB per file note
      }
      return acc + 0.005; // ~5KB per text note
    }, 0);
  }, [notes]);
  const storageTotalMB = 500;

  const handleSubmit = async () => {
    if (!title.trim() && !content.trim() && fileUrls.length === 0 && !linkUrl.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    // For multiple images, create separate notes for each or store first one
    // For now, create one note per image (or single note for other types)
    if (noteType === 'image' && fileUrls.length > 0) {
      for (let i = 0; i < fileUrls.length; i++) {
        await createNote({
          title: fileUrls.length > 1 ? `${title.trim() || 'Untitled'} (${i + 1})` : (title.trim() || 'Untitled'),
          content: content.trim() || null,
          note_type: noteType,
          file_url: fileUrls[i],
          file_name: fileNames[i],
          link_url: null,
        });
      }
    } else {
      await createNote({
        title: title.trim() || 'Untitled',
        content: content.trim() || null,
        note_type: noteType,
        file_url: fileUrls[0] || null,
        file_name: fileNames[0] || null,
        link_url: linkUrl.trim() || null,
      });
    }

    resetForm();
    setIsSubmitting(false);
    setMobileFormOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteNote(id);
  };

  const formatTimestamp = (date: string) => {
    return format(new Date(date), 'dd/MM/yyyy, HH:mm:ss');
  };

  const renderNoteContent = (note: Note) => {
    switch (note.note_type) {
      case 'image':
        return note.file_url ? (
          <div className="w-full h-full flex items-center justify-center p-1">
            <img 
              src={note.file_url} 
              alt={note.title}
              className="max-w-full max-h-full object-contain rounded border border-border"
            />
          </div>
        ) : null;
      
      case 'link':
        return note.link_url ? (
          <a 
            href={note.link_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-white hover:underline break-all"
          >
            <ExternalLink size={14} className="shrink-0" />
            <span className="truncate">{note.link_url}</span>
          </a>
        ) : null;
      
      case 'file':
      case 'pdf':
      case 'video':
      case 'audio':
        return note.file_url ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-4">
            {isPdfFile(note) ? (
              <>
                <div className="w-12 h-14 bg-red-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">PDF</span>
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-full px-2">{note.file_name}</span>
              </>
            ) : (
              <>
                <FileIcon size={32} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate max-w-full px-2">{note.file_name || 'File'}</span>
              </>
            )}
          </div>
        ) : null;
      
      default:
        return note.content ? (
          <p className="text-muted-foreground text-sm line-clamp-4 whitespace-pre-wrap">
            {note.content}
          </p>
        ) : null;
    }
  };


  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-transparent pt-3 sm:pt-4 pb-2 px-2 sm:px-4">
        
        {/* DESKTOP LAYOUT (lg+) - Original layout restored */}
        <div className="hidden lg:flex items-center">
          {/* Left - Made by Pratik badge with margin (text first, then logo) */}
          <a
            href="https://xpratik.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex bg-secondary/80 backdrop-blur-sm border border-border rounded-full px-4 py-2 items-center gap-2 hover:bg-secondary transition-colors ml-16"
          >
            <span className="text-sm text-muted-foreground">Made by Pratik</span>
            <img 
              src="https://raw.githubusercontent.com/pratik11500/PratikPortfolio/refs/heads/replit-agent/assets/images/logo.png" 
              alt="Pratik Logo"
              className="w-6 h-6 object-contain"
            />
          </a>

          {/* Center - Main navbar with w-[60%] */}
          <div className="flex-1 flex justify-center">
            <div className="w-[60%] bg-secondary/80 backdrop-blur-sm border border-border rounded-full px-12 py-3 flex items-center justify-between">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8">
                <rect width="100" height="100" rx="20" fill="#000000" stroke="#ffffff" strokeWidth="4"/>
                <path d="M30 70 L50 30 L70 70" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round"/>
              </svg>
              <span className="font-semibold tracking-tight">NotaForge</span>
            </div>
          </div>

          {/* Right - Role Toggle Button */}
          <button
            onClick={() => isAdmin ? logout() : setLoginModalOpen(true)}
            className={`flex backdrop-blur-sm border rounded-full px-4 py-2 items-center gap-2 transition-colors mr-16 ${
              isAdmin
                ? 'bg-amber-600/80 border-amber-500/50 hover:bg-amber-500/80'
                : 'bg-purple-500/10 border-purple-500/40 hover:bg-purple-500/20'
            }`}
          >
            <span className={`text-sm ${isAdmin ? 'text-white' : 'text-purple-300'}`}>{isAdmin ? 'Admin' : 'Public'}</span>
          </button>
        </div>

        {/* MOBILE/TABLET LAYOUT (< lg) - Symmetric layout */}
        <div className="flex lg:hidden items-center justify-between">
          {/* Left - Logo with margin to shift right */}
          <a
            href="https://xpratik.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex bg-secondary/80 backdrop-blur-sm border border-border rounded-full p-2 items-center hover:bg-secondary transition-colors shrink-0 ml-10 sm:ml-16 md:ml-24"
          >
            <img 
              src="https://raw.githubusercontent.com/pratik11500/PratikPortfolio/refs/heads/replit-agent/assets/images/logo.png" 
              alt="Pratik Logo"
              className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
            />
          </a>

          {/* Center - Main navbar (mobile: shifted left, tablet: shifted right) */}
          <div className="bg-secondary/80 backdrop-blur-sm border border-border rounded-full px-5 sm:px-10 md:px-16 py-2 sm:py-3 flex items-center justify-between gap-6 sm:gap-14 md:gap-24 -ml-2 sm:ml-0 md:mr-[-8px]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-6 h-6 sm:w-8 sm:h-8">
              <rect width="100" height="100" rx="20" fill="#000000" stroke="#ffffff" strokeWidth="4"/>
              <path d="M30 70 L50 30 L70 70" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round"/>
            </svg>
            <span className="text-sm sm:text-base font-semibold tracking-tight">NotaForge</span>
          </div>

          {/* Right - Role Toggle Button (Mobile) */}
          <button
            onClick={() => isAdmin ? logout() : setLoginModalOpen(true)}
            className={`flex backdrop-blur-sm border rounded-full p-2 sm:px-3 sm:py-2 items-center gap-1 transition-colors shrink-0 ${
              isAdmin
                ? 'bg-amber-600/80 border-amber-500/50 hover:bg-amber-500/80'
                : 'bg-purple-500/10 border-purple-500/40 hover:bg-purple-500/20'
            }`}
          >
            <span className={`text-xs sm:text-sm ${isAdmin ? 'text-white' : 'text-purple-300'}`}>{isAdmin ? 'Admin' : 'Public'}</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-y-auto overflow-x-hidden p-2 pt-2 gap-4 relative">
        {/* Desktop Sidebar - Hidden on mobile/tablet */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col ml-4 fixed top-[88px] left-0 z-40">
          <NoteFormPanel
            title={title}
            setTitle={setTitle}
            content={content}
            setContent={setContent}
            noteType={noteType}
            setNoteType={setNoteType}
            linkUrl={linkUrl}
            setLinkUrl={setLinkUrl}
            fileUrls={fileUrls}
            fileNames={fileNames}
            isSubmitting={isSubmitting}
            isUploading={isUploading}
            uploadSuccess={uploadSuccess}
            isDragging={isDragging}
            handleDragOver={handleDragOver}
            handleDragLeave={handleDragLeave}
            handleDrop={handleDrop}
            handleFileUpload={handleFileUpload}
            handleSubmit={handleSubmit}
            clearAttachment={clearAttachment}
            removeImage={removeImage}
            storageUsedMB={storageUsedMB}
            storageTotalMB={storageTotalMB}
          />
        </aside>

        {/* Main Content - Responsive margin */}
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 overflow-hidden w-full">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className="bg-secondary/60 backdrop-blur-md border-2 rounded-2xl p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 hover:bg-secondary/80 transition-all cursor-pointer h-[240px] sm:h-[280px] w-full"
                  style={{ 
                    borderColor: NOTE_BORDER_COLOR,
                    boxShadow: `0 0 10px ${NOTE_GLOW_COLOR}`
                  }}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-white truncate flex-1 text-sm sm:text-base">
                      {note.title}
                    </h3>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(note);
                          }}
                          className="text-muted-foreground hover:text-white transition-colors shrink-0 p-1"
                        >
                          <Pencil size={14} className="sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(note.id);
                          }}
                          className="text-destructive hover:text-destructive/80 transition-colors shrink-0 p-1"
                        >
                          <Trash2 size={14} className="sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Card Content */}
                  <div className="flex-1 min-h-0 overflow-hidden">
                    {renderNoteContent(note)}
                  </div>
                  
                  {/* Card Footer */}
                  <div className="text-[10px] sm:text-xs text-muted-foreground pt-2 border-t border-border">
                    {formatTimestamp(note.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Floating Action Button */}
      <button
        onClick={() => setMobileFormOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:scale-105 transition-transform active:scale-95"
        aria-label="Add new note"
      >
        <Plus size={24} />
      </button>

      {/* Mobile Sheet for Note Creation */}
      <Sheet open={mobileFormOpen} onOpenChange={setMobileFormOpen}>
        <SheetContent side="bottom" className="h-[85vh] bg-secondary/70 backdrop-blur-xl border-t-2 border-x-2 border-purple-500/50 rounded-t-2xl p-4 flex flex-col">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-white text-left">Add New Note</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <NoteFormPanel
              inSheet
              title={title}
              setTitle={setTitle}
              content={content}
              setContent={setContent}
              noteType={noteType}
              setNoteType={setNoteType}
              linkUrl={linkUrl}
              setLinkUrl={setLinkUrl}
              fileUrls={fileUrls}
              fileNames={fileNames}
              isSubmitting={isSubmitting}
              isUploading={isUploading}
              uploadSuccess={uploadSuccess}
              isDragging={isDragging}
              handleDragOver={handleDragOver}
              handleDragLeave={handleDragLeave}
              handleDrop={handleDrop}
              handleFileUpload={handleFileUpload}
              handleSubmit={handleSubmit}
              clearAttachment={clearAttachment}
              removeImage={removeImage}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Note Popup Modal - Responsive with animation */}
      {selectedNote && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-2 sm:p-4 animate-fade-in"
          onClick={() => { setSelectedNote(null); setIsEditing(false); }}
        >
          <div 
            className="w-full sm:w-[90%] md:w-[85%] lg:w-[70%] h-[90vh] sm:h-[85vh] lg:h-[70vh] max-w-4xl bg-secondary/70 backdrop-blur-xl border-2 rounded-2xl p-4 sm:p-6 overflow-x-hidden overflow-y-auto flex flex-col animate-scale-in"
            style={{ borderColor: NOTE_BORDER_COLOR, boxShadow: `0 0 20px ${NOTE_GLOW_COLOR}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-2 sm:gap-4 mb-4">
              {isEditing ? (
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-lg sm:text-xl font-bold bg-secondary border-border text-white flex-1"
                  placeholder="Note title"
                />
              ) : (
                <h2 className="text-lg sm:text-xl font-bold text-white flex-1 break-words">{selectedNote.title}</h2>
              )}
              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {!isEditing && isAdmin && (
                  <button
                    onClick={() => openEditModal(selectedNote)}
                    className="text-muted-foreground hover:text-white transition-colors p-1"
                  >
                    <Pencil size={18} className="sm:w-5 sm:h-5" />
                  </button>
                )}
                <button
                  onClick={() => { setSelectedNote(null); setIsEditing(false); }}
                  className="text-muted-foreground hover:text-white transition-colors p-1"
                >
                  <X size={22} className="sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 w-full flex-1 overflow-y-auto overflow-x-hidden">
              {/* Text Content - Editable */}
              {isEditing ? (
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[150px] bg-secondary border-border text-white w-full"
                  placeholder="Note content..."
                />
              ) : (
                selectedNote.content && (
                  <p className="text-muted-foreground whitespace-pre-wrap break-words overflow-wrap-anywhere w-full text-sm sm:text-base">{selectedNote.content}</p>
                )
              )}

              {/* Image */}
              {selectedNote.note_type === 'image' && selectedNote.file_url && (
                <img 
                  src={selectedNote.file_url} 
                  alt={selectedNote.title}
                  className="w-full max-h-[300px] sm:max-h-[400px] object-contain rounded border border-border"
                />
              )}

              {/* Link */}
              {selectedNote.note_type === 'link' && selectedNote.link_url && (
                <a 
                  href={selectedNote.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-white hover:underline p-3 bg-secondary rounded border border-border w-full overflow-hidden"
                >
                  <ExternalLink size={18} className="shrink-0" />
                  <span className="break-all overflow-hidden text-sm sm:text-base">{selectedNote.link_url}</span>
                </a>
              )}

              {/* File/PDF */}
              {(selectedNote.note_type === 'file' || selectedNote.note_type === 'pdf') && selectedNote.file_url && (
                <div className="space-y-4">
                  {/* PDF Embed Preview */}
                  {isPdfFile(selectedNote) && (
                    <iframe 
                      src={selectedNote.file_url}
                      className="w-full h-[250px] sm:h-[400px] rounded border border-border bg-white"
                      title="PDF Preview"
                    />
                  )}
                  {/* Download Link */}
                  <a 
                    href={selectedNote.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-white hover:underline p-3 bg-secondary rounded border border-border"
                  >
                    <Download size={18} className="shrink-0" />
                    <span className="text-sm sm:text-base">{selectedNote.file_name || 'Download file'}</span>
                  </a>
                </div>
              )}
            </div>

            {/* Edit Actions */}
            {isEditing && (
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={handleSaveEdit}
                  className="bg-white text-black hover:bg-white/90 flex-1 sm:flex-none"
                >
                  Save Changes
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="border-border text-white hover:bg-secondary flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-4 sm:mt-6 pt-4 border-t border-border text-[10px] sm:text-xs text-muted-foreground">
              Created: {formatTimestamp(selectedNote.created_at)}
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      <AdminLoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLogin={login}
      />
    </div>
  );
}
