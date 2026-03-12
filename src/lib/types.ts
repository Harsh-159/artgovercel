/// <reference types="vite/client" />

export type Category =
  'visual' | 'graffiti' | 'music' | 'dance' | 'poetry' | 'digital' | 'sculpture';

export type MediaType = 'image' | 'video' | 'audio';

export interface Artwork {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  category: Category;
  mediaUrl: string;
  mediaType: MediaType;
  lat: number;
  lng: number;
  isPaid: boolean;
  price?: number;
  likes: number;
  unlockCount?: number;
  accessTiers?: {
    viewOnce: {
      enabled: boolean;
      price: number;
    };
    viewForever: {
      enabled: boolean;
      price: number;
    };
    own: {
      enabled: boolean;
      price: number;
      tokenId?: string;
    };
  };
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export type AccessTier = 'viewOnce' | 'viewForever' | 'own';

export interface Certificate {
  artworkId: string;
  artworkTitle: string;
  artistName: string;
  mediaUrl: string;
  category: string;
  lat: number;
  lng: number;
  tokenId: string;        // 64-char hex hash
  ownerId: string;
  ownerName: string;      // buyer's Firebase displayName
  purchasedAt: string;    // ISO date string
  transactionId: string;  // Stripe paymentIntent ID
}
