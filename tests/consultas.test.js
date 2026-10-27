'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearBD } = require('./_bd');
const C = require('../src/consultas');

async function baseDePrueba() {
    const db = await crearBD();
    if (!db) return null;
    const persona = async (cedula, nombre, correo, tel) => (await db.run(
        'INSERT INTO personas (cedula, nombre_completo, nombre_busqueda, correo, telefono) VALUES (?, ?, ?, ?, ?)',
        [cedula, nombre, nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(), correo, tel])).lastID;
    const asig = (id, periodo, pnf, sede, condicion) => db.run(
        'INSERT INTO asignaciones (id_persona, periodo, id_pnf, id_sede, condicion, categoria) VALUES (?, ?, ?, ?, ?, ?)',
        [id, periodo, pnf, sede, condicion, 'AGREGADO']);

    const ana = await persona('12345678', 'PÉREZ ANA', 'ana@mail.com', '0414-1112233');
    const luis = await persona('87654321', 'GÓMEZ LUIS', 'luis@mail.com', '0424-9998877');
    await persona('11111111', 'SIN ASIGNACION', null, null);
    await asig(ana, 'II-2025', 1, 1, 'ORDINARIO/ADMINISTRATIVO');
    await asig(ana, 'III-2025', 5, 2, 'ORDINARIO');
    await asig(luis, 'II-2025', 5, 1, 'CONTRATADO');
    return { db, ana, luis };
}

test('búsqueda por texto: ignora tildes y mayúsculas, y busca por cédula, correo y teléfono', async (t) => {
    const b = await baseDePrueba();
    if (!b) return t.skip('requiere Node 22+ (node:sqlite)');
    const nombres = async (f) => (await C.buscarPersonas(b.db, f)).map(p => p.nombre_completo);
    assert.deepEqual(await nombres({ texto: 'perez' }), ['PÉREZ ANA']);
    assert.deepEqual(await nombres({ texto: 'GOMEZ  luis' }), ['GÓMEZ LUIS']);
    assert.deepEqual(await nombres({ texto: '12.345.678' }), ['PÉREZ ANA']);
    assert.deepEqual(await nombres({ texto: 'luis@mail' }), ['GÓMEZ LUIS']);
    assert.deepEqual(await nombres({ texto: '0424-999' }), ['GÓMEZ LUIS']);
    assert.deepEqual(await nombres({ texto: 'nadie' }), []);
    assert.equal((await nombres({})).length, 3);
    assert.deepEqual(await nombres({ texto: "x' OR '1'='1" }), []);   // no se rompe con comillas
    assert.deepEqual(await nombres({ texto: '%' }), []);               // % no es comodín
});

test('filtros: la misma asignación debe cumplir todo y solo se muestran las que coinciden', async (t) => {
    const b = await baseDePrueba();
    if (!b) return t.skip('requiere Node 22+ (node:sqlite)');
    const r = await C.buscarPersonas(b.db, { id_pnf: 5 });
    assert.deepEqual(r.map(p => p.nombre_completo), ['GÓMEZ LUIS', 'PÉREZ ANA']);
    const ana = r.find(p => p.id === b.ana);
    assert.equal(ana.asignaciones.length, 1);
    assert.equal(ana.asignaciones[0].periodo, 'III-2025');
    assert.equal(ana.asignaciones[0].pnf, 'Historia');

    // PNF Informática y sede 2 nunca ocurren en la misma asignación
    assert.deepEqual(await C.buscarPersonas(b.db, { id_pnf: 1, id_sede: 2 }), []);
    assert.equal((await C.buscarPersonas(b.db, { periodo: 'II-2025' })).length, 2);
});

test('condición: coincide por palabra completa en condiciones combinadas', async (t) => {
    const b = await baseDePrueba();
    if (!b) return t.skip('requiere Node 22+ (node:sqlite)');
    assert.equal((await C.buscarPersonas(b.db, { condicion: 'ADMINISTRATIVO' })).length, 1);
    assert.equal((await C.buscarPersonas(b.db, { condicion: 'ORDINARIO' })).length, 1);
    assert.equal((await C.buscarPersonas(b.db, { condicion: 'ORDINAR' })).length, 0);
});

test('obtenerPersonas: devuelve a todos los pedidos aunque el filtro no coincida', async (t) => {
    const b = await baseDePrueba();
    if (!b) return t.skip('requiere Node 22+ (node:sqlite)');
    const r = await C.obtenerPersonas(b.db, [b.luis, b.ana, 'no-es-id'], { id_pnf: 1 });
    assert.equal(r.length, 2);
    assert.equal(r.find(p => p.id === b.luis).asignaciones.length, 0);
    assert.equal(r.find(p => p.id === b.ana).asignaciones.length, 1);
});

test('listarFiltros: períodos del más nuevo al más viejo y condiciones separadas', async (t) => {
    const b = await baseDePrueba();
    if (!b) return t.skip('requiere Node 22+ (node:sqlite)');
    await b.db.run("INSERT INTO asignaciones (id_persona, periodo) VALUES (?, 'III-2024')", [b.luis]);
    const f = await C.listarFiltros(b.db);
    assert.deepEqual(f.periodos, ['III-2025', 'II-2025', 'III-2024']);
    assert.deepEqual(f.condiciones, ['ADMINISTRATIVO', 'CONTRATADO', 'ORDINARIO']);
    assert.equal(f.areas.length, 5);
});
