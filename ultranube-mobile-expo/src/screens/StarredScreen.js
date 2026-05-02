// src/screens/StarredScreen.js
import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import * as FileSystem from 'expo-file-system';

import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config/api';

// Formatear fecha bonita
const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString();
};

export default function StarredScreen() {
  const { token } = useContext(AuthContext);

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // ----- Prompt para renombrar (Android) -----
  const [promptVisible, setPromptVisible] = useState(false);
  const [promptTitle, setPromptTitle] = useState('');
  const [promptValue, setPromptValue] = useState('');
  const [promptCallback, setPromptCallback] = useState(null);

  const openTextPrompt = (title, defaultValue, onConfirm) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        title,
        '',
        (text) => {
          const val = (text || '').trim();
          if (!val) {
            Alert.alert('Nombre requerido', 'Escribe un nombre para continuar.');
            return;
          }
          onConfirm(val);
        },
        'plain-text',
        defaultValue
      );
      return;
    }

    setPromptTitle(title);
    setPromptValue(defaultValue || '');
    setPromptCallback(() => onConfirm);
    setPromptVisible(true);
  };

  const handlePromptCancel = () => {
    setPromptVisible(false);
    setPromptCallback(null);
  };

  const handlePromptAccept = () => {
    if (!promptCallback) {
      setPromptVisible(false);
      return;
    }
    const val = promptValue.trim();
    if (!val) {
      Alert.alert('Nombre requerido', 'Escribe un nombre para continuar.');
      return;
    }
    const cb = promptCallback;
    setPromptVisible(false);
    setPromptCallback(null);
    cb(val);
  };

  // ----- Cargar recientes -----
  const loadRecent = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/files/recent/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        console.log('getRecentFiles error response:', txt);
        throw new Error('Error al cargar recientes');
      }

      const data = await res.json();
      setFiles(data || []);
    } catch (err) {
      console.log('loadRecent error:', err);
      Alert.alert('Error', 'No se pudieron cargar los archivos recientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecent();
  }, []);

  // ----- Renombrar archivo -----
  const renameFile = (file) => {
    openTextPrompt(
      'Renombrar archivo',
      file.originalName || file.name,
      async (newName) => {
        try {
          const res = await fetch(`${API_URL}/api/files/${file._id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: newName }),
          });

          if (!res.ok) throw new Error('Error al renombrar archivo');

          await loadRecent();
        } catch (err) {
          console.log('renameFile (recent) error:', err);
          Alert.alert('Error', 'No se pudo renombrar el archivo.');
        }
      }
    );
  };

  // ----- Eliminar archivo -----
  const deleteFile = (file) => {
    Alert.alert(
      'Eliminar archivo',
      `¿Eliminar "${file.originalName || file.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/api/files/${file._id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });

              if (!res.ok) throw new Error('Error al eliminar archivo');

              await loadRecent();
            } catch (err) {
              console.log('deleteFile (recent) error:', err);
              Alert.alert('Error', 'No se pudo eliminar el archivo.');
            }
          },
        },
      ]
    );
  };

  // ----- Descargar archivo -----
  const downloadFile = async (file) => {
    try {
      setDownloadingId(file._id);

      const url = `${API_URL}/api/files/${file._id}/download`;
      const fileUri =
        FileSystem.documentDirectory +
        encodeURIComponent(file.originalName || file.name || 'archivo');

      const res = await FileSystem.downloadAsync(url, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('download result:', res);

      Alert.alert(
        'Descarga completa',
        'El archivo se descargó en el almacenamiento de la app.\nPuedes abrirlo desde un gestor de archivos o compartirlo desde la app.'
      );
    } catch (err) {
      console.log('downloadFile error:', err);
      Alert.alert('Error', 'No se pudo descargar el archivo.');
    } finally {
      setDownloadingId(null);
    }
  };

  const renderFile = ({ item }) => (
    <View style={styles.itemRow}>
      <View style={styles.itemMain}>
        <Text style={styles.itemEmoji}>📄</Text>
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.itemTitle}>
            {item.originalName || item.name}
          </Text>
          <Text style={styles.itemSubtitle}>{formatDate(item.createdAt)}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.circleBtn, { backgroundColor: '#2563EB' }]}
        onPress={() => downloadFile(item)}
      >
        <Text style={styles.circleIcon}>
          {downloadingId === item._id ? '⏳' : '⬇️'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.circleBtn, { backgroundColor: '#16A34A' }]}
        onPress={() => renameFile(item)}
      >
        <Text style={styles.circleIcon}>✏️</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.circleBtn, { backgroundColor: '#DC2626' }]}
        onPress={() => deleteFile(item)}
      >
        <Text style={styles.circleIcon}>🗑</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Archivos recientes</Text>
      <Text style={styles.subtitle}>
        Los últimos archivos que has subido a tu Ultranube.
      </Text>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      ) : files.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>Aún no hay archivos recientes.</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          keyExtractor={(item) => item._id}
          renderItem={renderFile}
          contentContainerStyle={{ paddingTop: 12 }}
        />
      )}

      <TouchableOpacity style={styles.refreshBtn} onPress={loadRecent}>
        <Text style={styles.refreshText}>Actualizar</Text>
      </TouchableOpacity>

      {/* Modal de prompt (Android) */}
      <Modal
        visible={promptVisible}
        transparent
        animationType="fade"
        onRequestClose={handlePromptCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{promptTitle}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Escribe aquí."
              placeholderTextColor="#6b7280"
              value={promptValue}
              onChangeText={setPromptValue}
              autoFocus
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#111827' }]}
                onPress={handlePromptCancel}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#2563EB' }]}
                onPress={handlePromptAccept}
              >
                <Text style={styles.modalButtonText}>Aceptar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  title: {
    color: '#f9fafb',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 16,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  loadingText: {
    color: '#e5e7eb',
    marginLeft: 8,
  },
  emptyBox: {
    marginTop: 24,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemEmoji: {
    fontSize: 22,
  },
  itemTitle: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '600',
  },
  itemSubtitle: {
    color: '#9ca3af',
    fontSize: 12,
  },
  refreshBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  refreshText: {
    color: '#fff',
    fontWeight: '600',
  },
  circleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  circleIcon: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    width: '85%',
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#fff',
    marginBottom: 12,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginLeft: 8,
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
