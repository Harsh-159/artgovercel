import React, { useState, useEffect } from 'react';
import { Navigation } from '../components/Navigation';
import { matchArtworks, getDistanceMetres } from '../lib/discovery';
import { getArtworks } from '../lib/firebase';
import { Artwork } from '../lib/types';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Map, MapPin, Search, Sparkles } from 'lucide-react';

const MOODS = [
    { id: 'calm', label: 'Calm', icon: '😌' },
    { id: 'energised', label: 'Energised', icon: '🔥' },
    { id: 'reflective', label: 'Reflective', icon: '💭' },
    { id: 'mysterious', label: 'Mysterious', icon: '🌙' },
    { id: 'playful', label: 'Playful', icon: '😂' },
    { id: 'surprised', label: 'Surprised', icon: '😮' },
    { id: 'melancholic', label: 'Melancholic', icon: '💔' },
    { id: 'inspired', label: 'Inspired', icon: '✨' },
];

const CATEGORIES = [
    { id: 'visual', label: 'Visual', color: '#4488FF' },
    { id: 'graffiti', label: 'Graffiti', color: '#FF3333' },
    { id: 'music', label: 'Music', color: '#FFD700' },
    { id: 'dance', label: 'Dance', color: '#44FF88' },
    { id: 'poetry', label: 'Poetry', color: '#FF8844' },
    { id: 'digital', label: 'Digital', color: '#AA44FF' },
    { id: 'sculpture', label: 'Sculpture', color: '#EEEEEE' },
    { id: 'voice', label: 'Voice', color: '#FF6B9D' },
    { id: '3d', label: '3D', color: '#00FFD1' },
];

