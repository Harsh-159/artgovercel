import { Artwork } from './types';

export interface DiscoveryPreferences {
    mood: string | null;
    categories: string[];
    maxDistanceMetres: number | null;
    keyword: string | null;
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

/**
 * Calls Gemini to semantically score artworks against a user's search query.
 * Returns a Map of artworkId → AI relevance score (0–10).
 * If no API key or network error, returns an empty map (graceful fallback).
 */
async function aiKeywordMatch(
    artworks: Artwork[],
    keyword: string
): Promise<Map<string, number>> {
    const scores = new Map<string, number>();
    // Note: Vite ONLY exposes VITE_ prefixed variables to the client.
    // If search isn't finding anything, check the console for "AI Match Failed".
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY;
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE" || !keyword.trim()) {
        console.warn("[Discovery] No valid Gemini API key found (uses 'VITE_GEMINI_API_KEY' or 'GEMINI_API_KEY')");
        return scores;
    }

    // Build an artwork list for Gemini to evaluate
    const artworkLines = artworks.map(a => {
        const desc = a.description?.trim()
            ? a.description.trim()
            : `A ${a.category} artwork.`;
        return `ID:${a.id} | Title: "${a.title}" | Category: ${a.category} | Description: ${desc}`;
    }).join('\n');

    const prompt = `You are an AI assistant helping users discover street art. The user is searching for: "${keyword}".

Below is a list of artworks. For each artwork, give a relevance score from 0 to 10 based on how well it semantically matches the search query. Consider themes, mood, style, and anything implied by the description. Even if exact words don't match, score conceptual similarity highly.

ARTWORK LIST:
${artworkLines}

Respond ONLY with a valid JSON array. Each object must have exactly:
- "id": the artwork ID string (as given after "ID:")
- "score": a number from 0 to 10

Example: [{"id":"abc123","score":8},{"id":"def456","score":3}]

Do not include any explanation or markdown. Only output the JSON array.`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: 1024,
                        temperature: 0.2,
                    }
                })
            }
        );

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '[]';
        // Strip possible markdown code fences
        const cleaned = raw.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
        const parsed: { id: string; score: number }[] = JSON.parse(cleaned);

        for (const item of parsed) {
            if (item.id && typeof item.score === 'number') {
                scores.set(item.id, Math.max(0, Math.min(10, item.score)));
            }
        }
    } catch (err) {
        console.error('[AI Discovery] Gemini call failed, falling back to no AI scores:', err);
    }

    return scores;
}

export const matchArtworks = async (
    artworks: Artwork[],
    prefs: DiscoveryPreferences,
    userLat: number,
    userLng: number
): Promise<{ artwork: Artwork; score: number; aiScore?: number }[]> => {

    // Step 1: Hard filters (distance + category)
    const candidates = artworks
        .filter(a => a.isActive)
        .filter(a => {
            if (!prefs.maxDistanceMetres) return true;
            return getDistanceMetres(userLat, userLng, a.lat, a.lng) <= prefs.maxDistanceMetres;
        })
        .filter(a => {
            if (prefs.categories.length === 0) return true;
            return prefs.categories.includes(a.category);
        });

    // Step 2: AI keyword scoring (if keyword provided)
    const keyword = prefs.keyword?.trim().toLowerCase();
    const aiScores = keyword
        ? await aiKeywordMatch(candidates, keyword)
        : new Map<string, number>();

    const hasAI = aiScores.size > 0;

    // Step 3: Keyword Filtering & Fallback
    const filtered = candidates.filter(a => {
        if (!keyword) return true;
        
        // Use AI score if available
        if (hasAI) {
            return (aiScores.get(a.id) ?? 0) >= 2;
        }

        // Fallback: simple string match
        const title = a.title.toLowerCase();
        const desc = (a.description || "").toLowerCase();
        return title.includes(keyword) || desc.includes(keyword) || a.category.toLowerCase().includes(keyword);
    });

    // Step 4: Score and sort
    return filtered
        .map(a => {
            let score = 0;
            const dist = getDistanceMetres(userLat, userLng, a.lat, a.lng);

            // Mood weight
            if (prefs.mood && MOOD_CATEGORY_WEIGHTS[prefs.mood]) {
                score += MOOD_CATEGORY_WEIGHTS[prefs.mood][a.category] || 0;
            }

            // AI keyword relevance (scaled: max AI boost = 10 points)
            const aiScore = aiScores.get(a.id);
            if (aiScore !== undefined) {
                score += aiScore;
            } else if (keyword) {
                // Local match boost if AI failed but keyword matched
                score += 5;
            }

            // Distance penalty (crucial for "Any" distance mode)
            // -2 points per 1km starting from 100m. Large distances (like Birmingham @ 140km) get -280 points.
            if (dist > 100) {
                const km = (dist - 100) / 1000;
                score -= km * 2; 
            }

            // Likes boost (popular = better match, up to 3 points)
            score += Math.min(a.likes / 50, 3);

            // Randomness injection (±0.2)
            score += (Math.random() - 0.5) * 0.4;

            return { artwork: a, score, aiScore };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, keyword ? 3 : 12);
};
