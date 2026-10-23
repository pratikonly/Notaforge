import { Skeleton } from '@/components/ui/skeleton';

const bar = 'rgba(255,255,255,0.07)';

/** Placeholder matching the real note card (same size, border, glass look). */
export function NoteCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="relative rounded-2xl p-3 sm:p-4 flex flex-col gap-2 h-[240px] sm:h-[280px] w-full overflow-hidden"
      style={{
        background:
          'linear-gradient(150deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 60%, rgba(0,0,0,0.18) 100%)',
        border: '1.5px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)',
        backdropFilter: 'blur(14px)',
      }}
    >
      {/* Header: dot + title */}
      <div className="flex items-center gap-1.5">
        <Skeleton className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: bar }} />
        <Skeleton className="h-4 w-3/5" style={{ background: bar }} />
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex flex-col gap-2 pt-1">
        <Skeleton className="h-3 w-full" style={{ background: bar }} />
        <Skeleton className="h-3 w-[92%]" style={{ background: bar }} />
        <Skeleton className="h-3 w-[78%]" style={{ background: bar }} />
        <Skeleton className="h-3 w-[86%]" style={{ background: bar }} />
        <Skeleton className="h-3 w-[55%]" style={{ background: bar }} />
      </div>

      {/* Footer: tag + date */}
      <div
        className="flex items-center gap-1.5 pt-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.055)' }}
      >
        <Skeleton className="h-4 w-10 rounded-md" style={{ background: bar }} />
        <Skeleton className="h-3 w-20" style={{ background: bar }} />
      </div>
    </div>
  );
}

/** Grid of note card skeletons, same grid classes as the real grid. */
export function NotesGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading notes"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full"
    >
      {Array.from({ length: count }).map((_, i) => (
        <NoteCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Circular placeholders for the folder rails. size: 44 mobile, 40 desktop. */
export function FolderRailSkeleton({ size = 44, count = 4 }: { size?: number; count?: number }) {
  return (
    <>
      <div className="shrink-0 w-6 h-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          aria-hidden="true"
          className="shrink-0 rounded-full"
          style={{ width: size, height: size, background: bar, animationDelay: `${i * 120}ms` }}
        />
      ))}
    </>
  );
}
