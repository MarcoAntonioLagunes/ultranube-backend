// src/models/File.js
import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    mimeType: String,
    size: Number,
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    path: {
      type: String,
    },
  },
  { timestamps: true }
);

// Índices para acelerar las consultas más frecuentes
fileSchema.index({ owner: 1, folder: 1 });           // listado por carpeta
fileSchema.index({ owner: 1, createdAt: -1 });        // archivos recientes
fileSchema.index({ owner: 1, originalName: 1 });      // búsqueda por nombre

const File = mongoose.model('File', fileSchema);
export default File;
