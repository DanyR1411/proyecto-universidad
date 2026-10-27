'use strict';
// ============================================================
// Funciones puras de limpieza y normalización de datos.
// No tocan la base de datos ni el sistema de archivos, así que
// se pueden probar solas (ver tests/normalizar.test.js).
// ============================================================

// Catálogos (los IDs de las áreas coinciden con los que ya usaba la app)
const AREAS_PNF = [
    { id: 1, nombre: 'Informática' },
    { id: 2, nombre: 'Contaduría Pública' },
    { id: 3, nombre: 'Agroalimentación' },
    { id: 4, nombre: 'Educación Especial' },
    { id: 5, nombre: 'Historia' }
];

// Clave (mayúsculas, sin acentos) -> nombre para mostrar
const SEDES = {
    'CABIMAS': 'Cabimas',
    'MENE GRANDE': 'Mene Grande',
    'TRUJILLO': 'Trujillo',
    'SAN FRANCISCO': 'San Francisco',
    'LOS PUERTOS': 'Los Puertos',
    'CIUDAD OJEDA': 'Ciudad Ojeda',
    'SAN PEDRO': 'San Pedro',
    'BOBURES': 'Bobures',
    'BACHAQUERO': 'Bachaquero'
};

const CATEGORIAS = ['INSTRUCTOR', 'ASISTENTE', 'AGREGADO', 'ASOCIADO', 'TITULAR', 'ADMINISTRATIVO'];
const DEDICACIONES = ['TIEMPO COMPLETO', 'MEDIO TIEMPO', 'TIEMPO CONVENCIONAL', 'DEDICACION EXCLUSIVA'];
const ALIAS_DEDICACION = { 'EXCLUSIVA': 'DEDICACION EXCLUSIVA' };
const ALIAS_CATEGORIA = { 'INSTRUCTO': 'INSTRUCTOR', 'INSTRUCTORA': 'INSTRUCTOR', 'AGRAGADO': 'AGREGADO' };
const ALIAS_CONDICION = { 'ORDINACIO': 'ORDINARIO', 'ORDINARIA': 'ORDINARIO', 'CONTRATADA': 'CONTRATADO' };

// ------------------------------------------------------------
// Utilidades básicas
// ------------------------------------------------------------
function sinAcentos(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Texto con espacios simples y sin bordes; vacío -> null
function limpiar(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).replace(/\s+/g, ' ').trim();
    return s === '' ? null : s;
}

// Versión para comparar y buscar: MAYÚSCULAS, sin acentos, espacios simples
function clave(v) {
    const s = limpiar(v);
    return s === null ? '' : sinAcentos(s).toUpperCase();
}

// ------------------------------------------------------------
// Campos concretos
// ------------------------------------------------------------
function normNombre(raw) {
    const s = limpiar(String(raw ?? '').replace(/,/g, ' '));
    return s === null ? null : s.toUpperCase();
}

// Deja solo los dígitos: "V-12.345.678" y "25,885,345" -> sólo números
function normCedula(raw) {
    const s = limpiar(raw);
    if (!s) return { valor: null, dudosa: false };
    const digitos = s.replace(/\D/g, '');
    if (!digitos) return { valor: null, dudosa: false };
    return { valor: digitos, dudosa: digitos.length < 6 || digitos.length > 9 };
}

