// @ts-nocheck
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './AppLayout';

import { Home } from './pages/Home';
import StudioShell from './pages/Studio';
import { Collab } from './pages/Collab';
import { Wallet } from './pages/Wallet';
import { Profile } from './pages/Profile';
import { Admin } from './pages/Admin';
import { Earnings } from './pages/Earnings';
import { Auth } from './pages/Auth';
import { AiProducer } from './pages/AiProducer';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/studio" element={<StudioShell />} />
                <Route path="/collab" element={<Collab />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/earnings" element={<Earnings />} />
                <Route path="/ai-producer" element={<AiProducer />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}