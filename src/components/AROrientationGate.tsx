// This component wraps the AR view.
// It detects whether DeviceOrientationEvent permission is needed,
// and shows a full-screen "Enable Motion" prompt before launching AR.
// This is REQUIRED on iOS. On Android it usually works without it
// but the user gesture still helps activate the sensor reliably.

import React, { useState, useEffect } from 'react';

interface Props {
    children: React.ReactNode;
}

type PermissionState = 'unknown' | 'needed' | 'granted' | 'denied';

const AROrientationGate: React.FC<Props> = ({ children }) => {
    const [permState, setPermState] = useState<PermissionState>('unknown');

    useEffect(() => {
        // Check if permission API exists (iOS 13+)
        if (
            typeof (DeviceOrientationEvent as any).requestPermission === 'function'
        ) {
            setPermState('needed');
        } else {
            // Android or older iOS — permission not required via API
            // But we still check if the event fires at all
            const testHandler = () => setPermState('granted');
            window.addEventListener('deviceorientation', testHandler, { once: true });
            // If no event in 2 seconds, show the prompt anyway
            const timeout = setTimeout(() => {
                setPermState(prev => prev === 'unknown' ? 'needed' : prev);
            }, 2000);
            return () => {
                clearTimeout(timeout);
                window.removeEventListener('deviceorientation', testHandler);
            };
        }
    }, []);

    const requestPermission = async () => {
        try {
            if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                const response = await (DeviceOrientationEvent as any).requestPermission();
                setPermState(response === 'granted' ? 'granted' : 'denied');
            } else {
                // Android: just granting after gesture usually works
                setPermState('granted');
            }
        } catch (err) {
            console.error('Orientation permission error:', err);
            setPermState('granted'); // Proceed anyway
        }
    };

    // Auto-grant on Android where API doesn't exist
    if (permState === 'unknown') {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
                <div className="w-8 h-8 border-2 border-white/30 border-t-white 
                        rounded-full animate-spin" />
            </div>
        );
    }

    if (permState === 'granted') {
        return <>{children}</>;
    }

    if (permState === 'denied') {
        return (
            <div className="fixed inset-0 bg-[#0A0A0F] flex flex-col items-center 
                      justify-center p-8 text-center z-50">
                <span className="text-6xl mb-4">🧭</span>
                <h2 className="text-white text-xl font-bold mb-2">
                    Motion Access Denied
                </h2>
                <p className="text-gray-400 text-sm mb-6">
                    AR requires device orientation. Enable it in your browser settings
                    and reload the page.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-6 py-3 bg-[#4488FF] text-white rounded-full font-bold"
                >
                    Reload
                </button>
            </div>
        );
    }

    // permState === 'needed'
    return (
        <div className="fixed inset-0 bg-[#0A0A0F] flex flex-col items-center 
                    justify-center p-8 text-center z-50">
            <div className="w-24 h-24 rounded-full bg-[#4488FF]/20 border 
                      border-[#4488FF]/40 flex items-center justify-center 
                      mb-6 animate-pulse">
                <span className="text-5xl">🧭</span>
            </div>
            <h2 className="text-white text-2xl font-bold mb-3">
                Enable AR Orientation
            </h2>
            <p className="text-gray-400 text-sm mb-8 max-w-xs">
                GalleryOS needs access to your device's compass and motion sensors
                to anchor art in the real world.
            </p>
            <button
                onClick={requestPermission}
                className="w-full max-w-xs py-4 bg-[#4488FF] text-white rounded-full 
                   font-bold text-lg shadow-[0_0_30px_rgba(68,136,255,0.4)]
                   active:scale-95 transition-all"
            >
                Enable & Open AR
            </button>
            <button
                onClick={() => window.history.back()}
                className="mt-4 text-gray-500 text-sm"
            >
                Go back
            </button>
        </div>
    );
};

export default AROrientationGate;
