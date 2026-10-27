'use strict';
// ============================================================
// Importador del Excel "DATA_DE_PNF".
//   leerExcel()      -> lee el archivo (usa exceljs)
//   procesarHojas()  -> limpia y agrupa (función pura, se puede probar)
//   guardarEnBD()    -> guarda personas y asignaciones en SQLite
// ============================================================
const N = require('./normalizar');

const CAMPOS_PERSONA = ['telefono', 'correo', 'fecha_ingreso', 'titulo_pregrado', 'especialidad', 'maestria', 'doctorado'];

// ------------------------------------------------------------
// 1. Lectura del archivo
// ------------------------------------------------------------
// exceljs devuelve objetos para hipervínculos, texto enriquecido y fórmulas
function valorCelda(v) {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v;
    if (typeof v === 'object') {
        if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
        if ('result' in v) return valorCelda(v.result);
        if ('text' in v) return valorCelda(v.text);
        if ('error' in v) return null;
        return String(v);
    }
    return v;
}

// Devuelve [{ nombre, filas: [[celda, celda...], ...] }]. La fila i del arreglo
// es la fila i+1 de Excel, así los avisos señalan la fila real del archivo.
async function leerExcel(ruta) {
    const ExcelJS = require('exceljs');
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(ruta);
    const hojas = [];
    libro.eachSheet((hoja) => {
        const filas = [];
        for (let r = 1; r <= hoja.rowCount; r++) {
            const fila = hoja.getRow(r);
            const celdas = [];
            for (let c = 1; c <= hoja.columnCount; c++) celdas.push(valorCelda(fila.getCell(c).value));
            filas.push(celdas);
        }
        hojas.push({ nombre: hoja.name, filas });
    });
    return hojas;
}

// ------------------------------------------------------------
// 2. Interpretación de la estructura de cada hoja
// ------------------------------------------------------------
function tipoDeHoja(nombre) {
    const k = N.clave(nombre);
    if (k.includes('ORDINARIO')) return 'ORDINARIO';
    if (k.includes('CONTRATADO')) return 'CONTRATADO';
    if (k.includes('ADM')) return 'ADMINISTRATIVO';
    return null;   // p. ej. "Hoja1" (índice A-Z): ya no hace falta
}

function detectarPeriodo(filas) {
    for (const fila of filas.slice(0, 15)) {
        for (const celda of fila) {
            const m = /PERIODO ACADEMICO\s*:\s*([IVX]+)\s*-\s*(\d{4})/.exec(N.clave(celda));
            if (m) return `${m[1]}-${m[2]}`;
        }
    }
    return null;
}

function campoDeEncabezado(texto) {
    const k = N.clave(texto);
    if (!k) return null;
    if (k.includes('APELLIDO')) return 'nombre';
    if (k === 'CEDULA') return 'cedula';
    if (k.includes('TELEFONO')) return 'telefono';
    if (k.includes('CORREO')) return 'correo';
    if (k.includes('FECHA DE INGRESO')) return 'fecha_ingreso';
    if (k.startsWith('TITULO')) return 'titulo_pregrado';
    if (k === 'ESPECIALIDAD') return 'especialidad';
    if (k === 'MAESTRIA') return 'maestria';
    if (k === 'DOCTORADO') return 'doctorado';
    if (k === 'PROGRAMA') return 'programa';
    if (k === 'CONDICION') return 'condicion';
    if (k === 'CATEGORIA') return 'categoria';
    if (k === 'DEDICACION') return 'dedicacion';
    if (k === 'SEDE') return 'sede';
    if (k === 'PROYECTO') return 'proyecto';
    if (k.startsWith('ASIGNATURAS')) return 'asignaturas';
    if (k.startsWith('COMISION')) return 'comision_servicios';
    if (k === 'PERMISO NO REMUNERADO') return 'permiso_no_remunerado';
    if (k.startsWith('PERMISO M')) return 'permiso_medico';
    if (k.startsWith('OBSERVACION')) return 'observaciones';
    return null;
}

// Si la fila es de encabezados, devuelve { campo: indiceDeColumna }
function detectarEncabezado(fila) {
    const mapa = {};
    fila.forEach((celda, i) => {
        let campo = campoDeEncabezado(celda);
        if (!campo) return;
        if (campo === 'categoria' && mapa.categoria !== undefined) campo = 'categoria_2';  // hay dos columnas CATEGORÍA
        if (mapa[campo] === undefined) mapa[campo] = i;
    });
    return (mapa.cedula !== undefined && mapa.nombre !== undefined) ? mapa : null;
}

