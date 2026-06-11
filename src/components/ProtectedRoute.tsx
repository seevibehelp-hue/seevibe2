// @ts-nocheck
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute = () => {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <div className="h-screen w-screen bg-background flex items-center justify-center animate-pulse" />;
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
};