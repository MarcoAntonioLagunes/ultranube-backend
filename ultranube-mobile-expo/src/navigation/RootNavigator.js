// src/navigation/RootNavigator.js
import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AuthContext } from '../context/AuthContext';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import FilesScreen from '../screens/FilesScreen';
import StarredScreen from '../screens/StarredScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors } from '../utils/theme';

const AppTab = createBottomTabNavigator();
const AuthTab = createBottomTabNavigator();

/**
 * Tabs cuando el usuario YA inició sesión
 */
function AppTabs() {
  return (
    <AppTab.Navigator
      screenOptions={({ route }) => {
        let iconName = 'home-outline';

        if (route.name === 'Home') {
          iconName = 'home-outline';
        } else if (route.name === 'Starred') {
          iconName = 'star-outline';
        } else if (route.name === 'Files') {
          iconName = 'folder-outline';
        } else if (route.name === 'Settings') {
          iconName = 'settings-outline';
        }

        return {
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors?.tabBarBg || '#020617',
            borderTopColor: '#111827',
          },
          tabBarActiveTintColor: colors?.primary || '#EC4899',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={iconName} size={size} color={color} />
          ),
        };
      }}
    >
      <AppTab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Inicio' }}
      />
      <AppTab.Screen
        name="Starred"
        component={StarredScreen}
        options={{ title: 'Destacados' }}
      />
      <AppTab.Screen
        name="Files"
        component={FilesScreen}
        options={{ title: 'Archivos' }}
      />
      <AppTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Configuración' }}
      />
    </AppTab.Navigator>
  );
}

/**
 * Tabs para LOGIN / REGISTRO (antes de entrar a la app)
 */
function AuthTabs() {
  return (
    <AuthTab.Navigator
      screenOptions={({ route }) => {
        let iconName = 'log-in-outline';

        if (route.name === 'Login') {
          iconName = 'log-in-outline';
        } else if (route.name === 'Register') {
          iconName = 'person-add-outline';
        }

        return {
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors?.tabBarBg || '#020617',
            borderTopColor: '#111827',
          },
          tabBarActiveTintColor: colors?.primary || '#EC4899',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={iconName} size={size} color={color} />
          ),
        };
      }}
    >
      <AuthTab.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Login' }}
      />
      <AuthTab.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Registro' }}
      />
    </AuthTab.Navigator>
  );
}

export default function RootNavigator() {
  const { token } = useContext(AuthContext);

  // Si hay token mostramos las tabs de la app, si no, las tabs de login/registro
  if (token) {
    return <AppTabs />;
  }

  return <AuthTabs />;
}
