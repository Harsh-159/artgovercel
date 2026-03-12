import { useState, useEffect } from 'react';
import { auth, getUserProfile, updateUserProfile } from './firebase';
import { UserProfile } from './types';

export const usePortalState = () => {
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        let unmounted = false;
        let unsubAuth: (() => void) | undefined;

        const checkPortal = async (uid: string) => {
            const p = await getUserProfile(uid);
            if (unmounted) return;

            // Check expiry (24h)
            if (p.portalActive && p.portalActivatedAt) {
                const activatedTime = new Date(p.portalActivatedAt).getTime();
                const now = Date.now();
                const hrs24 = 24 * 60 * 60 * 1000;

                if (now - activatedTime > hrs24) {
                    // Expired
                    await updateUserProfile(uid, { portalActive: false });
                    p.portalActive = false;
                }
            }
            setProfile(p);
        };

        if (auth) {
            unsubAuth = auth.onAuthStateChanged((user) => {
                if (user) {
                    checkPortal(user.uid);
                } else {
                    setProfile(null);
                }
            });
        }

        return () => {
            unmounted = true;
            if (unsubAuth) unsubAuth();
        };
    }, []);

    const activatePortal = async (city: string, lat: number, lng: number) => {
        if (!profile || profile.portalCount <= 0) return false;

        const newProfile = {
            ...profile,
            portalActive: true,
            portalCity: city,
            portalCoordinates: { lat, lng },
            portalActivatedAt: new Date().toISOString(),
            portalCount: profile.portalCount - 1
        };

        setProfile(newProfile);
        await updateUserProfile(profile.uid, newProfile);
        return true;
    };

    const deactivatePortal = async () => {
        if (!profile || !profile.portalActive) return;

        const newProfile = { ...profile, portalActive: false };
        setProfile(newProfile);
        await updateUserProfile(profile.uid, { portalActive: false });
    };

    return { profile, activatePortal, deactivatePortal };
};
