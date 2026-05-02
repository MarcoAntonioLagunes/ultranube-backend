// src/screens/SettingsScreen.js
import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { colors } from '../utils/theme';

export default function SettingsScreen() {
  const { user, logout } = useContext(AuthContext);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Configuración</Text>

      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name ? user.name.charAt(0).toUpperCase() : '?'}
          </Text>
        </View>
        <View>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferencias</Text>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="moon-outline" size={18} color={colors.muted} />
            <Text style={styles.rowText}>Tema oscuro</Text>
          </View>
          <Switch value={true} disabled />
        </View>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={18} color={colors.muted} />
            <Text style={styles.rowText}>Notificaciones</Text>
          </View>
          <Switch value={false} disabled />
        </View>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color="white" />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
    paddingTop: 24
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  avatarText: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '700'
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600'
  },
  email: {
    color: colors.muted,
    fontSize: 12
  },
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    color: colors.muted,
    marginBottom: 8,
    fontSize: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  rowText: {
    color: colors.text,
    marginLeft: 10
  },
  logoutBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8
  },
  logoutText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16
  }
});
