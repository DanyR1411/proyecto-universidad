'use strict';
// Uso:
//   node scripts/importar-cli.js ruta/al/archivo.xlsx --solo-revisar
//   node scripts/importar-cli.js ruta/al/archivo.xlsx [ruta/a/personal.db]
//
// --solo-revisar: lee y limpia el Excel y genera el informe, sin tocar ninguna base de datos.
const fs = require('fs');
const path = require('path');
const { leerExcel, procesarHojas, guardarEnBD, formatearReporte, avisosACSV } = require('../src/importador');

async function main() {
    const args = process.argv.slice(2);
    const soloRevisar = args.includes('--solo-revisar');
    const [archivo, rutaBD = path.join('datos', 'personal.db')] = args.filter(a => !a.startsWith('--'));

    if (!archivo) {
        console.error('Indica el archivo Excel. Ej.: node scripts/importar-cli.js DATA_DE_PNF_2026.xlsx --solo-revisar');
        process.exit(1);
    }

    const resultado = procesarHojas(await leerExcel(archivo));
    console.log(formatearReporte(resultado));

    fs.mkdirSync('datos', { recursive: true });
    const rutaInforme = path.join('datos', 'informe-importacion.csv');
    fs.writeFileSync(rutaInforme, avisosACSV(resultado.issues), 'utf8');
    console.log(`\nInforme detallado de avisos: ${rutaInforme}`);

    if (soloRevisar) { console.log('Modo solo-revisar: no se escribió ninguna base de datos.'); return; }

    const { abrirBD } = require('../src/db');   // se carga aquí para que --solo-revisar no requiera sqlite3
    fs.mkdirSync(path.dirname(rutaBD), { recursive: true });
    const db = await abrirBD(rutaBD);
    try {
        await guardarEnBD(db, resultado);
        console.log(`Datos guardados en ${rutaBD}`);
    } finally {
        await db.close();
    }
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
