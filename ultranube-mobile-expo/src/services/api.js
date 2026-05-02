// src/services/api.js
const config = {
  BASE_URL: 'http://10.19.11.10:4012' // 👈 tu IP + puerto del backend
};

let authToken = null;

function headersJSON() {
  const h = { 'Content-Type': 'application/json' };
  if (authToken) h['Authorization'] = `Bearer ${authToken}`;
  return h;
}

async function parseOrThrow(res, fallbackMsg) {
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || fallbackMsg || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

const api = {
  setToken: (t) => { authToken = t; },

  async login(email, password) {
    const res = await fetch(`${config.BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: headersJSON(),
      body: JSON.stringify({ email, password })
    });
    return parseOrThrow(res, 'Login failed');
  },

  async register(name, email, password) {
    const res = await fetch(`${config.BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: headersJSON(),
      body: JSON.stringify({ name, email, password })
    });
    return parseOrThrow(res, 'Register failed');
  },

  async me() {
    const res = await fetch(`${config.BASE_URL}/api/auth/me`, {
      headers: headersJSON()
    });
    return parseOrThrow(res, 'Not authenticated');
  },

  // 🔹 LISTAR carpetas + archivos
  async listDrive(parentId = null) {
    const q = parentId ? `?parent=${parentId}` : '?parent=root';
    const res = await fetch(`${config.BASE_URL}/api/drive${q}`, {
      headers: headersJSON()
    });
    return parseOrThrow(res, 'Error listing drive');
  },

  // 🔹 CREAR carpeta
  async createFolder(name, parentId = null) {
    const res = await fetch(`${config.BASE_URL}/api/drive/folder`, {
      method: 'POST',
      headers: headersJSON(),
      body: JSON.stringify({ name, parentId })
    });
    return parseOrThrow(res, 'Error creating folder');
  },

  // 🔹 SUBIR archivo (con folderId opcional)
  async uploadFileAsync(file, folderId = null) {
    const form = new FormData();
    form.append('file', file);
    if (folderId) form.append('folderId', folderId);

    const res = await fetch(`${config.BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`
      },
      body: form
    });
    return parseOrThrow(res, 'Upload failed');
  },

  // 🔹 ELIMINAR archivo
  async deleteFile(id) {
    const res = await fetch(`${config.BASE_URL}/api/files/${id}`, {
      method: 'DELETE',
      headers: headersJSON()
    });
    return parseOrThrow(res, 'Delete failed');
  }
};

export default api;
