import { useState, useCallback, useEffect } from 'react';
import { usePublicNotes, Note, NoteType } from '@/hooks/usePublicNotes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  Image, 
  FileText, 
  Link2, 
  Trash2, 
  Loader2,
  ExternalLink,
  Download,
  Pencil,
  X,
  FileIcon,
  Check,
  Upload,
  Plus,
  Menu
} from 'lucide-react';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

export function NotaForgeDashboard() {
  const { notes, loading, createNote, updateNote, deleteNote, uploadFile } = usePublicNotes();
  const isMobile = useIsMobile();
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('text');
  const [linkUrl, setLinkUrl] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
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
    setFileUrl(null);
    setFileName(null);
  };

  // Process file upload (shared by input, drag & drop, and paste)
  const processFileUpload = useCallback(async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const type: 'image' | 'file' = isImage ? 'image' : 'file';
    
    // Check file size based on type (10MB for images, 50MB for files)
    const maxSize = type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    const maxSizeLabel = type === 'image' ? '10MB' : '50MB';
    
    if (file.size > maxSize) {
      alert(`File size must be less than ${maxSizeLabel}`);
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);
    const url = await uploadFile(file);
    setIsUploading(false);

    if (url) {
      setFileUrl(url);
      setFileName(file.name);
      setNoteType(type);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 3000);
    }
  }, [uploadFile]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFileUpload(file);
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
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFileUpload(files[0]);
    }
  }, [processFileUpload]);

  // Ctrl+V paste handler
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            await processFileUpload(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFileUpload]);

  const clearAttachment = () => {
    setFileUrl(null);
    setFileName(null);
    setNoteType('text');
    setLinkUrl('');
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

  const handleSubmit = async () => {
    if (!title.trim() && !content.trim() && !fileUrl && !linkUrl.trim()) {
      return;
    }

    setIsSubmitting(true);
    
    await createNote({
      title: title.trim() || 'Untitled',
      content: content.trim() || null,
      note_type: noteType,
      file_url: fileUrl,
      file_name: fileName,
      link_url: linkUrl.trim() || null,
    });

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
          <img 
            src={note.file_url} 
            alt={note.title}
            className="w-full h-32 object-cover rounded border border-border"
          />
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

  // Note Form Component - Reused in sidebar and mobile sheet
  const NoteForm = ({ inSheet = false }: { inSheet?: boolean }) => (
    <div 
      className={`bg-secondary/50 border rounded-2xl p-4 flex flex-col transition-all relative ${
        isDragging 
          ? 'border-primary border-2 bg-primary/10' 
          : 'border-border'
      } ${inSheet ? 'min-h-0 flex-1' : 'min-h-[580px]'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-2xl z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload size={32} />
            <span className="text-sm font-medium">Drop file here</span>
          </div>
        </div>
      )}
      {/* Title Input */}
      <Input
        placeholder="Note Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mb-3 bg-secondary border-border text-white placeholder:text-muted-foreground"
      />
      
      {/* Content Textarea */}
      <Textarea
        placeholder="Your note (optional)..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className={`mb-4 bg-secondary border-border text-white placeholder:text-muted-foreground resize-y ${inSheet ? 'min-h-[80px]' : 'min-h-[100px]'}`}
      />
      
      {/* Attachment Buttons */}
      <div className="flex gap-2 mb-2">
        <label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleFileUpload(e, 'image')}
            className="hidden"
            disabled={isUploading}
          />
          <div className={`p-2 rounded border border-border hover:bg-secondary cursor-pointer transition-colors ${noteType === 'image' && fileUrl ? 'bg-secondary border-white' : ''}`}>
            <Image size={18} className="text-white" />
          </div>
        </label>
        
        <label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt,.zip,.rar"
            onChange={(e) => handleFileUpload(e, 'file')}
            className="hidden"
            disabled={isUploading}
          />
          <div className={`p-2 rounded border border-border hover:bg-secondary cursor-pointer transition-colors ${noteType === 'file' && fileUrl ? 'bg-secondary border-white' : ''}`}>
            <FileText size={18} className="text-white" />
          </div>
        </label>
        
        <button
          type="button"
          className={`p-2 rounded border border-border hover:bg-secondary transition-colors ${noteType === 'link' ? 'bg-secondary border-white' : ''}`}
          onClick={() => setNoteType(noteType === 'link' ? 'text' : 'link')}
        >
          <Link2 size={18} className="text-white" />
        </button>
      </div>

      {/* Link Input - Shows when link type is selected */}
      {noteType === 'link' && (
        <Input
          placeholder="https://example.com"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          className="mb-3 bg-secondary border-border text-white placeholder:text-muted-foreground"
        />
      )}

      {/* Upload Limits & Success */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          Images: 10MB max | Files: 50MB max
        </p>
        {uploadSuccess && (
          <span className="text-xs text-green-500 flex items-center gap-1">
            <Check size={12} /> Uploaded
          </span>
        )}
      </div>
      
      {/* Add Note Button */}
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || isUploading}
        className="w-full bg-white text-black hover:bg-white/90 font-semibold rounded-lg"
      >
        {isSubmitting ? (
          <Loader2 className="animate-spin mr-2" size={16} />
        ) : isUploading ? (
          <Loader2 className="animate-spin mr-2" size={16} />
        ) : null}
        {isUploading ? 'Uploading...' : 'Add Note'}
      </Button>

      {/* Preview Panel - Shows under Add Note button when there's content */}
      {(fileUrl || (noteType === 'link' && linkUrl)) && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground">Preview</h3>
            <button
              onClick={clearAttachment}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <X size={12} /> Remove
            </button>
          </div>
          
          {/* Link Preview */}
          {noteType === 'link' && linkUrl && (
            <a 
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-white hover:underline text-sm break-all p-2 bg-secondary rounded border border-border"
            >
              <ExternalLink size={14} className="shrink-0" />
              <span className="truncate">{linkUrl}</span>
            </a>
          )}

          {/* Image Preview */}
          {noteType === 'image' && fileUrl && (
            <div className="space-y-2">
              <img 
                src={fileUrl} 
                alt="Preview"
                className="w-full h-32 object-cover rounded border border-border"
              />
              <p className="text-xs text-muted-foreground truncate">📷 {fileName}</p>
            </div>
          )}

          {/* File Preview */}
          {noteType === 'file' && fileUrl && (
            <div className="flex items-center gap-2 p-2 bg-secondary rounded border border-border">
              {fileName?.toLowerCase().endsWith('.pdf') ? (
                <div className="w-6 h-7 bg-red-600 rounded flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">PDF</span>
                </div>
              ) : (
                <FileText size={16} className="text-white shrink-0" />
              )}
              <span className="text-sm truncate">{fileName}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top Navbar - Responsive */}
      <header className="sticky top-0 z-50 bg-black pt-3 sm:pt-4 pb-2 px-2 sm:px-4">
        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-0">
          {/* Left - Made by Pratik (hidden on mobile) */}
          <a
            href="https://xpratik.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex bg-secondary/80 backdrop-blur-sm border border-border rounded-full px-4 py-2 items-center gap-2 hover:bg-secondary transition-colors ml-4"
          >
            <span className="text-sm text-muted-foreground">Made by Pratik</span>
            <img 
              src="https://raw.githubusercontent.com/pratik11500/PratikPortfolio/refs/heads/replit-agent/assets/images/logo.png" 
              alt="Pratik Logo"
              className="w-5 h-5 object-contain"
            />
          </a>

          {/* Center - Main navbar */}
          <div className="flex-1 flex justify-center lg:justify-center">
            <div className="w-full sm:w-[80%] lg:w-[60%] max-w-md lg:max-w-none bg-secondary/80 backdrop-blur-sm border border-border rounded-full px-4 sm:px-6 py-2 sm:py-3 flex items-center justify-between">
              {/* Left side - SVG Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-6 h-6 sm:w-8 sm:h-8">
                <rect width="100" height="100" rx="20" fill="#000000" stroke="#ffffff" strokeWidth="4"/>
                <path d="M30 70 L50 30 L70 70" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round"/>
              </svg>
              
              {/* Right side - Name */}
              <span className="text-sm sm:text-base font-semibold tracking-tight">NotaForge</span>
            </div>
          </div>
          
          {/* Right spacer for balance - hidden on mobile/tablet */}
          <div className="hidden lg:block w-[200px] mr-4"></div>
        </div>
      </header>

      <div className="flex flex-1 overflow-y-auto overflow-x-hidden p-2 pt-2 gap-4 relative">
        {/* Desktop Sidebar - Hidden on mobile/tablet */}
        <aside className="hidden lg:flex w-72 shrink-0 flex-col ml-4 fixed top-[88px] left-0 z-40">
          <NoteForm />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 overflow-hidden w-full">
              {notes.map((note) => (
                <div
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className="bg-black border border-border rounded-lg p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 hover:border-muted-foreground/50 transition-colors cursor-pointer h-[240px] sm:h-[280px] w-full"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-white truncate flex-1 text-sm sm:text-base">
                      {note.title}
                    </h3>
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
        <SheetContent side="bottom" className="h-[85vh] bg-black border-border rounded-t-2xl p-4 flex flex-col">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-white text-left">Add New Note</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <NoteForm inSheet />
          </div>
        </SheetContent>
      </Sheet>

      {/* Note Popup Modal - Responsive */}
      {selectedNote && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-blue-900/10 backdrop-blur-sm p-2 sm:p-4"
          onClick={() => { setSelectedNote(null); setIsEditing(false); }}
        >
          <div 
            className="w-full sm:w-[90%] md:w-[85%] lg:w-[70%] h-[90vh] sm:h-[85vh] lg:h-[70vh] max-w-4xl bg-black border border-border rounded-2xl p-4 sm:p-6 overflow-x-hidden overflow-y-auto flex flex-col"
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
                {!isEditing && (
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
    </div>
  );
}