// ------------------------------------------------------------
// 3. Procesamiento (función pura)
// ------------------------------------------------------------
function procesarHojas(hojas, { periodoPorDefecto = null } = {}) {
    const issues = [];
    const registros = [];
    const hojasIgnoradas = [];
    const periodos = new Set();

    for (const hoja of hojas) {
        const condicionHoja = tipoDeHoja(hoja.nombre);
        if (!condicionHoja) { hojasIgnoradas.push(hoja.nombre.trim()); continue; }

        const periodo = detectarPeriodo(hoja.filas) || periodoPorDefecto;
        if (!periodo) {
            issues.push({ hoja: hoja.nombre.trim(), fila: '', cedula: '', nombre: '', tipo: 'SIN_PERIODO',
                detalle: 'No se encontró "PERIODO ACADÉMICO: ..." en la hoja; sus filas no se importaron.' });
            continue;
        }
        periodos.add(periodo);

        let mapa = null;
        let pnfActual = null;

        hoja.filas.forEach((fila, i) => {
            const numFila = i + 1;

            const encabezado = detectarEncabezado(fila);
            if (encabezado) { mapa = encabezado; return; }

            // Fila de sección: "PNF INFORMATICA", etc. (en las primeras columnas)
            const celdaSeccion = fila.slice(0, 4).find(c => N.clave(c).startsWith('PNF'));
            if (celdaSeccion !== undefined) {
                const id = N.detectarPNF(celdaSeccion);
                if (id === null) {
                    issues.push({ hoja: hoja.nombre.trim(), fila: numFila, cedula: '', nombre: '', tipo: 'PNF_NO_RECONOCIDO',
                        detalle: `Sección "${N.limpiar(celdaSeccion)}" no corresponde a un PNF conocido.` });
                }
                pnfActual = id;
                return;
            }

            if (!mapa) return;
            const get = (campo) => (mapa[campo] === undefined ? null : fila[mapa[campo]] ?? null);

            const cedula = N.normCedula(get('cedula'));
            const nombre = N.normNombre(get('nombre'));
            if (!cedula.valor && !nombre) return;   // fila vacía o solo numeración

            const aviso = (tipo, detalle) => issues.push({
                hoja: hoja.nombre.trim(), fila: numFila, cedula: cedula.valor || '', nombre: nombre || '', tipo, detalle
            });

            if (!cedula.valor) { aviso('SIN_CEDULA', 'Tiene nombre pero no cédula; no se importó.'); return; }
            if (!nombre) { aviso('SIN_NOMBRE', 'Tiene cédula pero no nombre; no se importó.'); return; }
            if (cedula.dudosa) aviso('CEDULA_DUDOSA', `La cédula "${cedula.valor}" no tiene entre 6 y 9 dígitos.`);
            if (pnfActual === null) aviso('SIN_PNF', 'La fila no está bajo ninguna sección de PNF reconocida.');

            // --- datos de la persona ---
            const fecha = N.normFecha(get('fecha_ingreso'));
            if (fecha.error) aviso('FECHA_ILEGIBLE', fecha.error + ' (queda vacía; corregir a mano).');
            if (fecha.ambigua) aviso('FECHA_AMBIGUA', `La fecha "${N.limpiar(get('fecha_ingreso'))}" se leyó como día/mes/año (${fecha.valor}); confirmar.`);
            const tel = N.normTelefono(get('telefono'));
            if (tel.dudoso) aviso('TELEFONO_DUDOSO', `Formato de teléfono no reconocido: "${tel.valor}" (se conservó tal cual).`);
            const correo = N.normCorreo(get('correo'));
            if (!correo.valido) aviso('CORREO_INVALIDO', `Correo con formato inválido: "${correo.valor}" (se conservó tal cual).`);

            const persona = {
                telefono: tel.valor, correo: correo.valor, fecha_ingreso: fecha.valor,
                titulo_pregrado: N.limpiar(get('titulo_pregrado')), especialidad: N.limpiar(get('especialidad')),
                maestria: N.limpiar(get('maestria')), doctorado: N.limpiar(get('doctorado'))
            };

            // --- datos de la asignación ---
            const notas = [];
            const sede = N.normSede(get('sede'));
            if (sede.desconocido) { aviso('SEDE_NO_RECONOCIDA', `Sede "${sede.desconocido}" no está en el catálogo.`); notas.push(`Sede original no reconocida: ${sede.desconocido}`); }

            const cats = [N.normCategoria(get('categoria')), N.normCategoria(get('categoria_2'))];
            const categoria = (cats.find(c => c.valor) || {}).valor || null;
            cats.filter(c => c.desconocido).forEach(c => {
                aviso('CATEGORIA_NO_RECONOCIDA', `Categoría "${c.desconocido}" no está en el catálogo.`);
                notas.push(`Categoría original no reconocida: ${c.desconocido}`);
            });

            const ded = N.normDedicacion(get('dedicacion'));
            if (ded.desconocido) { aviso('DEDICACION_NO_RECONOCIDA', `Dedicación "${ded.desconocido}" no está en el catálogo.`); notas.push(`Dedicación original no reconocida: ${ded.desconocido}`); }

            const obsExcel = N.limpiar(get('observaciones'));
            const asignacion = {
                periodo, id_pnf: pnfActual, sede: sede.valor,
                programa: N.limpiar(get('programa')),
                condicion: N.normCondicion(get('condicion'), condicionHoja),
                categoria, dedicacion: ded.valor,
                proyecto: N.limpiar(get('proyecto')),
                asignaturas: N.limpiar(get('asignaturas')),
                comision_servicios: N.limpiar(get('comision_servicios')),
                permiso_no_remunerado: N.limpiar(get('permiso_no_remunerado')),
                permiso_medico: N.limpiar(get('permiso_medico')),
                observaciones: [obsExcel, ...notas].filter(Boolean).join(' | ') || null
            };

            registros.push({ hoja: hoja.nombre.trim(), fila: numFila, cedula: cedula.valor, nombre, persona, asignacion });
        });
    }

    // --- Agrupar: una persona por cédula, con todas sus asignaciones ---
    const porCedula = new Map();
    let duplicadosExactos = 0;

    for (const r of registros) {
        let p = porCedula.get(r.cedula);
        if (!p) {
            p = { cedula: r.cedula, nombre_completo: r.nombre, ...r.persona, asignaciones: [], _firmas: new Set() };
            porCedula.set(r.cedula, p);
        } else {
            const ctx = { hoja: r.hoja, fila: r.fila, cedula: r.cedula, nombre: r.nombre };
            // Mismo nombre escrito distinto (orden, apellido omitido): se queda el más completo, sin aviso
            const fusionado = N.fusionarNombres(p.nombre_completo, r.nombre);
            if (fusionado) {
                p.nombre_completo = fusionado;
            } else {
                issues.push({ ...ctx, tipo: 'MISMA_CEDULA_NOMBRES_DISTINTOS',
                    detalle: `La cédula ya estaba registrada con otro nombre ("${p.nombre_completo}"). Se conservó el primero.` });
            }
            const conflictos = [];
            for (const campo of CAMPOS_PERSONA) {
                const nuevo = r.persona[campo];
                if (!nuevo) continue;
                if (!p[campo]) p[campo] = nuevo;
                else if (N.clave(p[campo]) !== N.clave(nuevo)) conflictos.push(campo);
            }
            if (conflictos.length) {
                issues.push({ ...ctx, tipo: 'DATOS_DISTINTOS_ENTRE_FILAS',
                    detalle: `Valores distintos en otra fila de la misma persona (${conflictos.join(', ')}). Se conservó el primero.` });
            }
        }
        const a = r.asignacion;
        const firma = JSON.stringify([a.periodo, a.id_pnf, a.sede, a.condicion, a.categoria, a.dedicacion, N.clave(a.asignaturas)]);
        if (p._firmas.has(firma)) { duplicadosExactos++; continue; }
        p._firmas.add(firma);
        p.asignaciones.push(a);
    }

    const personas = [...porCedula.values()].map(({ _firmas, ...p }) => p);

    // --- Posibles duplicados: mismo nombre, distinta cédula (suele ser un error de digitación) ---
    const porNombre = new Map();
    for (const p of personas) {
        const k = N.clave(p.nombre_completo);
        if (!porNombre.has(k)) porNombre.set(k, []);
        porNombre.get(k).push(p);
    }
    for (const grupo of porNombre.values()) {
        if (grupo.length > 1) {
            issues.push({ hoja: '', fila: '', cedula: grupo[0].cedula, nombre: grupo[0].nombre_completo, tipo: 'POSIBLE_DUPLICADO',
                detalle: `El mismo nombre aparece con ${grupo.length} cédulas distintas: ${grupo.map(g => g.cedula).join(', ')}.` });
        }
    }

    return {
        personas, issues,
        stats: {
            registrosLeidos: registros.length,
            personas: personas.length,
            asignaciones: personas.reduce((n, p) => n + p.asignaciones.length, 0),
            duplicadosExactos,
            periodos: [...periodos],
            hojasIgnoradas
        }
    };
}

