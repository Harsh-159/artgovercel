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
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}
