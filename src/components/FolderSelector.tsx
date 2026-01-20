import { Folder as FolderIcon } from 'lucide-react';
import { Folder } from '@/hooks/useFolders';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface FolderSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  folders: Folder[];
  onSelectFolder: (folderId: string) => void;
}

export function FolderSelector({ isOpen, onClose, folders, onSelectFolder }: FolderSelectorProps) {
  const handleSelect = (folderId: string) => {
    onSelectFolder(folderId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">Move to Folder</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {folders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No folders available. Create a folder first.
            </p>
          ) : (
            folders.map((folder) => (
              <Button
                key={folder.id}
                variant="ghost"
                onClick={() => handleSelect(folder.id)}
                className="w-full justify-start gap-3 h-auto py-3"
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <FolderIcon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground">{folder.name}</span>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
