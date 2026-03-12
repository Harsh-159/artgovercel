import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getArtworks } from '../lib/firebase';
import { Artwork } from '../lib/types';
import { UnlockModal } from '../components/UnlockModal';
import AROrientationGate from '../components/AROrientationGate';
import { ArrowLeft, Play, Pause } from 'lucide-react';
import { clsx } from 'clsx';

export const ARPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const locationState = useLocation();
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [lockedSelected, setLockedSelected] = useState<Artwork | null>(null);

  useEffect(() => {
    // Check if returning from Stripe checkout redirect
    const params = new URLSearchParams(locationState.search);
    if (id && params.get('unlocked') === 'true' && params.get('redirect_status') === 'succeeded') {
      const lockKey = `unlocked_${id}`;
      if (!localStorage.getItem(lockKey)) {
        localStorage.setItem(lockKey, 'true');
        import('../lib/firebase').then(m => m.incrementUnlockCount(id)).catch(console.error);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [id, locationState.search]);

  useEffect(() => {
    const unsub = getArtworks(setArtworks);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (artworks.length > 0 && id) {
      const target = artworks.find(a => a.id === id);
      if (target) {
        const isUnlocked = localStorage.getItem(`unlocked_${target.id}`) === 'true';
        if (target.isPaid && !isUnlocked) {
          setLockedSelected(target);
        } else {
          setSelectedArtwork(target);
        }
      }
    }
  }, [artworks, id]);

  const quitAR = () => {
    navigate('/map');
  };

  if (!selectedArtwork && !lockedSelected) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden text-white">
      {/* Back Button */}
      <button
        onClick={quitAR}
        className="absolute top-6 left-6 w-12 h-12 bg-black/50 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 pointer-events-auto hover:bg-white/20 z-50 text-white shadow-lg active:scale-95 transition-all"
      >
        <ArrowLeft className="w-6 h-6" />
      </button>

      {/* Unlock Dialog for Paid Items */}
      {lockedSelected && (
        <UnlockModal
          artwork={lockedSelected}
          onUnlock={() => {
            setLockedSelected(null);
            setSelectedArtwork(lockedSelected);
          }}
          onCancel={quitAR}
        />
      )}

      {selectedArtwork && (
        <AROrientationGate>
          <ARScene artwork={selectedArtwork} />
        </AROrientationGate>
      )}
    </div>
  );
};

const ARScene: React.FC<{ artwork: Artwork }> = ({ artwork }) => {
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [showCalibration, setShowCalibration] = useState(false);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Script Injection
  useEffect(() => {
    if ((window as any).AFRAME) {
      setScriptsLoaded(true);
      return;
    }

    const loadScripts = async () => {
      return new Promise<void>((resolve, reject) => {
        const aframe = document.createElement('script');
        aframe.src = "https://aframe.io/releases/1.4.0/aframe.min.js";
        aframe.onload = () => {
          const arjs = document.createElement('script');
          arjs.src = "https://raw.githack.com/AR-js-org/AR.js/3.4.5/aframe/build/aframe-ar.js";
          arjs.onload = () => resolve();
          arjs.onerror = reject;
          document.head.appendChild(arjs);
        };
        aframe.onerror = reject;
        document.head.appendChild(aframe);
      });
    };

    loadScripts()
      .then(() => setScriptsLoaded(true))
      .catch((e) => console.error("Failed to load AR scripts", e));
  }, []);

  // GPS Accuracy Gate
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsAccuracy(pos.coords.accuracy);
        // Consider GPS "ready" when accuracy is better than 30 metres
        if (pos.coords.accuracy <= 30) {
          setGpsReady(true);
        }
      },
      (err) => console.error('GPS error:', err),
      {
        enableHighAccuracy: true,  // CRITICAL — forces GPS chip, not cell tower
        maximumAge: 0,             // always fresh position
        timeout: 15000
      }
    );

    // Safety fallback — show AR after 10 seconds regardless of accuracy
    const fallback = setTimeout(() => {
      setGpsReady(true);
    }, 10000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(fallback);
    };
  }, []);

  useEffect(() => {
    if (gpsReady) {
      setShowCalibration(true);
    }
  }, [gpsReady]);

  // Compass Calibration Overlay Timer
  useEffect(() => {
    if (showCalibration) {
      const t = setTimeout(() => setShowCalibration(false), 3000);
      return () => clearTimeout(t);
    }
  }, [showCalibration]);

  useEffect(() => {
    if ((artwork.mediaType === 'audio' || artwork.mediaType === 'voice') && audioRef.current) {
      audioRef.current.src = artwork.mediaUrl;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error("Audio block:", e));
    }
  }, [artwork.mediaType, artwork.mediaUrl]);

  if (!scriptsLoaded) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 text-white z-40">
        <div className="w-12 h-12 border-2 border-[#4488FF]/30 border-t-[#4488FF] rounded-full animate-spin" />
        <p className="font-bold">Loading Engine...</p>
      </div>
    );
  }

  if (!gpsReady) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 text-white z-40">
        <div className="w-12 h-12 border-2 border-[#4488FF]/30 border-t-[#4488FF] rounded-full animate-spin" />
        <p className="font-bold">Getting GPS lock...</p>
        {gpsAccuracy && (
          <p className="text-gray-400 text-sm">
            Accuracy: ±{Math.round(gpsAccuracy)}m
            {gpsAccuracy > 30 ? ' (move outdoors for better signal)' : ' ✓'}
          </p>
        )}
      </div>
    );
  }

  const getEntityMarkup = () => {
    const lat = artwork.lat;
    const lng = artwork.lng;

    if (artwork.mediaType === 'image') {
      return `
        <a-image
          src="${artwork.mediaUrl}"
          gps-projected-entity-place="latitude: ${lat}; longitude: ${lng}"
          look-at="[gps-projected-camera]"
          scale="10 10 1"
          material="transparent: true; alphaTest: 0.1; side: double"
          animation__scale="property: scale; from: 9.5 9.5 1; to: 10 10 1; dir: alternate; dur: 2000; loop: true; easing: easeInOutSine">
        </a-image>`;
    }

    if (artwork.mediaType === 'video') {
      return `
        <a-assets>
          <video id="arVideo" src="${artwork.mediaUrl}" autoplay loop crossorigin="anonymous" playsinline webkit-playsinline></video>
        </a-assets>
        <a-video
          src="#arVideo"
          gps-projected-entity-place="latitude: ${lat}; longitude: ${lng}"
          look-at="[gps-projected-camera]"
          width="16" height="9"
          material="side: double">
        </a-video>`;
    }

    if (artwork.mediaType === 'audio' || artwork.mediaType === 'voice') {
      return `
        <a-entity gps-projected-entity-place="latitude: ${lat}; longitude: ${lng}" look-at="[gps-projected-camera]">
          <a-box color="#FF6B9D" position="-0.6 0 0" width="0.2" height="1" depth="0.2" animation="property: scale; from: 1 0.5 1; to: 1 2 1; dir: alternate; dur: 400; loop: true; easing: easeInOutSine"></a-box>
          <a-box color="#FF6B9D" position="-0.2 0 0" width="0.2" height="1" depth="0.2" animation="property: scale; from: 1 1.5 1; to: 1 0.3 1; dir: alternate; dur: 600; loop: true; easing: easeInOutSine"></a-box>
          <a-box color="#FF6B9D" position="0.2 0 0" width="0.2" height="1" depth="0.2" animation="property: scale; from: 1 0.8 1; to: 1 1.8 1; dir: alternate; dur: 500; loop: true; easing: easeInOutSine"></a-box>
          <a-box color="#FF6B9D" position="0.6 0 0" width="0.2" height="1" depth="0.2" animation="property: scale; from: 1 1.2 1; to: 1 0.4 1; dir: alternate; dur: 450; loop: true; easing: easeInOutSine"></a-box>
        </a-entity>`;
    }

    if (artwork.mediaType === 'model3d') {
      return `
        <a-entity
          gltf-model="${artwork.mediaUrl}"
          gps-projected-entity-place="latitude: ${lat}; longitude: ${lng}"
          scale="2 2 2"
          animation="property: rotation; from: 0 0 0; to: 0 360 0; loop: true; dur: 8000; easing: linear">
        </a-entity>`;
    }

    return '';
  };

  const aframeScene = `
    <a-scene
      vr-mode-ui="enabled: false"
      arjs="sourceType: webcam; videoTexture: true; debugUIEnabled: false; trackingMethod: best; patternRatio: 0.5"
      renderer="antialias: true; alpha: true; precision: medium; logarithmicDepthBuffer: true"
      embedded
      loading-screen="enabled: false"
      gesture-detector>
      
      <a-camera gps-projected-camera="originDestinationOffset: 0" rotation-reader></a-camera>

      ${getEntityMarkup()}
    </a-scene>
  `;

  return (
    <>
      {showCalibration && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-none animate-[fadeOut_0.5s_ease_2.5s_forwards]">
          <div className="text-center p-6">
            <span className="text-6xl block mb-4">🔄</span>
            <p className="text-white font-bold text-lg">Calibrating compass</p>
            <p className="text-gray-400 text-sm mt-2">Move your phone in a figure-8 motion</p>
          </div>
        </div>
      )}

      {/* Audio UI logic */}
      {(artwork.mediaType === 'audio' || artwork.mediaType === 'voice') && (
        <>
          <audio ref={audioRef} loop className="hidden" />
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-black/60 backdrop-blur-xl p-3 pr-5 rounded-full border border-white/20 flex items-center gap-4 text-white shadow-[0_0_30px_rgba(255,215,0,0.4)]">
            <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center font-bold relative shadow-inner">
              {isPlaying && <span className="absolute inset-0 rounded-full border-2 border-white/50 animate-ping"></span>}
              <span className="text-2xl mt-1">♫</span>
            </div>
            <div className="flex-1 min-w-[120px]">
              <p className="font-bold text-sm whitespace-nowrap w-[120px] overflow-hidden text-ellipsis">{artwork.title}</p>
              <p className="text-xs text-text-secondary w-[120px] overflow-hidden text-ellipsis">{artwork.artistName}</p>
            </div>
            <button
              onClick={() => {
                if (isPlaying) audioRef.current?.pause();
                else {
                  audioRef.current?.play().catch(console.error);
                }
                setIsPlaying(!isPlaying);
              }}
              className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all flex-shrink-0 shadow-lg pointer-events-auto"
            >
              {isPlaying ? <Pause className="fill-current w-5 h-5" /> : <Play className="fill-current w-5 h-5 ml-1" />}
            </button>
          </div>
        </>
      )}

      {/* Inject A-Frame AR.js Scene */}
      <div
        className="fixed inset-0 z-0 pointer-events-none [&>div]:!h-full [&>div]:!w-full"
        dangerouslySetInnerHTML={{ __html: aframeScene }}
      />
    </>
  );
};
