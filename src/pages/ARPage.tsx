import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getArtworks } from '../lib/firebase';
import { Artwork } from '../lib/types';
import { UnlockModal } from '../components/UnlockModal';
import { clsx } from 'clsx';
import { ArrowLeft, Maximize, Play, Pause } from 'lucide-react';

// Math Helpers
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const λ1 = lon1 * Math.PI / 180;
  const λ2 = lon2 * Math.PI / 180;
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const θ = Math.atan2(y, x);
  return (θ * 180 / Math.PI + 360) % 360;
};

type ARMode = 'scanning' | 'surface-detection' | 'placed' | 'music-playing';

export const ARPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const locationState = useLocation();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [mode, setMode] = useState<ARMode>('scanning');
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [lockedSelected, setLockedSelected] = useState<Artwork | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicUIRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [placedOrientation, setPlacedOrientation] = useState<{ heading: number, beta: number, gamma: number } | null>(null);

  const stateRef = useRef({
    location: null as { lat: number; lng: number } | null,
    orientation: { heading: 0, beta: 0, gamma: 0 },
    visibleOrbs: [] as any[]
  });

  useEffect(() => {
    // Check if returning from Stripe checkout redirect
    const params = new URLSearchParams(locationState.search);
    if (id && params.get('unlocked') === 'true' && params.get('redirect_status') === 'succeeded') {
      const lockKey = `unlocked_${id}`;
      if (!localStorage.getItem(lockKey)) {
        localStorage.setItem(lockKey, 'true');
        import('../lib/firebase').then(m => m.incrementUnlockCount(id)).catch(console.error);

        // Remove params from URL cleanly without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [id, locationState.search]);

  useEffect(() => {
    const unsub = getArtworks(setArtworks);
    return () => unsub();
  }, []);

  const requestPermissionsAndStart = async () => {
    try {
      // iOS 13+ DeviceOrientation request
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const permissionState = await (DeviceOrientationEvent as any).requestPermission();
        if (permissionState !== 'granted') {
          navigate('/map');
          return;
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setPermissionGranted(true);
    } catch (err) {
      console.error("AR Permission error", err);
      navigate('/map');
    }
  };

  useEffect(() => {
    if (permissionGranted && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [permissionGranted]);

  useEffect(() => {
    if (!permissionGranted) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      let heading = 0;
      if ((e as any).webkitCompassHeading !== undefined) {
        heading = (e as any).webkitCompassHeading;
      } else if (e.alpha !== null) {
        heading = (360 - e.alpha) % 360; // fallback Approximation
      }
      stateRef.current.orientation = { heading, beta: e.beta || 0, gamma: e.gamma || 0 };
    };

    window.addEventListener('deviceorientation', handleOrientation);
    window.addEventListener('deviceorientationabsolute', handleOrientation); // Important for Android true compass

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        stateRef.current.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      (err) => console.error("GPS Error", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [permissionGranted]);

  // Main Render Loop
  useEffect(() => {
    if (!permissionGranted) return;

    let animationFrameId: number;

    const render = () => {
      const loc = stateRef.current.location;
      const { heading, beta, gamma } = stateRef.current.orientation;

      // Render Orbs in Scanning Mode
      if (mode === 'scanning') {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
          if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
          }
          const width = canvas.width;
          const height = canvas.height;
          ctx.clearRect(0, 0, width, height);

          const visibleOrbs: any[] = [];

          if (!loc) {
            ctx.font = 'bold 16px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.textAlign = 'center';
            ctx.fillText('WAITING FOR GPS SIGNAL...', width / 2, height / 2);
          } else {
            let foundAny = false;
            artworks.forEach(art => {
              const dist = getDistance(loc.lat, loc.lng, art.lat, art.lng);
              const bearing = getBearing(loc.lat, loc.lng, art.lat, art.lng);

              let diff = bearing - heading;
              if (diff > 180) diff -= 360;
              if (diff < -180) diff += 360;

              // Only render if within 60 degrees of view and within 50 meters
              if (Math.abs(diff) <= 60 && dist <= 50) {
                foundAny = true;
                const x = ((diff + 60) / 120) * width;
                const y = height / 2;

                // Scale: 5m = 40px, 50m = 10px
                let r = 40 - ((dist - 5) / 45) * 30;
                r = Math.max(10, Math.min(40, r));

                visibleOrbs.push({ ...art, x, y, r, dist });

                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);

                let rgb = '255, 255, 255';
                if (art.category === 'music') rgb = '255, 215, 0';
                else if (art.category === 'graffiti') rgb = '255, 51, 51';
                else if (art.category === 'visual') rgb = '68, 136, 255';
                else if (art.category === 'poetry') rgb = '255, 136, 68';
                else if (art.category === 'digital') rgb = '170, 68, 255';

                ctx.fillStyle = `rgba(${rgb}, 0.8)`;
                ctx.shadowColor = `rgba(${rgb}, 1)`;
                ctx.shadowBlur = 20;
                ctx.fill();

                // Inner core
                ctx.beginPath();
                ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.shadowBlur = 0;
                ctx.fill();

                // Text tag below
                if (r > 15) {
                  ctx.font = 'bold 12px sans-serif';
                  ctx.fillStyle = 'white';
                  ctx.textAlign = 'center';
                  ctx.fillText(`${Math.round(dist)}m`, x, y + r + 20);
                }
              }
            });

            // Helpful debug text
            ctx.font = '12px sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.textAlign = 'left';
            ctx.fillText(`GPS: ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}`, 20, 30);
            ctx.fillText(`Heading: ${Math.round(heading)}°`, 20, 50);
            ctx.fillText(`Artworks Total: ${artworks.length}`, 20, 70);
            if (!foundAny && artworks.length > 0) {
              ctx.textAlign = 'center';
              ctx.fillText('Look around! Move your phone.', width / 2, height / 2 + 50);
            }
          }
          stateRef.current.visibleOrbs = visibleOrbs;
        }
      }

      // Track Music UI continuously in AR Space
      if (mode === 'music-playing' && selectedArtwork && loc && musicUIRef.current) {
        const dist = getDistance(loc.lat, loc.lng, selectedArtwork.lat, selectedArtwork.lng);
        const bearing = getBearing(loc.lat, loc.lng, selectedArtwork.lat, selectedArtwork.lng);
        let diff = bearing - heading;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;

        if (Math.abs(diff) <= 60) {
          const width = window.innerWidth;
          const height = window.innerHeight;
          const x = ((diff + 60) / 120) * width;
          const y = height / 2;
          musicUIRef.current.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0)`;
          musicUIRef.current.style.opacity = '1';
          musicUIRef.current.style.pointerEvents = 'auto';
        } else {
          musicUIRef.current.style.opacity = '0';
          musicUIRef.current.style.pointerEvents = 'none';
        }
      }

      // Perspective Transform rendering for Placed Objects
      if (mode === 'placed' && placedOrientation && transformRef.current) {
<<<<<<<<< Temporary merge branch 1
        const dBeta = beta - placedOrientation.beta;
        const dGamma = gamma - placedOrientation.gamma;

        // Rotate relative to anchor
        const rotateX = Math.max(-90, Math.min(90, placedOrientation.beta - 90 - dBeta));
        const rotateY = -dGamma;

        transformRef.current.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(-300px)`;
=========
         let diffHeading = heading - placedOrientation.heading;
         if (diffHeading > 180) diffHeading -= 360;
         if (diffHeading < -180) diffHeading += 360;

         const dBeta = beta - placedOrientation.beta;
         const dGamma = gamma - placedOrientation.gamma;

         // Translate based on how much the device has turned from original placement
         const translateX = -(diffHeading / 30) * (window.innerWidth / 2);
         const translateY = -(dBeta / 30) * (window.innerHeight / 2);

         // Anchor rotation
         const rotateX = placedOrientation.beta - 90;
         
         transformRef.current.style.transform = `translate3d(${translateX}px, ${translateY}px, -400px) rotateX(${rotateX}deg) rotateZ(${-dGamma}deg)`;
>>>>>>>>> Temporary merge branch 2
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [permissionGranted, mode, artworks, selectedArtwork, placedOrientation]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'scanning') return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedOrb = stateRef.current.visibleOrbs.find((orb) => {
      const distToClick = Math.sqrt((orb.x - x) ** 2 + (orb.y - y) ** 2);
      return distToClick <= orb.r + 30; // 30px padding for easy tapping
    });

    const checkAccess = (artwork: Artwork): boolean => {
      if (!artwork.isPaid) return true;
      if (localStorage.getItem(`unlocked_${artwork.id}`)) return true;
      if (sessionStorage.getItem(`viewonce_${artwork.id}`)) return true;
      if (new URLSearchParams(window.location.search).get('unlocked') === 'true') return true;
      return false;
    };

    if (clickedOrb) {
      if (!checkAccess(clickedOrb)) {
        setLockedSelected(clickedOrb);
        return;
      }

      setSelectedArtwork(clickedOrb);
      if (clickedOrb.mediaType === 'audio') {
        setMode('music-playing');
        if (audioRef.current) {
          audioRef.current.src = clickedOrb.mediaUrl;
          audioRef.current.play();
          setIsPlaying(true);
        }
      } else {
        setMode('surface-detection');
      }
    }
  };

  const handleSurfaceTap = () => {
    if (mode === 'surface-detection') {
      const { heading, beta, gamma } = stateRef.current.orientation;
      setPlacedOrientation({ heading, beta, gamma });
      setMode('placed');
    }
  };

  const quitAR = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    navigate('/map');
  };

  if (permissionGranted === null) {
    return (
      <div className="h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center bg-[url('https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070')] bg-cover bg-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-0"></div>
        <div className="relative z-10 w-full max-w-sm">
          <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce shadow-[0_0_30px_rgba(68,136,255,0.8)]">
            <Maximize size={32} />
          </div>
          <h1 className="text-3xl font-heading font-bold mb-4">Start AR Camera</h1>
          <p className="mb-8 text-white/80">Explore the physical world. We need your Camera, GPS, and Compass to project art securely into your environment.</p>
          <button
            onClick={requestPermissionsAndStart}
            className="bg-accent text-white px-8 py-4 rounded-full font-bold text-lg w-full shadow-[0_0_20px_rgba(68,136,255,0.4)] active:scale-95 transition-transform"
          >
            Enable AR Tracking
          </button>
          <button
            onClick={() => navigate('/map')}
            className="mt-4 bg-white/10 text-white px-8 py-4 rounded-full font-bold text-sm w-full"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden" onClick={mode === 'surface-detection' ? handleSurfaceTap : undefined}>

      {/* Live Camera Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover z-0"
      />

      {/* AR Orbs Rendering Layer */}
      {mode === 'scanning' && (
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="absolute inset-0 z-10 block cursor-pointer touch-none"
        />
      )}

      {/* Surface Detection / Cropping Frame UX */}
      {mode === 'surface-detection' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="w-64 h-64 border-4 border-dashed border-white/50 rounded-xl relative shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-accent -ml-1 -mt-1"></div>
            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-accent -mr-1 -mt-1"></div>
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-accent -ml-1 -mb-1"></div>
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-accent -mr-1 -mb-1"></div>
          </div>
          <div className="mt-8 animate-pulse text-white font-bold text-sm bg-black/60 px-6 py-3 rounded-full backdrop-blur-md flex items-center gap-2 border border-white/10 shadow-xl">
            <span className="text-xl">👉</span> Point at a surface, then tap!
          </div>
        </div>
      )}

      {/* Visually Placed AR Object using Perspective Transform */}
      {mode === 'placed' && selectedArtwork && placedOrientation && (
        <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center overflow-hidden" style={{ perspective: '800px' }}>
          <div ref={transformRef} style={{ transformStyle: 'preserve-3d' }} className="relative transition-transform ease-out duration-75 origin-center">
            {selectedArtwork.mediaType === 'image' && (
              <div className="relative p-2 bg-white rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                <img src={selectedArtwork.mediaUrl} className="max-w-[70vw] max-h-[50vh] object-cover rounded shadow-inner" />
              </div>
            )}
            {selectedArtwork.mediaType === 'video' && (
              <div className="relative p-2 bg-black rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.8)] border-2 border-white/20">
                <video src={selectedArtwork.mediaUrl} autoPlay loop playsInline className="max-w-[70vw] max-h-[50vh] object-cover rounded shadow-inner" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spatial Audio Controls (Floating in AR) */}
      <div
        ref={musicUIRef}
        className={clsx(
          "absolute top-0 left-0 z-20 bg-black/60 backdrop-blur-xl p-3 pr-5 rounded-full border border-white/20 flex items-center gap-4 text-white shadow-[0_0_30px_rgba(255,215,0,0.4)] pointer-events-none opacity-0 transition-opacity duration-300",
          mode !== 'music-playing' && "hidden"
        )}
      >
        <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 bg-accent text-white flex items-center justify-center font-bold relative shadow-inner">
          {selectedArtwork?.mediaType === 'audio' && isPlaying && (
            <span className="absolute inset-0 rounded-full border-2 border-white/50 animate-ping"></span>
          )}
          <span className="text-2xl mt-1">♫</span>
        </div>
        <div className="flex-1 min-w-[120px]">
          <p className="font-bold text-sm whitespace-nowrap w-[120px] overflow-hidden text-ellipsis">{selectedArtwork?.title}</p>
          <p className="text-xs text-text-secondary w-[120px] overflow-hidden text-ellipsis">{selectedArtwork?.artistName}</p>
        </div>
        <button
          onClick={() => {
            if (isPlaying) audioRef.current?.pause();
            else audioRef.current?.play();
            setIsPlaying(!isPlaying);
          }}
          className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all flex-shrink-0 shadow-lg"
        >
          {isPlaying ? <Pause className="fill-current w-5 h-5" /> : <Play className="fill-current w-5 h-5 ml-1" />}
        </button>
      </div>

      {/* Back Button */}
      <button
        onClick={() => {
          if (mode !== 'scanning') {
            setMode('scanning');
            setSelectedArtwork(null);
            audioRef.current?.pause();
            setIsPlaying(false);
          } else {
            quitAR();
          }
        }}
        className="absolute top-6 left-6 w-12 h-12 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 pointer-events-auto hover:bg-white/20 z-50 text-white shadow-lg active:scale-95 transition-all"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      {/* Unlock Dialog for Paid Items */}
      {lockedSelected && (
        <UnlockModal
          artwork={lockedSelected}
          onUnlock={() => setLockedSelected(null)}
          onCancel={() => setLockedSelected(null)}
        />
      )}

      <audio ref={audioRef} loop className="hidden" />
    </div>
  );
};
