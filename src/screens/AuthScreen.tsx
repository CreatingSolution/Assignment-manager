import React, { useState } from 'react';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';

export function AuthScreen() {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'register'>('login');

  if (currentScreen === 'register') {
    return <RegisterScreen onNavigateToLogin={() => setCurrentScreen('login')} />;
  }

  return <LoginScreen onNavigateToRegister={() => setCurrentScreen('register')} />;
}
