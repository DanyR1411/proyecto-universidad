'use strict';
// ============================================================
// Generación de HTML para imprimir: listados y fichas.
// Funciones puras (no usan Electron), por eso se pueden probar.
// ============================================================

// Cambia este texto si el membrete debe decir otra cosa
const INSTITUCION = 'UNIVERSIDAD NACIONAL EXPERIMENTAL RAFAEL MARÍA BARALT';

const G_PERSONAL = 'Datos personales y académicos';
const G_LABORAL = 'Datos laborales (por asignación)';

// Cada campo: id, etiqueta, tipo ('persona' = una vez por persona; 'asignacion' = por cada asignación)
// "fijo" = siempre se incluye, no se puede desmarcar.
const CAMPOS = [
    { id: 'nombre_completo', etiqueta: 'Nombre completo', tipo: 'persona', fijo: true, grupo: G_PERSONAL },
    { id: 'cedula', etiqueta: 'Cédula', tipo: 'persona', fijo: true, formato: 'cedula', grupo: G_PERSONAL },
    { id: 'telefono', etiqueta: 'Teléfono', tipo: 'persona', fijo: true, grupo: G_PERSONAL },
    { id: 'correo', etiqueta: 'Correo electrónico', tipo: 'persona', fijo: true, grupo: G_PERSONAL },
    { id: 'fecha_ingreso', etiqueta: 'Fecha de ingreso', tipo: 'persona', formato: 'fecha', grupo: G_PERSONAL },
    { id: 'titulo_pregrado', etiqueta: 'Título (pregrado)', tipo: 'persona', grupo: G_PERSONAL },
    { id: 'especialidad', etiqueta: 'Especialidad', tipo: 'persona', grupo: G_PERSONAL },
    { id: 'maestria', etiqueta: 'Maestría', tipo: 'persona', grupo: G_PERSONAL },
    { id: 'doctorado', etiqueta: 'Doctorado', tipo: 'persona', grupo: G_PERSONAL },
    { id: 'periodo', etiqueta: 'Período', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'pnf', etiqueta: 'PNF', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'sede', etiqueta: 'Sede', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'condicion', etiqueta: 'Condición', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'categoria', etiqueta: 'Categoría', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'dedicacion', etiqueta: 'Dedicación', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'programa', etiqueta: 'Programa', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'proyecto', etiqueta: 'Proyecto', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'asignaturas', etiqueta: 'Asignaturas / unidades curriculares', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'comision_servicios', etiqueta: 'Comisión de servicios', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'permiso_no_remunerado', etiqueta: 'Permiso no remunerado', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'permiso_medico', etiqueta: 'Permiso médico', tipo: 'asignacion', grupo: G_LABORAL },
    { id: 'observaciones', etiqueta: 'Observaciones', tipo: 'asignacion', grupo: G_LABORAL }
];

// Devuelve los campos elegidos en el orden estándar; los fijos siempre van.
function seleccionarCampos(ids) {
    const pedidos = new Set(Array.isArray(ids) ? ids : []);
    return CAMPOS.filter(c => c.fijo || pedidos.has(c.id));
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ESCAPES[ch]);

const formatoCedula = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
function formatoFecha(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
}

// Texto de un campo para una persona. Los campos de asignación juntan los
// valores distintos de todas sus asignaciones.
function valorTexto(p, campo) {
    if (campo.tipo === 'persona') {
        const v = p[campo.id];
        if (!v) return '';
        if (campo.formato === 'cedula') return formatoCedula(v);
        if (campo.formato === 'fecha') return formatoFecha(v);
        return String(v);
    }
    const valores = [];
    for (const a of p.asignaciones || []) {
        const v = a[campo.id];
        if (v && !valores.includes(v)) valores.push(v);
    }
    return valores.join(campo.id === 'asignaturas' || campo.id === 'observaciones' ? ' | ' : ' / ');
}

// Columnas cortas que no deben partirse en dos líneas
const SIN_SALTO = ['cedula', 'telefono', 'fecha_ingreso', 'periodo'];

