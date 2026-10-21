const { app, BrowserWindow, ipcMain } = require('electron');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// ============================================================
// 1. CONECTAR BASE DE DATOS (ruta absoluta con __dirname)
// ============================================================
const db = new sqlite3.Database(path.join(__dirname, 'control_profesores.db'), (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
    } else {
        console.log('Base de datos conectada correctamente.');
    }
});

// ============================================================
// 2. INICIALIZAR TABLAS SI NO EXISTEN
//    db.serialize() garantiza que los comandos corran en orden
// ============================================================
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS sedes (
        id_sede     INTEGER PRIMARY KEY,
        nombre_sede TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS areas_pnf (
        id_pnf      INTEGER PRIMARY KEY,
        nombre_area TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS profesores (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        cedula           TEXT UNIQUE NOT NULL,
        nombre_completo  TEXT NOT NULL,
        telefono         TEXT,
        correo           TEXT,
        fecha_ingreso    TEXT,
        id_sede          INTEGER,
        id_pnf           INTEGER,
        titulo_pregrado  TEXT,
        especialidad     TEXT,
        maestria         TEXT,
        doctorado        TEXT,
        programa         TEXT,
        condicion        TEXT,
        categoria        TEXT,
        dedicacion       TEXT,
        proyecto         TEXT,
        observaciones    TEXT,
        FOREIGN KEY (id_sede) REFERENCES sedes(id_sede),
        FOREIGN KEY (id_pnf)  REFERENCES areas_pnf(id_pnf)
    )`);

    // Datos semilla (INSERT OR IGNORE no falla si ya existen)
    db.run(`INSERT OR IGNORE INTO sedes (id_sede, nombre_sede) VALUES (1, 'Sede Principal')`);

    const stmt = db.prepare(`INSERT OR IGNORE INTO areas_pnf (id_pnf, nombre_area) VALUES (?, ?)`);
    const areas = [
        [1, 'Informática'],
        [2, 'Contaduría Pública'],
        [3, 'Agroalimentación'],
        [4, 'Educación Especial'],
        [5, 'Historia']
    ];
    areas.forEach(([id, nombre]) => stmt.run(id, nombre));
    stmt.finalize();
});

// ============================================================
// 3. CREAR VENTANA
// ============================================================
function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 820,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,   // Explícito: aísla el contexto del renderer
            nodeIntegration: false    // Explícito: el renderer no accede a Node.js directamente
        }
    });
    win.loadFile('index.html');
}

app.whenReady().then(createWindow);

// Comportamiento estándar en Windows y Linux
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Comportamiento estándar en macOS
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Cerrar la BD limpiamente al salir de la app
app.on('will-quit', () => {
    db.close((err) => {
        if (err) console.error('Error al cerrar la base de datos:', err.message);
        else console.log('Base de datos cerrada correctamente.');
    });
});

// ============================================================
// 4. IPC: REGISTRAR PROFESOR
// ============================================================
ipcMain.handle('registrar-profesor', (event, datos) => {
    return new Promise((resolve) => {
        const sql = `
            INSERT INTO profesores (
                cedula, nombre_completo, telefono, correo, fecha_ingreso,
                id_sede, id_pnf, titulo_pregrado, especialidad, maestria,
                doctorado, programa, condicion, categoria, dedicacion,
                proyecto, observaciones
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const valores = [
            datos.cedula,
            datos.nombre,
            datos.telefono        || null,
            datos.correo          || null,
            datos.fecha_ingreso   || null,
            datos.id_sede         || null,
            datos.id_pnf          || null,
            datos.titulo_pregrado || null,
            datos.especialidad    || null,
            datos.maestria        || null,  // null es más correcto que 'N/A' para campos vacíos
            datos.doctorado       || null,
            datos.programa        || null,
            datos.condicion       || null,
            datos.categoria       || null,
            datos.dedicacion      || null,
            datos.proyecto        || null,
            datos.observaciones   || null
        ];

        db.run(sql, valores, function(err) {
            if (err) resolve({ exito: false, error: err.message });
            else     resolve({ exito: true });
        });
    });
});

// ============================================================
// 5. IPC: OBTENER PROFESORES
//    CORREGIDO: ahora incluye 'categoria' y 'dedicacion' en el SELECT
// ============================================================
ipcMain.handle('obtener-profesores', () => {
    return new Promise((resolve) => {
        const sql = `
            SELECT
                p.cedula,
                p.nombre_completo,
                p.condicion,
                p.categoria,
                p.dedicacion,
                s.nombre_sede,
                a.nombre_area
            FROM profesores p
            LEFT JOIN sedes    s ON p.id_sede = s.id_sede
            LEFT JOIN areas_pnf a ON p.id_pnf  = a.id_pnf
            ORDER BY p.nombre_completo ASC
        `;

        db.all(sql, [], (err, rows) => {
            if (err) resolve({ exito: false, error: err.message });
            else     resolve({ exito: true, profesores: rows });
        });
    });
});