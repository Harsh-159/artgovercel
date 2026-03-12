import { Artwork } from './types';

export interface DiscoveryPreferences {
    mood: string | null;
    categories: string[];
    maxDistanceMetres: number | null;
}

// Mood → category affinity weights (hardcoded, pseudo-intelligent)
const MOOD_CATEGORY_WEIGHTS: Record<string, Record<string, number>> = {
    'calm': { visual: 3, poetry: 3, music: 2, sculpture: 2, dance: 1, graffiti: 1, digital: 1, voice: 2, '3d': 1 },
    'energised': { dance: 3, music: 3, graffiti: 2, digital: 2, visual: 1, poetry: 1, sculpture: 1, voice: 1, '3d': 2 },
    'reflective': { poetry: 3, visual: 3, voice: 3, music: 2, sculpture: 2, graffiti: 1, dance: 1, digital: 1, '3d': 1 },
    'mysterious': { digital: 3, sculpture: 3, '3d': 3, graffiti: 2, visual: 2, poetry: 2, music: 1, dance: 1, voice: 1 },
    'playful': { graffiti: 3, dance: 3, digital: 2, '3d': 2, music: 2, visual: 1, poetry: 1, sculpture: 1, voice: 1 },
    'surprised': { '3d': 3, digital: 3, graffiti: 2, dance: 2, sculpture: 2, music: 1, visual: 1, poetry: 1, voice: 1 },
    'melancholic': { poetry: 3, voice: 3, music: 3, visual: 2, sculpture: 2, graffiti: 1, dance: 1, digital: 1, '3d': 1 },
    'inspired': { visual: 3, digital: 3, sculpture: 2, dance: 2, music: 2, poetry: 2, graffiti: 1, voice: 1, '3d': 2 },
};

// Haversine distance in metres between two GPS points
export const getDistanceMetres = (
    lat1: number, lng1: number,
    lat2: number, lng2: number
): number => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const matchArtworks = (
    artworks: Artwork[],
    prefs: DiscoveryPreferences,
    userLat: number,
    userLng: number
): { artwork: Artwork; score: number }[] => {
    return artworks
        .filter(a => a.isActive)
        .filter(a => {
            // Distance filter
            if (!prefs.maxDistanceMetres) return true;
            return getDistanceMetres(userLat, userLng, a.lat, a.lng)
                <= prefs.maxDistanceMetres;
        })
        .filter(a => {
            // Category filter (if any selected)
            if (prefs.categories.length === 0) return true;
            return prefs.categories.includes(a.category);
        })
        .map(a => {
            // Score each artwork
            let score = 0;

            // Mood weight
            if (prefs.mood && MOOD_CATEGORY_WEIGHTS[prefs.mood]) {
                score += MOOD_CATEGORY_WEIGHTS[prefs.mood][a.category] || 0;
            }

            // Likes boost (popular = better match, up to 3 points)
            score += Math.min(a.likes / 20, 3);

            // Randomness injection (±1.5 points) — prevents same order every time
            score += (Math.random() * 3) - 1.5;

            return { artwork: a, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);  // max 12 results
};
