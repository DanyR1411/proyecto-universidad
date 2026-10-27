'use strict';
// Base de datos SQLite en memoria para las pruebas, usando el módulo integrado de Node 22+.
// Si la versión de Node es anterior, devuelve null y esas pruebas se omiten.
const { inicializarEsquema } = require('../src/esquema');

async function crearBD() {
    let DatabaseSync;
    try { ({ DatabaseSync } = require('node:sqlite')); } catch { return null; }
    const raw = new DatabaseSync(':memory:');
    const db = {
        run: async (sql, p = []) => { const r = raw.prepare(sql).run(...p); return { lastID: Number(r.lastInsertRowid), changes: r.changes }; },
        get: async (sql, p = []) => raw.prepare(sql).get(...p),
        all: async (sql, p = []) => raw.prepare(sql).all(...p),
        exec: async (sql) => raw.exec(sql)
    };
    await inicializarEsquema(db);
    return db;
}

module.exports = { crearBD };
