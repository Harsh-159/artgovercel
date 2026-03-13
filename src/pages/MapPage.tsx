import React, { useEffect, useState, useRef } from 'react';
import Map, { Marker, MapRef, Source, Layer } from 'react-map-gl';
import { useNavigate } from 'react-router-dom';
import { getArtworks } from '../lib/firebase';
import { Artwork } from '../lib/types';
import { Orb } from '../components/Orb';
import { getActiveConditions, getCurrentEnvironment } from '../lib/conditions';
import { LikeButton } from '../components/LikeButton';
import { Navigation } from '../components/Navigation';
import { PortalModal } from '../components/PortalModal';
import { CameraDiscovery } from '../components/CameraDiscovery';
import { usePortalState } from '../lib/usePortalState';
import { clsx } from 'clsx';
import { getLocationFast, locateNow } from '../lib/geolocation';
import { Globe } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiaGFyc2h5YWRhdmhhcHB5IiwiYSI6ImNsczB2b252MDBhN2Qya21zZ254Z254Z24ifQ.demo';

export const MapPage: React.FC = () => {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [locationFetched, setLocationFetched] = useState(false);
  const [is3D, setIs3D] = useState(false);
  const [viewState, setViewState] = useState<{ longitude: number; latitude: number; zoom: number; pitch?: number; bearing?: number } | null>(null);
  const navigate = useNavigate();

  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const mapRef = useRef<MapRef>(null);
  const [mapMode, setMapMode] = useState<'map' | 'camera'>('map');

  const { profile, activatePortal, deactivatePortal } = usePortalState();
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);

  useEffect(() => {
    if (profile?.portalActive && profile.portalCoordinates) {
      setViewState(prev => ({
        ...(prev || { zoom: 15, pitch: 60, bearing: -20 }),
        longitude: profile.portalCoordinates!.lng,
        latitude: profile.portalCoordinates!.lat
      }));
    }
  }, [profile?.portalActive, profile?.portalCoordinates]);

  useEffect(() => {
    const unsubscribe = getArtworks(setArtworks);

    // Two-tier location: IP geo (instant) then GPS (accurate)
    const stopWatching = getLocationFast(
      ({ lat, lng }) => {
        setUserLocation({ lat, lng });
        setViewState({ longitude: lng, latitude: lat, zoom: 15, pitch: 60, bearing: -20 });
        setLocationFetched(true);
      },
      () => {
        // Location denied/unavailable — show map at a generic default
        setViewState({ longitude: 0, latitude: 20, zoom: 2, pitch: 0, bearing: 0 });
        setLocationFetched(true);
      }
    );

    return () => { unsubscribe(); stopWatching(); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const map = mapRef.current?.getMap();
      const activeLoc = profile?.portalActive && profile.portalCoordinates ? profile.portalCoordinates : userLocation;
      if (!map || !activeLoc) return;

      const userPixel = map.project([activeLoc.lng, activeLoc.lat]);

      document.querySelectorAll('.art-orb').forEach((orbEl) => {
        const orbLng = parseFloat(orbEl.getAttribute('data-lng') || '0');
        const orbLat = parseFloat(orbEl.getAttribute('data-lat') || '0');
        const orbPixel = map.project([orbLng, orbLat]);

        const dist = Math.sqrt(
          (orbPixel.x - userPixel.x) ** 2 +
          (orbPixel.y - userPixel.y) ** 2
        );

        if (dist < 240) {
          const delay = (dist / 240) * 2000;
          setTimeout(() => {
            orbEl.classList.add('orb-flare');
            setTimeout(() => orbEl.classList.remove('orb-flare'), 600);
          }, delay);
        }
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [userLocation, profile]);

  const handleOrbClick = (artwork: Artwork) => {
    setSelectedArtwork(artwork);
  };

  const toggle3D = () => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const next3D = !is3D;
    setIs3D(next3D);
    map.flyTo({
      pitch: next3D ? 60 : 0,
      bearing: 0,
      duration: 600,
      easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    });
    // Let Mapbox recalculate tile grid after transition
    setTimeout(() => map.resize(), 650);
  };

  if (!locationFetched) {
    return (
      <div className="w-full h-screen bg-black flex flex-col items-center justify-center text-white font-bold">
        <div className="w-12 h-12 border-4 border-white/20 border-t-accent rounded-full animate-spin mb-4"></div>
        <p>Locating you...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-background relative overflow-hidden">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 z-10 flex justify-between items-center pointer-events-none">
        <h1 className="text-2xl font-heading font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] pointer-events-auto">
          ArtGO
        </h1>
        <div className="flex gap-2 items-center pointer-events-auto">
          <button
            onClick={() => setIsPortalModalOpen(true)}
            className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors shadow-lg"
          >
            <Globe size={18} className={clsx(profile?.portalActive ? "text-accent" : "text-white")} />
            {profile?.portalCount ? (
              <span className="absolute -top-1 -right-1 bg-accent text-black text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {profile.portalCount}
              </span>
            ) : null}
          </button>
          <button
            onClick={() => setMapMode(mapMode === 'map' ? 'camera' : 'map')}
            className="bg-accent/20 hover:bg-accent/30 text-accent backdrop-blur-md rounded-full px-4 h-10 flex items-center gap-2 font-bold transition-all border border-accent/30"
          >
            <span className="text-sm">{mapMode === 'map' ? 'AR Mode' : 'Map Mode'}</span>
          </button>
          <button
            onClick={() => {
              locateNow(
                ({ lat, lng }) => {
                  setUserLocation({ lat, lng });
                  setViewState({ longitude: lng, latitude: lat, zoom: 15 });
                },
                (err) => alert(`Could not get your location: ${err}`)
              );
            }}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full px-4 h-10 flex items-center gap-2 text-white font-bold transition-all border border-white/10"
          >
            <span>📍</span>
          </button>
          <div className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center cursor-pointer">
            <span className="text-sm">👤</span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {mapMode === 'map' ? (
        <Map
          ref={mapRef}
          {...(viewState ?? { longitude: 0, latitude: 20, zoom: 2 })}
          onMove={evt => setViewState(evt.viewState)}
          onClick={e => {
            // ensure we don't trigger when clicking a marker
            if ((e.originalEvent.target as HTMLElement).tagName.toLowerCase() === 'canvas') {
              navigate('/upload', { state: { lat: e.lngLat.lat, lng: e.lngLat.lng } });
            }
          }}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
        >
          {userLocation && (
            <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
              <div className="relative flex items-center justify-center w-6 h-6">
                <div className="absolute w-full h-full bg-blue-500 rounded-full opacity-30 animate-ping"></div>

                {/* Sonar Rings Overlay */}
                <div className="sonar-ring-container absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-0 flex items-center justify-center pointer-events-none">
                  <div className="sonar-ring" />
                  <div className="sonar-ring" />
                  <div className="sonar-ring" />
                </div>

                {/* User Dot */}
                <div className="w-3 h-3 bg-white rounded-full border-2 border-white shadow-[0_0_10px_rgba(68,136,255,0.8)] z-10 animate-[pulse-slow_3s_infinite]" style={{ backgroundColor: 'white', borderColor: 'white', boxSizing: 'content-box' }}>
                  <div className="absolute inset-0 bg-blue-500 rounded-full scale-75 blur-[2px]" />
                </div>
              </div>
            </Marker>
          )}
          {artworks
            .filter(artwork => {
              const appearDuring = (artwork as any).appearDuring || ['Always'];
              if (appearDuring.includes('Always')) return true;
              const active = getActiveConditions();
              return appearDuring.some((c: string) => active.includes(c as any));
            })
            .map(artwork => (
              <Marker
                key={artwork.id}
                longitude={artwork.lng}
                latitude={artwork.lat}
                anchor="center"
              >
                <Orb artwork={artwork} onClick={() => handleOrbClick(artwork)} />
              </Marker>
            ))}

          {/* 3D Buildings Layer */}
          <Layer
            id="3d-buildings"
            source="composite"
            source-layer="building"
            filter={['==', 'extrude', 'true']}
            type="fill-extrusion"
            minzoom={15}
            paint={{
              'fill-extrusion-color': '#1A1A24',
              'fill-extrusion-height': ['get', 'height'],
              'fill-extrusion-base': ['get', 'min_height'],
              'fill-extrusion-opacity': 0.8
            }}
          />

          {/* Water Layer Styling */}
          <Layer
            id="water-styling"
            source="composite"
            source-layer="water"
            type="fill"
            paint={{
              'fill-color': '#0A1930'
            }}
          />

          {/* Parks / Landuse Layer Styling */}
          <Layer
            id="parks-styling"
            source="composite"
            source-layer="landuse"
            filter={['any', ['==', 'class', 'park'], ['==', 'class', 'pitch']]}
            type="fill"
            paint={{
              'fill-color': '#0F2514'
            }}
          />
        </Map>
      ) : (
        <CameraDiscovery
          artworks={artworks}
          userLocation={profile?.portalActive && profile.portalCoordinates ? profile.portalCoordinates : userLocation}
          onSelectArtwork={setSelectedArtwork}
          onClose={() => setMapMode('map')}
        />
      )}

      {/* Bottom Sheet Preview */}
      <div className={clsx(
        "absolute bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-white/10 rounded-t-3xl p-6 transition-transform duration-300 z-30",
        selectedArtwork ? "translate-y-0" : "translate-y-full"
      )}>
        {selectedArtwork && (
          <div className="flex flex-col h-full pb-20">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6 cursor-pointer" onClick={() => setSelectedArtwork(null)} />

            <div className="flex justify-between items-start mb-4">
              <div className="flex-1 min-w-0 pr-4">
                <h2 className="text-2xl font-heading font-bold text-white mb-1 truncate">{selectedArtwork.title}</h2>
                <p className="text-text-secondary font-medium">by {selectedArtwork.artistName}</p>
                {selectedArtwork.description && (
                  <p className="text-sm text-text-secondary/80 italic mt-2 line-clamp-2">{selectedArtwork.description}</p>
                )}
              </div>
              <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider text-white whitespace-nowrap border border-white/5">
                {selectedArtwork.category}
              </div>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <LikeButton artworkId={selectedArtwork.id} initialLikes={selectedArtwork.likes} />
            </div>

            <button
              onClick={() => navigate(`/ar/${selectedArtwork.id}`)}
              className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-4 rounded-full transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {selectedArtwork.isPaid && localStorage.getItem(`unlocked_${selectedArtwork.id}`) !== 'true'
                ? `Unlock £${selectedArtwork.price?.toFixed(2)}`
                : 'View in AR →'}
            </button>
            {localStorage.getItem(`owned_${selectedArtwork.id}`) && (
              <button
                onClick={() => navigate(`/certificate/${localStorage.getItem(`owned_${selectedArtwork.id}`)}`)}
                className="w-full bg-[#FFD700]/10 hover:bg-[#FFD700]/20 text-[#FFD700] font-bold py-3 rounded-full transition-all active:scale-95 flex items-center justify-center gap-2 mt-3 border border-[#FFD700]/20"
              >
                ⭐ View Certificate →
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2D / 3D Toggle */}
      <button
        onClick={toggle3D}
        className="absolute bottom-24 right-4 z-20 w-12 h-12 flex flex-col items-center justify-center gap-0.5 rounded-2xl border border-[#FFD700]/30 bg-black/70 backdrop-blur-md shadow-lg hover:bg-[#FFD700]/10 transition-all active:scale-95"
      >
        <span className="text-[#FFD700] text-xs font-bold font-mono leading-none">{is3D ? '2D' : '3D'}</span>
        <span className="text-[10px] text-[#FFD700]/50 leading-none">{is3D ? 'flat' : 'tilt'}</span>
      </button>

      <Navigation />

      <PortalModal
        isOpen={isPortalModalOpen}
        onClose={() => setIsPortalModalOpen(false)}
        profile={profile}
        onActivate={activatePortal}
        onDeactivate={deactivatePortal}
      />
    </div>
  );
};
