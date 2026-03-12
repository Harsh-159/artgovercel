import React, { useEffect, useState } from 'react';
import Map, { Marker } from 'react-map-gl';
import { useNavigate } from 'react-router-dom';
import { getArtworks } from '../lib/firebase';
import { Artwork } from '../lib/types';
import { Orb } from '../components/Orb';
import { LikeButton } from '../components/LikeButton';
import { Navigation } from '../components/Navigation';
import { clsx } from 'clsx';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiaGFyc2h5YWRhdmhhcHB5IiwiYSI6ImNsczB2b252MDBhN2Qya21zZ254Z254Z24ifQ.demo';

export const MapPage: React.FC = () => {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [locationFetched, setLocationFetched] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: 0.1218,
    latitude: 52.2053,
    zoom: 14
  });
  const navigate = useNavigate();

  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    const unsubscribe = getArtworks(setArtworks);
    
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setViewState(prev => ({
            ...prev,
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude,
            zoom: 15
          }));
          setLocationFetched(true);
        },
        (err) => {
          console.error(err);
          setLocationFetched(true); // fallback to Cambridge if denied
        },
        { timeout: 5000, maximumAge: 0 }
      );
    } else {
      setLocationFetched(true); // if no geolocation supported
    }

    return () => unsubscribe();
  }, []);

  const handleOrbClick = (artwork: Artwork) => {
    setSelectedArtwork(artwork);
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
          GalleryOS
        </h1>
        <div className="flex gap-2 items-center pointer-events-auto">
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    setViewState(prev => ({
                      ...prev,
                      longitude: pos.coords.longitude,
                      latitude: pos.coords.latitude,
                      zoom: 15
                    }));
                  },
                  (err) => {
                    console.error("Locate Me error:", err);
                    alert("Could not get your location.");
                  }
                );
              } else {
                alert("Geolocation is not supported by your browser.");
              }
            }}
            className="bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full px-4 h-10 flex items-center gap-2 text-white font-bold transition-all border border-white/10"
          >
            <span>📍</span>
            <span className="text-sm">Locate Me</span>
          </button>
          <div className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center cursor-pointer">
            <span className="text-sm">👤</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <Map
        {...viewState}
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
              <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
            </div>
          </Marker>
        )}
        
        {artworks.map(artwork => (
          <Marker 
            key={artwork.id} 
            longitude={artwork.lng} 
            latitude={artwork.lat}
            anchor="center"
          >
            <Orb artwork={artwork} onClick={() => handleOrbClick(artwork)} />
          </Marker>
        ))}
      </Map>

      {/* Bottom Sheet Preview */}
      <div className={clsx(
        "absolute bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-white/10 rounded-t-3xl p-6 transition-transform duration-300 z-30",
        selectedArtwork ? "translate-y-0" : "translate-y-full"
      )}>
        {selectedArtwork && (
          <div className="flex flex-col h-full pb-20">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6 cursor-pointer" onClick={() => setSelectedArtwork(null)} />
            
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-heading font-bold text-white mb-1">{selectedArtwork.title}</h2>
                <p className="text-text-secondary">by {selectedArtwork.artistName}</p>
              </div>
              <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-wider text-white">
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
          </div>
        )}
      </div>

      <Navigation />
    </div>
  );
};
