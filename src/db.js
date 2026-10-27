'use strict';
const sqlite3 = require('sqlite3');
const { inicializarEsquema } = require('./esquema');

// Envuelve sqlite3 (callbacks) en promesas para poder usar async/await.
function envolver(raw) {
    return {
        run: (sql, params = []) => new Promise((resolve, reject) => {
            raw.run(sql, params, function (err) {
                if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes });
            });
        }),
        get: (sql, params = []) => new Promise((resolve, reject) => {
            raw.get(sql, params, (err, fila) => err ? reject(err) : resolve(fila));
        }),
        all: (sql, params = []) => new Promise((resolve, reject) => {
            raw.all(sql, params, (err, filas) => err ? reject(err) : resolve(filas));
        }),
        exec: (sql) => new Promise((resolve, reject) => {
            raw.exec(sql, (err) => err ? reject(err) : resolve());
        }),
        close: () => new Promise((resolve, reject) => {
            raw.close((err) => err ? reject(err) : resolve());
        })
    };
}

async function abrirBD(ruta) {
    const raw = await new Promise((resolve, reject) => {
        const conexion = new sqlite3.Database(ruta, (err) => err ? reject(err) : resolve(conexion));
    });
    const db = envolver(raw);
    await inicializarEsquema(db);
    return db;
}

module.exports = { abrirBD };
