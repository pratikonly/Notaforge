import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface PdfViewerProps {
  url: string;
  fileName?: string | null;
}

interface PageProps {
  pdf: any;
  pageNumber: number;
  width: number;
}

function PdfPage({ pdf, pageNumber, width }: PageProps) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [height, setHeight]   = useState(Math.round(width * 1.414));

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
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || width <= 0) return;
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const base  = page.getViewport({ scale: 1 });
        const dpr   = Math.min(window.devicePixelRatio || 1, 2);
        const view  = page.getViewport({ scale: (width / base.width) * dpr });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width  = Math.floor(view.width);
        canvas.height = Math.floor(view.height);
        canvas.style.width  = `${width}px`;
        canvas.style.height = `${Math.round(view.height / dpr)}px`;
        setHeight(Math.round(view.height / dpr));
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const task = page.render({ canvasContext: ctx, viewport: view });
        renderTask = task;
        await task.promise;
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('PDF page error:', err);
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [visible, pdf, pageNumber, width]);

  return (
    <div ref={wrapRef} style={{ width, minHeight: height, background: '#fff' }} className="mx-auto mb-2 shadow-md">
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}

/**
 * Scrollable in-page PDF reader. Works on mobile, where iframes cannot
 * show PDFs. Pages render lazily as they scroll into view.
 */
export function PdfViewer({ url, fileName }: PdfViewerProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf]         = useState<any>(null);
  const [pages, setPages]     = useState(0);
  const [width, setWidth]     = useState(0);
  const [error, setError]     = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(200, Math.floor(el.clientWidth - 16)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    setPdf(null); setPages(0); setError(false);

    (async () => {
      try {
        const { pdfjs } = await import('@/lib/pdf');
        const loading = pdfjs.getDocument({ url });
        task = loading;
        const doc = await loading.promise;
        if (cancelled) return;
        setPdf(doc);
        setPages(doc.numPages);
      } catch (err) {
        console.error('PDF load error:', err);
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      task?.destroy().catch(() => {});
    };
  }, [url]);

  return (
    <div
      ref={boxRef}
      className="rounded-2xl border border-white/10 overflow-y-auto relative"
      style={{ background: '#1a1a2e', height: '460px', padding: '8px' }}
      aria-label={fileName || 'PDF preview'}
    >
      {!pdf && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(96,165,250,0.7)' }} />
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Loading PDF…</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Could not show this PDF here.</span>
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: '#60a5fa' }}>
            Open in new tab
          </a>
        </div>
      )}
      {pdf && width > 0 &&
        Array.from({ length: pages }, (_, i) => (
          <PdfPage key={i + 1} pdf={pdf} pageNumber={i + 1} width={width} />
        ))}
    </div>
  );
}