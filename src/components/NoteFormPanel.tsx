import { useRef } from 'react';
import { 
  Image, 
  FileText, 
  Link2, 
  Loader2,
  ExternalLink,
  X,
  Check,
  Upload
} from 'lucide-react';
import { MAX_FILE_SIZE_LABEL } from '@/lib/telegram';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NoteType } from '@/hooks/usePublicNotes';

interface NoteFormPanelProps {
  inSheet?: boolean;
  title: string;
  setTitle: (value: string) => void;
  content: string;
  setContent: (value: string) => void;
  noteType: NoteType;
  setNoteType: (value: NoteType) => void;
  linkUrl: string;
  setLinkUrl: (value: string) => void;
  fileUrls: string[];
  fileNames: string[];
  isSubmitting: boolean;
  isUploading: boolean;
  uploadSuccess: boolean;
  isDragging: boolean;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => void;
  handleSubmit: () => void;
  clearAttachment: () => void;
  removeImage: (index: number) => void;
}

export function NoteFormPanel({
  inSheet = false,
  title,
  setTitle,
  content,
  setContent,
  noteType,
  setNoteType,
  linkUrl,
  setLinkUrl,
  fileUrls,
  fileNames,
  isSubmitting,
  isUploading,
  uploadSuccess,
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  handleFileUpload,
  handleSubmit,
  clearAttachment,
  removeImage,
}: NoteFormPanelProps) {
  // Bug fix: key changes whenever fileUrls.length changes so the input
  // element is remounted — this lets the same file be re-selected after removal.
  const imageInputKey = `img-${fileUrls.length}`;
  const fileInputKey  = `file-${fileUrls.length}`;

  return (
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
        <label aria-label="Attach images">
          <input
            key={imageInputKey}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleFileUpload(e, 'image')}
            className="hidden"
            disabled={isUploading || fileUrls.length >= 5}
            aria-label="Attach images"
          />
          <div className={`p-2 rounded border border-border hover:bg-secondary cursor-pointer transition-colors ${noteType === 'image' && fileUrls.length > 0 ? 'bg-secondary border-white' : ''} ${fileUrls.length >= 5 ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Image size={18} className="text-white" aria-hidden="true" />
            <span className="sr-only">Attach images</span>
          </div>
        </label>
        
        <label aria-label="Attach file">
          <input
            key={fileInputKey}
            type="file"
            accept="*/*"
            onChange={(e) => handleFileUpload(e, 'file')}
            className="hidden"
            disabled={isUploading}
            aria-label="Attach file"
          />
          <div className={`p-2 rounded border border-border hover:bg-secondary cursor-pointer transition-colors ${(noteType === 'file' || noteType === 'pdf' || noteType === 'video' || noteType === 'audio') && fileUrls.length > 0 ? 'bg-secondary border-white' : ''}`}>
            <FileText size={18} className="text-white" aria-hidden="true" />
            <span className="sr-only">Attach file</span>
          </div>
        </label>
        
        <button
          type="button"
          className={`p-2 rounded border border-border hover:bg-secondary transition-colors ${noteType === 'link' ? 'bg-secondary border-white' : ''}`}
          onClick={() => setNoteType(noteType === 'link' ? 'text' : 'link')}
          aria-label="Toggle link attachment"
          aria-pressed={noteType === 'link'}
        >
          <Link2 size={18} className="text-white" aria-hidden="true" />
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
          Max 5 files · {MAX_FILE_SIZE_LABEL} per file · Any type supported
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
      {(fileUrls.length > 0 || (noteType === 'link' && linkUrl)) && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Preview {fileUrls.length > 1 && `(${fileUrls.length} images)`}
            </h3>
            <button
              onClick={clearAttachment}
              className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1"
            >
              <X size={12} /> Remove All
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

          {/* Multi-Image Preview - Custom size, mobile optimized */}
          {noteType === 'image' && fileUrls.length > 0 && (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {fileUrls.map((url, index) => (
                <div key={index} className="relative group aspect-square">
                  <img 
                    src={url} 
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-contain rounded border border-border bg-secondary/50"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-destructive rounded-full flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    aria-label={`Remove image ${index + 1}`}
                  >
                    <X size={10} className="text-white" aria-hidden="true" />
                  </button>
                  <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-background/80 px-1 rounded text-muted-foreground">
                    {index + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* File Preview */}
          {noteType === 'file' && fileUrls.length > 0 && (
            <div className="flex items-center gap-2 p-2 bg-secondary rounded border border-border">
              {fileNames[0]?.toLowerCase().endsWith('.pdf') ? (
                <div className="w-6 h-7 bg-destructive rounded flex items-center justify-center">
                  <span className="text-white text-[8px] font-bold">PDF</span>
                </div>
              ) : (
                <FileText size={16} className="text-white shrink-0" />
              )}
              <span className="text-sm truncate">{fileNames[0]}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
