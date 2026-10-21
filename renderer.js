// ============================================================
// SISTEMA DE NOTIFICACIONES (reemplaza alert())
// ============================================================
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    const icons = { success: '✅', error: '❌' };

    const iconEl = document.createElement('span');
    iconEl.className = 'toast-icon';
    iconEl.textContent = icons[type] || 'ℹ️';

    const textEl = document.createElement('span');
    textEl.textContent = message; // textContent es seguro, no interpreta HTML

    toast.appendChild(iconEl);
    toast.appendChild(textEl);
    container.appendChild(toast);

    // Doble requestAnimationFrame para garantizar que la transición CSS se active
    requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('show'));
    });

    // Auto-cerrar después de 4 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

// ============================================================
// VALIDACIÓN DEL FORMULARIO
// ============================================================
function limpiarErrores() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
}

function marcarError(fieldId, mensaje) {
    const campo = document.getElementById(fieldId);
    const errorEl = document.getElementById(`error-${fieldId}`);
    if (campo) campo.classList.add('input-error');
    if (errorEl) errorEl.textContent = mensaje;
}

function validarFormulario() {
    limpiarErrores();
    let esValido = true;

    const cedula  = document.getElementById('cedula').value.trim();
    const nombre  = document.getElementById('nombre').value.trim();
    const correo  = document.getElementById('correo').value.trim();

    // Cédula obligatoria y con formato venezolano V/E/J
    if (!cedula) {
        marcarError('cedula', 'La cédula es obligatoria.');
        esValido = false;
    } else if (!/^[VEJvej]-?\d{5,10}$/.test(cedula.replace(/\s/g, ''))) {
        marcarError('cedula', 'Formato inválido. Ejemplo: V-12345678');
        esValido = false;
    }

    // Nombre obligatorio
    if (!nombre) {
        marcarError('nombre', 'El nombre es obligatorio.');
        esValido = false;
    }

    // Correo: validar formato solo si se proporcionó
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        marcarError('correo', 'Ingresa un correo electrónico válido.');
        esValido = false;
    }

    return esValido;
}

// ============================================================
// GUARDAR PROFESOR
// ============================================================
document.getElementById('formProfesor').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita recarga de página

    if (!validarFormulario()) return;

    // Deshabilitar botón para evitar envíos duplicados
    const btn = document.getElementById('btnGuardar');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Guardando...';

    const datos = {
        cedula:          document.getElementById('cedula').value.trim(),
        nombre:          document.getElementById('nombre').value.trim(),
        telefono:        document.getElementById('telefono').value.trim(),
        correo:          document.getElementById('correo').value.trim(),
        fecha_ingreso:   document.getElementById('fecha_ingreso').value,
        id_sede:         document.getElementById('id_sede').value,
        id_pnf:          document.getElementById('id_pnf').value,
        titulo_pregrado: document.getElementById('titulo_pregrado').value.trim(),
        especialidad:    document.getElementById('especialidad').value.trim(),
        maestria:        document.getElementById('maestria').value.trim(),
        doctorado:       document.getElementById('doctorado').value.trim(),
        programa:        document.getElementById('programa').value.trim(),
        condicion:       document.getElementById('condicion').value,
        categoria:       document.getElementById('categoria').value,
        dedicacion:      document.getElementById('dedicacion').value,
        proyecto:        document.getElementById('proyecto').value.trim(),
        observaciones:   document.getElementById('observaciones').value.trim()
    };

    try {
        const resultado = await window.baseDatos.registrarProfesor(datos);

        if (resultado.exito) {
            showToast('Profesor registrado correctamente.', 'success');
            document.getElementById('formProfesor').reset();
            cargarTabla();
        } else {
            showToast('Error al guardar: ' + resultado.error, 'error');
        }
    } catch (err) {
        // Captura errores inesperados de la promesa (ej: fallo de IPC)
        showToast('Error inesperado: ' + err.message, 'error');
    } finally {
        // Siempre re-habilitar el botón
        btn.disabled = false;
        btn.innerHTML = '<span>💾</span> Guardar Profesor';
    }
});

// ============================================================
// CARGAR TABLA
// ============================================================
async function cargarTabla() {
    const btnCargar = document.getElementById('btnCargar');
    const tbody = document.getElementById('tablaProfesores');

    btnCargar.disabled = true;
    btnCargar.innerHTML = '<span>⏳</span> Cargando...';
    tbody.innerHTML = '';

    try {
        const resultado = await window.baseDatos.obtenerProfesores();

        if (!resultado.exito) {
            showToast('Error al cargar la tabla: ' + resultado.error, 'error');
            return;
        }

        if (resultado.profesores.length === 0) {
            // Estado vacío seguro (sin usuario data, no hay riesgo XSS)
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;

            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-state';

            const iconDiv = document.createElement('div');
            iconDiv.className = 'empty-state-icon';
            iconDiv.textContent = '📋';

            const p = document.createElement('p');
            p.textContent = 'No hay profesores registrados aún.';

            emptyDiv.appendChild(iconDiv);
            emptyDiv.appendChild(p);
            td.appendChild(emptyDiv);
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        resultado.profesores.forEach(prof => {
            const tr = document.createElement('tr');

            // Usamos textContent en cada celda para prevenir inyección XSS
            const columnas = [
                prof.cedula,
                prof.nombre_completo,
                prof.nombre_area,
                prof.condicion,
                prof.categoria,
                prof.dedicacion
            ];

            columnas.forEach(valor => {
                const td = document.createElement('td');
                td.textContent = valor || 'N/A'; // textContent: seguro contra XSS
                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

    } catch (err) {
        showToast('Error inesperado al cargar datos: ' + err.message, 'error');
    } finally {
        btnCargar.disabled = false;
        btnCargar.innerHTML = '<span>🔄</span> Refrescar';
    }
}

// Cargar tabla al inicio (el script está al final del body, el DOM ya está listo)
cargarTabla();

// Botón refrescar
document.getElementById('btnCargar').addEventListener('click', cargarTabla);