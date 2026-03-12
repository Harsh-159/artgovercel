import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Map, X, Clock, Globe } from 'lucide-react';
import { UserProfile } from '../lib/types';

export const PORTAL_CITIES = [
    { name: 'Tokyo', lat: 35.6762, lng: 139.6503, emoji: '🗼' },
    { name: 'Paris', lat: 48.8566, lng: 2.3522, emoji: '🥐' },
    { name: 'New York', lat: 40.7128, lng: -74.0060, emoji: '🗽' },
    { name: 'Berlin', lat: 52.5200, lng: 13.4050, emoji: '🍻' },
    { name: 'Seoul', lat: 37.5665, lng: 126.9780, emoji: '🍜' },
    { name: 'São Paulo', lat: -23.5505, lng: -46.6333, emoji: '🌴' },
];

interface PortalModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: UserProfile | null;
    onActivate: (city: string, lat: number, lng: number) => Promise<boolean>;
    onDeactivate: () => Promise<void>;
}

export const PortalModal: React.FC<PortalModalProps> = ({
    isOpen, onClose, profile, onActivate, onDeactivate
}) => {
    const [activating, setActivating] = useState(false);

    if (!isOpen) return null;

    const handleActivate = async (city: string, lat: number, lng: number) => {
        setActivating(true);
        const success = await onActivate(city, lat, lng);
        setActivating(false);
        if (success) onClose();
    };

    const activeCity = profile?.portalActive ? profile.portalCity : null;
    const count = profile?.portalCount || 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl transition-all duration-300">
            <div className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mx-1 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center">
                            <Globe className="text-accent" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-heading font-black text-white">Art Portals</h2>
                            <div className="text-xs text-text-secondary flex items-center gap-1">
                                <Clock size={12} /> Lasts 24 Hours
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Status Box */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-4 mb-6 flex items-center justify-between">
                    <div>
                        <div className="text-sm text-text-secondary">Available Portals</div>
                        <div className="text-3xl font-black text-white">{count}</div>
                        <div className="text-[10px] text-text-secondary mt-1">Earn 1 per 3 artworks bought</div>
                    </div>
                    {profile?.portalActive && (
                        <button
                            onClick={async () => {
                                await onDeactivate();
                                onClose();
                            }}
                            className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 font-bold py-2 px-4 rounded-xl transition-all text-sm"
                        >
                            Close Current Portal
                        </button>
                    )}
                </div>

                {/* Cities Grid */}
                <div className="space-y-3 max-h-[50vh] overflow-y-auto scrollbar-none pb-2">
                    {PORTAL_CITIES.map((c) => {
                        const isActive = activeCity === c.name;
                        return (
                            <button
                                key={c.name}
                                disabled={isActive || activating || (!profile?.portalActive && count === 0)}
                                onClick={() => handleActivate(c.name, c.lat, c.lng)}
                                className={clsx(
                                    "w-full flex items-center justify-between p-4 border rounded-xl transition-all",
                                    isActive
                                        ? "bg-accent/20 border-accent text-white cursor-default"
                                        : "bg-white/5 border-white/10 hover:bg-white/10 hover:scale-[1.02] text-white",
                                    (!profile?.portalActive && count === 0) && !isActive && "opacity-50 grayscale cursor-not-allowed hover:scale-100 hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl filter drop-shadow-md">{c.emoji}</span>
                                    <div className="text-left">
                                        <div className="font-bold text-lg">{c.name}</div>
                                        <div className="text-xs text-text-secondary uppercase tracking-wider">
                                            {isActive ? 'Active Now' : `${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`}
                                        </div>
                                    </div>
                                </div>
                                {!isActive && count > 0 && (
                                    <div className="bg-accent text-black text-xs font-bold px-3 py-1.5 rounded-full shadow-[0_0_15px_rgba(0,255,209,0.3)]">
                                        Travel
                                    </div>
                                )}
                                {!isActive && count === 0 && (
                                    <div className="bg-white/10 text-text-secondary text-xs font-bold px-3 py-1.5 rounded-full">
                                        Locked
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
