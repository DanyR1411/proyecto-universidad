'use strict';
const { AREAS_PNF, SEDES } = require('./normalizar');

// Una persona (cédula única) puede tener varias asignaciones:
// una por período, PNF, sede, condición, etc.
const SQL_ESQUEMA = `
CREATE TABLE IF NOT EXISTS sedes (
    id_sede     INTEGER PRIMARY KEY,
    nombre_sede TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS areas_pnf (
    id_pnf      INTEGER PRIMARY KEY,
    nombre_area TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS personas (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula           TEXT NOT NULL UNIQUE,      -- solo dígitos
    nombre_completo  TEXT NOT NULL,
    nombre_busqueda  TEXT NOT NULL,             -- MAYÚSCULAS sin acentos, para buscar
    telefono         TEXT,
    correo           TEXT,
    fecha_ingreso    TEXT,                      -- AAAA-MM-DD
    titulo_pregrado  TEXT,
    especialidad     TEXT,
    maestria         TEXT,
    doctorado        TEXT,
    observaciones    TEXT
);

CREATE TABLE IF NOT EXISTS asignaciones (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    id_persona             INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    periodo                TEXT NOT NULL,       -- ej. II-2025
    id_pnf                 INTEGER REFERENCES areas_pnf(id_pnf),
    id_sede                INTEGER REFERENCES sedes(id_sede),
    programa               TEXT,
    condicion              TEXT,
    categoria              TEXT,
    dedicacion             TEXT,
    proyecto               TEXT,
    asignaturas            TEXT,
    comision_servicios     TEXT,
    permiso_no_remunerado  TEXT,
    permiso_medico         TEXT,
    observaciones          TEXT,
    origen                 TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual', 'importado'))
);

CREATE INDEX IF NOT EXISTS idx_personas_nombre  ON personas(nombre_busqueda);
CREATE INDEX IF NOT EXISTS idx_asig_persona     ON asignaciones(id_persona);
CREATE INDEX IF NOT EXISTS idx_asig_periodo     ON asignaciones(periodo);
CREATE INDEX IF NOT EXISTS idx_asig_pnf         ON asignaciones(id_pnf);
CREATE INDEX IF NOT EXISTS idx_asig_sede        ON asignaciones(id_sede);
`;

// "db" es el envoltorio con promesas de src/db.js (run / get / all / exec)
async function inicializarEsquema(db) {
    await db.run('PRAGMA foreign_keys = ON');
    await db.exec(SQL_ESQUEMA);
    for (const a of AREAS_PNF) {
        await db.run('INSERT OR IGNORE INTO areas_pnf (id_pnf, nombre_area) VALUES (?, ?)', [a.id, a.nombre]);
    }
    for (const nombre of Object.values(SEDES)) {
        await db.run('INSERT OR IGNORE INTO sedes (nombre_sede) VALUES (?)', [nombre]);
    }
}

module.exports = { SQL_ESQUEMA, inicializarEsquema };
