// src/screens/RegisterScreen.js
import React, { useContext, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';

// Validaciones
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export default function RegisterScreen() {
  const { register } = useContext(AuthContext);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setErrorMsg('');

    const trimmedName = (name || '').trim();
    const trimmedEmail = (email || '').trim();

    if (!trimmedName || !trimmedEmail || !password || !confirm) {
      return setErrorMsg('Todos los campos son obligatorios');
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return setErrorMsg('Ingresa un correo electrónico válido');
    }

    if (password !== confirm) {
      return setErrorMsg('Las contraseñas no coinciden');
    }

    if (!PASSWORD_REGEX.test(password)) {
      return setErrorMsg(
        'La contraseña debe tener mínimo 8 caracteres e incluir letras y números'
      );
    }

    try {
      setLoading(true);
      const result = await register(
        trimmedName,
        trimmedEmail.toLowerCase(),
        password
      );
      setLoading(false);

      if (!result || !result.ok) {
        setErrorMsg(result?.message || 'Error al crear cuenta');
      }
    } catch (e) {
      setLoading(false);
      setErrorMsg('Error al crear cuenta');
    }
  };

  return (
    <LinearGradient
      colors={['#ff00cc', '#333399']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Únete a UltraNube</Text>

          <TextInput
            style={styles.input}
            placeholder="Nombre completo"
            placeholderTextColor="#cbd5f5"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            placeholderTextColor="#cbd5f5"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#cbd5f5"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TextInput
            style={styles.input}
            placeholder="Confirmar contraseña"
            placeholderTextColor="#cbd5f5"
            secureTextEntry
            value={confirm}
            onChangeText={setConfirm}
          />

          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && { opacity: 0.7 }]}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>REGISTRARME</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  card: {
    width: '80%',
    backgroundColor: 'rgba(10,16,40,0.96)',
    borderRadius: 26,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#cbd5f5',
    fontSize: 12,
    marginBottom: 18,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: 'white',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.7)',
  },
  button: {
    width: '100%',
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#ff0080',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    letterSpacing: 1,
    fontSize: 14,
  },
  error: {
    width: '100%',
    color: '#fecaca',
    fontSize: 12,
    marginTop: 4,
  },
});
