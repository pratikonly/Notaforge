import { Folder as FolderIcon, Edit2, Trash2, Archive, MoreVertical, ChevronRight, FolderPlus } from 'lucide-react';
import { Folder } from '@/hooks/useFolders';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface FolderCardProps {
  folder: Folder;
  noteCount: number;
  subfolderCount?: number;
  onClick: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onCreateSubfolder?: () => void;
}

export function FolderCard({ 
  folder, 
  noteCount, 
  subfolderCount = 0,
  onClick, 
  onRename, 
  onArchive, 
  onDelete,
  onCreateSubfolder,
}: FolderCardProps) {
  return (
    <div 
      className="note-card rounded-xl p-3 sm:p-4 cursor-pointer transition-all duration-200"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="p-2 sm:p-2.5 rounded-lg bg-primary/10 flex-shrink-0 relative">
            <FolderIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            {subfolderCount > 0 && (
              <ChevronRight className="w-2.5 h-2.5 text-primary absolute -right-0.5 -bottom-0.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-foreground truncate text-sm sm:text-base">{folder.name}</h3>
            <p className="text-xs text-muted-foreground">
              {noteCount} {noteCount === 1 ? 'note' : 'notes'}
              {subfolderCount > 0 && ` · ${subfolderCount} subfolder${subfolderCount > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            {onCreateSubfolder && (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateSubfolder(); }}>
                  <FolderPlus className="w-4 h-4 mr-2" />
                  New Subfolder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(); }}>
              <Edit2 className="w-4 h-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(); }}>
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
