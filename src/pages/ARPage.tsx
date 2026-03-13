import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { getArtworks } from '../lib/firebase';
import { Artwork } from '../lib/types';
import { UnlockModal } from '../components/UnlockModal';
import { ArrowLeft } from 'lucide-react';
import { usePortalState } from '../lib/usePortalState';

export const ARPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const locationState = useLocation();
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const [lockedSelected, setLockedSelected] = useState<Artwork | null>(null);
  const { profile } = usePortalState();

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

  const isUnlocked = selectedArtwork && (!selectedArtwork.isPaid || localStorage.getItem(`unlocked_${selectedArtwork.id}`) === 'true' || sessionStorage.getItem(`viewonce_${selectedArtwork.id}`) === 'true');

  useEffect(() => {
    // Only navigate when we have artwork data AND access is confirmed
    if (!selectedArtwork || !isUnlocked) return;

    const params = new URLSearchParams({
      id: selectedArtwork.id,
      mediaUrl: selectedArtwork.mediaUrl,
      mediaType: selectedArtwork.mediaType,
      lat: selectedArtwork.lat.toString(),
      lng: selectedArtwork.lng.toString(),
      title: selectedArtwork.title,
      artistName: selectedArtwork.artistName || '',
      isPaid: selectedArtwork.isPaid.toString(),
      price: (selectedArtwork.price || 0).toString(),
      likes: (selectedArtwork.likes || 0).toString(),
      origin: window.location.origin,
      fbProject: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
      appearDuring: (selectedArtwork as any).appearDuring?.join(',') || 'Always',
    });

    if (profile?.portalActive && profile.portalCoordinates) {
      params.append('portalLat', profile.portalCoordinates.lat.toString());
      params.append('portalLng', profile.portalCoordinates.lng.toString());
    }

    window.location.href = '/ar-view.html?' + params.toString();
  }, [selectedArtwork, isUnlocked, profile]);

  if (!selectedArtwork && !lockedSelected) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="w-8 h-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  if (selectedArtwork && isUnlocked) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-[#4488FF]/30 border-t-[#4488FF] rounded-full animate-spin" />
        <p className="text-white text-sm font-medium">Opening AR...</p>
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
    </div>
  );
};
