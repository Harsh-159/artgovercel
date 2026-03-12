import React from 'react';
import { Artwork } from '../lib/types';
import { Lock } from 'lucide-react';

const categoryColors: Record<string, string> = {
  visual: '#4488FF',
  graffiti: '#FF3333',
  music: '#FFD700',
  dance: '#44FF88',
  poetry: '#FF8844',
  digital: '#AA44FF',
  sculpture: '#EEEEEE',
  voice: '#FF6B9D',
  '3d': '#00FFD1',
};

export const Orb: React.FC<{ artwork: Artwork; onClick: () => void }> = ({ artwork, onClick }) => {
  const color = categoryColors[artwork.category] || '#FFFFFF';
  const isUnlocked = localStorage.getItem(`unlocked_${artwork.id}`) === 'true';
  const isLocked = artwork.isPaid && !isUnlocked;
  const isHot = artwork.likes > 50;
  const isSparkling = artwork.likes > 10;

  return (
    <div
      className="art-orb relative flex items-center justify-center cursor-pointer group drop-bounce"
      data-lng={artwork.lng}
      data-lat={artwork.lat}
      onClick={onClick}
      style={{
        width: isHot ? '48px' : '32px',
        height: isHot ? '48px' : '32px',
      }}
    >
      {/* Outer Ring */}
      <div
        className="absolute inset-0 rounded-full animate-pulse-slow"
        style={{ backgroundColor: color, opacity: 0.4 }}
      />

      {/* Sparkle Ring */}
      {isSparkling && (
        <div
          className="absolute inset-[-8px] rounded-full animate-spin-slow border border-dashed"
          style={{ borderColor: color, opacity: 0.6 }}
        />
      )}

      {/* Inner Core */}
      <div
        className="absolute rounded-full shadow-glow transition-transform group-hover:scale-110"
        style={{
          backgroundColor: color,
          width: isHot ? '24px' : '16px',
          height: isHot ? '24px' : '16px',
          boxShadow: `0 0 15px ${color}`
        }}
      />

      {/* Badges */}
      {isLocked && (
        <div className="absolute -top-2 -right-2 bg-surface p-0.5 rounded-full border border-white/10">
          <Lock size={12} className="text-white" />
        </div>
      )}
      {isHot && (
        <div className="absolute -bottom-2 -right-2 text-lg">
          🔥
        </div>
      )}
    </div>
  );
};