// ------------------------------------------------------------
// 4. Guardado en la base de datos
// ------------------------------------------------------------
// Es repetible: las asignaciones "importadas" de los períodos del archivo se
// reemplazan, pero lo que se haya creado o editado a mano se respeta.
async function guardarEnBD(db, resultado) {
    await db.run('BEGIN');
    try {
        const idSede = new Map();
        const nombresSede = new Set(resultado.personas.flatMap(p => p.asignaciones.map(a => a.sede)).filter(Boolean));
        for (const nombre of nombresSede) {
            await db.run('INSERT OR IGNORE INTO sedes (nombre_sede) VALUES (?)', [nombre]);
            idSede.set(nombre, (await db.get('SELECT id_sede FROM sedes WHERE nombre_sede = ?', [nombre])).id_sede);
        }

        for (const periodo of resultado.stats.periodos) {
            await db.run("DELETE FROM asignaciones WHERE origen = 'importado' AND periodo = ?", [periodo]);
        }

        for (const p of resultado.personas) {
            await db.run(
                `INSERT OR IGNORE INTO personas (cedula, nombre_completo, nombre_busqueda) VALUES (?, ?, ?)`,
                [p.cedula, p.nombre_completo, N.clave(p.nombre_completo)]
            );
            const { id } = await db.get('SELECT id FROM personas WHERE cedula = ?', [p.cedula]);
            // Solo completa lo que esté vacío: no pisa correcciones hechas en la app
            await db.run(
                `UPDATE personas SET
                    telefono = COALESCE(telefono, ?), correo = COALESCE(correo, ?), fecha_ingreso = COALESCE(fecha_ingreso, ?),
                    titulo_pregrado = COALESCE(titulo_pregrado, ?), especialidad = COALESCE(especialidad, ?),
                    maestria = COALESCE(maestria, ?), doctorado = COALESCE(doctorado, ?)
                 WHERE id = ?`,
                [p.telefono, p.correo, p.fecha_ingreso, p.titulo_pregrado, p.especialidad, p.maestria, p.doctorado, id]
            );
            for (const a of p.asignaciones) {
                await db.run(
                    `INSERT INTO asignaciones (id_persona, periodo, id_pnf, id_sede, programa, condicion, categoria, dedicacion,
                        proyecto, asignaturas, comision_servicios, permiso_no_remunerado, permiso_medico, observaciones, origen)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'importado')`,
                    [id, a.periodo, a.id_pnf, a.sede ? idSede.get(a.sede) : null, a.programa, a.condicion, a.categoria,
                     a.dedicacion, a.proyecto, a.asignaturas, a.comision_servicios, a.permiso_no_remunerado,
                     a.permiso_medico, a.observaciones]
                );
            }
        }
        await db.run('COMMIT');
    } catch (err) {
        await db.run('ROLLBACK');
        throw err;
    }
}

