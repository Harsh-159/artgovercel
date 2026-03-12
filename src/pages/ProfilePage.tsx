import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth, signInWithGoogle } from '../lib/firebase';
import { Artwork } from '../lib/types';
import { Navigation } from '../components/Navigation';
import { Lock, MapPin, Heart, Coins } from 'lucide-react';
import { clsx } from 'clsx';

export const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const [artworks, setArtworks] = useState<Artwork[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(auth?.currentUser);
    const [ownedCount, setOwnedCount] = useState(0);

    useEffect(() => {
        let count = 0;
        for (let i = 0; i < localStorage.length; i++) {
            if (localStorage.key(i)?.startsWith('owned_')) count++;
        }
        setOwnedCount(count);
    }, []);

    useEffect(() => {
        const unsubAuth = auth?.onAuthStateChanged(user => {
            setCurrentUser(user);
        });

        return () => unsubAuth?.();
    }, []);

    useEffect(() => {
        if (!currentUser || !db) {
            setIsLoading(false);
            return;
        }

        const q = query(
            collection(db, 'artworks'),
            where('artistId', '==', currentUser.uid),
            where('isActive', '==', true)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Artwork[];
            setArtworks(data.sort((a, b) => (b.createdAt?.valueOf() || 0) - (a.createdAt?.valueOf() || 0)));
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-background pb-24 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mb-6">
                    <span className="text-3xl">👤</span>
                </div>
                <h1 className="text-2xl font-heading font-bold text-white mb-2">Sign in to see your profile</h1>
                <p className="text-text-secondary mb-8">Manage your pins, earnings, and stats.</p>
                <button
                    onClick={() => signInWithGoogle()}
                    className="bg-white text-black font-bold py-3 px-8 rounded-full hover:bg-gray-200 transition-all active:scale-95"
                >
                    Sign In with Google
                </button>
                <Navigation />
            </div>
        );
    }

    const stats = {
        pins: artworks.length,
        likes: artworks.reduce((sum, art) => sum + (art.likes || 0), 0),
        unlocks: artworks.reduce((sum, art) => sum + (art.unlockCount || 0), 0),
        earnings: artworks.reduce((sum, art) => sum + ((art.price || 0) * (art.unlockCount || 0)), 0)
    };

    return (
        <div className="min-h-screen bg-background pb-24">
            {/* Header */}
            <div className="pt-12 px-6 pb-6 bg-surface/50 border-b border-white/5">
                <div className="flex items-center gap-4 mb-6">
                    {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt="Avatar" className="w-20 h-20 rounded-full border-2 border-accent" />
                    ) : (
                        <div className="w-20 h-20 rounded-full bg-accent text-white flex items-center justify-center text-2xl font-bold font-heading">
                            {currentUser.displayName?.charAt(0) || 'U'}
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-heading font-bold text-white">{currentUser.displayName || 'Anonymous Artist'}</h1>
                        <p className="text-text-secondary">{currentUser.email}</p>
                    </div>
                </div>
                <button className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors">
                    Edit Profile
                </button>
            </div>

            {/* Stats Grid */}
            <div className="p-6">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                    <div className="bg-surface border border-white/10 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                        <MapPin size={24} className="text-accent mb-2" />
                        <span className="text-2xl font-mono font-bold text-white">{stats.pins}</span>
                        <span className="text-xs text-text-secondary uppercase tracking-wider">Pins</span>
                    </div>
                    <div className="bg-surface border border-white/10 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                        <Heart size={24} className="text-red-500 mb-2" />
                        <span className="text-2xl font-mono font-bold text-white">{stats.likes}</span>
                        <span className="text-xs text-text-secondary uppercase tracking-wider">Total Likes</span>
                    </div>
                    <div className="bg-surface border border-white/10 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                        <Lock size={24} className="text-purple-400 mb-2" />
                        <span className="text-2xl font-mono font-bold text-white">{stats.unlocks}</span>
                        <span className="text-xs text-text-secondary uppercase tracking-wider">Unlocks</span>
                    </div>
                    <div className="bg-surface border border-white/10 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                        <Coins size={24} className="text-yellow-400 mb-2" />
                        <span className="text-2xl font-mono font-bold text-white">£{stats.earnings.toFixed(2)}</span>
                        <span className="text-xs text-text-secondary uppercase tracking-wider">Earnings <span className="text-[9px] opacity-50">(simulated)</span></span>
                    </div>
                    <div className="bg-[#FFD700]/10 border border-[#FFD700]/30 p-4 rounded-2xl flex flex-col items-center justify-center text-center shadow-[0_0_15px_rgba(255,215,0,0.1)]">
                        <span className="text-2xl mb-2">⭐</span>
                        <span className="text-2xl font-mono font-bold text-[#FFD700]">{ownedCount}</span>
                        <span className="text-xs text-[#FFD700]/70 uppercase tracking-wider">Owned NFTs</span>
                    </div>
                </div>

                {/* My Pins */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-heading font-bold text-white">My Art</h2>
                    <span className="bg-white/10 text-white text-xs px-2 py-1 rounded-full">{stats.pins} items</span>
                </div>

                {isLoading ? (
                    <div className="text-center py-10 text-text-secondary">Loading your art...</div>
                ) : artworks.length === 0 ? (
                    <div className="text-center py-12 bg-surface/30 rounded-2xl border border-white/5 border-dashed">
                        <div className="text-4xl mb-4">🎨</div>
                        <p className="text-text-secondary mb-4">You haven't pinned any art yet.</p>
                        <button
                            onClick={() => navigate('/upload')}
                            className="text-accent font-bold hover:underline"
                        >
                            Pin Something →
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4">
                        {artworks.map(art => (
                            <div
                                key={art.id}
                                className="bg-surface border border-white/10 rounded-2xl overflow-hidden cursor-pointer group hover:border-white/30 transition-colors"
                                onClick={() => navigate(`/ar/${art.id}`)}
                            >
                                <div className="aspect-square relative overflow-hidden bg-black/50">
                                    {art.mediaType === 'image' && <img src={art.mediaUrl} alt={art.title} className="w-full h-full object-cover" />}
                                    {art.mediaType === 'video' && <video src={art.mediaUrl} className="w-full h-full object-cover pointer-events-none" muted />}
                                    {art.mediaType === 'audio' && <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-purple-900"><span className="text-3xl">🎵</span></div>}

                                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                                        {localStorage.getItem(`owned_${art.id}`) && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); navigate(`/certificate/${localStorage.getItem(`owned_${art.id}`)}`); }}
                                                className="bg-[#FFD700]/20 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-[#FFD700] border border-[#FFD700]/40 flex items-center gap-1 hover:scale-105 transition-transform"
                                            >
                                                <span>⭐</span> Owned
                                            </button>
                                        )}
                                        {art.isPaid && (
                                            <span className="bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold text-yellow-400 border border-yellow-400/20">
                                                PAID
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-3">
                                    <h3 className="font-bold text-white truncate text-sm mb-1">{art.title}</h3>
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary bg-white/5 px-2 py-0.5 rounded">
                                            {art.category}
                                        </span>
                                        <div className="flex items-center gap-1 text-xs text-text-secondary">
                                            <Heart size={10} /> {art.likes || 0}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Navigation />
        </div>
    );
};
