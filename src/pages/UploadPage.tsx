import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Category, MediaType } from '../lib/types';
import { saveArtwork, signInWithGoogle, auth, generateTokenId } from '../lib/firebase';
import { uploadToCloudinary } from '../lib/cloudinary';
import { ArrowLeft, Upload as UploadIcon, MapPin } from 'lucide-react';
import Map, { Marker } from 'react-map-gl';
import { clsx } from 'clsx';
import { Navigation } from '../components/Navigation';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoiaGFyc2h5YWRhdmhhcHB5IiwiYSI6ImNsczB2b252MDBhN2Qya21zZ254Z254Z24ifQ.demo';

const categories: { id: Category; label: string; color: string }[] = [
  { id: 'visual', label: 'Visual', color: '#4488FF' },
  { id: 'graffiti', label: 'Graffiti', color: '#FF3333' },
  { id: 'music', label: 'Music', color: '#FFD700' },
  { id: 'dance', label: 'Dance', color: '#44FF88' },
  { id: 'poetry', label: 'Poetry', color: '#FF8844' },
  { id: 'digital', label: 'Digital', color: '#AA44FF' },
  { id: 'sculpture', label: 'Sculpture', color: '#EEEEEE' },
];

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as { state: { lat: number; lng: number } | null };
  const [title, setTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [category, setCategory] = useState<Category>('visual');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('image');
  const [pricingModel, setPricingModel] = useState<'free' | 'paid'>('free');
  const [tiers, setTiers] = useState({
    viewOnce: { enabled: false, price: 0.49 },
    viewForever: { enabled: false, price: 0.99 },
    own: { enabled: false, price: 4.99 },
  });
  const [pricingError, setPricingError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [expiresIn24h, setExpiresIn24h] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [locationFetched, setLocationFetched] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: state?.lng || 0.1218,
    latitude: state?.lat || 52.2053,
    zoom: 15
  });

  // Keep the old `location` pointer in sync for the form
  const [location, setLocation] = useState({ lat: viewState.latitude, lng: viewState.longitude });

  useEffect(() => {
    setLocation({ lat: viewState.latitude, lng: viewState.longitude });
  }, [viewState]);

  // Render User Location if available
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    let unsubAuth: (() => void) | undefined;

    if (!auth) {
      // Auto-login for demo
      signInWithGoogle().then(res => {
        if (res?.user?.displayName) {
          setArtistName(res.user.displayName);
        }
      }).catch(console.error);
    } else {
      unsubAuth = auth.onAuthStateChanged(user => {
        if (user?.displayName) {
          setArtistName(user.displayName);
        }
      });
    }

    if (navigator.geolocation && !state) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setViewState({
            longitude: pos.coords.longitude,
            latitude: pos.coords.latitude,
            zoom: 15
          });
          setLocationFetched(true);
        },
        (err) => {
          console.error(err);
          setLocationFetched(true); // fallback
        },
        { timeout: 5000, maximumAge: 0 }
      );
    } else {
      setLocationFetched(true); // fallback or already have state
    }

    return () => unsubAuth?.();
  }, [state]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingMedia(true);
    setUploadPercent(0);
    try {
      const result = await uploadToCloudinary(file, (percent) => {
        setUploadPercent(percent);
      });
      setMediaUrl(result.url);
      setMediaType(result.mediaType);
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      alert("Media upload failed. Check Cloudinary settings and Upload Preset.");
    } finally {
      setIsUploadingMedia(false);
      setUploadPercent(0);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingError('');
    if (!title || !mediaUrl) return;

    if (pricingModel === 'paid') {
      if (!tiers.viewOnce.enabled && !tiers.viewForever.enabled && !tiers.own.enabled) {
        setPricingError('At least one tier must be enabled');
        return;
      }

      const enabledTiers = [];
      if (tiers.viewOnce.enabled) enabledTiers.push({ name: 'View Once', price: tiers.viewOnce.price });
      if (tiers.viewForever.enabled) enabledTiers.push({ name: 'View Forever', price: tiers.viewForever.price });
      if (tiers.own.enabled) enabledTiers.push({ name: 'Own', price: tiers.own.price });

      for (let i = 0; i < enabledTiers.length - 1; i++) {
        if (enabledTiers[i].price >= enabledTiers[i + 1].price) {
          setPricingError(`${enabledTiers[i].name} price must be lower than ${enabledTiers[i + 1].name} price`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const isPaidMode = pricingModel === 'paid';
      const artworkData: any = {
        title,
        artistName: artistName || 'Anonymous',
        artistId: auth?.currentUser?.uid || 'demo-user',
        category,
        mediaUrl,
        mediaType,
        lat: location.lat,
        lng: location.lng,
        isPaid: isPaidMode,
        likes: 0,
        createdAt: new Date(),
        isActive: true,
        accessTiers: isPaidMode ? {
          viewOnce: { enabled: tiers.viewOnce.enabled, price: tiers.viewOnce.price },
          viewForever: { enabled: tiers.viewForever.enabled, price: tiers.viewForever.price },
          own: { enabled: tiers.own.enabled, price: tiers.own.price, tokenId: generateTokenId() }
        } : {
          viewOnce: { enabled: false, price: tiers.viewOnce.price },
          viewForever: { enabled: false, price: tiers.viewForever.price },
          own: { enabled: false, price: tiers.own.price, tokenId: generateTokenId() }
        }
      };

      if (expiresIn24h) {
        artworkData.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }

      await saveArtwork(artworkData);
      setShowSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-accent/20 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <MapPin size={48} className="text-accent" />
        </div>
        <h1 className="text-3xl font-heading font-bold text-white mb-4">Your art is live!</h1>
        <p className="text-text-secondary mb-8">It has been pinned to the world.</p>
        <button
          onClick={() => navigate('/map')}
          className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-gray-200 transition-colors"
        >
          View on Map
        </button>
      </div>
    );
  }

  if (!locationFetched) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white font-bold pb-24">
        <div className="w-12 h-12 border-4 border-white/20 border-t-accent rounded-full animate-spin mb-4"></div>
        <p>Locating you...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 bg-background/80 backdrop-blur-md z-20 p-4 flex items-center border-b border-white/10">
        <button onClick={() => navigate('/map')} className="p-2 mr-4 text-white">
          <ArrowLeft />
        </button>
        <h1 className="text-xl font-heading font-bold text-white">Pin New Art</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8 max-w-md mx-auto">
        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wider">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-accent transition-colors"
              placeholder="Give it a name..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wider">Artist</label>
            <input
              type="text"
              value={artistName}
              onChange={e => setArtistName(e.target.value)}
              className="w-full bg-surface border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-accent transition-colors"
              placeholder="Your name..."
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wider">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={clsx(
                  "px-4 py-2 rounded-full text-sm font-bold transition-all border",
                  category === c.id ? "bg-white/10 text-white" : "bg-transparent text-text-secondary border-white/10 hover:border-white/30"
                )}
                style={{ borderColor: category === c.id ? c.color : undefined }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Media */}
        <div>
          <label className="block text-sm font-bold text-text-secondary mb-2 uppercase tracking-wider">Media</label>
          {mediaUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-white/10 aspect-video bg-surface">
              {mediaType === 'image' && <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />}
              {mediaType === 'video' && <video src={mediaUrl} className="w-full h-full object-cover" controls />}
              {mediaType === 'audio' && <div className="w-full h-full flex items-center justify-center"><audio src={mediaUrl} controls /></div>}
              <button
                type="button"
                onClick={() => setMediaUrl('')}
                className="absolute top-2 right-2 bg-black/50 p-2 rounded-full text-white text-xs"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingMedia}
                className="w-full aspect-video bg-surface border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center text-text-secondary hover:text-white hover:border-white/40 transition-colors disabled:opacity-50 overflow-hidden relative"
              >
                {isUploadingMedia && (
                  <div
                    className="absolute bottom-0 left-0 h-1 bg-accent transition-all duration-300 ease-out"
                    style={{ width: `${uploadPercent}%` }}
                  />
                )}
                <UploadIcon size={32} className={clsx("mb-2", isUploadingMedia && "animate-bounce")} />
                <span>{isUploadingMedia ? `Uploading to Cloudinary... ${uploadPercent}%` : "Tap to upload media"}</span>
                <span className="text-xs opacity-50 mt-1">Image, Video, or Audio (Max 50MB)</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*,audio/*"
                onChange={handleFileChange}
              />
            </>
          )}
        </div>

        {/* Location */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-text-secondary uppercase tracking-wider">Location Pin</label>
            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                      setViewState({
                        longitude: pos.coords.longitude,
                        latitude: pos.coords.latitude,
                        zoom: 15
                      });
                      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                    }
                  );
                }
              }}
              className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <MapPin size={12} />
              Locate Me
            </button>
          </div>
          <div className="h-[300px] rounded-xl overflow-hidden border border-white/10 relative">
            <Map
              {...viewState}
              onMove={e => setViewState(e.viewState)}
              mapStyle="mapbox://styles/mapbox/dark-v11"
              mapboxAccessToken={MAPBOX_TOKEN}
            >
              {userLocation && (
                <Marker longitude={userLocation.lng} latitude={userLocation.lat} anchor="center">
                  <div className="relative flex items-center justify-center w-6 h-6">
                    <div className="absolute w-full h-full bg-blue-500 rounded-full opacity-30 animate-ping"></div>
                    <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                  </div>
                </Marker>
              )}

              <Marker longitude={location.lng} latitude={location.lat} anchor="bottom" draggable onDragEnd={e => setLocation({ lat: e.lngLat.lat, lng: e.lngLat.lng })}>
                <MapPin size={32} className="text-accent drop-shadow-lg" />
              </Marker>
            </Map>
            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-mono text-white/70">
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-surface border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-white">Pricing</span>
            <div className="flex bg-black/50 rounded-full p-1 border border-white/10">
              <button type="button" onClick={() => setPricingModel('free')} className={clsx("px-4 py-1 rounded-full text-sm font-bold transition-colors", pricingModel === 'free' ? "bg-white text-black" : "text-text-secondary")}>Free</button>
              <button type="button" onClick={() => setPricingModel('paid')} className={clsx("px-4 py-1 rounded-full text-sm font-bold transition-colors", pricingModel === 'paid' ? "bg-accent text-white" : "text-text-secondary")}>Paid</button>
            </div>
          </div>

          {pricingModel === 'paid' && (
            <div className="flex flex-col gap-3 mt-4">
              <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👁</span>
                    <div>
                      <div className="font-bold text-white">View Once</div>
                      <div className="text-xs text-text-secondary">Pay once to view this piece right now</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={tiers.viewOnce.enabled} onChange={(e) => setTiers({ ...tiers, viewOnce: { ...tiers.viewOnce, enabled: e.target.checked } })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent hover:after:scale-95"></div>
                  </label>
                </div>
                {tiers.viewOnce.enabled && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                    <span className="text-text-secondary">£</span>
                    <input type="number" step="0.01" value={tiers.viewOnce.price} onChange={(e) => setTiers({ ...tiers, viewOnce: { ...tiers.viewOnce, price: parseFloat(e.target.value) || 0 } })} className="bg-transparent text-white font-mono focus:outline-none w-full" placeholder="0.49" />
                  </div>
                )}
              </div>

              <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">♾</span>
                    <div>
                      <div className="font-bold text-white">View Forever</div>
                      <div className="text-xs text-text-secondary">Unlock permanently — revisit any time</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={tiers.viewForever.enabled} onChange={(e) => setTiers({ ...tiers, viewForever: { ...tiers.viewForever, enabled: e.target.checked } })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent hover:after:scale-95"></div>
                  </label>
                </div>
                {tiers.viewForever.enabled && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10">
                    <span className="text-text-secondary">£</span>
                    <input type="number" step="0.01" value={tiers.viewForever.price} onChange={(e) => setTiers({ ...tiers, viewForever: { ...tiers.viewForever, price: parseFloat(e.target.value) || 0 } })} className="bg-transparent text-white font-mono focus:outline-none w-full" placeholder="0.99" />
                  </div>
                )}
              </div>

              <div className="bg-[#FFD700]/10 rounded-lg p-3 border border-[#FFD700]/30 shadow-[0_0_15px_rgba(255,215,0,0.1)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⭐</span>
                    <div>
                      <div className="font-bold text-[#FFD700]">Own It</div>
                      <div className="text-xs text-[#FFD700]/70">Become the verified owner. Receive an NFT certificate.</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={tiers.own.enabled} onChange={(e) => setTiers({ ...tiers, own: { ...tiers.own, enabled: e.target.checked } })} className="sr-only peer" />
                    <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#FFD700] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFD700] hover:after:scale-95"></div>
                  </label>
                </div>
                {tiers.own.enabled && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#FFD700]/20">
                    <span className="text-[#FFD700]/70">£</span>
                    <input type="number" step="0.01" value={tiers.own.price} onChange={(e) => setTiers({ ...tiers, own: { ...tiers.own, price: parseFloat(e.target.value) || 0 } })} className="bg-transparent text-[#FFD700] font-mono focus:outline-none w-full" placeholder="4.99" />
                  </div>
                )}
              </div>
            </div>
          )}
          {pricingError && <p className="text-red-400 text-sm mt-3">{pricingError}</p>}
        </div>

        {/* Expiry */}
        <div className="flex items-center justify-between bg-surface border border-white/10 rounded-xl p-4">
          <div>
            <span className="font-bold text-white block">Ephemeral Art</span>
            <span className="text-xs text-text-secondary">Disappears after 24 hours</span>
          </div>
          <button
            type="button"
            onClick={() => setExpiresIn24h(!expiresIn24h)}
            className={clsx("w-12 h-6 rounded-full transition-colors relative", expiresIn24h ? "bg-accent" : "bg-white/10")}
          >
            <div className={clsx("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", expiresIn24h ? "right-1" : "left-1")} />
          </button>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !title || !mediaUrl}
          className="w-full bg-accent hover:bg-accent/90 disabled:bg-surface disabled:text-text-secondary text-white font-bold py-4 rounded-full transition-all active:scale-95 shadow-[0_0_20px_rgba(68,136,255,0.3)]"
        >
          {isSubmitting ? 'Pinning...' : 'Pin to the World 📍'}
        </button>
      </form>

      <Navigation />
    </div>
  );
};
