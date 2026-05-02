import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { colors } from '../utils/theme';

export default function AccountScreen() {
  const { user, logout } = useContext(AuthContext);

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={36} color={colors.primary} />
        </View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.row}>
          <Ionicons name="cloud-outline" size={18} color={colors.muted} />
          <Text style={styles.rowText}>Plan: UltraNube Estudiante</Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.muted} />
          <Text style={styles.rowText}>Cifrado, respaldo y control de acceso</Text>
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
    paddingTop: 40
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  name: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700'
  },
  email: {
    color: colors.muted,
    marginTop: 4,
    marginBottom: 18
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6
  },
  rowText: {
    color: colors.muted,
    marginLeft: 8
  },
  logoutBtn: {
    marginTop: 24,
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
