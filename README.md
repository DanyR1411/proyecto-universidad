# 🎓 Sistema de Control de Profesores

Aplicación de escritorio para la gestión y control del personal docente universitario, desarrollada con **Electron**, **HTML/CSS/JS** y **SQLite**.

---

## 📋 Descripción

Esta aplicación permite registrar, consultar y gestionar la información de los profesores de una institución universitaria, incluyendo:

- Datos personales (cédula, nombre, teléfono, correo, fecha de ingreso)
- Datos académicos (pregrado, especialidad, maestría, doctorado, programa, área PNF)
- Datos laborales (condición, categoría, dedicación, sede, proyecto)

---

## 🛠️ Tecnologías utilizadas

| Tecnología | Versión | Rol |
|---|---|---|
| [Electron](https://www.electronjs.org/) | ^33.0.0 | Framework de escritorio |
| [Node.js](https://nodejs.org/) | ≥ 18.x | Entorno de ejecución |
| [SQLite3](https://github.com/TryGhost/node-sqlite3) | ^6.0.1 | Base de datos local |
| HTML / CSS / JS | — | Interfaz de usuario |

---

## 🚀 Instalación y ejecución

### Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- npm (incluido con Node.js)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/proyecto-universidad.git
cd proyecto-universidad

# 2. Instalar dependencias
npm install

# 3. Iniciar la aplicación
npm start
```

> **Nota:** La base de datos SQLite (`control_profesores.db`) se crea automáticamente la primera vez que se ejecuta la aplicación. No es necesario configurarla manualmente.

---

## 📁 Estructura del proyecto

```
proyecto-universidad/
├── main.js          # Proceso principal de Electron (lógica de BD e IPC)
├── preload.js       # Puente seguro entre el proceso principal y el renderer
├── renderer.js      # Lógica del frontend (validación, UI, llamadas IPC)
├── index.html       # Interfaz de usuario
├── package.json     # Configuración del proyecto y dependencias
└── .gitignore       # Archivos excluidos del repositorio
```

---

## 🔒 Seguridad

La aplicación implementa las siguientes medidas de seguridad de Electron:

- **`contextIsolation: true`** — El contexto del renderer está aislado del proceso principal.
- **`nodeIntegration: false`** — El renderer no tiene acceso directo a las APIs de Node.js.
- **`contextBridge`** — Solo se exponen al renderer las funciones estrictamente necesarias.
- **XSS Prevention** — Los datos de la base de datos se insertan en el DOM mediante `textContent`, nunca con `innerHTML`.

---

## ✨ Funcionalidades

- [x] Registro de profesores con validación de formulario
- [x] Validación de formato de cédula venezolana (V/E/J-XXXXXXXX)
- [x] Validación de formato de correo electrónico
- [x] Listado de profesores en tabla con datos completos
- [x] Notificaciones visuales tipo toast (sin `alert()`)
- [x] Inicialización automática de la base de datos
- [x] Prevención de envíos duplicados

---

## 🗄️ Base de datos

La aplicación usa SQLite con el siguiente esquema:

```sql
-- Sedes de la institución
CREATE TABLE sedes (
    id_sede     INTEGER PRIMARY KEY,
    nombre_sede TEXT NOT NULL
);

-- Áreas del Programa Nacional de Formación
CREATE TABLE areas_pnf (
    id_pnf      INTEGER PRIMARY KEY,
    nombre_area TEXT NOT NULL
);

-- Profesores
CREATE TABLE profesores (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula           TEXT UNIQUE NOT NULL,
    nombre_completo  TEXT NOT NULL,
    telefono         TEXT,
    correo           TEXT,
    fecha_ingreso    TEXT,
    id_sede          INTEGER REFERENCES sedes(id_sede),
    id_pnf           INTEGER REFERENCES areas_pnf(id_pnf),
    titulo_pregrado  TEXT,
    especialidad     TEXT,
    maestria         TEXT,
    doctorado        TEXT,
    programa         TEXT,
    condicion        TEXT,
    categoria        TEXT,
    dedicacion       TEXT,
    proyecto         TEXT,
    observaciones    TEXT
);
```

---

## 📄 Licencia

ISC — consulta el campo `license` en [package.json](./package.json).
