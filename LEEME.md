# Control de Personal — etapas 1 y 2

Búsqueda, filtros e impresión (listados y fichas) sobre los datos del Excel del personal.

## Instalar
1. Copia el contenido de este paquete a la raíz del proyecto, reemplazando `main.js`, `preload.js`,
   `index.html`, `renderer.js` y `package.json`.
2. Agrega al final de tu `.gitignore` lo que hay en `gitignore-agregar.txt`.
3. Ejecuta:  `npm install`  y luego  `npm test`  y  `npm start`.

## Primer uso
1. Abre la aplicación y pulsa **Importar Excel…**; elige `DATA_DE_PNF_2026.xlsx`.
2. Lee el resumen y, si hay avisos, **Ver informe de avisos** (cédulas repetidas, fechas ilegibles, etc.).
   Se puede importar de nuevo cuando quieras sin duplicar datos.

## Uso diario
- **Buscar:** escribe nombre, cédula, correo o teléfono (sin importar tildes ni mayúsculas).
- **Filtrar:** período, PNF, sede, condición, categoría y dedicación.
- **Imprimir:** marca personas (la selección se conserva entre búsquedas) o no marques nada para
  imprimir toda la lista. Elige **listado** o **fichas**, directo a la impresora o **en PDF**.
- **Datos a incluir:** nombre, cédula, teléfono y correo siempre van; el resto se elige con casillas
  (se recuerda la elección).
- Haz clic en un nombre para ver su ficha completa.

## Dónde quedan los datos
La base de datos (`personal.db`) se guarda en la carpeta de datos de la aplicación del usuario
(no dentro del proyecto), así que no se sube a GitHub por accidente.

## Estructura
- `main.js`, `preload.js`, `index.html`, `renderer.js`: la aplicación
- `src/`: normalización, esquema, importador, consultas e impresión
- `scripts/importar-cli.js`: importar por línea de comandos (`--solo-revisar` no toca la base de datos)
- `tests/`: pruebas automáticas
