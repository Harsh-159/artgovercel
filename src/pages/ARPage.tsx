import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getArtworkById } from '../lib/firebase';
import { Artwork } from '../lib/types';
import { ArrowLeft, Maximize } from 'lucide-react';
import { UnlockModal } from '../components/UnlockModal';
import { LikeButton } from '../components/LikeButton';
import { clsx } from 'clsx';

// Pre-register A-Frame component to handle taps
if (typeof window !== 'undefined' && !(window as any).hasRegisteredCursorListener) {
  (window as any).hasRegisteredCursorListener = true;
  // A-Frame might not be loaded immediately, wait for it
  const registerComponent = () => {
    if ((window as any).AFRAME) {
      (window as any).AFRAME.registerComponent('cursor-listener', {
        init: function () {
          this.el.addEventListener('click', () => {
            const event = new CustomEvent('ar-orb-tapped');
            window.dispatchEvent(event);
          });
        }
      });
    } else {
      setTimeout(registerComponent, 100);
    }
  };
  registerComponent();
}

export const ARPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showDrawer, setShowDrawer] = useState(true);
  const sceneRef = useRef<HTMLDivElement>(null);

  const isModelViewerMediaType = artwork?.mediaType === 'image';

  useEffect(() => {
    if (id) {
      getArtworkById(id).then(data => {
        if (data) {
          setArtwork(data);
          const unlocked = localStorage.getItem(`unlocked_${data.id}`) === 'true';
          if (data.isPaid && !unlocked) {
            setIsLocked(true);
          }
          if (data.mediaType !== 'image') {
            setShowDrawer(false); // Hide by default for A-Frame orb interaction
          }
        }
      });
    }
  }, [id]);

  useEffect(() => {
    const handleOrbTap = () => setShowDrawer(prev => !prev);
    window.addEventListener('ar-orb-tapped', handleOrbTap);
    return () => window.removeEventListener('ar-orb-tapped', handleOrbTap);
  }, []);

  useEffect(() => {
    if (artwork && !isLocked && !isModelViewerMediaType && sceneRef.current) {
      
      // Register custom WebXR Hit Test component for our specific use-case if not already registered
      if (typeof window !== 'undefined' && !(window as any).hasRegisteredHitTest) {
        (window as any).hasRegisteredHitTest = true;
        const registerHitTest = () => {
          if ((window as any).AFRAME) {
            (window as any).AFRAME.registerComponent('ar-hit-test-listener', {
              init: function () {
                this.reticle = document.getElementById('reticle');
                this.orb = document.getElementById('initial-orb');
                this.artworkGroup = document.getElementById('artwork-group');
                this.isPlaced = false;

                // Listen for hit test events (surface found)
                this.el.addEventListener('ar-hit-test-start', () => {
                   console.log("Hit test started");
                });

                this.el.addEventListener('ar-hit-test-achieved', () => {
                   console.log("Surface found!");
                });

                // Listen for tap/clicks to place the object
                this.el.sceneEl.addEventListener('click', () => {
                  if (!this.reticle.components['ar-hit-test'].hasFound) return;
                  if (this.isPlaced) return; // Only place once

                  this.isPlaced = true;
                  
                  // Hide the orb, show the artwork
                  this.orb.setAttribute('visible', 'false');
                  this.artworkGroup.setAttribute('visible', 'true');

                  // Move artwork to the reticle's position (the detected surface)
                  const position = this.reticle.getAttribute('position');
                  this.artworkGroup.setAttribute('position', position);
                  
                  // Optional: Notify the React app that placement occurred to show/hide UI if needed
                  window.dispatchEvent(new CustomEvent('artwork-placed'));
                });
              },
              tick: function() {
                  // Keep the orb positioned slightly above the reticle for scanning phase
                  if (!this.isPlaced && this.reticle.components['ar-hit-test'].hasFound) {
                      const pos = this.reticle.getAttribute('position');
                      this.orb.setAttribute('position', `${pos.x} ${pos.y + 1} ${pos.z}`);
                  }
              }
            });
          } else {
            setTimeout(registerHitTest, 100);
          }
        };
        registerHitTest();
      }

      // Prepare the Artwork representation (Audio/Video generic drops)
      let artworkHtml = '';

      if (artwork.mediaType === 'video') {
        artworkHtml = `
          <a-assets>
            <video id="arVideo" src="${artwork.mediaUrl}" autoplay loop crossorigin="anonymous" playsinline></video>
          </a-assets>
          <a-video
            src="#arVideo"
            class="clickable"
            cursor-listener
            position="0 1 0"
            width="2" height="1.125">
          </a-video>
        `;
      } else if (artwork.mediaType === 'audio') {
        artworkHtml = `
          <a-sphere class="clickable" cursor-listener radius="0.3" color="#4488FF" position="-0.8 1 0">
            <a-animation attribute="position" from="-0.8 1 0" to="-0.8 1.5 0" dur="1000" dir="alternate" repeat="indefinite"></a-animation>
          </a-sphere>
          <a-sphere class="clickable" cursor-listener radius="0.4" color="#FF3333" position="0 1 0">
            <a-animation attribute="position" from="0 1 0" to="0 1.8 0" dur="1200" dir="alternate" repeat="indefinite"></a-animation>
          </a-sphere>
          <a-sphere class="clickable" cursor-listener radius="0.25" color="#FFD700" position="0.8 1 0">
             <a-animation attribute="position" from="0.8 1 0" to="0.8 1.4 0" dur="900" dir="alternate" repeat="indefinite"></a-animation>
          </a-sphere>
        `;
      } else {
        // Fallback generic placement
        artworkHtml = `
          <a-box class="clickable" cursor-listener color="#44FF88" position="0 0.5 0" height="1" width="1" depth="1">
            <a-animation attribute="rotation" to="0 360 0" dur="4000" easing="linear" repeat="indefinite"></a-animation>
          </a-box>
        `;
      }

      const sceneHtml = `
        <a-scene
          webxr="optionalFeatures: hit-test;"
          renderer="antialias: true; alpha: true"
          ar-hit-test-listener
          cursor="rayOrigin: mouse;"
          raycaster="objects: .clickable"
        >
          <a-camera position="0 1.6 0"></a-camera>

          <!-- Reticle (targeting ring on the floor) -->
          <a-entity id="reticle" ar-hit-test="target: #reticle;" visible="false">
             <a-ring color="#00ff00" radius-inner="0.1" radius-outer="0.15" rotation="-90 0 0"></a-ring>
          </a-entity>

          <!-- Initial Orb (floats above reticle before placement) -->
          <a-entity id="initial-orb" position="0 1 -3">
             <a-sphere radius="0.2" color="#ffffff" material="opacity: 0.8; transparent: true; emissive: #ffffff; emissiveIntensity: 0.5"></a-sphere>
             <a-entity text="value: Tap to Place; color: white; align: center; width: 4" position="0 0.4 0"></a-entity>
          </a-entity>

          <!-- The Actual Placed Artwork (Hidden initially) -->
          <a-entity id="artwork-group" visible="false">
             ${artworkHtml}
          </a-entity>
          
        </a-scene>
      `;

      sceneRef.current.innerHTML = sceneHtml;

      if (artwork.mediaType === 'audio') {
        const audio = new Audio(artwork.mediaUrl);
        audio.loop = true;
        audio.play().catch(e => console.error("Audio play failed", e));
        return () => audio.pause();
      }
    }
  }, [artwork, isLocked, isModelViewerMediaType]);

  const handleUnlock = () => {
    setIsLocked(false);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  if (!artwork) return <div className="h-screen bg-background flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      {/* 3D Model Viewer for Native AR Images/Visual Art */}
      {!isLocked && isModelViewerMediaType && (
        <div className="absolute inset-0 z-0 bg-surface flex items-center justify-center">
            {/* Using a default frame for 2D images, in a real app you'd map the image texture dynamically to a .glb */}
             {React.createElement('model-viewer', {
                 src: "https://modelviewer.dev/shared-assets/models/Astronaut.glb", // Generic placeholder
                 iosSrc: "https://modelviewer.dev/shared-assets/models/Astronaut.usdz", 
                 ar: "true",
                 'ar-modes': "webxr scene-viewer quick-look",
                 'camera-controls': "true",
                 'auto-rotate': "true",
                 style: { width: '100%', height: '100%' },
                 alt: artwork.title,
                 'ar-placement': "floor" // floor or wall
             })}
             
             {/* Simple hack to show actual image beside the 3D model since we're using a generic model */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 pointer-events-none opacity-50 z-[-1]">
                <img src={artwork.mediaUrl} alt="Artwork" className="w-full h-full object-cover rounded-xl shadow-2xl" />
             </div>
             
             <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/60 px-4 py-2 rounded-full text-white text-xs z-10 font-bold backdrop-blur">
               Native AR Mode - Tap icon bottom right to place
             </div>
        </div>
      )}

      {/* AR Scene Container (A-Frame) */}
      {!isLocked && !isModelViewerMediaType && (
        <div ref={sceneRef} className="absolute inset-0 z-0" />
      )}

      {/* Overlays */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-6 overflow-hidden">
        {/* Top Bar */}
        <div className="flex justify-between items-start">
          <button 
            onClick={() => navigate('/map')}
            className="w-12 h-12 bg-surface/80 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 pointer-events-auto hover:bg-white/10 transition-colors shadow-lg"
          >
            <ArrowLeft className="text-white" />
          </button>
        </div>

        {/* Bottom Card Drawer */}
        <div className={clsx(
            "bg-surface/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between pointer-events-auto transition-transform duration-500 ease-in-out shadow-2xl",
            showDrawer ? "translate-y-0" : "translate-y-[150%]"
        )}>
          <div>
            <h2 className="text-xl font-heading font-bold text-white mb-1">{artwork.title}</h2>
            <p className="text-sm text-text-secondary">{artwork.artistName}</p>
          </div>
          <div className="flex gap-2 items-center">
             {!isModelViewerMediaType && (
                 <button onClick={() => setShowDrawer(false)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white mr-2 hover:bg-white/20 transition-colors">
                     <Maximize size={16} />
                 </button>
             )}
            <LikeButton artworkId={artwork.id} initialLikes={artwork.likes} />
          </div>
        </div>
      </div>

      {/* Unlock Modal */}
      {isLocked && (
        <UnlockModal 
          artwork={artwork} 
          onUnlock={handleUnlock} 
          onCancel={() => navigate('/map')} 
        />
      )}

      {/* Toast */}
      {showToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full font-bold shadow-lg animate-bounce z-50">
          ✨ Unlocked forever
        </div>
      )}
    </div>
  );
};
