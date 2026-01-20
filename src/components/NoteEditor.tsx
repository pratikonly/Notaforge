import { useState, useRef, useEffect } from 'react';
import { 
  X, FileText, Image, FileIcon, Video, Music, Link, 
  Upload, Save, Loader2 
} from 'lucide-react';
import { Note, NoteType } from '@/hooks/useNotes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface NoteEditorProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteData: Partial<Note>) => Promise<void>;
  onUploadFile: (file: File) => Promise<string | null>;
}

const noteTypes: { type: NoteType; label: string; icon: React.ElementType }[] = [
  { type: 'text', label: 'Text', icon: FileText },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'pdf', label: 'PDF', icon: FileIcon },
  { type: 'video', label: 'Video', icon: Video },
  { type: 'audio', label: 'Audio', icon: Music },
  { type: 'link', label: 'Link', icon: Link },
  { type: 'file', label: 'File', icon: FileIcon },
];

export function NoteEditor({ note, isOpen, onClose, onSave, onUploadFile }: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('text');
  const [linkUrl, setLinkUrl] = useState('');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content || '');
      setNoteType(note.note_type);
      setLinkUrl(note.link_url || '');
      setFileUrl(note.file_url);
      setFileName(note.file_name);
    } else {
      setTitle('');
      setContent('');
      setNoteType('text');
      setLinkUrl('');
      setFileUrl(null);
      setFileName(null);
    }
  }, [note, isOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const url = await onUploadFile(file);
    setIsUploading(false);

    if (url) {
      setFileUrl(url);
      setFileName(file.name);
      
      // Auto-detect note type from file
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
        setNoteType('image');
      } else if (ext === 'pdf') {
        setNoteType('pdf');
      } else if (['mp4', 'webm', 'mov'].includes(ext || '')) {
        setNoteType('video');
      } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) {
        setNoteType('audio');
      } else {
        setNoteType('file');
      }
    }
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim() && !fileUrl && !linkUrl) return;

    setIsSaving(true);
    await onSave({
      id: note?.id,
      title: title.trim() || 'Untitled',
      content,
      note_type: noteType,
      file_url: fileUrl,
      file_name: fileName,
      link_url: noteType === 'link' ? linkUrl : null,
    });
    setIsSaving(false);
    onClose();
  };

  const getAcceptedFileTypes = () => {
    switch (noteType) {
      case 'image': return 'image/jpeg,image/png,image/gif,image/webp';
      case 'pdf': return 'application/pdf';
      case 'video': return 'video/mp4,video/webm,video/quicktime';
      case 'audio': return 'audio/mpeg,audio/wav,audio/ogg,audio/mp4';
      default: return '*';
    }
  };

  const getAcceptedFormatsLabel = () => {
    switch (noteType) {
      case 'image': return 'Supports: JPG, PNG, GIF, WEBP';
      case 'pdf': return 'Supports: PDF';
      case 'video': return 'Supports: MP4, WEBM, MOV';
      case 'audio': return 'Supports: MP3, WAV, OGG, M4A';
      case 'file': return 'Supports: Any file type';
      default: return '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {note ? 'Edit Note' : 'Create Note'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Note Type Selector */}
          <div className="flex flex-wrap gap-2">
            {noteTypes.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                onClick={() => setNoteType(type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                  noteType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Title Input */}
          <Input
            placeholder="Note title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-medium"
          />

          {/* Content based on type */}
          {noteType === 'text' && (
            <Textarea
              placeholder="Write your note here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px] resize-none"
            />
          )}

          {noteType === 'link' && (
            <div className="space-y-3">
              <Input
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <Textarea
                placeholder="Add a description (optional)..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[100px] resize-none"
              />
            </div>
          )}

          {['image', 'pdf', 'video', 'audio', 'file'].includes(noteType) && (
            <div className="space-y-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept={getAcceptedFileTypes()}
                className="hidden"
              />
              
              {fileUrl ? (
                <div className="space-y-3">
                  {noteType === 'image' && (
                    <img 
                      src={fileUrl} 
                      alt={fileName || 'Uploaded image'} 
                      className="w-full max-h-64 object-contain rounded-lg bg-secondary"
                    />
                  )}
                  <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
                    <FileIcon className="w-5 h-5 text-primary" />
                    <span className="text-sm text-foreground truncate flex-1">{fileName}</span>
                    <Button
                      variant="vault-ghost"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="w-full p-8 border-2 border-dashed border-border rounded-xl hover:border-primary/50 transition-colors flex flex-col items-center gap-3"
                >
                  {isUploading ? (
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8 text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground text-sm">
                    {isUploading ? 'Uploading...' : `Click to upload ${noteType}`}
                  </span>
                  <span className="text-muted-foreground/70 text-xs">
                    {getAcceptedFormatsLabel()}
                  </span>
                </button>
              )}

              <Textarea
                placeholder="Add a description (optional)..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              variant="vault" 
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Note
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
