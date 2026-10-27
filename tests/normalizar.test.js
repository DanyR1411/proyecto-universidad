'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const N = require('../src/normalizar');

test('cédula: deja solo dígitos y marca largos raros', () => {
    assert.equal(N.normCedula('V-12.345.678').valor, '12345678');
    assert.equal(N.normCedula('25,885,345').valor, '25885345');
    assert.equal(N.normCedula(7799543).valor, '7799543');
    assert.equal(N.normCedula('123').dudosa, true);
    assert.equal(N.normCedula('').valor, null);
    assert.equal(N.normCedula('N/A').valor, null);
});

test('fecha: acepta Date, ISO y día/mes/año; avisa si es ambigua', () => {
    assert.deepEqual(N.normFecha(new Date('2021-09-16T00:00:00Z')), { valor: '2021-09-16', error: null, ambigua: false });
    assert.equal(N.normFecha('2024-05-06 00:00:00').valor, '2024-05-06');
    assert.equal(N.normFecha('16/09/2021').valor, '2021-09-16');
    assert.equal(N.normFecha('04/17/2017').valor, '2017-04-17');            // inequívoco: mes/día
    const amb = N.normFecha('02.06.2025');
    assert.equal(amb.valor, '2025-06-02');
    assert.equal(amb.ambigua, true);
    assert.equal(N.normFecha('01/10/20211').valor, null);
    assert.ok(N.normFecha('29/102018').error);
    assert.equal(N.normFecha('').valor, null);
    assert.equal(N.normFecha('31/02/2020').valor, null);                     // fecha inexistente
});

test('teléfono: unifica a 04XX-XXXXXXX y soporta varios números', () => {
    assert.equal(N.normTelefono('4146060182').valor, '0414-6060182');
    assert.equal(N.normTelefono('416-0705702').valor, '0416-0705702');
    assert.equal(N.normTelefono('0416- 7662304').valor, '0416-7662304');
    assert.equal(N.normTelefono('(+58)4241149581').valor, '0424-1149581');
    assert.equal(N.normTelefono('0412-1237150  0424-6328150').valor, '0412-1237150 / 0424-6328150');
    assert.equal(N.normTelefono('abc').dudoso, true);
    assert.equal(N.normTelefono(null).valor, null);
});

test('correo: minúsculas, sin espacios y detecta inválidos', () => {
    assert.deepEqual(N.normCorreo(' Juan@Gmail.COM '), { valor: 'juan@gmail.com', valido: true });
    assert.equal(N.normCorreo('algo|@gmail.com').valido, false);
    assert.equal(N.normCorreo('sin-arroba.com').valido, false);
    assert.equal(N.normCorreo('').valor, null);
});

test('catálogos: corrige variantes y conserva lo no reconocido', () => {
    assert.equal(N.normCategoria('Instructora').valor, 'INSTRUCTOR');
    assert.equal(N.normCategoria('ASISTENTE ').valor, 'ASISTENTE');
    assert.equal(N.normCategoria('Dedicación Exclusiva').desconocido, 'Dedicación Exclusiva');
    assert.equal(N.normDedicacion('Exclusiva').valor, 'DEDICACION EXCLUSIVA');
    assert.equal(N.normDedicacion('Tiempo Completo').valor, 'TIEMPO COMPLETO');
    assert.equal(N.normSede('MENE GRANDE ').valor, 'Mene Grande');
    assert.equal(N.normSede('Ciudad Ojeda').valor, 'Ciudad Ojeda');
    assert.equal(N.normSede('Nowhere').desconocido, 'Nowhere');
    assert.equal(N.normCondicion('ORDINACIO'), 'ORDINARIO');
    assert.equal(N.normCondicion('contratada'), 'CONTRATADO');
    assert.equal(N.normCondicion('Invitado/Administrativo'), 'INVITADO/ADMINISTRATIVO');
    assert.equal(N.normCondicion('', 'ORDINARIO'), 'ORDINARIO');
});

test('PNF: detecta el área por el texto de la sección', () => {
    assert.equal(N.detectarPNF('PNF CONTADURIA PÚBLICA'), 2);
    assert.equal(N.detectarPNF('PNF INFORMATICA '), 1);
    assert.equal(N.detectarPNF('PNF EDUCACION ESPECIAL'), 4);
    assert.equal(N.detectarPNF('PNF DERECHO'), null);
});

test('nombres: fusiona variantes del mismo nombre y detecta los distintos', () => {
    assert.equal(N.fusionarNombres('SAAVEDRA JENIREE', 'JENIREE SAAVEDRA'), 'SAAVEDRA JENIREE');
    assert.equal(N.fusionarNombres('REYES MARIA', 'REYES MARIA G.'), 'REYES MARIA G.');
    assert.equal(N.fusionarNombres('PEREZ ANA', 'GOMEZ LUIS'), null);
    assert.equal(N.normNombre(' GAMARRA, MOSQUERA  LIZMARY '), 'GAMARRA MOSQUERA LIZMARY');
});
