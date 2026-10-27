'use strict';
// ============================================================
// Interfaz: búsqueda, filtros, selección e impresión.
// Todo el texto de la base de datos se inserta con textContent (sin innerHTML).
// ============================================================
const $ = (id) => document.getElementById(id);

const estado = {
    campos: [],                 // catálogo de campos (viene de main)
    elegidos: new Set(),        // campos opcionales marcados para imprimir
    resultados: [],             // personas de la búsqueda actual
    seleccion: new Set(),       // ids marcados (se conservan entre búsquedas)
    secuencia: 0,               // para ignorar respuestas viejas
    fichaId: null
};

const CLAVE_CAMPOS = 'camposImpresion';
const FILTROS = ['periodo', 'id_pnf', 'id_sede', 'condicion', 'categoria', 'dedicacion'];

// ---------- utilidades ----------
function crear(etiqueta, props = {}, texto = null) {
    const el = document.createElement(etiqueta);
    Object.assign(el, props);
    if (texto !== null) el.textContent = texto;
    return el;
}

function toast(mensaje, tipo = 'ok') {
    const caja = crear('div', { className: `toast${tipo === 'error' ? ' toast-error' : ''}` }, mensaje);
    caja.setAttribute('role', 'alert');
    $('toast-container').appendChild(caja);
    requestAnimationFrame(() => requestAnimationFrame(() => caja.classList.add('show')));
    setTimeout(() => { caja.classList.remove('show'); setTimeout(() => caja.remove(), 300); }, 4500);
}

// Las respuestas de main son { exito, datos } o { exito: false, error }
async function llamar(promesa) {
    const r = await promesa;
    if (!r.exito) throw new Error(r.error || 'Error desconocido');
    return r.datos;
}

