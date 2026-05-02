// src/context/AuthContext.js
import React, { createContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config/api';

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar sesión guardada al abrir la app
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('token');
        const storedUser = await SecureStore.getItemAsync('user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.log('Error cargando sesión', e);
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error en login');
      }

      setUser(data.user);
      setToken(data.token);

      // 🔐 SecureStore SIEMPRE recibe STRINGS
      await SecureStore.setItemAsync('token', data.token);
      await SecureStore.setItemAsync('user', JSON.stringify(data.user));

      return { ok: true };
    } catch (e) {
      console.log('Login error', e);
      return { ok: false, message: e.message };
    }
  };

  const register = async (name, email, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Error al registrar');
      }

      // Después de registrarse, hacemos login automático
      return await login(email, password);
    } catch (e) {
      console.log('Register error', e);
      return { ok: false, message: e.message };
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setToken(null);
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
    } catch (e) {
      console.log('Logout error', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
