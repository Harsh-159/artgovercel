import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth, signInWithGoogle, signOutUser, handleRedirectResult, getCertificate } from '../lib/firebase';
import { Artwork, Certificate } from '../lib/types';
import { Navigation } from '../components/Navigation';
import { Lock, MapPin, Heart, Coins, LogOut, Image, Award, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

export const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const [artworks, setArtworks] = useState<Artwork[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(auth?.currentUser);
    const [ownedCount, setOwnedCount] = useState(0);
    const [ownedCerts, setOwnedCerts] = useState<Certificate[]>([]);

    useEffect(() => {
        const loadCertificates = async () => {
            const tokens: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('owned_')) {
                    const tokenId = localStorage.getItem(key);
                    if (tokenId) tokens.push(tokenId);
                }
            }

            setOwnedCount(tokens.length);

            const certs: Certificate[] = [];
            for (const token of tokens) {
                try {
                    const cert = await getCertificate(token);
                    if (cert) certs.push(cert);
                } catch (e) {
                    console.error("Failed to load cert:", token);
                }
            }
            setOwnedCerts(certs);
        };

        loadCertificates();
    }, []);

    useEffect(() => {
        // Complete Google redirect sign-in if returning from Google auth
        handleRedirectResult().then(result => {
            if (result?.user) setCurrentUser(result.user as any);
        });

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

    const handleSignOut = async () => {
        setIsLoading(true);
        await signOutUser();
        setCurrentUser(null);
        setIsLoading(false);
    };

    const handleSignIn = async () => {
        setIsLoading(true);
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error("Sign-in failed:", error);
            setIsLoading(false);
        }
    };

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                {/* Background decorative elements */}
                <div className="absolute top-1/4 left-0 w-64 h-64 bg-accent/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" />

                <div className="z-10 bg-surface/50 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] w-full max-w-sm flex flex-col items-center">
                    <div className="w-24 h-24 bg-gradient-to-tr from-accent to-purple-500 rounded-full flex items-center justify-center mb-8 shadow-lg shadow-accent/20">
                        <span className="text-4xl">👤</span>
                    </div>
                    <h1 className="text-3xl font-heading font-bold text-white mb-3">Your Collection</h1>
                    <p className="text-text-secondary text-base mb-10 leading-relaxed">
                        Sign in to trace your digital footprint, manage earnings, and view your owned collection.
                    </p>
                    <button
                        onClick={handleSignIn}
                        disabled={isLoading}
                        className={clsx(
                            "w-full font-bold py-4 px-8 rounded-full transition-all active:scale-95 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.1)]",
                            isLoading ? "bg-white/50 text-black/50 cursor-wait" : "bg-white text-black hover:scale-[1.02]"
                        )}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                Connecting...
                            </span>
                        ) : (
                            <>
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                </svg>
                                Continue with Google
                            </>
                        )}
                    </button>
                </div>
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
        <div className="min-h-screen bg-black pb-24 text-white">
            {/* Header Area */}
            <div className="relative border-b border-white/5 bg-gradient-to-b from-surface to-black pt-16 px-6 pb-8">
                <div className="absolute top-0 right-0 p-6 flex justify-end w-full max-w-2xl mx-auto">
                    <button
                        onClick={handleSignOut}
                        className="text-text-secondary hover:text-white flex items-center gap-2 text-sm bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md transition-colors"
                    >
                        <LogOut size={16} />
                        Sign Out
                    </button>
                </div>

                <div className="max-w-2xl mx-auto flex flex-col items-center mt-4">
                    <div className="relative mb-4 group">
                        {currentUser.photoURL ? (
                            <img src={currentUser.photoURL} alt="Avatar" className="w-24 h-24 rounded-full border-4 border-black shadow-[0_0_0_2px_rgba(68,136,255,0.5)] object-cover" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-accent to-purple-600 border-4 border-black text-white flex items-center justify-center text-4xl font-bold font-heading shadow-[0_0_0_2px_rgba(68,136,255,0.5)]">
                                {currentUser.displayName?.charAt(0)?.toUpperCase() || 'U'}
                            </div>
                        )}
                        <div className="absolute -bottom-2 -right-2 bg-black border border-white/20 p-2 rounded-full text-xs">
                            🛡️
                        </div>
                    </div>

                    <h1 className="text-3xl font-heading font-bold mb-1 text-center">
                        {currentUser.displayName || 'Anonymous Artist'}
                    </h1>
                    <p className="text-text-secondary text-sm font-mono bg-white/5 px-3 py-1 rounded-full mb-6">
                        {currentUser.email}
                    </p>
                </div>
            </div>

            {/* Content Body */}
            <div className="max-w-2xl mx-auto p-6">

                {/* Main Stats Panel */}
                <div className="bg-surface/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 mb-8 mt-[-40px] shadow-2xl relative z-10 flex flex-col gap-6">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-lg font-bold font-heading">Performance</h2>
                        <span className="text-accent text-xs font-mono bg-accent/10 px-2 py-1 rounded text-right">simulated</span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                                <Image size={24} />
                            </div>
                            <div>
                                <p className="text-2xl font-mono font-bold">{stats.pins}</p>
                                <p className="text-sm text-text-secondary">Dropped Pins</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[#FF3C3C]/10 flex items-center justify-center text-[#FF3C3C]">
                                <Heart size={24} />
                            </div>
                            <div>
                                <p className="text-2xl font-mono font-bold">{stats.likes}</p>
                                <p className="text-sm text-text-secondary">Total Likes</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                <Lock size={24} />
                            </div>
                            <div>
                                <p className="text-2xl font-mono font-bold">{stats.unlocks}</p>
                                <p className="text-sm text-text-secondary">Paid Unlocks</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[#FFD700]/10 flex items-center justify-center text-[#FFD700]">
                                <Coins size={24} />
                            </div>
                            <div>
                                <p className="text-2xl font-mono font-bold pl-0.5">£{stats.earnings.toFixed(2)}</p>
                                <p className="text-sm text-text-secondary">Gross Revenue</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Collection Highlight */}
                <div className="w-full border border-[#FFD700]/20 rounded-2xl mb-10 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#FFD700]/10 to-transparent p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#FFD700]/20 flex items-center justify-center">
                            <Award className="text-[#FFD700]" size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-[#FFD700]">Digital Certificates</p>
                            <p className="text-sm text-[#FFD700]/70 flex items-center gap-2">
                                <span className="font-mono">{ownedCount}</span> Artworks Owned
                            </p>
                        </div>
                    </div>
                    {ownedCount > 0 && (
                        <div className="px-4 pb-4 flex flex-col gap-2">
                            {ownedCerts.length === 0 ? (
                                <div className="text-center py-4 text-sm text-[#FFD700]/50 animate-pulse">Loading certificates...</div>
                            ) : (
                                ownedCerts.map(cert => (
                                    <button
                                        key={cert.tokenId}
                                        onClick={() => navigate(`/certificate/${cert.tokenId}`)}
                                        className="flex items-center justify-between bg-[#FFD700]/5 hover:bg-[#FFD700]/15 border border-[#FFD700]/10 rounded-xl px-4 py-3 transition-colors text-left w-full"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className="text-lg">⭐</span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{cert.artworkTitle}</p>
                                                <p className="text-[11px] text-[#FFD700]/60 font-mono truncate">{cert.tokenId.slice(0, 12)}...</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={16} className="text-[#FFD700]/50 flex-shrink-0" />
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* My Pins Gallery */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-heading font-bold text-white flex items-center gap-2">
                        My Art <span className="text-text-secondary font-normal text-sm">({stats.pins})</span>
                    </h2>
                    <button
                        onClick={() => navigate('/upload')}
                        className="text-accent text-sm font-bold bg-accent/10 px-4 py-2 rounded-full hover:bg-accent/20 transition-colors"
                    >
                        + Drop Art
                    </button>
                </div>

                {isLoading ? (
                    <div className="text-center py-10 text-text-secondary flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin mb-4" />
                        Loading gallery...
                    </div>
                ) : artworks.length === 0 ? (
                    <div className="text-center py-16 bg-surface/30 rounded-3xl border border-white/5 border-dashed">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                            <MapPin className="text-text-secondary w-10 h-10" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">No art dropped yet</h3>
                        <p className="text-text-secondary mb-6 max-w-xs mx-auto text-sm">
                            Head to a location and drop your first piece of location-locked art into the world.
                        </p>
                        <button
                            onClick={() => navigate('/upload')}
                            className="bg-accent text-white font-bold py-3 px-8 rounded-full shadow-[0_0_20px_rgba(68,136,255,0.4)] hover:scale-105 active:scale-95 transition-all"
                    >
                        Drop Art Now
                    </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-4 pb-12">
                        {artworks.map(art => (
                            <div
                                key={art.id}
                                className="bg-surface/80 border border-white/10 rounded-2xl overflow-hidden group hover:border-white/30 transition-all hover:-translate-y-1 shadow-lg"
                            >
                                <div className="aspect-square relative overflow-hidden bg-black cursor-pointer" onClick={() => navigate(`/ar/${art.id}`)}>
                                    {art.mediaType === 'image' && <img src={art.mediaUrl} alt={art.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />}
                                    {art.mediaType === 'video' && <video src={art.mediaUrl} className="w-full h-full object-cover pointer-events-none group-hover:scale-110 transition-transform duration-700" muted />}
                                    {(art.mediaType === 'audio' || art.mediaType === 'voice') && (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-900/40 to-purple-900/40 border border-white/5">
                                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-sm mb-2">
                                                <span className="text-2xl">🎵</span>
                                            </div>
                                        </div>
                                    )}
                                    {art.mediaType === 'model3d' && (
                                        <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                            <span className="text-4xl text-white/20">🧊</span>
                                        </div>
                                    )}

                                    {/* Overlay Gradient */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                                    <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
                                        {localStorage.getItem(`owned_${art.id}`) && (
                                            <span className="bg-[#FFD700]/20 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold text-[#FFD700] border border-[#FFD700]/40 flex items-center gap-1">
                                                <span>⭐</span> Owned
                                            </span>
                                        )}
                                        {art.isPaid && (
                                            <span className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold text-accent border border-accent/40 shadow-[0_0_10px_rgba(68,136,255,0.3)]">
                                                PAID
                                            </span>
                                        )}
                                    </div>

                                    <div className="absolute bottom-3 left-3 right-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary bg-black/50 backdrop-blur px-2 py-0.5 rounded border border-white/10">
                                                {art.mediaType}
                                            </span>
                                            <div className="flex items-center gap-1 text-xs text-white bg-black/50 backdrop-blur px-2 py-0.5 rounded border border-white/10">
                                                <Heart size={10} className="text-[#FF3C3C] fill-current" /> {art.likes || 0}
                                            </div>
                                        </div>
                                        <h3 className="font-bold text-white truncate text-sm drop-shadow-md">{art.title}</h3>
                                    </div>
                                </div>
                                {/* Certificate link for owned artworks */}
                                {localStorage.getItem(`owned_${art.id}`) && (
                                    <button
                                        onClick={() => navigate(`/certificate/${localStorage.getItem(`owned_${art.id}`)}`)}
                                        className="w-full py-2 text-[11px] font-bold text-[#FFD700] bg-[#FFD700]/5 hover:bg-[#FFD700]/15 transition-colors flex items-center justify-center gap-1.5 border-t border-[#FFD700]/10"
                                    >
                                        <Award size={12} /> View Certificate
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Navigation />
        </div>
    );
};
