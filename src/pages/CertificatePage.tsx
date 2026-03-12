import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCertificate } from '../lib/firebase';
import { Certificate } from '../lib/types';
import { ArrowLeft } from 'lucide-react';
import html2canvas from 'html2canvas';

export const CertificatePage: React.FC = () => {
    const { tokenId } = useParams();
    const navigate = useNavigate();
    const [cert, setCert] = useState<Certificate | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!tokenId) return;
        getCertificate(tokenId).then((data) => {
            setCert(data);
            setLoading(false);
        });
    }, [tokenId]);

    const handleDownload = async () => {
        const element = document.getElementById('certificate-card');
        if (!element || !cert) return;

        // Slight pause to ensure fonts are rendered perfectly (hack but safe)
        await new Promise(r => setTimeout(r, 100));

        const canvas = await html2canvas(element, {
            backgroundColor: '#0A0A0F',
            scale: 2,           // retina quality
            useCORS: true,      // needed for Cloudinary images
            allowTaint: false,
        });

        const link = document.createElement('a');
        link.download = `galleryos-certificate-${cert.tokenId.slice(0, 8)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center text-white pb-24">
                <div className="w-12 h-12 border-4 border-white/20 border-t-accent rounded-full animate-spin mb-4"></div>
                <p className="font-bold">Verifying Ownership...</p>
            </div>
        );
    }

    if (!cert) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
                <h1 className="text-2xl font-bold text-white mb-2">Certificate Not Found</h1>
                <p className="text-text-secondary mb-8">This token does not exist on the GalleryOS Network.</p>
                <button
                    onClick={() => navigate('/map')}
                    className="bg-accent text-white font-bold py-3 px-8 rounded-full shadow-[0_0_20px_rgba(68,136,255,0.4)]"
                >
                    Return to Map
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 relative flex flex-col items-center pt-16 pb-12 overflow-x-hidden">

            <button
                onClick={() => navigate('/map')}
                className="absolute top-4 left-4 p-2 text-white/50 hover:text-white bg-white/5 rounded-full backdrop-blur-md border border-white/10 transition-colors z-50"
            >
                <ArrowLeft size={24} />
            </button>

            {/* The Glow Wrapper */}
            <div className="relative w-full max-w-md mx-auto">
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-accent via-[#AA44FF] to-[#FFD700] blur-xl opacity-50 animate-pulse-slow"></div>

                {/* Certificate Card Container */}
                <div
                    id="certificate-card"
                    className="relative bg-surface border border-white/20 rounded-2xl w-full p-6 pb-8 overflow-hidden 
                     shadow-[0_0_50px_rgba(0,0,0,0.8)] z-10"
                >
                    {/* Subtle noise texture overlay */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/stardust.png")' }}></div>

                    {/* Header */}
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                        <span className="font-heading font-black tracking-tighter text-2xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">Gallery<span className="text-accent">OS</span></span>
                        <span className="text-[#FFD700] text-[10px] font-bold uppercase tracking-widest border border-[#FFD700]/30 px-2 py-1 rounded bg-[#FFD700]/10">Verified Ownership</span>
                    </div>

                    {/* Artwork Media Display */}
                    <div className="w-full aspect-square bg-black/50 rounded-xl overflow-hidden border border-white/10 mb-6 shadow-inner relative flex items-center justify-center">
                        {cert.mediaType === 'video' ? (
                            <video src={cert.mediaUrl} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                        ) : cert.mediaType === 'audio' ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                                <div className="flex items-end gap-1 h-12">
                                    {[...Array(12)].map((_, i) => (
                                        <div key={i} className="w-2 bg-accent rounded-t-full" style={{ height: `${Math.random() * 100}%` }}></div>
                                    ))}
                                </div>
                                <span className="text-2xl">♫ Audio Canvas</span>
                            </div>
                        ) : (
                            <img src={cert.mediaUrl} className="w-full h-full object-cover" />
                        )}
                    </div>

                    {/* Title and Metadata */}
                    <div className="text-center mb-8">
                        <h1 className="font-heading text-3xl font-bold text-white mb-2 leading-tight">{cert.artworkTitle}</h1>
                        <p className="text-xl text-text-secondary mb-4 italic">by <span className="text-white/90">{cert.artistName}</span></p>

                        <div className="flex items-center justify-center gap-3">
                            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-white/80 border border-white/10 shadow-sm">
                                📌 {cert.category}
                            </span>
                            <span className="px-3 py-1 rounded-full text-xs font-mono bg-black/40 text-text-secondary border border-white/5 shadow-inner">
                                📍 {cert.lat.toFixed(4)}, {cert.lng.toFixed(4)}
                            </span>
                        </div>
                    </div>

                    {/* Blockchain & Ownership Data Block */}
                    <div className="bg-black/60 rounded-xl p-4 border border-white/5 font-mono text-sm space-y-4 mb-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-3xl group-hover:bg-accent/10 transition-colors"></div>

                        <div>
                            <div className="text-[10px] text-text-secondary mb-1">TOKEN ID / HASH</div>
                            <div className="text-accent break-all text-xs opacity-90">{cert.tokenId}</div>
                        </div>

                        <div>
                            <div className="text-[10px] text-text-secondary mb-1">CURRENT VERIFIED OWNER</div>
                            <div className="text-white font-bold tracking-wide">{cert.ownerName} <span className="text-xs text-white/40 font-normal">({cert.ownerId.slice(0, 8)}...)</span></div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <div className="text-[10px] text-text-secondary mb-1">MINTED / PURCHASED DATE</div>
                                <div className="text-white/80 text-xs">{new Date(cert.purchasedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                            </div>
                            <div className="flex-1">
                                <div className="text-[10px] text-text-secondary mb-1">TRANSACTION REF</div>
                                <div className="text-white/80 text-xs">{cert.transactionId.slice(0, 8)}...{cert.transactionId.slice(-6)}</div>
                            </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-white/10">
                            <div className="text-[10px] text-text-secondary mb-1">NETWORK CONFIRMATION</div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
                                <span className="text-white/70 text-xs">Polygon (Simulated) · GalleryOS Network</span>
                            </div>
                        </div>
                    </div>

                    {/* Autheticity Badge */}
                    <div className="flex items-start gap-3 bg-[#1B2720] border border-[#2A4532] rounded-xl p-4">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0 mt-1">✓</div>
                        <div>
                            <div className="text-green-400 font-bold text-sm mb-1">Authenticity Verified</div>
                            <div className="text-green-400/70 text-[10px] leading-relaxed">
                                This unforgeable cryptographic certificate represents absolute digital ownership of a location-anchored artwork on the GalleryOS Network.
                            </div>
                        </div>
                    </div>

                    {/* Footer inside card for screenshot context */}
                    <div className="text-center text-[9px] text-white/30 uppercase tracking-[0.2em] mt-8 pt-4 border-t border-white/5">
                        galleryos.art · Cambridge RealityX Hackathon 2026
                    </div>
                </div>
            </div>

            {/* Out-of-card Action Buttons (Will not be in the downloaded screenshot) */}
            <div className="w-full max-w-md flex gap-3 mt-8 px-4 z-20">
                <button
                    onClick={() => navigate(`/ar/${cert.artworkId}?unlocked=true`)}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-colors border border-white/10 active:scale-95 text-sm"
                >
                    View in AR →
                </button>
                <button
                    onClick={handleDownload}
                    className="flex-1 bg-accent/20 hover:bg-accent/30 text-accent font-bold py-3 rounded-xl transition-colors border border-accent/30 active:scale-95 text-sm flex items-center justify-center gap-2"
                >
                    <span>Download</span>
                    <span className="text-lg">↓</span>
                </button>
            </div>
        </div>
    );
};
