# Sistema de Gestión de Personal — PROPEEP

Dirección General de Proyectos Estratégicos y Especiales de la Presidencia · Dirección de RR.HH.

## Estructura
- `index.html` — estructura de la aplicación
- `css/styles.css` — sistema de diseño completo
- `js/config.js` — credenciales (ofuscadas) y logo
- `js/nomina.js` — **nómina del mes (sustituir mensualmente)**
- `js/auth.js` — login, roles y sesión persistente (30 min deslizantes)
- `js/acciones.js` — acciones de personal, carga masiva, histórico y resumen
- `js/certificaciones.js` — certificaciones, su histórico y PDFs
- `js/isr.js` — calculadora ISR
- `js/regalia.js` — regalía pascual
- `js/init.js` — arranque y restauración de sesión

## Despliegue
Push a GitHub. El orden de los `<script>` en `index.html` es obligatorio.

**Versión:** v0.02
