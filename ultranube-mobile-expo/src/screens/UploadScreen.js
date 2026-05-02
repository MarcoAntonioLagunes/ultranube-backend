import React, { useState, useContext } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { colors } from '../utils/theme';
import { DriveContext } from '../context/DriveContext';

export default function UploadScreen() {
  const [status, setStatus] = useState('');
  const { currentFolder } = useContext(DriveContext); // 👈 carpeta actual (null = raíz)

  const pickAndUpload = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled) return;

    const file = result.assets[0];
    const fileToSend = {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream'
    };

    try {
      const targetFolder = currentFolder || null; // raíz si no hay carpeta seleccionada
      setStatus('Subiendo...');
      await api.uploadFileAsync(fileToSend, targetFolder);
      setStatus('Archivo subido ✔');
    } catch (e) {
      console.log(e);
      setStatus('');
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Subir archivo</Text>
      <Text style={styles.subtitle}>
        Se subirá a: {currentFolder ? 'Carpeta actual' : 'Raíz de tu UltraNube'}
      </Text>

      <TouchableOpacity style={styles.dropzone} onPress={pickAndUpload}>
        <Ionicons name="cloud-upload-outline" size={40} color={colors.primary} />
        <Text style={styles.dropTitle}>Toca para elegir archivo</Text>
        <Text style={styles.dropSubtitle}>Desde tu almacenamiento o gestor de archivos</Text>
      </TouchableOpacity>

      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 20,
    paddingTop: 30
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700'
  },
  subtitle: {
    color: colors.muted,
    marginTop: 6,
    marginBottom: 24
  },
  dropzone: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card
  },
  dropTitle: {
    color: colors.text,
    fontWeight: '600',
    marginTop: 12
  },
  dropSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4
  },
  status: {
    color: colors.muted,
    marginTop: 20
  }
});
