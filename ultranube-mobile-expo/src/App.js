// src/App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './navigation/RootNavigator';
import { AuthProvider } from './context/AuthContext';
import { DriveProvider } from './context/DriveContext';

export default function App() {
  return (
    <AuthProvider>
      <DriveProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </DriveProvider>
    </AuthProvider>
  );
}