export const DiscoverPage: React.FC = () => {
    const [artworks, setArtworks] = useState<Artwork[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const navigate = useNavigate();

    const [mood, setMood] = useState<string | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [maxDistance, setMaxDistance] = useState<number | null>(null);
    const [keyword, setKeyword] = useState<string>('');

    const [isSearching, setIsSearching] = useState(false);
    const [isAiPhase, setIsAiPhase] = useState(false);
    const [results, setResults] = useState<{ artwork: Artwork; score: number; aiScore?: number }[] | null>(null);

    useEffect(() => {
        const unsub = getArtworks(setArtworks);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (err) => console.error("Could not get location:", err),
                { timeout: 5000, maximumAge: 0 }
            );
        }
        return () => unsub();
    }, []);

    const handleSearch = async () => {
        if (!userLocation) {
            alert("We need your location to find nearby art!");
            return;
        }

        setIsSearching(true);
        setIsAiPhase(false);
        setResults(null);

        // Brief initial delay for UX, then show AI phase if keyword provided
        await new Promise(r => setTimeout(r, 400));
        if (keyword.trim()) setIsAiPhase(true);

        try {
            const matches = await matchArtworks(
                artworks,
                { mood, categories, maxDistanceMetres: maxDistance, keyword: keyword.trim() || null },
                userLocation.lat,
                userLocation.lng
            );
            setResults(matches);
        } catch (err) {
            console.error('Search failed:', err);
            setResults([]);
        } finally {
            setIsSearching(false);
            setIsAiPhase(false);
        }
    };

    const getDistanceStr = (artLat: number, artLng: number) => {
        if (!userLocation) return '';
        const m = getDistanceMetres(userLocation.lat, userLocation.lng, artLat, artLng);
        if (m > 1000) return `~${(m / 1000).toFixed(1)}km away`;
        return `~${Math.round(m)}m away`;
    };

    return (
        <div className="w-full min-h-screen bg-background pb-32">
            <div className="p-6">
                <h1 className="text-3xl font-heading font-bold text-white mb-2">Discover Art</h1>
                <p className="text-text-secondary mb-8">Find pieces that match your vibe</p>

                {/* Filters */}
                {!results && !isSearching && (
                    <div className="space-y-8 animate-fade-in">
                        {/* Keyword Search */}
                        <div>
                            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">What are you looking for?</h2>
                            <p className="text-xs text-text-secondary mb-3 flex items-center gap-1.5">
                                <Sparkles size={12} className="text-accent" />
                                Powered by Gemini AI — describe any vibe, theme, or feeling
                            </p>
                            <div className="bg-surface border border-white/10 rounded-full flex items-center px-4 py-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all">
                                <Search size={18} className="text-text-secondary mr-3" />
                                <input
                                    type="text"
                                    placeholder="e.g. 'dark and melancholy', 'hopeful energy', 'urban chaos'"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    className="bg-transparent border-none outline-none text-white w-full placeholder:text-text-secondary/50"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSearch();
                                    }}
                                />
                            </div>
                        </div>

                        {/* Mood */}
                        <div>
                            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">How are you feeling?</h2>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                                {MOODS.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => setMood(m.id === mood ? null : m.id)}
                                        className={clsx(
                                            "flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-full font-bold transition-all border",
                                            mood === m.id ? "bg-accent text-white border-accent shadow-[0_0_15px_rgba(68,136,255,0.4)]" : "bg-surface border-white/10 text-white/80 hover:bg-white/5"
                                        )}
                                    >
                                        <span className="text-xl">{m.icon}</span>
                                        <span>{m.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Categories */}
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider">What kind of art?</h2>
                                <button
                                    onClick={() => setCategories(categories.length === CATEGORIES.length ? [] : CATEGORIES.map(c => c.id))}
                                    className="text-xs text-accent uppercase font-bold"
                                >
                                    {categories.length === CATEGORIES.length ? "Clear" : "All"}
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORIES.map(c => {
                                    const isSelected = categories.includes(c.id);
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                if (isSelected) setCategories(categories.filter(id => id !== c.id));
                                                else setCategories([...categories, c.id]);
                                            }}
                                            className="px-4 py-2 rounded-full text-sm font-bold transition-all border"
                                            style={{
                                                backgroundColor: isSelected ? `${c.color}20` : 'transparent',
                                                borderColor: isSelected ? c.color : 'rgba(255,255,255,0.1)',
                                                color: isSelected ? c.color : 'rgba(255,255,255,0.7)'
                                            }}
                                        >
                                            {c.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Distance */}
                        <div>
                            <h2 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4">Distance</h2>
                            <div className="bg-surface border border-white/10 rounded-2xl p-4">
                                <input
                                    type="range"
                                    min="0" max="4"
                                    value={maxDistance === 100 ? 0 : maxDistance === 250 ? 1 : maxDistance === 500 ? 2 : maxDistance === 1000 ? 3 : 4}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value);
                                        if (val === 0) setMaxDistance(100);
                                        else if (val === 1) setMaxDistance(250);
                                        else if (val === 2) setMaxDistance(500);
                                        else if (val === 3) setMaxDistance(1000);
                                        else setMaxDistance(null);
                                    }}
                                    className="w-full accent-accent mb-4"
                                />
                                <div className="flex justify-between text-xs text-text-secondary font-bold">
                                    <span>100m</span>
                                    <span>250m</span>
                                    <span>500m</span>
                                    <span>1km</span>
                                    <span>Any</span>
                                </div>
                                <div className="text-center mt-4 text-white font-bold">
                                    Within {maxDistance ? (maxDistance >= 1000 ? maxDistance / 1000 + 'km' : maxDistance + 'm') : 'Any distance'}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSearch}
                            disabled={!userLocation}
                            className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:bg-surface text-white font-bold py-4 rounded-full transition-all active:scale-95 shadow-[0_0_20px_rgba(68,136,255,0.3)]"
                        >
                            {userLocation ? "Find Matches" : "Waiting for GPS..."}
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {isSearching && (
                    <div className="space-y-4">
                        {/* AI status banner */}
                        <div className={clsx(
                            "flex items-center gap-3 p-4 rounded-2xl border transition-all duration-500",
                            isAiPhase
                                ? "bg-accent/10 border-accent/30"
                                : "bg-surface border-white/5"
                        )}>
                            <div className={clsx(
                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                                isAiPhase ? "bg-accent/20" : "bg-white/5"
                            )}>
                                {isAiPhase
                                    ? <Sparkles size={16} className="text-accent animate-pulse" />
                                    : <Search size={16} className="text-text-secondary animate-pulse" />
                                }
                            </div>
                            <div>
                                <p className="text-sm font-bold text-white">
                                    {isAiPhase ? "Gemini AI is scanning artworks..." : "Finding nearby art..."}
                                </p>
                                <p className="text-xs text-text-secondary">
                                    {isAiPhase
                                        ? "Matching your search with descriptions and themes"
                                        : "Applying your filters"}
                                </p>
                            </div>
                        </div>

                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-surface/50 border border-white/5 rounded-2xl p-4 flex gap-4 animate-pulse">
                                <div className="w-20 h-20 rounded-xl bg-white/10 flex-shrink-0" />
                                <div className="flex-1 space-y-2 py-2">
                                    <div className="h-4 bg-white/10 rounded w-3/4" />
                                    <div className="h-3 bg-white/10 rounded w-1/2" />
                                    <div className="h-3 bg-white/10 rounded w-1/4 mt-4" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div className="animate-fade-in">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-accent font-bold">Found {results.length} pieces for your vibe</h2>
                                {keyword.trim() && (
                                    <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                                        <Sparkles size={10} className="text-accent" />
                                        AI-ranked for "{keyword}"
                                    </p>
                                )}
                            </div>
                            <button onClick={() => setResults(null)} className="text-xs text-text-secondary hover:text-white uppercase tracking-wider font-bold">Refine Filters</button>
                        </div>

                        {results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <span className="text-6xl mb-4">🗺️</span>
                                <h3 className="text-white font-bold text-xl mb-2">Nothing matches nearby</h3>
                                <p className="text-text-secondary mb-8">Try a different search or expand your distance.</p>
                                <button onClick={() => { setMood(null); setCategories([]); setMaxDistance(null); setKeyword(''); setResults(null); }} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-full font-bold transition-colors">
                                    Clear Filters
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {results.map(({ artwork, score, aiScore }) => (
                                    <div key={artwork.id} className="bg-surface hover:bg-surface/80 border border-white/10 rounded-2xl p-4 flex gap-4 cursor-pointer transition-colors group" onClick={() => navigate(`/ar/${artwork.id}`)}>
                                        <div className="flex-1 min-w-0 pr-2">
                                            <div className="flex justify-between items-start mb-1">
                                                <h3 className="text-white font-bold truncate text-lg leading-tight group-hover:text-accent transition-colors">{artwork.title}</h3>
                                                <div className="flex items-center gap-2 mt-1 flex-shrink-0">
                                                    {/* AI match badge */}
                                                    {aiScore !== undefined && aiScore >= 7 && (
                                                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
                                                            <Sparkles size={9} /> AI Match
                                                        </span>
                                                    )}
                                                    <div className="flex gap-1">
                                                        {[1, 2, 3].map(i => (
                                                            <div key={i} className={clsx("w-2 h-2 rounded-full", score > 4 ? (i <= 3 ? "bg-accent" : "bg-white/20") : score >= 2 ? (i <= 2 ? "bg-accent" : "bg-white/20") : (i <= 1 ? "bg-accent" : "bg-white/20"))} />
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-xs text-text-secondary mb-2 truncate">by {artwork.artistName}</p>

                                            {/* Description snippet if available */}
                                            {artwork.description && (
                                                <p className="text-xs text-text-secondary/70 mb-2 line-clamp-2 italic">"{artwork.description}"</p>
                                            )}

                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded border" style={{ borderColor: CATEGORIES.find(c => c.id === artwork.category)?.color, color: CATEGORIES.find(c => c.id === artwork.category)?.color, backgroundColor: `${CATEGORIES.find(c => c.id === artwork.category)?.color}10` }}>
                                                    {artwork.category}
                                                </span>
                                                <span className="text-xs text-text-secondary flex items-center gap-1 opacity-70"><MapPin size={10} /> {getDistanceStr(artwork.lat, artwork.lng)}</span>
                                            </div>

                                            <div className="flex items-center gap-4 border-t border-white/10 pt-3 relative">
                                                <span className="text-xs text-text-secondary flex items-center gap-1"><span className="text-[10px]">❤️</span> {artwork.likes}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/map?highlight=${artwork.id}`); }}
                                                    className="absolute right-0 text-xs text-accent font-bold flex items-center gap-1 hover:underline"
                                                >
                                                    Show on Map →
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <Navigation />
        </div>
    );
};