function aISO(y, m, d) {
    const f = new Date(Date.UTC(y, m - 1, d));
    if (f.getUTCFullYear() !== y || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
    if (y < 1950 || y > new Date().getFullYear() + 1) return null;
    return f.toISOString().slice(0, 10);
}

// Devuelve { valor: 'AAAA-MM-DD' | null, error: texto | null, ambigua: boolean }
// "ambigua" = texto tipo 02/06/2025 donde día y mes podrían intercambiarse;
// se interpreta como día/mes/año y se avisa para que alguien lo confirme.
function normFecha(raw) {
    const ok = (valor, ambigua = false) => ({ valor, error: null, ambigua });
    const mal = (error) => ({ valor: null, error, ambigua: false });

    if (raw instanceof Date) {
        const iso = isNaN(raw) ? null : aISO(raw.getUTCFullYear(), raw.getUTCMonth() + 1, raw.getUTCDate());
        return iso ? ok(iso) : mal('Fecha fuera de rango o inválida');
    }
    const s = limpiar(raw);
    if (!s) return ok(null);

    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(s);
    if (m) {
        const iso = aISO(+m[1], +m[2], +m[3]);
        return iso ? ok(iso) : mal(`Fecha inválida "${s}"`);
    }
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/.exec(s);
    if (m) {
        const a = +m[1], b = +m[2], anio = +m[3];
        let dia = a, mes = b, ambigua = false;
        if (a <= 12 && b > 12) { mes = a; dia = b; }              // 04/17/2017: claramente mes/día
        else if (a <= 12 && b <= 12 && a !== b) ambigua = true;   // 02/06/2025: se asume día/mes
        const iso = aISO(anio, mes, dia);
        return iso ? ok(iso, ambigua) : mal(`Fecha inválida "${s}"`);
    }
    return mal(`No se pudo interpretar la fecha "${s}"`);
}

// Unifica a 04XX-XXXXXXX. Admite varios números en la misma celda y prefijo (+58).
function normTelefono(raw) {
    const original = limpiar(raw);
    if (!original) return { valor: null, dudoso: false };
    const s = original.replace(/(^|[\s\/;,])\(?\+?58\)?[\s.\-]*(?=\d{10})/g, '$1');
    const encontrados = s.match(/0?\d{3}[\s.\-]{0,3}\d{7}/g) || [];
    const digitosTotales = s.replace(/\D/g, '').length;
    const digitosUsados = encontrados.reduce((n, t) => n + t.replace(/\D/g, '').length, 0);
    if (encontrados.length === 0 || digitosTotales !== digitosUsados) {
        return { valor: original, dudoso: true };   // se conserva tal cual para revisión
    }
    const formateados = encontrados.map(t => {
        let d = t.replace(/\D/g, '');
        if (d.length === 10) d = '0' + d;
        return `${d.slice(0, 4)}-${d.slice(4)}`;
    });
    return { valor: [...new Set(formateados)].join(' / '), dudoso: false };
}

function normCorreo(raw) {
    let s = limpiar(raw);
    if (!s) return { valor: null, valido: true };
    s = s.replace(/^mailto:/i, '').replace(/\s+/g, '').toLowerCase();
    const valido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && !/[|<>(),;]/.test(s);
    return { valor: s, valido };
}

// Valida contra una lista; lo que no encaje se devuelve en "desconocido"
// para no perder el dato original.
function normEnumerado(raw, validos, alias = {}) {
    const k = clave(raw);
    if (!k) return { valor: null, desconocido: null };
    const v = alias[k] || k;
    if (validos.includes(v)) return { valor: v, desconocido: null };
    return { valor: null, desconocido: limpiar(raw) };
}

const normCategoria = (raw) => normEnumerado(raw, CATEGORIAS, ALIAS_CATEGORIA);
const normDedicacion = (raw) => normEnumerado(raw, DEDICACIONES, ALIAS_DEDICACION);

function normSede(raw) {
    const k = clave(raw);
    if (!k) return { valor: null, desconocido: null };
    if (SEDES[k]) return { valor: SEDES[k], desconocido: null };
    return { valor: null, desconocido: limpiar(raw) };
}

// La condición admite combinaciones ("ORDINARIO/ADMINISTRATIVO"), por eso
// no se valida contra una lista: solo se unifican mayúsculas y errores comunes.
function normCondicion(raw, porDefecto = null) {
    const k = clave(raw);
    if (!k || k === 'CONDICION') return porDefecto;
    return k.split('/').map(p => p.trim()).map(p => ALIAS_CONDICION[p] || p).join('/');
}

// Palabras significativas de un nombre (sin acentos, sin iniciales sueltas)
function palabrasNombre(nombre) {
    return clave(nombre).replace(/[^A-Z0-9Ñ ]/g, ' ').split(' ').filter(t => t.length > 1);
}

// ¿Son el mismo nombre escrito distinto? (orden, segundo apellido omitido...)
// Devuelve el nombre más completo si son compatibles, o null si realmente difieren.
function fusionarNombres(a, b) {
    const pa = new Set(palabrasNombre(a)), pb = new Set(palabrasNombre(b));
    const aEnB = [...pa].every(t => pb.has(t));
    const bEnA = [...pb].every(t => pa.has(t));
    if (aEnB && bEnA) return b.length > a.length ? b : a;
    if (aEnB) return b;
    if (bEnA) return a;
    return null;
}

// "PNF CONTADURIA PÚBLICA" -> 2, etc.
function detectarPNF(texto) {
    const k = clave(texto);
    if (k.includes('CONTADUR')) return 2;
    if (k.includes('INFORMAT')) return 1;
    if (k.includes('AGROALIM')) return 3;
    if (k.includes('EDUCACION ESPECIAL')) return 4;
    if (k.includes('HISTORIA')) return 5;
    return null;
}

module.exports = {
    AREAS_PNF, SEDES, CATEGORIAS, DEDICACIONES,
    sinAcentos, limpiar, clave,
    normNombre, normCedula, normFecha, normTelefono, normCorreo,
    normCategoria, normDedicacion, normSede, normCondicion, detectarPNF,
    palabrasNombre, fusionarNombres
};
