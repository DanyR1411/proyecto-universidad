const { contextBridge, ipcRenderer } = require('electron');

// Exponemos las dos funciones para que el HTML pueda usarlas
contextBridge.exposeInMainWorld('baseDatos', {
    registrarProfesor: (datos) => ipcRenderer.invoke('registrar-profesor', datos),
    obtenerProfesores: () => ipcRenderer.invoke('obtener-profesores')
});