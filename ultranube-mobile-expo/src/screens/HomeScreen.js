// src/screens/HomeScreen.js
import React, { useEffect, useState, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config/api';

export default function HomeScreen({ navigation }) {
  const { user, token } = useContext(AuthContext);
  const [stats, setStats] = useState({ files: 0, folders: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (!token) return;

        const res = await fetch(`${API_URL}/api/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          console.log('Error dashboard stats:', await res.text());
          return;
        }

        const data = await res.json();
        setStats({
          files: data.files || 0,
          folders: data.folders || 0,
        });
      } catch (err) {
        console.log('fetchStats error:', err);
      }
    };

    fetchStats();
  }, [token]);

  const displayName = user?.name || user?.email || 'Usuario';

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Bienvenido, {displayName}</Text>
      <Text style={styles.subtitle}>Tu nube privada UltraNube</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumen rápido</Text>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.folders}</Text>
            <Text style={styles.statLabel}>Carpetas</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.files}</Text>
            <Text style={styles.statLabel}>Archivos</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.buttonPrimary}
          onPress={() => navigation.navigate('Files')}
        >
          <Text style={styles.buttonText}>Ver mis archivos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonOutline}
          onPress={() => navigation.navigate('Files')}
        >
          <Text style={styles.buttonOutlineText}>Crear carpeta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.buttonOutline}
          onPress={() => navigation.navigate('Files')}
        >
          <Text style={styles.buttonOutlineText}>Subir archivo</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Gestiona tus documentos como en una nube profesional, pero 100% tuya.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  welcome: {
    color: '#F9FAFB',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  actions: {
    marginTop: 10,
  },
  buttonPrimary: {
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 999,
    marginBottom: 12,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  buttonOutline: {
    borderWidth: 1,
    borderColor: '#2563EB',
    padding: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonOutlineText: { color: '#2563EB', fontSize: 16, fontWeight: 'bold' },
  footer: {
    marginTop: 24,
  },
  footerText: {
    color: '#6B7280',
    fontSize: 13,
  },
});