const CSS = `
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #111; margin: 0; padding: 0; }
.membrete { text-align: center; border-bottom: 2px solid #2c3e50; padding-bottom: 6px; margin-bottom: 10px; }
.membrete .inst { font-weight: bold; font-size: 12pt; letter-spacing: .3px; }
.membrete .tit { font-size: 11pt; margin-top: 2px; }
.membrete .sub { font-size: 9pt; color: #444; margin-top: 2px; }
table { border-collapse: collapse; width: 100%; }
table.listado th, table.listado td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; font-size: 9.5pt; }
table.listado th { background: #2c3e50; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
table.listado td.nw { white-space: nowrap; }
table.listado td.n { text-align: right; width: 28px; color: #555; }
table.listado thead { display: table-header-group; }
table.listado tr { page-break-inside: avoid; }
.pie { margin-top: 8px; font-size: 8.5pt; color: #555; }
.ficha { page-break-after: always; padding: 4px 2px; }
.ficha:last-of-type { page-break-after: auto; }
.ficha h2 { margin: 6px 0 2px; font-size: 15pt; color: #1b2a38; }
.ficha h3 { margin: 14px 0 6px; font-size: 11pt; color: #2c3e50; border-bottom: 1px solid #bbb; padding-bottom: 2px; }
table.datos th { width: 32%; text-align: left; background: #eef1f4; font-weight: 600; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
table.datos th, table.datos td { border: 1px solid #c9ced3; padding: 5px 8px; vertical-align: top; }
.asig { margin-bottom: 10px; page-break-inside: avoid; }
.asig-tit { font-weight: bold; font-size: 10pt; margin: 6px 0 3px; color: #34495e; }
.nd { color: #999; }
.vacio { color: #777; font-style: italic; }
`;

function documento({ titulo, horizontal, cuerpo }) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title>` +
        `<style>${CSS}@page { size: A4 ${horizontal ? 'landscape' : 'portrait'}; margin: 12mm; }</style></head><body>${cuerpo}</body></html>`;
}

function fechaLarga() {
    return new Date().toLocaleDateString('es-VE', { day: '2-digit', month: 'long', year: 'numeric' });
}

function membrete(titulo, resumen, institucion) {
    return `<div class="membrete"><div class="inst">${esc(institucion)}</div><div class="tit">${esc(titulo)}</div>` +
        (resumen ? `<div class="sub">${esc(resumen)}</div>` : '') + '</div>';
}

// ---- Listado: una fila por persona ----
function generarListadoHTML(personas, camposIds, o = {}) {
    const campos = seleccionarCampos(camposIds);
    const titulo = o.titulo || 'Listado de personal';
    const fecha = o.fecha || fechaLarga();
    const encabezados = campos.map(c => `<th>${esc(c.etiqueta)}</th>`).join('');
    const filas = personas.map((p, i) =>
        `<tr><td class="n">${i + 1}</td>${campos.map(c => `<td${SIN_SALTO.includes(c.id) ? ' class="nw"' : ''}>${esc(valorTexto(p, c))}</td>`).join('')}</tr>`).join('');
    const cuerpo = membrete(titulo, o.resumen, o.institucion || INSTITUCION) +
        `<table class="listado"><thead><tr><th>N°</th>${encabezados}</tr></thead><tbody>${filas}</tbody></table>` +
        `<div class="pie">Total: ${personas.length} ${personas.length === 1 ? 'persona' : 'personas'} · Generado el ${esc(fecha)}</div>`;
    return documento({ titulo, horizontal: campos.length > 5, cuerpo });
}

// ---- Fichas: una página por persona ----
function generarFichasHTML(personas, camposIds, o = {}) {
    const campos = seleccionarCampos(camposIds);
    const dePersona = campos.filter(c => c.tipo === 'persona' && c.id !== 'nombre_completo');
    const deAsignacion = campos.filter(c => c.tipo === 'asignacion');
    const fecha = o.fecha || fechaLarga();
    const institucion = o.institucion || INSTITUCION;

    const fila = (etiqueta, valor) =>
        `<tr><th>${esc(etiqueta)}</th><td>${valor ? esc(valor) : '<span class="nd">—</span>'}</td></tr>`;

    const fichas = personas.map(p => {
        let laboral = '';
        if (deAsignacion.length) {
            const asigs = p.asignaciones || [];
            laboral = '<h3>Datos laborales</h3>' + (asigs.length
                ? asigs.map((a, i) =>
                    `<div class="asig"><div class="asig-tit">${asigs.length > 1 ? `Asignación ${i + 1} de ${asigs.length}` : 'Asignación'}</div>` +
                    `<table class="datos">${deAsignacion.map(c => fila(c.etiqueta, a[c.id] || '')).join('')}</table></div>`).join('')
                : '<p class="vacio">Sin asignaciones registradas.</p>');
        }
        return `<section class="ficha">${membrete('Ficha de personal', o.resumen, institucion)}` +
            `<h2>${esc(p.nombre_completo)}</h2><h3>Datos personales</h3>` +
            `<table class="datos">${dePersona.map(c => fila(c.etiqueta, valorTexto(p, c))).join('')}</table>` +
            `${laboral}<div class="pie">Generado el ${esc(fecha)}</div></section>`;
    }).join('');

    return documento({ titulo: o.titulo || 'Fichas de personal', horizontal: false, cuerpo: fichas });
}

module.exports = {
    INSTITUCION, CAMPOS, seleccionarCampos, valorTexto, esc, formatoCedula, formatoFecha,
    generarListadoHTML, generarFichasHTML
};
