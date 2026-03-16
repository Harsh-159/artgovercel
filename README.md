# GalleryOS 🌍🎨

GalleryOS is a spatial, location-based augmented reality (AR) art platform. It transforms the physical world into an interactive digital canvas, allowing artists to pin multimedia artworks to real-world GPS coordinates and users to discover them through an immersive AR experience.

## ✨ Core Features

### 📍 Location-Based AR Engine
*   **Spatial Anchoring:** Artworks are pinned to precise physical GPS coordinates.
*   **Mixed Media Support:** Upload and view Images, Videos, Audio, Voice Memos, and immersive 3D Models (`.glb`/`.gltf`).
*   **Standalone AR Viewer:** A highly optimized WebGL/A-Frame AR tracking engine utilizing native device sensors (gyroscope, compass) ensures artworks stay planted in the real world without jitter.

### 📷 Camera Discovery Mode (AI Camera)
*   Instead of just looking at a flat map, users can toggle to **Camera Mode** to scan their physical surroundings via a live WebRTC camera feed.
*   Nearby artworks render as hovering spatial UI pins that scale dynamically based on real-time distance.
*   **Proximity Gating:** Walk within 20 meters of a spatial pin to physically unlock and experience the artwork.

### 🌌 Global Art Portals
*   **Teleportation:** Users can temporarily override their physical location to explore the AR street art scene in major global hubs (e.g., Tokyo, Paris, New York, Seoul).
*   **Portal Economy:** Portals are earned through engagement. Purchasing artworks grants portal keys, allowing 24-hour access to foreign city layers.

### 🧠 Deep AI Integration (Powered by Gemini)
*   **Semantic AI Discovery:** Go beyond simple keyword matching. Users can search for vibes, emotions, or concepts (e.g., "dark and melancholy," "hopeful energy"), and Gemini AI semantically ranks and matches artworks to the query.
*   **AI Art Descriptor:** During the upload process, artists can utilize an AI assistant to automatically generate rich, engaging descriptions of their work based on the media context.

### 🌤️ Environmental Conditions
*   Artworks can be context-aware. Creators can set conditional visibility tags such as **"Only appear during: Rain"**, **"Night"**, **"Day"**, or **"Summer"**. 
*   If a user visits an artwork's location but the weather or time condition is not met, the artwork remains hidden until the environment matches the artist's intent.

### 💎 Ownership & Creator Economy
*   **Access Tiers:** Creators can set artworks as Free, View Once, View Forever, or Own.
*   **Stripe Integration:** Frictionless payment processing for unlocking premium physical-digital art.
*   **Digital Certificates:** Purchasing the "Own" tier generates an immutable digital certificate of ownership, instantly accessible via a dedicated viewing page.

### 🗺️ Interactive Map & Sonar
*   **Mapbox GL JS:** A beautiful, dark-themed 2D/3D map interface to navigate the city.
*   **Sonar Pulses:** As users walk the map, their location marker emits sonar pulses that physically interact with nearby artwork orbs, causing them to flare and notify the user of nearby discoveries.

---

## 🛠️ Tech Stack

*   **Frontend:** React 19, TypeScript, Vite
*   **Styling:** Tailwind CSS, Lucide Icons, clsx
*   **Mapping:** Mapbox GL JS, `react-map-gl`
*   **AR Engine:** A-Frame 1.4.0, AR.js 3.4.5 (Location-based web AR)
*   **Backend / Database:** Firebase (Firestore, Auth, Storage)
*   **AI:** Google Gemini API (Firebase Serverless Functions / Vercel API)
*   **Media Hosting:** Cloudinary CDN
*   **Payments:** Stripe Elements

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js and npm installed. You will also need API keys for Firebase, Mapbox, Cloudinary, Stripe, and Google Gemini.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/galleryos.git
   cd galleryos
   ```
2. **Install dependencies:**

```bash
npm install
```
Set up Environment Variables: Create a .env file in the root directory and add your API keys:
```bash
env
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_name
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
GEMINI_API_KEY=your_gemini_api_key
```
Run the development server:
```
npm run dev
```
Open locally: Navigate to http://localhost:5173 in your browser. 
For AR features android mobile is needed.
