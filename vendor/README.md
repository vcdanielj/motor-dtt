# Bibliotecas incorporadas

El motor usa seis bibliotecas desde `vendor/` mediante dependencias `file:` de npm. Todas se usaban antes de incorporarlas: las importaciones en `src/` y las versiones permanecen iguales. Los directorios contienen el código fuente de revisiones públicas y, cuando la publicación npm lo requiere, los artefactos de distribución de la misma versión.

| Biblioteca | Uso real | Origen | Licencia |
| --- | --- | --- | --- |
| PapaParse 5.5.4 | Lectura de CSV en el worker y en el estado de la aplicación | [mholt/PapaParse, etiqueta 5.5.4](https://github.com/mholt/PapaParse/tree/5.5.4) | [MIT](papaparse/LICENSE) |
| fastest-levenshtein 1.0.16 | Distancia de edición usada por el emparejamiento difuso | [ka-weihe/fastest-levenshtein, revisión 29f25a1](https://github.com/ka-weihe/fastest-levenshtein/tree/29f25a1409e09d703caf6746fa9b3a3230607d91) | [MIT](fastest-levenshtein/LICENSE.md) |
| idb 8.0.3 | Acceso asíncrono a IndexedDB para el aprendizaje local | [jakearchibald/idb, etiqueta v8.0.3](https://github.com/jakearchibald/idb/tree/v8.0.3) | [ISC](idb/LICENSE) |
| JSZip 3.10.1 | Lectura de contenedores XLSX y archivos ZIP locales | [Stuk/jszip, etiqueta v3.10.1](https://github.com/Stuk/jszip/tree/v3.10.1) | [MIT, opción de licencia dual](jszip/LICENSE.markdown) |
| Zustand 4.5.7 | Estado de la interfaz y acciones de corrida | [pmndrs/zustand, etiqueta 4.5.7](https://github.com/pmndrs/zustand/tree/4.5.7) | [MIT](zustand/LICENSE) |
| ExcelJS 4.4.0 | Generación de la plantilla de clientes | [exceljs/exceljs, etiqueta v4.4.0](https://github.com/exceljs/exceljs/tree/v4.4.0) | [MIT](exceljs/LICENSE) |

`package.upstream.json` preserva el manifiesto original de cada proyecto. Para las cuatro bibliotecas nuevas, `package.published.json` preserva además el manifiesto npm de la versión consumida. El `package.json` activo mantiene las rutas de importación y las dependencias de ejecución, y elimina scripts y dependencias de desarrollo del proyecto externo: no se necesitan para consumir sus artefactos desde este repositorio y arrastraban cientos de paquetes ajenos al build. En `fastest-levenshtein`, los archivos `mod.js`, `mod.d.ts` y `esm/` proceden del paquete npm 1.0.16, porque el repositorio fuente publica TypeScript sin esos archivos compilados.

El `.gitignore` de fastest-levenshtein incluye excepciones locales para esos artefactos publicados. En las cuatro bibliotecas añadidas después, el original se conserva como `.gitignore.upstream` para que Git incluya `build/` y `dist/`, necesarios para instalar desde `file:`.

El snapshot de PapaParse conserva código, pruebas y ejemplos del repositorio original. Se excluyó su sitio web `docs/` y el CSV de demostración de 48 MB. En JSZip se excluyó un ZIP de prueba de 23 MB y en ExcelJS un XLSX de prueba de 14 MB; esas pruebas upstream concretas necesitan recuperar sus fixtures para ejecutarse. Ninguno de esos archivos participa en el motor. Los archivos de `vendor/` siguen siendo de sus autores originales. `manifest.json` registra revisiones y hashes de los ejecutables principales; `npm run verify:vendor` comprueba los hashes, avisos de licencia y dependencias locales.

Para actualizar una biblioteca, revisar primero su licencia y compatibilidad, copiar una revisión fija, conservar el aviso de licencia y `package.upstream.json`, regenerar artefactos si aplica, actualizar `manifest.json` y ejecutar `npm ci`, `npm run verify:vendor`, `npm run test` y `npm run build`. El cambio de una revisión upstream no debe presentarse como código original del motor.
