// src/screens/FilesScreen.js
import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';


import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config/api';

export default function FilesScreen() {
  const { token } = useContext(AuthContext);

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'Inicio' }]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // ----- Prompt genérico (crear/renombrar) -----
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
      return; // dejamos el teclado hasta que el usuario escriba algo
    }
    const cb = promptCallback;
    setPromptVisible(false);
    setPromptCallback(null);
    cb(val);
  };

  // ----- Cargar carpetas + archivos -----
  const loadItems = async (folderId = currentFolderId) => {
    try {
      setLoading(true);

      let url = `${API_URL}/api/drive/items`;
      if (folderId) url += `?folderId=${folderId}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        console.log('loadItems error response:', txt);
        throw new Error('Error al cargar items');
      }

      const data = await res.json();
      setFolders(data.folders || []);
      setFiles(data.files || []);

      if (data.breadcrumbs && data.breadcrumbs.length) {
        setBreadcrumbs(
          data.breadcrumbs.map((b) => ({ id: b._id, name: b.name }))
        );
      } else {
        setBreadcrumbs([{ id: null, name: 'Inicio' }]);
      }

      setCurrentFolderId(folderId || null);
    } catch (err) {
      console.log('loadItems error:', err);
      Alert.alert('Error', 'Error al cargar carpetas y archivos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Navegación de carpetas -----
  const openFolder = (folder) => {
    loadItems(folder._id);
  };

  const goBack = () => {
    if (!breadcrumbs || breadcrumbs.length <= 1) {
      loadItems(null);
      return;
    }
    const newCrumbs = breadcrumbs.slice(0, -1);
    setBreadcrumbs(newCrumbs);
    const last = newCrumbs[newCrumbs.length - 1];
    loadItems(last.id || null);
  };

  // ----- Carpeta: crear / renombrar / borrar -----
  const createFolder = () => {
    openTextPrompt('Nueva carpeta', '', async (name) => {
      try {
        const res = await fetch(`${API_URL}/api/drive/folders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            parentId: currentFolderId || null,
          }),
        });

        if (!res.ok) {
          const txt = await res.text();
          console.log('createFolder error response:', txt);
          throw new Error('Error al crear carpeta');
        }

        await loadItems(currentFolderId || null);
      } catch (err) {
        console.log('createFolder error:', err);
        Alert.alert('Error', 'No se pudo crear la carpeta.');
      }
    });
  };

  const renameFolder = (folder) => {
    openTextPrompt('Renombrar carpeta', folder.name, async (newName) => {
      try {
        const res = await fetch(
          `${API_URL}/api/drive/folders/${folder._id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: newName }),
          }
        );

        if (!res.ok) throw new Error('Error al renombrar carpeta');

        await loadItems(currentFolderId || null);
      } catch (err) {
        console.log('renameFolder error:', err);
        Alert.alert('Error', 'No se pudo renombrar la carpeta.');
      }
    });
  };

  const deleteFolder = (folder) => {
    Alert.alert(
      'Eliminar carpeta',
      `¿Eliminar la carpeta "${folder.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(
                `${API_URL}/api/drive/folders/${folder._id}`,
                {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                }
              );

              if (!res.ok) throw new Error('Error al eliminar carpeta');

              await loadItems(currentFolderId || null);
            } catch (err) {
              console.log('deleteFolder error:', err);
              Alert.alert('Error', 'No se pudo eliminar la carpeta.');
            }
          },
        },
      ]
    );
  };

  // ----- Subir archivo (con manejo de red) -----
  const uploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: '*/*',
      });
      if (result.canceled) return;

      const file = result.assets[0];

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      });

      if (currentFolderId) formData.append('folderId', currentFolderId);

      setUploading(true);

      try {
        const res = await fetch(`${API_URL}/api/files/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          const txt = await res.text();
          console.log('upload error response:', txt);
          throw new Error('Error al subir archivo');
        }

        await loadItems(currentFolderId || null);
        Alert.alert('Listo', 'Archivo subido correctamente.');
      } catch (error) {
        console.log('upload error:', error);

        if (String(error.message).includes('Network request failed')) {
          Alert.alert(
            'Sin conexión',
            'No se pudo conectar con el servidor. Revisa que el backend esté encendido y que tu celular y tu PC estén en la misma red.'
          );
        } else {
          Alert.alert('Error', 'Ocurrió un problema al subir el archivo.');
        }
      } finally {
        setUploading(false);
      }
    } catch (err) {
      console.log('DocumentPicker error:', err);
    }
  };

  // ----- Archivo: renombrar / borrar / descargar -----
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

          await loadItems(currentFolderId || null);
        } catch (err) {
          console.log('renameFile error:', err);
          Alert.alert('Error', 'No se pudo renombrar el archivo.');
        }
      }
    );
  };

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

              await loadItems(currentFolderId || null);
            } catch (err) {
              console.log('deleteFile error:', err);
              Alert.alert('Error', 'No se pudo eliminar el archivo.');
            }
          },
        },
      ]
    );
  };

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

  // ----- Filtros / render -----
  const filteredFolders = folders.filter((f) =>
    (f.name || '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredFiles = files.filter((f) =>
    (f.originalName || f.name || '')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const breadcrumbText =
    breadcrumbs && breadcrumbs.length
      ? breadcrumbs.map((b) => b.name).join(' / ')
      : 'Inicio';

  const renderFolder = ({ item }) => (
    <View style={styles.itemRow}>
      <TouchableOpacity style={styles.itemMain} onPress={() => openFolder(item)}>
        <Text style={styles.itemEmoji}>📁</Text>
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.itemTitle}>{item.name}</Text>
          <Text style={styles.itemSubtitle}>Carpeta</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => renameFolder(item)}>
        <Text style={styles.iconText}>✏️</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => deleteFolder(item)}>
        <Text style={styles.iconText}>🗑</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFile = ({ item }) => (
    <View style={styles.itemRow}>
      <View style={styles.itemMain}>
        <Text style={styles.itemEmoji}>📄</Text>
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.itemTitle}>
            {item.originalName || item.name}
          </Text>
          <Text style={styles.itemSubtitle}>Archivo</Text>
        </View>
      </View>

      {/* Descargar */}
      <TouchableOpacity
        style={[styles.circleBtn, { backgroundColor: '#2563EB' }]}
        onPress={() => downloadFile(item)}
      >
        <Text style={styles.circleIcon}>
          {downloadingId === item._id ? '⏳' : '⬇️'}
        </Text>
      </TouchableOpacity>

      {/* Renombrar */}
      <TouchableOpacity
        style={[styles.circleBtn, { backgroundColor: '#16A34A' }]}
        onPress={() => renameFile(item)}
      >
        <Text style={styles.circleIcon}>✏️</Text>
      </TouchableOpacity>

      {/* Borrar */}
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
      {/* Buscador */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar archivos o carpetas..."
          placeholderTextColor="#787d8a"
          value={search}
          onChangeText={setSearch}
        />
        <View style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Buscar</Text>
        </View>
      </View>

      {/* Ruta */}
      <Text style={styles.breadcrumbs}>{breadcrumbText}</Text>

      {/* Acciones */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={goBack}>
          <Text style={styles.actionButtonText}>← Atrás</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={createFolder}>
          <Text style={styles.actionButtonText}>+ Carpeta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={uploadFile}
          disabled={uploading}
        >
          <Text style={styles.actionButtonText}>
            {uploading ? 'Subiendo...' : '↑ Archivo'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color="#fff" />
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Carpetas</Text>
          {filteredFolders.length === 0 ? (
            <Text style={styles.emptyText}>Aún no tienes carpetas aquí.</Text>
          ) : (
            <FlatList
              data={filteredFolders}
              renderItem={renderFolder}
              keyExtractor={(item) => item._id}
            />
          )}

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
            Archivos
          </Text>
          {filteredFiles.length === 0 ? (
            <Text style={styles.emptyText}>Aún no tienes archivos aquí.</Text>
          ) : (
            <FlatList
              data={filteredFiles}
              renderItem={renderFile}
              keyExtractor={(item) => item._id}
            />
          )}
        </View>
      )}

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
    paddingTop: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  breadcrumbs: {
    color: '#9ca3af',
    marginBottom: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  actionButtonText: {
    color: '#e5e7eb',
    fontWeight: '600',
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
  sectionTitle: {
    color: '#e5e7eb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
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
  iconText: {
    fontSize: 18,
    marginLeft: 10,
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
