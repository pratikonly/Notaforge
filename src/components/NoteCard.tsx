import React from 'react';
import { 
  FileText, Image, FileIcon, Video, Music, Link, 
  Pin, PinOff, Trash2, Edit2, ExternalLink, Archive, FolderInput, FolderMinus
} from 'lucide-react';
import { Note, NoteType } from '@/hooks/useNotes';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface NoteCardProps {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, isPinned: boolean) => void;
  onArchive?: (id: string) => void;
  onMoveToFolder?: (noteId: string) => void;
  onRemoveFromFolder?: (noteId: string) => void;
  showMoveButton?: boolean;
  showRemoveFromFolder?: boolean;
}

const typeIcons: Record<NoteType, React.ElementType> = {
  text: FileText,
  image: Image,
  pdf: FileIcon,
  video: Video,
  audio: Music,
  link: Link,
  file: FileIcon,
};

const typeColors: Record<NoteType, string> = {
  text: 'text-primary',
  image: 'text-vault-success',
  pdf: 'text-destructive',
  video: 'text-vault-warning',
  audio: 'text-primary',
  link: 'text-primary',
  file: 'text-muted-foreground',
};

export function NoteCard({ 
  note, 
  onEdit, 
  onDelete, 
  onTogglePin, 
  onArchive,
  onMoveToFolder,
  onRemoveFromFolder,
  showMoveButton = false,
  showRemoveFromFolder = false,
}: NoteCardProps) {
  const Icon = typeIcons[note.note_type];

  const renderContent = () => {
    switch (note.note_type) {
      case 'image':
        return note.file_url ? (
          <div className="mt-3 rounded-lg overflow-hidden">
            <img 
              src={note.file_url} 
              alt={note.title} 
              className="w-full object-cover"
            />
          </div>
        ) : null;
      case 'video':
        return note.file_url ? (
          <div className="mt-3 rounded-lg overflow-hidden">
            <video 
              src={note.file_url} 
              controls
              className="w-full max-h-48 object-contain bg-secondary/50"
              preload="metadata"
            >
              Your browser does not support video playback.
            </video>
            {note.content && (
              <p className="mt-2 text-muted-foreground text-sm whitespace-pre-wrap break-words">
                {note.content}
              </p>
            )}
          </div>
        ) : note.file_name ? (
          <div className="mt-3 flex items-center gap-2 text-muted-foreground text-sm">
            <Video className="w-4 h-4 flex-shrink-0" />
            <span className="break-all">{note.file_name}</span>
          </div>
        ) : null;
      case 'audio':
        return note.file_url ? (
          <div className="mt-3 space-y-2">
            <audio 
              src={note.file_url} 
              controls
              className="w-full h-10"
              preload="metadata"
            >
              Your browser does not support audio playback.
            </audio>
            {note.file_name && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Music className="w-3 h-3 flex-shrink-0" />
                <span className="break-all truncate">{note.file_name}</span>
              </div>
            )}
            {note.content && (
              <p className="text-muted-foreground text-sm whitespace-pre-wrap break-words">
                {note.content}
              </p>
            )}
          </div>
        ) : note.file_name ? (
          <div className="mt-3 flex items-center gap-2 text-muted-foreground text-sm">
            <Music className="w-4 h-4 flex-shrink-0" />
            <span className="break-all">{note.file_name}</span>
          </div>
        ) : null;
      case 'link':
        return note.link_url ? (
          <a 
            href={note.link_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-2 text-primary hover:underline text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
            <span className="break-all">{note.link_url}</span>
          </a>
        ) : null;
      case 'pdf':
      case 'file':
        return note.file_name ? (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <FileIcon className="w-4 h-4 flex-shrink-0" />
              <span className="break-all">{note.file_name}</span>
            </div>
            {note.file_url && (
              <a
                href={note.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="w-3 h-3" />
                Open file
              </a>
            )}
          </div>
        ) : null;
      default:
        return note.content ? (
          <p className="mt-3 text-muted-foreground text-sm whitespace-pre-wrap break-words">
            {note.content}
          </p>
        ) : null;
    }
  };

  return (
    <div className="note-card rounded-xl p-3 sm:p-4 animate-scale-in transition-all">
      {/* Header with title, type icon, and move button */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className={`p-1 sm:p-1.5 rounded-lg bg-secondary flex-shrink-0 ${typeColors[note.note_type]}`}>
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <h3 className="font-medium text-foreground break-words text-sm sm:text-base flex-1">{note.title}</h3>
          {note.is_pinned && (
            <Pin className="w-3 h-3 text-primary flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {showRemoveFromFolder && onRemoveFromFolder && (
            <Button
              variant="vault-ghost"
              size="icon"
              onClick={() => onRemoveFromFolder(note.id)}
              className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0"
              title="Remove from folder"
            >
              <FolderMinus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          )}
          {showMoveButton && onMoveToFolder && (
            <Button
              variant="vault-ghost"
              size="icon"
              onClick={() => onMoveToFolder(note.id)}
              className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0"
              title="Move to folder"
            >
              <FolderInput className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Full content preview - dynamic height */}
      {renderContent()}

      {/* Timestamp */}
      <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-border/50">
        <span className="text-[10px] sm:text-xs text-muted-foreground">
          {format(new Date(note.updated_at), 'MMM d, yyyy · h:mm a')}
        </span>
      </div>

      {/* Action buttons */}
      <div className="mt-2 sm:mt-3 flex items-center justify-end gap-0.5 sm:gap-1">
        <Button 
          variant="vault-ghost" 
          size="icon"
          onClick={() => onEdit(note)}
          className="h-7 w-7 sm:h-8 sm:w-8"
          title="Edit"
        >
          <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </Button>
        <Button 
          variant="vault-ghost" 
          size="icon"
          onClick={() => onTogglePin(note.id, !note.is_pinned)}
          className="h-7 w-7 sm:h-8 sm:w-8"
          title={note.is_pinned ? "Unpin" : "Pin"}
        >
          {note.is_pinned ? <PinOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Pin className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
        </Button>
        {onArchive && (
          <Button 
            variant="vault-ghost" 
            size="icon"
            onClick={() => onArchive(note.id)}
            className="h-7 w-7 sm:h-8 sm:w-8"
            title="Archive"
          >
            <Archive className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </Button>
        )}
        <Button 
          variant="vault-ghost" 
          size="icon"
          onClick={() => onDelete(note.id)}
          className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </Button>
      </div>
    </div>
  );
}
