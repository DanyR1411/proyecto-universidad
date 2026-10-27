const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { abrirBD } = require('./src/db');
const consultas = require('./src/consultas');
const impresion = require('./src/impresion');
const { importarExcel, formatearReporte, avisosACSV } = require('./src/importador');

let db = null;
let ventana = null;

const rutaBD = () => path.join(app.getPath('userData'), 'personal.db');
const rutaInforme = () => path.join(app.getPath('userData'), 'informe-importacion.csv');

// ------------------------------------------------------------
// Ventana
// ------------------------------------------------------------
function crearVentana() {
    ventana = new BrowserWindow({
        width: 1280,
        height: 860,
        title: 'Control de Personal',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });
    ventana.loadFile('index.html');
}

app.whenReady().then(async () => {
    try {
        db = await abrirBD(rutaBD());
    } catch (err) {
        dialog.showErrorBox('No se pudo abrir la base de datos', err.message);
        app.quit();
        return;
    }
    crearVentana();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) crearVentana(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

app.on('will-quit', () => { if (db) db.close().catch(() => {}); });

// ------------------------------------------------------------
// IPC: todos los canales devuelven { exito, datos } o { exito: false, error }
// ------------------------------------------------------------
function manejar(canal, fn) {
    ipcMain.handle(canal, async (_evento, ...args) => {
        try {
            return { exito: true, datos: await fn(...args) };
        } catch (err) {
            console.error(`[${canal}]`, err);
            return { exito: false, error: err.message };
        }
    });
}

// Filtros que acepta la búsqueda (todo lo demás se ignora)
function filtrosSeguros(f = {}) {
    const texto = (v) => (typeof v === 'string' ? v.slice(0, 200) : '');
    return {
        texto: texto(f.texto), periodo: texto(f.periodo), condicion: texto(f.condicion),
        categoria: texto(f.categoria), dedicacion: texto(f.dedicacion),
        id_pnf: Number(f.id_pnf) || 0, id_sede: Number(f.id_sede) || 0
    };
}
const idsSeguros = (ids) => (Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger).slice(0, 5000) : []);
const camposSeguros = (c) => (Array.isArray(c) ? c.filter(x => typeof x === 'string') : []);

manejar('campos', async () => impresion.CAMPOS);
manejar('filtros', async () => consultas.listarFiltros(db));
manejar('resumen', async () => consultas.contarRegistros(db));
manejar('buscar', async (f) => consultas.buscarPersonas(db, filtrosSeguros(f)));

manejar('ficha-html', async ({ id, campos, filtros } = {}) => {
    const personas = await consultas.obtenerPersonas(db, [id], filtrosSeguros(filtros));
    return impresion.generarFichasHTML(personas, camposSeguros(campos));
});

// Imprime con el diálogo del sistema o guarda en PDF
manejar('imprimir', async (p = {}) => {
    const tipo = p.tipo === 'fichas' ? 'fichas' : 'listado';
    const accion = p.accion === 'pdf' ? 'pdf' : 'imprimir';
    const ids = idsSeguros(p.ids);
    if (!ids.length) throw new Error('No hay personas para imprimir.');

    const personas = await consultas.obtenerPersonas(db, ids, filtrosSeguros(p.filtros));
    const opciones = { resumen: typeof p.resumen === 'string' ? p.resumen.slice(0, 300) : '' };
    const campos = camposSeguros(p.campos);
    const html = tipo === 'fichas'
        ? impresion.generarFichasHTML(personas, campos, opciones)
        : impresion.generarListadoHTML(personas, campos, opciones);

    return imprimirHTML(html, { accion, nombreSugerido: tipo === 'fichas' ? 'fichas-personal.pdf' : 'listado-personal.pdf' });
});

async function imprimirHTML(html, { accion, nombreSugerido }) {
    const archivo = path.join(os.tmpdir(), `personal-${Date.now()}.html`);
    fs.writeFileSync(archivo, html, 'utf8');
    const oculta = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false }
    });
    try {
        await oculta.loadFile(archivo);
        if (accion === 'pdf') {
            const { canceled, filePath } = await dialog.showSaveDialog(ventana, {
                defaultPath: nombreSugerido, filters: [{ name: 'PDF', extensions: ['pdf'] }]
            });
            if (canceled || !filePath) return { cancelado: true };
            fs.writeFileSync(filePath, await oculta.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true }));
            return { archivo: filePath };
        }
        return await new Promise((resolve) => {
            oculta.webContents.print({ silent: false, printBackground: true }, (ok, motivo) => {
                if (ok) resolve({ impreso: true });
                else if (/cancel/i.test(String(motivo))) resolve({ cancelado: true });
                else resolve({ error: motivo || 'No se pudo imprimir.' });
            });
        });
    } finally {
        oculta.destroy();
        fs.unlink(archivo, () => {});
    }
}

// Importar el Excel desde la propia aplicación
manejar('importar-excel', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(ventana, {
        title: 'Seleccionar el Excel de personal',
        properties: ['openFile'],
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (canceled || !filePaths.length) return { cancelado: true };

    const resultado = await importarExcel(db, filePaths[0]);
    fs.writeFileSync(rutaInforme(), avisosACSV(resultado.issues), 'utf8');
    return { reporte: formatearReporte(resultado), avisos: resultado.issues.length };
});

manejar('mostrar-informe', async () => {
    if (!fs.existsSync(rutaInforme())) throw new Error('Todavía no hay informe de importación.');
    shell.showItemInFolder(rutaInforme());
    return true;
});
