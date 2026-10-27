'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../src/impresion');

const persona = {
    id: 1, cedula: '12345678', nombre_completo: 'PÉREZ <b>ANA</b>', telefono: '0414-1112233',
    correo: 'ana@mail.com', fecha_ingreso: '2020-03-05', titulo_pregrado: 'Lic. en Informática',
    asignaciones: [
        { periodo: 'III-2025', pnf: 'Historia', sede: 'Cabimas', condicion: 'ORDINARIO', asignaturas: 'A' },
        { periodo: 'II-2025', pnf: 'Informática', sede: 'Cabimas', condicion: 'ORDINARIO', asignaturas: 'B' }
    ]
};

test('los 4 campos fijos siempre van, aunque no se pidan', () => {
    const ids = I.seleccionarCampos([]).map(c => c.id);
    assert.deepEqual(ids, ['nombre_completo', 'cedula', 'telefono', 'correo']);
    const con = I.seleccionarCampos(['sede', 'inventado', 'maestria']).map(c => c.id);
    assert.deepEqual(con, ['nombre_completo', 'cedula', 'telefono', 'correo', 'maestria', 'sede']);
});

test('formatos: cédula con puntos y fecha dd/mm/aaaa', () => {
    assert.equal(I.formatoCedula('12345678'), '12.345.678');
    assert.equal(I.formatoCedula('5174134'), '5.174.134');
    assert.equal(I.formatoFecha('2020-03-05'), '05/03/2020');
    assert.equal(I.formatoFecha('texto raro'), 'texto raro');
});

test('listado: una fila por persona, valores de asignaciones unidos sin repetir', () => {
    const html = I.generarListadoHTML([persona], ['sede', 'pnf', 'asignaturas'], { fecha: '1 de enero' });
    assert.equal((html.match(/<tbody>.*<\/tbody>/s)[0].match(/<tr>/g) || []).length, 1);
    assert.match(html, /Cabimas<\/td>/);                       // sede repetida se muestra una vez
    assert.doesNotMatch(html, /Cabimas \/ Cabimas/);
    assert.match(html, /Historia \/ Informática/);
    assert.match(html, /A \| B/);
    assert.match(html, /12\.345\.678/);
    assert.match(html, /Total: 1 persona ·/);
});

test('listado: pasa a horizontal con muchas columnas', () => {
    assert.match(I.generarListadoHTML([persona], []), /A4 portrait/);
    assert.match(I.generarListadoHTML([persona], ['sede', 'pnf']), /A4 landscape/);
});

test('seguridad: el contenido de la base de datos se escapa', () => {
    const html = I.generarListadoHTML([persona], []) + I.generarFichasHTML([persona], []);
    assert.doesNotMatch(html, /<b>ANA<\/b>/);
    assert.match(html, /PÉREZ &lt;b&gt;ANA&lt;\/b&gt;/);
});

test('fichas: una sección por persona, asignaciones numeradas y datos opcionales', () => {
    const otra = { ...persona, id: 2, nombre_completo: 'GÓMEZ LUIS', asignaciones: [] };
    const html = I.generarFichasHTML([persona, otra], ['fecha_ingreso', 'pnf']);
    assert.equal((html.match(/<section class="ficha">/g) || []).length, 2);
    assert.match(html, /Asignación 1 de 2/);
    assert.match(html, /05\/03\/2020/);
    assert.match(html, /Sin asignaciones registradas/);
    const basica = I.generarFichasHTML([persona], []);
    assert.doesNotMatch(basica, /Datos laborales/);             // sin campos laborales no hay sección
});
