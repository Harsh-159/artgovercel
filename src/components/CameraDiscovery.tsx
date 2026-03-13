import React, { useEffect, useRef, useState } from 'react';
import { Artwork } from '../lib/types';
import { DistancePin } from './DistancePin';

// Distance between two coords in meters
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
        Math.cos(p1) * Math.cos(p2) *
        Math.sin(dl / 2) * Math.sin(dl / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Bearing from loc1 to loc2 in degrees (0-360)
const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const l1 = lat1 * Math.PI / 180;
    const l2 = lat2 * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(dl) * Math.cos(l2);
    const x = Math.cos(l1) * Math.sin(l2) -
        Math.sin(l1) * Math.cos(l2) * Math.cos(dl);
    const brng = Math.atan2(y, x);
    return (brng * 180 / Math.PI + 360) % 360;
};

interface CameraDiscoveryProps {
    artworks: Artwork[];
    userLocation: { lat: number, lng: number } | null;
    onSelectArtwork: (a: Artwork) => void;
    onClose: () => void;
}

export const CameraDiscovery: React.FC<CameraDiscoveryProps> = ({ artworks, userLocation, onSelectArtwork, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [heading, setHeading] = useState<number>(0);
    const [pitch, setPitch] = useState<number>(0);

    // Start camera (after user gesture / permission flow).
    useEffect(() => {
        if (hasPermission !== true) return;

        let stream: MediaStream | null = null;
        let cancelled = false;

        const initCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } }
                });
                if (cancelled) return;
                const v = videoRef.current;
                if (v) {
                    v.srcObject = stream;
                    // On some mobile browsers, explicit play is required even with autoplay.
                    const tryPlay = async () => {
                        try { await v.play(); } catch { }
                    };
                    if (v.readyState >= 1) tryPlay();
                    v.onloadedmetadata = () => { tryPlay(); };
                }
            } catch (err) {
                console.error("Camera access denied:", err);
            }
        };

        initCamera();

        return () => {
            cancelled = true;
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [hasPermission]);

    // Request Orientation permissions (required for iOS 13+)
    const requestOrientation = async () => {
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
            try {
                const p = await (DeviceOrientationEvent as any).requestPermission();
                if (p === 'granted') {
                    setHasPermission(true);
                } else {
                    alert('Orientation permission denied.');
                }
            } catch (e) {
                setHasPermission(true); // Fallback
            }
        } else {
            setHasPermission(true); // Non-iOS
        }
    };

    useEffect(() => {
        if (hasPermission === null) return;

        const handleOrientation = (e: DeviceOrientationEvent) => {
            let webkitAlpha = (e as any).webkitCompassHeading;
            let angle = webkitAlpha ? webkitAlpha : 360 - (e.alpha || 0);
            setHeading(angle);

            // Beta goes from -180 to 180, represents front/back tilt
            setPitch(e.beta || 0);
        };

        window.addEventListener('deviceorientation', handleOrientation);
        return () => window.removeEventListener('deviceorientation', handleOrientation);
    }, [hasPermission]);

    if (hasPermission === null) {
        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6 text-center text-white">
                <h2 className="text-2xl font-bold mb-4 font-heading">Camera Access Required</h2>
                <p className="text-text-secondary mb-8">We need your permission to orient the camera securely.</p>
                <button
                    onClick={requestOrientation}
                    className="bg-accent text-black font-bold py-4 px-8 rounded-full shadow-[0_0_20px_rgba(0,255,209,0.4)]"
                >
                    Enable Camera AI
                </button>
                <button onClick={onClose} className="mt-8 text-white/50 border-b border-white/50">
                    Cancel mapping
                </button>
            </div>
        );
    }

    // Calculate nearby pins
    const closeArtworks = artworks.map(a => {
        if (!userLocation) return { ...a, distance: 9999, bearingInfo: null };
        const dist = getDistance(userLocation.lat, userLocation.lng, a.lat, a.lng);
        const targetBearing = getBearing(userLocation.lat, userLocation.lng, a.lat, a.lng);

        // Normalize angluar diff (-180 to 180)
        let angleDiff = targetBearing - heading;
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;

        // Map horizontal field of view (approx 60 deg) to -1 to 1 screen space
        const theta = Math.max(-2, Math.min(2, angleDiff / 30));

        // Pitch: beta=90 means phone is vertical. 
        // If we assume artwork is roughly eye level, its pitch diff depends on current phone pitch.
        // 90 is straight forward. < 90 is tilting down.
        let pitchDiff = 90 - pitch;
        const phi = Math.max(-2, Math.min(2, pitchDiff / 30));

        return {
            ...a,
            distance: dist,
            bearingInfo: { theta, phi } // Map -1 to 1 space roughly
        };
    }).filter(a => a.distance < 150); // only compute for nearby

    return (
        <div className="absolute inset-0 bg-black overflow-hidden z-20">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover scale-105 pointer-events-none"
            />

            {/* UI Overlay */}
            <div className="absolute inset-0 z-30 pointer-events-none">
                {closeArtworks.map(a => {
                    const isUnlocked = localStorage.getItem(`unlocked_${a.id}`) === 'true' || sessionStorage.getItem(`viewonce_${a.id}`) === 'true' || !a.isPaid;
                    return (
                        <DistancePin
                            key={a.id}
                            artwork={a as Artwork}
                            distance={a.distance}
                            bearingInfo={a.bearingInfo}
                            isUnlocked={isUnlocked}
                            onClick={(art) => {
                                if (a.distance > 20) {
                                    const el = document.getElementById('camera-toast');
                                    if (el) {
                                        el.textContent = "Please move closer to unlock this artwork.";
                                        el.classList.remove('opacity-0');
                                        setTimeout(() => el.classList.add('opacity-0'), 2500);
                                    }
                                } else {
                                    onSelectArtwork(art);
                                }
                            }}
                        />
                    );
                })}
            </div>

            <div
                id="camera-toast"
                className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 font-bold rounded-full text-sm opacity-0 transition-opacity z-50 duration-300"
            ></div>
        </div>
    );
};
