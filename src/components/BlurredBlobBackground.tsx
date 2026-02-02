export function BlurredBlobBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* SVG Blobs Layer */}
      <svg 
        className="fixed inset-0 w-full h-full z-0"
        preserveAspectRatio="xMidYMid slice" 
        viewBox="10 10 80 80"
      >
        <defs>
          <radialGradient id="Gradient1" cx="50%" cy="50%" fx="10%" fy="50%" r=".5">
            <animate attributeName="fx" dur="34s" values="0%;3%;0%" repeatCount="indefinite" />
            <stop offset="0%" stopColor="#ffaa40" />
            <stop offset="100%" stopColor="#9c40ff" />
          </radialGradient>
          <radialGradient id="Gradient2" cx="50%" cy="50%" fx="10%" fy="50%" r=".5">
            <animate attributeName="fx" dur="23.5s" values="0%;3%;0%" repeatCount="indefinite" />
            <stop offset="0%" stopColor="#e81d1d" />
            <stop offset="100%" stopColor="#e8b71d" />
          </radialGradient>
          <radialGradient id="Gradient3" cx="50%" cy="50%" fx="50%" fy="50%" r=".5">
            <animate attributeName="fx" dur="21.5s" values="0%;3%;0%" repeatCount="indefinite" />
            <stop offset="0%" stopColor="#1de840" />
            <stop offset="100%" stopColor="#1ddde8" />
          </radialGradient>
          <radialGradient id="Gradient4" cx="50%" cy="50%" fx="50%" fy="50%" r=".5">
            <animate attributeName="fx" dur="23s" values="0%;3%;0%" repeatCount="indefinite" />
            <stop offset="0%" stopColor="#2b1de8" />
            <stop offset="100%" stopColor="#dd00f3" />
          </radialGradient>
        </defs>
        
        <rect fill="url(#Gradient1)" className="blob-out-top" width="100%" height="100%" />
        <rect fill="url(#Gradient2)" className="blob-in-top" width="100%" height="100%" />
        <rect fill="url(#Gradient3)" className="blob-out-bottom" width="100%" height="100%" />
        <rect fill="url(#Gradient4)" className="blob-in-bottom" width="100%" height="100%" />
      </svg>

      {/* Blur Layer */}
      <div 
        className="fixed inset-0 z-[1] backdrop-blur-[60px] saturate-[140%]"
        style={{ background: 'rgba(0, 0, 0, 0.25)' }}
      />

      {/* Vignette Fade Layer */}
      <div 
        className="fixed inset-0 z-[2]"
        style={{
          background: 'radial-gradient(circle at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 65%, rgba(0,0,0,0.95) 100%)'
        }}
      />
    </div>
  );
}
