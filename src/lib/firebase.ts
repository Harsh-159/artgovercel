import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, increment, query, where } from 'firebase/firestore';
import { getAuth, signInWithPopup, getRedirectResult, GoogleAuthProvider, signOut as firebaseSignOut } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { Artwork } from './types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "demo",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "demo"
};

const isDemo = firebaseConfig.apiKey === "demo";

// Initialize Firebase only if not in demo mode
const app = !isDemo ? initializeApp(firebaseConfig) : null;
export const db = !isDemo ? getFirestore(app!) : null;
export const generateTokenId = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const saveCertificate = async (cert: any): Promise<void> => {
  try {
    await setDoc(doc(db!, 'certificates', cert.tokenId), cert);
  } catch (error) {
    console.error('Failed to save certificate:', error);
  }
};

export const getCertificate = async (tokenId: string): Promise<any | null> => {
  try {
    const snap = await getDoc(doc(db!, 'certificates', tokenId));
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    console.error('Failed to fetch certificate:', error);
    return null;
  }
};

export const getOwnershipByUser = async (
  artworkId: string,
  userId: string
): Promise<any | null> => {
  try {
    const q = query(
      collection(db!, 'certificates'),
      where('artworkId', '==', artworkId),
      where('ownerId', '==', userId)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0].data();
  } catch (error) {
    console.error('Failed to fetch ownership:', error);
    return null;
  }
};

export const auth = !isDemo ? getAuth(app!) : null;
export const storage = !isDemo ? getStorage(app!) : null;

// --- MOCK DATA FOR DEMO MODE ---
let mockArtworks: Artwork[] = [
  {
    id: "1", title: "Kings Fractal", artistName: "VXRN", artistId: "user1", category: "graffiti",
    mediaUrl: "https://picsum.photos/seed/mural1/800/600", mediaType: "image",
    lat: 52.2043, lng: 0.1149, isPaid: false, likes: 47, isActive: true, createdAt: new Date()
  },
  {
    id: "2", title: "River Reverie", artistName: "Clara M.", artistId: "user2", category: "visual",
    mediaUrl: "https://picsum.photos/seed/river2/800/600", mediaType: "image",
    lat: 52.2022, lng: 0.1147, isPaid: true, price: 0.99, likes: 12, isActive: true, createdAt: new Date()
  },
  {
    id: "3", title: "Pulse of the Cam", artistName: "DJ Fenwick", artistId: "user3", category: "music",
    mediaUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", mediaType: "audio",
    lat: 52.2055, lng: 0.1175, isPaid: false, likes: 89, isActive: true, createdAt: new Date()
  },
  {
    id: "4", title: "Ghost Dancer", artistName: "Lena Vo", artistId: "user4", category: "dance",
    mediaUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", mediaType: "video",
    lat: 52.2075, lng: 0.1210, isPaid: true, price: 1.49, likes: 31, isActive: true, createdAt: new Date()
  },
  {
    id: "5", title: "To the Bridge Builder", artistName: "Rumi.exe", artistId: "user5", category: "poetry",
    mediaUrl: "https://picsum.photos/seed/poem5/800/400", mediaType: "image",
    lat: 52.2038, lng: 0.1221, isPaid: false, likes: 156, isActive: true, createdAt: new Date()
  },
  {
    id: "6", title: "Neon Gate", artistName: "PixelDrift", artistId: "user6", category: "digital",
    mediaUrl: "https://picsum.photos/seed/digital6/800/800", mediaType: "image",
    lat: 52.2096, lng: 0.1232, isPaid: false, likes: 8, isActive: true, createdAt: new Date()
  }
];
let listeners: ((artworks: Artwork[]) => void)[] = [];

export const getArtworks = (callback: (artworks: Artwork[]) => void) => {
  if (isDemo) {
    callback(mockArtworks);
    listeners.push(callback);
    return () => { listeners = listeners.filter(l => l !== callback); };
  }
  const q = query(collection(db!, 'artworks'), where('isActive', '==', true));
  return onSnapshot(q, (snapshot) => {
    const artworks = snapshot.docs.map(doc => ({
      id: doc.id, ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate(),
    })) as Artwork[];
    callback(artworks);
  });
};

export const getArtworkById = async (id: string): Promise<Artwork | null> => {
  if (isDemo) return mockArtworks.find(a => a.id === id) || null;
  const docSnap = await getDoc(doc(db!, 'artworks', id));
  if (docSnap.exists()) {
    return {
      id: docSnap.id, ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate(),
      expiresAt: docSnap.data().expiresAt?.toDate(),
    } as Artwork;
  }
  return null;
};

export const saveArtwork = async (data: Omit<Artwork, 'id'>) => {
  if (isDemo) {
    const newArtwork = { ...data, id: Math.random().toString(36).substring(7) } as Artwork;
    mockArtworks.push(newArtwork);
    listeners.forEach(l => l(mockArtworks));
    return newArtwork;
  }
  return await addDoc(collection(db!, 'artworks'), data);
};

export const incrementLikes = async (id: string) => {
  if (isDemo) {
    const artwork = mockArtworks.find(a => a.id === id);
    if (artwork) {
      artwork.likes += 1;
      listeners.forEach(l => l(mockArtworks));
    }
    return;
  }
  await updateDoc(doc(db!, 'artworks', id), { likes: increment(1) });
};

export const signInWithGoogle = async () => {
  if (isDemo) return { user: { displayName: "Demo User", uid: "demo-user" } };
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth!, provider);
    return result;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  if (isDemo) return;
  try {
    await firebaseSignOut(auth!);
  } catch (error) {
    console.error('Sign out error:', error);
  }
};

export const handleRedirectResult = async () => {
  if (isDemo) return null;
  try {
    const result = await getRedirectResult(auth!);
    return result;
  } catch (error) {
    console.error('Redirect result error:', error);
    return null;
  }
};

// export const incrementUnlockCount = async (id: string) => {
//   if (isDemo) return;
//   await updateDoc(doc(db!, 'artworks', id), { unlockCount: increment(1) });
// };

export const seedDemoData = async () => {
  if (isDemo) return;
  const snapshot = await getDoc(doc(db!, 'system', 'seeded'));
  if (snapshot.exists() && snapshot.data().done) return;
  for (const art of mockArtworks) {
    const { id, ...data } = art;
    await addDoc(collection(db!, 'artworks'), data);
  }
  await updateDoc(doc(db!, 'system', 'seeded'), { done: true }).catch(async () => {
    await addDoc(collection(db!, 'system'), { done: true, id: 'seeded' });
  });
};

export const incrementUnlockCount = async (artworkId: string) => {
  try {
    await updateDoc(doc(db, 'artworks', artworkId), {
      unlockCount: increment(1)
    });
  } catch (error) {
    console.error('Failed to increment unlock count:', error);
  }
};