import React, { useState } from 'react';
import { Artwork } from '../lib/types';
import { Lock } from 'lucide-react';
import { incrementUnlockCount } from '../lib/firebase';
import { clsx } from 'clsx';

export const UnlockModal: React.FC<{ artwork: Artwork; onUnlock: () => void; onCancel: () => void }> = ({ artwork, onUnlock, onCancel }) => {
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleUnlock = async () => {
    setIsUnlocking(true);
    localStorage.setItem(`unlocked_${artwork.id}`, 'true');
    await incrementUnlockCount(artwork.id);
    setTimeout(() => {
      onUnlock();
    }, 800);
  };

  return (
    <div className={clsx(
      "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-all duration-500",
      isUnlocking && "opacity-0 scale-110"
    )}>
      <div className="bg-surface border border-white/10 rounded-2xl p-6 w-full max-w-sm flex flex-col items-center text-center relative overflow-hidden">

        {/* Blurred Preview Background */}
        <div
          className="absolute inset-0 opacity-20 blur-xl z-0"
          style={{ backgroundImage: `url(${artwork.mediaUrl})`, backgroundSize: 'cover' }}
        />

        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4 animate-pulse-slow">
            <Lock size={32} className="text-white" />
          </div>

          <h2 className="text-2xl font-heading font-bold text-text-primary mb-2">{artwork.title}</h2>
          <p className="text-text-secondary mb-6">This piece is locked</p>

          <div className="bg-accent/20 text-accent px-4 py-1 rounded-full font-mono text-lg mb-8 border border-accent/30">
            £{artwork.price?.toFixed(2)}
          </div>

          <button
            onClick={handleUnlock}
            className="w-full bg-accent hover:bg-accent/90 text-white font-bold py-3 px-6 rounded-full transition-all active:scale-95 mb-4 shadow-[0_0_20px_rgba(68,136,255,0.4)]"
          >
            Unlock & View Forever
          </button>

          <button
            onClick={onCancel}
            className="text-text-secondary hover:text-white transition-colors text-sm"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};
