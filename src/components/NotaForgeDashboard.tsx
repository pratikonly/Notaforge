import { useState } from 'react';
import { usePublicNotes, Note, NoteType } from '@/hooks/usePublicNotes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Image, 
  FileText, 
  Link2, 
  Trash2, 
  Loader2,
  ExternalLink,
  Download
} from 'lucide-react';
import { format } from 'date-fns';

export function NotaForgeDashboard() {
  const { notes, loading, createNote, deleteNote, uploadFile } = usePublicNotes();
  
  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('text');
  const [linkUrl, setLinkUrl] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setNoteType('text');
    setLinkUrl('');
    setFileUrl(null);
    setFileName(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setIsUploading(true);
    const url = await uploadFile(file);
    setIsUploading(false);

    if (url) {
      setFileUrl(url);
      setFileName(file.name);
      setNoteType(type);
    }
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
          <a 
            href={note.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-white hover:underline"
          >
            <Download size={14} className="shrink-0" />
            <span className="truncate">{note.file_name || 'Download file'}</span>
          </a>
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
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top Navbar - 70% width centered */}
      <header className="sticky top-0 z-50 bg-black pt-4 pb-2">
        <div className="flex justify-center">
          <div className="w-[50%] bg-secondary/80 backdrop-blur-sm border border-border rounded-full px-6 py-2 flex items-center justify-between">
            {/* Left side - SVG Icon */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" className="w-8 h-8">
              <rect width="100" height="100" rx="20" fill="#000000" stroke="#ffffff" strokeWidth="4"/>
              <path d="M30 70 L50 30 L70 70" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round"/>
            </svg>
            
            {/* Right side - Name */}
            <span className="text-base font-semibold tracking-tight">NotaForge</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Always visible */}
        <aside className="w-80 border-r border-border bg-black flex flex-col shrink-0">
          <div className="p-4 flex-1 overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">Add Note</h2>
            
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
              className="mb-4 min-h-[120px] bg-secondary border-border text-white placeholder:text-muted-foreground resize-none"
            />
            
            {/* Attachment Buttons */}
            <div className="flex gap-2 mb-3">
              <label className="flex-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'image')}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-border hover:bg-secondary"
                  disabled={isUploading}
                  asChild
                >
                  <span className="cursor-pointer flex items-center justify-center gap-2">
                    <Image size={16} />
                    Image
                  </span>
                </Button>
              </label>
              
              <label className="flex-1">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.zip,.rar"
                  onChange={(e) => handleFileUpload(e, 'file')}
                  className="hidden"
                  disabled={isUploading}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-border hover:bg-secondary"
                  disabled={isUploading}
                  asChild
                >
                  <span className="cursor-pointer flex items-center justify-center gap-2">
                    <FileText size={16} />
                    File
                  </span>
                </Button>
              </label>
              
              <Button
                type="button"
                variant="outline"
                className={`flex-1 border-border hover:bg-secondary ${noteType === 'link' ? 'bg-secondary' : ''}`}
                onClick={() => setNoteType(noteType === 'link' ? 'text' : 'link')}
              >
                <Link2 size={16} />
                Link
              </Button>
            </div>

            {/* Link Input */}
            {noteType === 'link' && (
              <Input
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="mb-3 bg-secondary border-border text-white placeholder:text-muted-foreground"
              />
            )}

            {/* File Preview */}
            {fileUrl && (
              <div className="mb-3 p-2 bg-secondary rounded border border-border text-sm truncate">
                📎 {fileName}
              </div>
            )}

            {/* Upload Limits */}
            <p className="text-xs text-destructive mb-4">
              Max 5MB per file
            </p>
            
            {/* Add Note Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || isUploading}
              className="w-full bg-white text-black hover:bg-white/90 font-semibold"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin mr-2" size={16} />
              ) : null}
              Add Note
            </Button>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border">
            <a
              href="https://xpratik.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-white transition-colors flex items-center gap-2"
            >
              Made by Pratik
              <ExternalLink size={12} />
            </a>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin" size={32} />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText size={48} className="mb-4" />
              <p>No notes yet. Add your first note!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="bg-black border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-muted-foreground/50 transition-colors"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-white truncate flex-1">
                      {note.title}
                    </h3>
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-destructive hover:text-destructive/80 transition-colors shrink-0"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  {/* Card Content */}
                  <div className="flex-1 min-h-0">
                    {renderNoteContent(note)}
                  </div>
                  
                  {/* Card Footer */}
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                    {formatTimestamp(note.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
