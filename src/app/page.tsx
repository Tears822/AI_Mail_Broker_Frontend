'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import LoginForm from '@/components/LoginForm';
import RegisterForm from '@/components/RegisterForm';

export default function HomePage() {
  const [showRegister, setShowRegister] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already authenticated
    if (apiClient.isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSwitchToRegister = () => {
    setShowRegister(true);
  };

  const handleSwitchToLogin = () => {
    setShowRegister(false);
  };

  return (
    <>
      {showRegister ? (
        <RegisterForm onSwitchToLogin={handleSwitchToLogin} />
      ) : (
        <LoginForm onSwitchToRegister={handleSwitchToRegister} />
      )}
    </>
  );
}