const formatoCedula = (v) => (v ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');
const unicos = (personas, clave) => [...new Set(personas.flatMap(p => p.asignaciones.map(a => a[clave]).filter(Boolean)))];

// ---------- campos a imprimir ----------
function guardarCampos() {
    try { localStorage.setItem(CLAVE_CAMPOS, JSON.stringify([...estado.elegidos])); } catch { /* sin almacenamiento: no pasa nada */ }
}

function cargarCamposGuardados() {
    try {
        const g = JSON.parse(localStorage.getItem(CLAVE_CAMPOS));
        if (Array.isArray(g)) return new Set(g);
    } catch { /* se usan los valores por defecto */ }
    return new Set(['pnf', 'sede', 'condicion']);   // primera vez
}

function actualizarResumenCampos() {
    const opcionales = estado.campos.filter(c => !c.fijo && estado.elegidos.has(c.id)).length;
    $('resumenCampos').textContent = `(4 fijos + ${opcionales} opcionales)`;
}

function construirCampos() {
    const cont = $('listaCampos');
    cont.replaceChildren();
    const grupos = [...new Set(estado.campos.map(c => c.grupo))];
    for (const grupo of grupos) {
        const caja = crear('div', { className: 'grupo-campos' });
        caja.appendChild(crear('h4', {}, grupo));
        const rejilla = crear('div', { className: 'casillas' });
        for (const c of estado.campos.filter(x => x.grupo === grupo)) {
            const etiqueta = crear('label', { className: c.fijo ? 'fijo' : '' });
            const casilla = crear('input', { type: 'checkbox', checked: c.fijo || estado.elegidos.has(c.id), disabled: !!c.fijo });
            casilla.dataset.campo = c.id;
            casilla.addEventListener('change', () => {
                if (casilla.checked) estado.elegidos.add(c.id); else estado.elegidos.delete(c.id);
                guardarCampos();
                actualizarResumenCampos();
            });
            etiqueta.append(casilla, document.createTextNode(c.fijo ? `${c.etiqueta} (siempre)` : c.etiqueta));
            rejilla.appendChild(etiqueta);
        }
        caja.appendChild(rejilla);
        cont.appendChild(caja);
    }
    actualizarResumenCampos();
}

function marcarCampos(todos) {
    estado.elegidos = new Set(todos ? estado.campos.filter(c => !c.fijo).map(c => c.id) : []);
    guardarCampos();
    construirCampos();
}

// ---------- filtros ----------
function llenarSelect(id, todosTexto, opciones) {
    const sel = $(id);
    const actual = sel.value;
    sel.replaceChildren(crear('option', { value: '' }, todosTexto));
    opciones.forEach(o => {
        const [valor, texto] = typeof o === 'object' ? [o.id, o.nombre] : [o, o];
        sel.appendChild(crear('option', { value: String(valor) }, texto));
    });
    if ([...sel.options].some(o => o.value === actual)) sel.value = actual;
}

async function cargarFiltros() {
    const f = await llamar(window.baseDatos.obtenerFiltros());
    llenarSelect('f-periodo', 'Todos', f.periodos);
    llenarSelect('f-id_pnf', 'Todos', f.areas);
    llenarSelect('f-id_sede', 'Todas', f.sedes);
    llenarSelect('f-condicion', 'Todas', f.condiciones);
    llenarSelect('f-categoria', 'Todas', f.categorias);
    llenarSelect('f-dedicacion', 'Todas', f.dedicaciones);
}

function leerFiltros() {
    const filtros = { texto: $('texto').value.trim() };
    FILTROS.forEach(k => { filtros[k] = $(`f-${k}`).value; });
    return filtros;
}

const hayFiltrosDeAsignacion = () => FILTROS.some(k => $(`f-${k}`).value);

function textoResumenFiltros() {
    const partes = [];
    const texto = $('texto').value.trim();
    const sel = estado.seleccion.size;
    if (sel) partes.push(`Selección de ${sel} ${sel === 1 ? 'persona' : 'personas'}`);   // puede venir de varias búsquedas
    else if (texto) partes.push(`Búsqueda: "${texto}"`);
    FILTROS.forEach(k => {
        const sel = $(`f-${k}`);
        if (sel.value) partes.push(`${sel.parentElement.firstChild.textContent.trim()}: ${sel.options[sel.selectedIndex].text}`);
    });
    return partes.join(' · ');
}

// ---------- resultados ----------
function celda(texto) { return crear('td', {}, texto || ''); }

function dibujarResultados() {
    const cuerpo = $('filas');
    cuerpo.replaceChildren();
    const vacio = $('vacio');
    vacio.hidden = estado.resultados.length > 0;
    if (!estado.resultados.length) {
        vacio.textContent = estado.sinDatos
            ? 'Aún no hay datos. Usa "Importar Excel…" para cargar el archivo del personal.'
            : 'No se encontró a nadie con esa búsqueda.';
    }

    for (const p of estado.resultados) {
        const tr = crear('tr', { className: estado.seleccion.has(p.id) ? 'marcada' : '' });

        const tdChk = crear('td', { className: 'chk' });
        const chk = crear('input', { type: 'checkbox', checked: estado.seleccion.has(p.id) });
        chk.setAttribute('aria-label', `Seleccionar a ${p.nombre_completo}`);
        chk.addEventListener('change', () => {
            if (chk.checked) estado.seleccion.add(p.id); else estado.seleccion.delete(p.id);
            tr.classList.toggle('marcada', chk.checked);
            actualizarBarra();
        });
        tdChk.appendChild(chk);

        const tdNombre = crear('td');
        const enlace = crear('button', { className: 'enlace', type: 'button' }, p.nombre_completo);
        enlace.addEventListener('click', () => abrirFicha(p));
        tdNombre.appendChild(enlace);

        tr.append(tdChk, tdNombre, celda(formatoCedula(p.cedula)), celda(p.telefono), celda(p.correo),
            celda(unicos([p], 'pnf').join(' / ')), celda(unicos([p], 'sede').join(' / ')),
            celda(unicos([p], 'condicion').join(' / ')));
        cuerpo.appendChild(tr);
    }
    actualizarBarra();
}

function actualizarBarra() {
    const n = estado.resultados.length;
    const sel = estado.seleccion.size;
    $('contador').textContent = `${n} ${n === 1 ? 'persona' : 'personas'}` + (sel ? ` · ${sel} seleccionada${sel === 1 ? '' : 's'}` : '');
    $('btnQuitarSel').hidden = sel === 0;
    $('chkTodos').checked = n > 0 && estado.resultados.every(p => estado.seleccion.has(p.id));

    const aImprimir = sel || n;
    ['btnListado', 'btnListadoPdf', 'btnFichas', 'btnFichasPdf'].forEach(id => { $(id).disabled = aImprimir === 0; });
    let nota = sel ? `Se imprimirán las ${sel} personas seleccionadas.` : (n ? `Sin selección: se imprimirán las ${n} personas de la lista.` : '');
    if (aImprimir && hayFiltrosDeAsignacion()) nota += ' Los filtros activos también limitan las asignaciones que se imprimen.';
    $('notaImpresion').textContent = nota;
}

async function buscar() {
    const mia = ++estado.secuencia;
    try {
        const personas = await llamar(window.baseDatos.buscar(leerFiltros()));
        if (mia !== estado.secuencia) return;        // llegó una búsqueda más nueva
        estado.resultados = personas;
        dibujarResultados();
    } catch (err) {
        toast(`Error al buscar: ${err.message}`, 'error');
    }
}

async function actualizarResumenBD() {
    const r = await llamar(window.baseDatos.resumen());
    estado.sinDatos = r.personas === 0;
    $('resumenBD').textContent = `${r.personas} personas · ${r.asignaciones} asignaciones registradas`;
}

// ---------- impresión ----------
async function imprimir(tipo, accion, ids = null) {
    const objetivo = ids || (estado.seleccion.size ? [...estado.seleccion] : estado.resultados.map(p => p.id));
    if (!objetivo.length) { toast('No hay personas para imprimir.', 'error'); return; }
    const botones = document.querySelectorAll('button');
    botones.forEach(b => { b.dataset.prev = b.disabled ? '1' : ''; b.disabled = true; });
    try {
        const r = await llamar(window.baseDatos.imprimir({
            tipo, accion, ids: objetivo, campos: [...estado.elegidos],
            filtros: leerFiltros(), resumen: textoResumenFiltros()
        }));
        if (r.archivo) toast('PDF guardado correctamente.');
        else if (r.impreso) toast('Enviado a la impresora.');
        else if (r.error) toast(`No se pudo imprimir: ${r.error}`, 'error');
    } catch (err) {
        toast(`Error: ${err.message}`, 'error');
    } finally {
        botones.forEach(b => { b.disabled = b.dataset.prev === '1'; });
        actualizarBarra();
    }
}

// ---------- ficha individual ----------
async function abrirFicha(p) {
    estado.fichaId = p.id;
    $('dlgTitulo').textContent = p.nombre_completo;
    try {
        $('marcoFicha').srcdoc = await llamar(window.baseDatos.fichaHTML({ id: p.id, campos: [...estado.elegidos], filtros: leerFiltros() }));
        $('dlgFicha').showModal();
    } catch (err) {
        toast(`No se pudo abrir la ficha: ${err.message}`, 'error');
    }
}

// ---------- importar ----------
async function importar() {
    try {
        const r = await llamar(window.baseDatos.importarExcel());
        if (r.cancelado) return;
        $('reporteImport').textContent = r.reporte;
        $('btnVerInforme').hidden = r.avisos === 0;
        $('dlgImport').showModal();
        await Promise.all([cargarFiltros(), actualizarResumenBD()]);
        await buscar();
    } catch (err) {
        toast(`No se pudo importar: ${err.message}`, 'error');
    }
}

// ---------- eventos ----------
let temporizador = null;
$('texto').addEventListener('input', () => { clearTimeout(temporizador); temporizador = setTimeout(buscar, 180); });
FILTROS.forEach(k => $(`f-${k}`).addEventListener('change', buscar));

$('btnLimpiar').addEventListener('click', () => {
    $('texto').value = '';
    FILTROS.forEach(k => { $(`f-${k}`).value = ''; });
    buscar();
    $('texto').focus();
});

$('chkTodos').addEventListener('change', (e) => {
    estado.resultados.forEach(p => { if (e.target.checked) estado.seleccion.add(p.id); else estado.seleccion.delete(p.id); });
    dibujarResultados();
});
$('btnQuitarSel').addEventListener('click', () => { estado.seleccion.clear(); dibujarResultados(); });

$('btnListado').addEventListener('click', () => imprimir('listado', 'imprimir'));
$('btnListadoPdf').addEventListener('click', () => imprimir('listado', 'pdf'));
$('btnFichas').addEventListener('click', () => imprimir('fichas', 'imprimir'));
$('btnFichasPdf').addEventListener('click', () => imprimir('fichas', 'pdf'));

$('btnSoloBasico').addEventListener('click', () => marcarCampos(false));
$('btnMarcarTodo').addEventListener('click', () => marcarCampos(true));

$('dlgImprimir').addEventListener('click', () => imprimir('fichas', 'imprimir', [estado.fichaId]));
$('dlgPdf').addEventListener('click', () => imprimir('fichas', 'pdf', [estado.fichaId]));
$('dlgCerrar').addEventListener('click', () => $('dlgFicha').close());

$('btnImportar').addEventListener('click', importar);
$('dlgImpCerrar').addEventListener('click', () => $('dlgImport').close());
$('btnVerInforme').addEventListener('click', async () => {
    try { await llamar(window.baseDatos.mostrarInforme()); } catch (err) { toast(err.message, 'error'); }
});

// ---------- arranque ----------
(async function iniciar() {
    try {
        estado.campos = await llamar(window.baseDatos.obtenerCampos());
        estado.elegidos = cargarCamposGuardados();
        construirCampos();
        await Promise.all([cargarFiltros(), actualizarResumenBD()]);
        await buscar();
    } catch (err) {
        toast(`Error al iniciar: ${err.message}`, 'error');
    }
})();
