'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { procesarHojas, valorCelda } = require('../src/importador');

// Fila de encabezados como las del Excel real
const ENC = [null, 'LETRA', 'Nº', 'APELLIDO (S) Y NOMBRE (S)', 'CÉDULA', 'NÚMERO TELÉFONO', 'CORREO ELECTRÓNICO',
    'FECHA DE INGRESO', 'TÍTULO (PREGRADO)', ' ESPECIALIDAD', ' MAESTRIA', 'DOCTORADO', 'PROGRAMA', 'CONDICIÓN',
    'CATEGORIA', 'DEDICACIÓN', 'SEDE', 'PROYECTO', 'ASIGNATURAS O UNIDAD(ES) CURRICULAR(ES)',
    'COMISIÓN DE SERVICIOS', 'PERMISO NO REMUNERADO', 'PERMISO MÈDICO', 'OBSERVACIONES'];

function fila(c) {
    const f = new Array(23).fill(null);
    Object.entries(c).forEach(([i, v]) => { f[i] = v; });
    return f;
}
const persona = (nombre, cedula, extra = {}) => fila({
    3: nombre, 4: cedula, 5: '0414-1234567', 6: 'x@gmail.com', 7: new Date('2020-01-15T00:00:00Z'),
    8: 'Lcdo.', 13: 'ORDINARIO', 14: 'INSTRUCTOR', 15: 'TIEMPO COMPLETO', 16: 'CABIMAS', 18: 'MATERIA', ...extra
});

const hojaBase = (...filas) => ({
    nombre: 'DATA ORDINARIO',
    filas: [[], ['"UNIVERSIDAD"'], [null, 'PERIODO ACADÉMICO: III-2025'], [], [null, 'PNF INFORMATICA'], ENC, ...filas]
});

test('detecta período, PNF y agrupa por cédula con varias asignaciones', () => {
    const hoja = hojaBase(
        persona('PEREZ ANA', '12.345.678'),
        [null, 'PNF HISTORIA'],
        persona('PEREZ ANA', 'V-12345678', { 16: 'TRUJILLO', 18: 'OTRA MATERIA' })
    );
    const r = procesarHojas([hoja]);
    assert.equal(r.stats.personas, 1);
    assert.equal(r.stats.asignaciones, 2);
    assert.deepEqual(r.stats.periodos, ['III-2025']);
    const [a1, a2] = r.personas[0].asignaciones;
    assert.equal(a1.id_pnf, 1);
    assert.equal(a2.id_pnf, 5);
    assert.equal(a2.sede, 'Trujillo');
    assert.equal(r.personas[0].cedula, '12345678');
});

test('ignora hojas que no son de personal y filas vacías o de numeración', () => {
    const r = procesarHojas([{ nombre: 'Hoja1', filas: [['A', 'B']] }, hojaBase(fila({ 2: '7' }))]);
    assert.deepEqual(r.stats.hojasIgnoradas, ['Hoja1']);
    assert.equal(r.stats.personas, 0);
    assert.equal(r.issues.length, 0);
});

test('avisa sin perder la fila: sin cédula, correo inválido, fecha ilegible', () => {
    const r = procesarHojas([hojaBase(
        persona('SIN CEDULA', null),
        persona('CORREO MALO', '11111111', { 6: 'malo|@gmail.com', 7: '29/102018' })
    )]);
    const tipos = r.issues.map(i => i.tipo);
    assert.ok(tipos.includes('SIN_CEDULA'));
    assert.ok(tipos.includes('CORREO_INVALIDO'));
    assert.ok(tipos.includes('FECHA_ILEGIBLE'));
    assert.equal(r.stats.personas, 1);                       // la que no tiene cédula no se importa
    assert.equal(r.personas[0].correo, 'malo|@gmail.com');   // el correo se conserva para corregirlo
});

test('un dato fuera de catálogo queda anotado en observaciones', () => {
    const r = procesarHojas([hojaBase(persona('LOPEZ LUIS', '22222222', { 14: 'DEDICACION EXCLUSIVA', 22: 'Nota original' }))]);
    const a = r.personas[0].asignaciones[0];
    assert.equal(a.categoria, null);
    assert.match(a.observaciones, /Nota original/);
    assert.match(a.observaciones, /Categoría original no reconocida: DEDICACION EXCLUSIVA/);
});

test('avisa si el mismo nombre aparece con cédulas distintas', () => {
    const r = procesarHojas([hojaBase(persona('ARENAS YURI', '15286167'), persona('ARENAS YURI', '15284167'))]);
    assert.equal(r.stats.personas, 2);
    assert.ok(r.issues.some(i => i.tipo === 'POSIBLE_DUPLICADO'));
});

test('valorCelda entiende hipervínculos, texto enriquecido y fórmulas', () => {
    assert.equal(valorCelda({ text: 'a@b.com', hyperlink: 'mailto:a@b.com' }), 'a@b.com');
    assert.equal(valorCelda({ richText: [{ text: 'Hola ' }, { text: 'mundo' }] }), 'Hola mundo');
    assert.equal(valorCelda({ formula: 'A1', result: 5 }), 5);
    assert.equal(valorCelda(undefined), null);
});
