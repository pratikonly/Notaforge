export function BlurredBlobBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* SVG Blobs Layer - Full coverage */}
      <svg 
        className="fixed inset-0 w-[200%] h-[200%] -left-1/2 -top-1/2 z-0"
        preserveAspectRatio="xMidYMid slice" 
        viewBox="0 0 100 100"
      >
        <defs>
          <radialGradient id="Gradient1" cx="50%" cy="50%" fx="10%" fy="50%" r=".5">
            <animate attributeName="fx" dur="34s" values="0%;3%;0%" repeatCount="indefinite" />
            <stop offset="0%" stopColor="#9c40ff" />
            <stop offset="100%" stopColor="#dd00f3" />
          </radialGradient>
          <radialGradient id="Gradient2" cx="50%" cy="50%" fx="10%" fy="50%" r=".5">
            <animate attributeName="fx" dur="23.5s" values="0%;3%;0%" repeatCount="indefinite" />
            <stop offset="0%" stopColor="#2b1de8" />
            <stop offset="100%" stopColor="#9c40ff" />
          </radialGradient>
          <radialGradient id="Gradient3" cx="50%" cy="50%" fx="50%" fy="50%" r=".5">
            <animate attributeName="fx" dur="21.5s" values="0%;3%;0%" repeatCount="indefinite" />
            <stop offset="0%" stopColor="#1de840" />
            <stop offset="100%" stopColor="#1ddde8" />
          </radialGradient>
          <radialGradient id="Gradient4" cx="50%" cy="50%" fx="50%" fy="50%" r=".5">
            <animate attributeName="fx" dur="23s" values="0%;3%;0%" repeatCount="indefinite" />
            <stop offset="0%" stopColor="#1ddde8" />
            <stop offset="100%" stopColor="#dd00f3" />
          </radialGradient>
        </defs>
        
        <rect fill="url(#Gradient1)" className="blob-out-top" width="100%" height="100%" />
        <rect fill="url(#Gradient2)" className="blob-in-top" width="100%" height="100%" />
        <rect fill="url(#Gradient3)" className="blob-out-bottom" width="100%" height="100%" />
        <rect fill="url(#Gradient4)" className="blob-in-bottom" width="100%" height="100%" />
      </svg>

      {/* Heavy Blur Layer */}
      <div 
        className="fixed inset-0 z-[1]"
        style={{ 
          backdropFilter: 'blur(100px) saturate(150%)',
          WebkitBackdropFilter: 'blur(100px) saturate(150%)',
          background: 'rgba(0, 0, 0, 0.4)' 
        }}
      />

      {/* Darker Vignette Fade Layer */}
      <div 
        className="fixed inset-0 z-[2]"
        style={{
          background: 'radial-gradient(circle at center, rgba(0,0,0,0.2) 20%, rgba(0,0,0,0.7) 55%, rgba(0,0,0,0.98) 100%)'
        }}
      />
    </div>
  );
}
