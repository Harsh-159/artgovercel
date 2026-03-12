/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MapPage } from './pages/MapPage';
import { ARPage } from './pages/ARPage';
import { UploadPage } from './pages/UploadPage';

import { handleRedirectResult } from './lib/firebase';

import { ProfilePage } from './pages/ProfilePage';
import { CertificatePage } from './pages/CertificatePage';
import { DiscoverPage } from './pages/DiscoverPage';

export default function App() {
  React.useEffect(() => {
    handleRedirectResult();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/ar/:id" element={<ARPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/certificate/:tokenId" element={<CertificatePage />} />
      </Routes>
    </BrowserRouter>
  );
}
