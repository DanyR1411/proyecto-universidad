'use strict';
// ============================================================
// Consultas de lectura: buscar personas, filtros y datos completos.
// Reciben "db" (el envoltorio con promesas de src/db.js).
// ============================================================
const N = require('./normalizar');

const ESC = " ESCAPE '\\'";
const escapeLike = (s) => String(s).replace(/[\\%_]/g, '\\$&');

// ---- Períodos: "III-2025" > "II-2025" > "II-2024" ----
const ROMANOS = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
function clavePeriodo(p) {
    const m = /^([IVX]+)-(\d{4})$/.exec(p || '');
    return m ? Number(m[2]) * 10 + (ROMANOS[m[1]] || 0) : 0;
}
const compararPeriodosDesc = (a, b) => clavePeriodo(b) - clavePeriodo(a);

// ---- Filtros que se aplican a UNA asignación (alias "a") ----
function condicionesAsignacion(f = {}) {
    const where = [], params = [];
    if (f.periodo)   { where.push('a.periodo = ?');    params.push(String(f.periodo)); }
    if (f.id_pnf)    { where.push('a.id_pnf = ?');     params.push(Number(f.id_pnf)); }
    if (f.id_sede)   { where.push('a.id_sede = ?');    params.push(Number(f.id_sede)); }
    if (f.categoria) { where.push('a.categoria = ?');  params.push(String(f.categoria)); }
    if (f.dedicacion){ where.push('a.dedicacion = ?'); params.push(String(f.dedicacion)); }
    if (f.condicion) {
        // La condición puede ser combinada ("ORDINARIO/ADMINISTRATIVO"): se busca por palabra completa
        where.push(`('/' || a.condicion || '/') LIKE ?${ESC}`);
        params.push(`%/${escapeLike(String(f.condicion))}/%`);
    }
    return { where, params };
}

async function adjuntarAsignaciones(db, personas, filtros) {
    const cond = condicionesAsignacion(filtros);
    const porId = new Map();
    personas.forEach(p => { p.asignaciones = []; porId.set(p.id, p); });
    const ids = [...porId.keys()];
    for (let i = 0; i < ids.length; i += 500) {
        const lote = ids.slice(i, i + 500);
        const filas = await db.all(
            `SELECT a.*, ar.nombre_area AS pnf, s.nombre_sede AS sede
               FROM asignaciones a
               LEFT JOIN areas_pnf ar ON ar.id_pnf = a.id_pnf
               LEFT JOIN sedes s ON s.id_sede = a.id_sede
              WHERE a.id_persona IN (${lote.map(() => '?').join(',')})
              ${cond.where.length ? 'AND ' + cond.where.join(' AND ') : ''}
              ORDER BY a.id`,
            [...lote, ...cond.params]
        );
        filas.forEach(f => porId.get(f.id_persona).asignaciones.push(f));
    }
    personas.forEach(p => p.asignaciones.sort((x, y) =>
        compararPeriodosDesc(x.periodo, y.periodo) || String(x.pnf || '').localeCompare(String(y.pnf || ''), 'es') || x.id - y.id));
    return personas;
}

// Busca por texto (nombre, cédula, correo o teléfono; cada palabra debe aparecer)
// y por filtros de asignación. Devuelve personas con sus asignaciones (filtradas).
async function buscarPersonas(db, filtros = {}) {
    const where = [], params = [];

    for (const termino of (N.limpiar(filtros.texto) || '').split(' ').filter(Boolean)) {
        const alternativas = [`p.nombre_busqueda LIKE ?${ESC}`, `LOWER(COALESCE(p.correo, '')) LIKE ?${ESC}`];
        params.push(`%${escapeLike(N.clave(termino))}%`, `%${escapeLike(termino.toLowerCase())}%`);
        const digitos = termino.replace(/\D/g, '');
        if (digitos.length >= 3) {
            alternativas.push('p.cedula LIKE ?');
            params.push(`%${digitos}%`);
        }
        if (digitos.length >= 4) {
            alternativas.push("REPLACE(COALESCE(p.telefono, ''), '-', '') LIKE ?");
            params.push(`%${digitos}%`);
        }
        where.push('(' + alternativas.join(' OR ') + ')');
    }

    const cond = condicionesAsignacion(filtros);
    if (cond.where.length) {
        where.push(`EXISTS (SELECT 1 FROM asignaciones a WHERE a.id_persona = p.id AND ${cond.where.join(' AND ')})`);
        params.push(...cond.params);
    }

    const limite = Math.min(Number(filtros.limite) || 2000, 5000);
    const personas = await db.all(
        `SELECT p.* FROM personas p ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY p.nombre_busqueda LIMIT ?`,
        [...params, limite]
    );
    return adjuntarAsignaciones(db, personas, filtros);
}

// Datos completos de las personas indicadas (para imprimir). Los filtros solo
// limitan qué asignaciones se muestran; no excluyen a nadie de los ids pedidos.
async function obtenerPersonas(db, ids, filtros = {}) {
    const limpios = [...new Set((ids || []).map(Number).filter(Number.isInteger))];
    let personas = [];
    for (let i = 0; i < limpios.length; i += 500) {
        const lote = limpios.slice(i, i + 500);
        personas.push(...await db.all(`SELECT * FROM personas WHERE id IN (${lote.map(() => '?').join(',')})`, lote));
    }
    personas.sort((a, b) => a.nombre_busqueda.localeCompare(b.nombre_busqueda, 'es'));
    return adjuntarAsignaciones(db, personas, filtros);
}

// Opciones para los menús desplegables de filtros
async function listarFiltros(db) {
    const distintos = async (columna) => (await db.all(
        `SELECT DISTINCT ${columna} AS v FROM asignaciones WHERE ${columna} IS NOT NULL`)).map(r => r.v);
    const porTexto = (a, b) => a.localeCompare(b, 'es');

    const condiciones = [...new Set((await distintos('condicion')).flatMap(c => c.split('/').map(t => t.trim()).filter(Boolean)))].sort(porTexto);
    return {
        periodos: (await distintos('periodo')).sort(compararPeriodosDesc),
        areas: await db.all('SELECT id_pnf AS id, nombre_area AS nombre FROM areas_pnf ORDER BY nombre_area'),
        sedes: await db.all('SELECT id_sede AS id, nombre_sede AS nombre FROM sedes ORDER BY nombre_sede'),
        condiciones,
        categorias: (await distintos('categoria')).sort(porTexto),
        dedicaciones: (await distintos('dedicacion')).sort(porTexto)
    };
}

async function contarRegistros(db) {
    return db.get('SELECT (SELECT COUNT(*) FROM personas) AS personas, (SELECT COUNT(*) FROM asignaciones) AS asignaciones');
}

module.exports = { buscarPersonas, obtenerPersonas, listarFiltros, contarRegistros, compararPeriodosDesc, condicionesAsignacion };
