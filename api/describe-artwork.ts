export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { imageUrl, title, category, mediaType } = req.body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY is not set');
        }

        let parts: any[] = [];

        if (mediaType === 'image' && imageUrl) {
            // Fetch the image to send to Gemini as base64 inline data
            const imgRes = await fetch(imageUrl);
            if (!imgRes.ok) throw new Error('Failed to fetch image for AI evaluation');

            const arrayBuffer = await imgRes.arrayBuffer();
            const base64Image = Buffer.from(arrayBuffer).toString('base64');
            const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

            parts.push({
                inlineData: {
                    mimeType: mimeType,
                    data: base64Image
                }
            });

            parts.push({
                text: `You are a poetic art critic writing gallery labels for location-anchored street art. Describe this ${category} artwork titled "${title}" in exactly 2 sentences. Be evocative, atmospheric, and specific to what you see. Do not start with "This artwork" or "This piece". Write as if guiding someone to feel something, not just understand something. Maximum 60 words total.`
            });
        } else {
            parts.push({
                text: `You are a poetic art critic writing gallery labels for location-anchored street art. Write a description for a ${category} piece titled "${title}" in exactly 2 sentences. Be evocative and atmospheric. Do not start with "This artwork" or "This piece". Write as if guiding someone to feel something. Maximum 60 words total.`
            });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts }],
                generationConfig: {
                    maxOutputTokens: 150,
                }
            }),
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message || 'Gemini API Error');
        }

        const description = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

        res.status(200).json({ description });
    } catch (error: any) {
        console.error('AI descriptor error:', error);
        res.status(500).json({ error: error.message });
    }
}
