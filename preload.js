const { contextBridge, ipcRenderer } = require('electron');

// Solo se expone lo estrictamente necesario al renderer
contextBridge.exposeInMainWorld('baseDatos', {
    obtenerCampos: () => ipcRenderer.invoke('campos'),
    obtenerFiltros: () => ipcRenderer.invoke('filtros'),
    resumen: () => ipcRenderer.invoke('resumen'),
    buscar: (filtros) => ipcRenderer.invoke('buscar', filtros),
    fichaHTML: (datos) => ipcRenderer.invoke('ficha-html', datos),
    imprimir: (datos) => ipcRenderer.invoke('imprimir', datos),
    importarExcel: () => ipcRenderer.invoke('importar-excel'),
    mostrarInforme: () => ipcRenderer.invoke('mostrar-informe')
});
