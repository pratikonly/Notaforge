import { useEffect, useRef, useState, type ReactNode } from 'react';

interface PdfThumbnailProps {
  url: string;
  fallback: ReactNode;
}

/**
 * Renders page 1 of a PDF as a cover image. Loads only when scrolled into
 * view, and falls back to `fallback` if the PDF cannot be read.
 */
export function PdfThumbnail({ url, fallback }: PdfThumbnailProps) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus]   = useState<'loading' | 'done' | 'error'>('loading');

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;

    (async () => {
      try {
        setStatus('loading');
        const { pdfjs } = await import('@/lib/pdf');
        const loading = pdfjs.getDocument({ url, disableAutoFetch: true });
        task = loading;
        const pdf  = await loading.promise;
        const page = await pdf.getPage(1);
        if (cancelled) return;

        const base   = page.getViewport({ scale: 1 });
        const dpr    = Math.min(window.devicePixelRatio || 1, 2);
        const scale  = (360 / base.width) * dpr;
        const view   = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width  = Math.floor(view.width);
        canvas.height = Math.floor(view.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No canvas context');

        await page.render({ canvasContext: ctx, viewport: view }).promise;
        if (!cancelled) setStatus('done');
      } catch (err) {
        console.error('PDF thumbnail error:', err);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      task?.destroy().catch(() => {});
    };
  }, [visible, url]);

  if (status === 'error') return <>{fallback}</>;

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full rounded-xl overflow-hidden"
      style={{ background: '#ffffff' }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          objectFit: 'cover',
          objectPosition: 'top',
          opacity: status === 'done' ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      />
      {status !== 'done' && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
          <span className="text-[10px] tracking-widest font-bold text-white/60">PDF</span>
        </div>
      )}
      {status === 'done' && (
        <span
          className="absolute left-1.5 bottom-1.5 text-[9px] font-bold tracking-widest px-1.5 py-0.5 rounded"
          style={{ background: '#dc2626', color: '#fff' }}
        >
          PDF
        </span>
      )}
    </div>
  );
}