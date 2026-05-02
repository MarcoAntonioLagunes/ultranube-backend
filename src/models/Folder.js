// src/models/Folder.js
import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Índices para acelerar las consultas más frecuentes
folderSchema.index({ owner: 1, parent: 1 });    // listado de subcarpetas
folderSchema.index({ owner: 1, name: 1 });       // búsqueda por nombre

const Folder = mongoose.model('Folder', folderSchema);
export default Folder;