// ------------------------------------------------------------
// 5. Informes
// ------------------------------------------------------------
function formatearReporte(res) {
    const s = res.stats;
    const porTipo = {};
    res.issues.forEach(i => { porTipo[i.tipo] = (porTipo[i.tipo] || 0) + 1; });
    const lineas = [
        `Períodos detectados: ${s.periodos.join(', ') || '(ninguno)'}`,
        `Filas de personal leídas: ${s.registrosLeidos}`,
        `Personas únicas (por cédula): ${s.personas}`,
        `Asignaciones creadas: ${s.asignaciones}  (descartadas por repetidas exactas: ${s.duplicadosExactos})`,
        `Hojas ignoradas: ${s.hojasIgnoradas.join(', ') || '(ninguna)'}`,
        '',
        `Avisos para revisar: ${res.issues.length}`
    ];
    Object.entries(porTipo).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => lineas.push(`  - ${t}: ${n}`));
    return lineas.join('\n');
}

function avisosACSV(issues) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const cab = ['hoja', 'fila', 'cedula', 'nombre', 'tipo', 'detalle'];
    const filas = issues.map(i => cab.map(c => esc(i[c])).join(','));
    return '\uFEFF' + [cab.join(','), ...filas].join('\r\n');   // BOM para que Excel respete los acentos
}

async function importarExcel(db, ruta) {
    const resultado = procesarHojas(await leerExcel(ruta));
    if (db) await guardarEnBD(db, resultado);
    return resultado;
}

module.exports = { leerExcel, valorCelda, procesarHojas, guardarEnBD, importarExcel, formatearReporte, avisosACSV };
