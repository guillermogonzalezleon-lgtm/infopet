# Infopet — Prompt para Claude Code CLI
## Ejecución autónoma Fases 1→4 con agentes en paralelo

---

## ⚡ COMANDO DE INICIO RÁPIDO

Pega esto directo en la terminal dentro del repo `infopet/`:

```bash
cd ~/infopet
claude --dangerously-skip-permissions
```

Luego pega el prompt maestro de abajo.

> ⚠️ Usar solo dentro de un directorio aislado del proyecto.
> Nunca en la raíz del sistema ni con archivos críticos en scope.

---

## 📋 PROMPT MAESTRO — Pegar completo en Claude Code

```
Eres el arquitecto técnico del proyecto Infopet. Tu misión es implementar
las Fases 1 a 4 de forma autónoma y en paralelo donde sea posible.

NO me pidas confirmación para acciones de desarrollo estándar.
NO preguntes "¿Puedo continuar?" entre pasos.
NO esperes "ok" para avanzar entre fases.
SÍ avisa solo si encuentras un error bloqueante real que no puedas resolver solo.

Trabaja con máxima autonomía. Si tienes dudas menores, elige la opción
más razonable y documenta tu decisión en un comentario en el código.

════════════════════════════════════════════════════════════
CONTEXTO DEL PROYECTO
════════════════════════════════════════════════════════════

Infopet es una tienda de mascotas en Viña del Mar que usa:
- Bsale (ERP/POS) → API REST con token en .env
- Jumpseller (e-commerce, 910 productos) → API REST con login+token en .env
- Google Sheets (Carga Maestra de productos) → Service Account en .env
- Google Drive (archivos y facturas) → misma Service Account
- Gmail → automatizaciones de notificaciones
- Mercado Pago → pagos físicos y web

Stack técnico:
- Frontend: HTML + CSS + JS vanilla (sin frameworks)
- Deploy: Vercel (automático desde GitHub en cada git push)
- Backend: Vercel Serverless Functions (carpeta /api)
- Sin servidor propio

════════════════════════════════════════════════════════════
ESTRUCTURA DE ARCHIVOS A CREAR
════════════════════════════════════════════════════════════

infopet/
├── CLAUDE.md                  ← instrucciones para futuros agentes
├── .env.example               ← template de variables (nunca .env real)
├── vercel.json                ← config deploy y rewrites
├── index.html                 ← dashboard principal
├── stock-dashboard.html       ← semáforo de compras
├── jumpseller-bulk.html       ← carga masiva CSV
├── carga-producto.html        ← formulario carga única
├── facturas.html              ← módulo OCR facturas
├── sync-stock.html            ← comparador stock Bsale vs Jumpseller
├── api/
│   ├── bsale.js               ← proxy Bsale
│   ├── jumpseller.js          ← proxy Jumpseller
│   ├── sheets.js              ← append Google Sheets
│   ├── drive.js               ← upload Google Drive
│   ├── ocr.js                 ← Claude Vision para facturas
│   ├── sync.js                ← sincronización de stock
│   └── gmail.js               ← envío de emails automáticos
└── assets/
    ├── style.css              ← variables CSS compartidas
    └── utils.js               ← funciones compartidas

════════════════════════════════════════════════════════════
FASE 1 — FUNDACIONES (ejecutar primero, bloquea las demás)
════════════════════════════════════════════════════════════

Tareas de la Fase 1:
1. Crear CLAUDE.md con el contexto del proyecto para futuros agentes
2. Crear .env.example con todas las variables necesarias documentadas
3. Crear/validar vercel.json con rewrites y headers de seguridad
4. Crear assets/style.css con las variables CSS del sistema de diseño:
   - Paleta: --bg #F7F6F2, --surface #FFFFFF, --border #E5E3DA
   - Texto: --text #1A1A18, --text-muted #7A7A72
   - Acento: --accent #2D6A4F, --accent-light #D8EDDF
   - Tipografía: Syne (headings), DM Sans (body), DM Mono (código)
5. Crear assets/utils.js con funciones:
   - fmt(n) → formatea número como $X.XXX CLP
   - sleep(ms) → Promise
   - showAlert(el, type, msg) → ok/err/warn/info
   - autoSKU(name) → genera SKU desde nombre
6. Validar que api/bsale.js existe y tiene el proxy correcto
7. Hacer git commit de la Fase 1

════════════════════════════════════════════════════════════
FASE 2 — CARGA DE PRODUCTOS (iniciar en paralelo con Fase 3)
════════════════════════════════════════════════════════════

Tareas de la Fase 2 (pueden ejecutarse mientras corre la Fase 3):

AGENTE 2A — api/jumpseller.js:
Crear Vercel Function proxy para Jumpseller API.
Base URL: https://api.jumpseller.com/v1
Auth: query params login= y authtoken=
Endpoints a soportar: products, orders, categories, stock
Headers: Cache-Control s-maxage=60
Manejar errores con mensajes descriptivos en español.

AGENTE 2B — api/sheets.js:
Crear Vercel Function para append a Google Sheets.
Usar Google Service Account desde env GOOGLE_SERVICE_ACCOUNT_JSON.
Sheet ID desde env GOOGLE_SHEETS_ID.
Operación principal: appendRow(values[]) al final de la Carga Maestra.
Columnas a appendar en orden: Clasificación, Tipo, Nombre, Variante,
Marca, Permite Decimal, Código Barra, SKU, Precio Costo, Precio Venta.

AGENTE 2C — carga-producto.html:
Crear formulario de carga única con el estilo del dashboard existente.
Campos: Nombre*, SKU (auto si vacío), Precio CLP*, Stock, Categoría*,
Marca, Variante, Código Barra EAN, Descripción web, Clasificación.
Al guardar, hacer POST en paralelo a:
  - /api/bsale → crea producto en Bsale
  - /api/jumpseller → crea producto en Jumpseller
  - /api/sheets → append a Carga Maestra
Mostrar barra de progreso mientras los 3 procesos corren en paralelo.
Si alguno falla, mostrar cuál falló sin cancelar los otros.
Al terminar, mostrar resumen: ✓ Bsale | ✓ Jumpseller | ✓ Sheets

Al terminar Fase 2: git commit con mensaje "feat: fase 2 carga productos"

════════════════════════════════════════════════════════════
FASE 3 — FACTURAS Y COMPRAS (paralela con Fase 2)
════════════════════════════════════════════════════════════

Tareas de la Fase 3 (corren en paralelo con Fase 2):

AGENTE 3A — api/ocr.js:
Crear Vercel Function para OCR de facturas físicas.
Recibe: { image: "base64string", mediaType: "image/jpeg" }
Llama a Anthropic API (claude-sonnet-4-6) con la imagen.
System prompt que pide extraer en JSON:
{
  "rut_proveedor": "",
  "numero_factura": "",
  "fecha": "YYYY-MM-DD",
  "proveedor_nombre": "",
  "proveedor_giro": "",
  "productos": [
    {
      "nombre": "",
      "variante": "",
      "cantidad": 0,
      "precio_unitario": 0,
      "codigo_barra": "",
      "sku": ""
    }
  ],
  "subtotal": 0,
  "iva": 0,
  "total": 0
}
Responder solo con JSON válido, sin texto adicional.
Usar env ANTHROPIC_API_KEY.

AGENTE 3B — api/drive.js:
Crear Vercel Function para subir archivos a Google Drive.
Recibe: { file: base64, filename: string, mimeType: string }
Sube a carpeta env GOOGLE_DRIVE_FOLDER_ID.
Nombre del archivo: "FACTURA_{rut}_{fecha}_{numero}.jpg"
Retorna: { id, webViewLink }

AGENTE 3C — facturas.html:
Crear módulo de facturas con dos flujos:
FLUJO A (80% - digital): Lista facturas de Bsale API con estado
  "azul" (digital, descargable) vs "gris" (no descargable).
  Al seleccionar una, extrae las líneas de productos via Bsale API
  y muestra tabla pre-llenada para confirmar y cargar.
FLUJO B (20% - física): Upload de foto desde celular o computador.
  Llama a /api/ocr con la imagen en base64.
  Muestra spinner mientras procesa.
  Rellena formulario con los datos extraídos (editable).
  Al confirmar: guarda en Drive + carga productos en Bsale + Sheets.
Diseño: mismo estilo dark que el dashboard de compras.

Al terminar Fase 3: git commit con mensaje "feat: fase 3 facturas y ocr"

════════════════════════════════════════════════════════════
FASE 4 — SYNC Y AUTOMATIZACIONES (ejecutar al terminar 2 y 3)
════════════════════════════════════════════════════════════

AGENTE 4A — api/sync.js:
Crear Vercel Function que compara stock entre Bsale y Jumpseller.
GET /api/sync?action=compare → retorna array de diferencias:
[{ sku, nombre, stock_bsale, stock_jumpseller, diferencia }]
GET /api/sync?action=fix&sku=XXX → actualiza Jumpseller con el stock de Bsale
Para actualizar stock en Jumpseller usar:
PUT https://api.jumpseller.com/v1/products/{id}/variants/{vid}/stock.json

AGENTE 4B — api/gmail.js:
Crear Vercel Function para envío de emails.
Usar Gmail API con OAuth2 (credenciales en env).
Endpoints:
- POST /api/gmail { to, subject, html } → envía email
- POST /api/gmail { type: "stock_alert" } → email con productos urgentes
- POST /api/gmail { type: "orden_compra", productos: [] } → OC al proveedor
Template HTML para cada tipo de email, con el logo de Infopet.

AGENTE 4C — sync-stock.html:
Dashboard comparador Bsale vs Jumpseller.
Tabla con 3 columnas: Producto | Stock Bsale | Stock Jumpseller | Diferencia.
Semáforo: verde (igual), amarillo (±5%), rojo (diferencia >5%).
Botón "Sincronizar todo" → llama a /api/sync?action=fix para cada diferencia.
Botón "Enviar alerta stock" → llama a /api/gmail con stock crítico.
Actualización automática cada 5 minutos.

AGENTE 4D — Actualizar index.html:
Agregar widget de sincronización al dashboard principal.
Mostrar: "Última sync: hace X minutos" con dot verde/rojo.
Botón rápido "Sincronizar ahora".
Agregar sección de emails enviados hoy.

Al terminar Fase 4: git commit con mensaje "feat: fase 4 sync y automatizaciones"
Hacer git push origin main → esto dispara el deploy en Vercel automáticamente.

════════════════════════════════════════════════════════════
REGLAS GENERALES PARA TODOS LOS AGENTES
════════════════════════════════════════════════════════════

DISEÑO (todos los HTML deben seguir esto):
- Fuentes: Syne para headings, DM Sans para body, DM Mono para código/monospace
- Importar desde Google Fonts en cada archivo HTML
- Usar variables de style.css (ya creado en Fase 1)
- Paleta: fondo #F7F6F2, superficie blanca, acento verde #2D6A4F
- Bordes suaves, border-radius 12-14px, transiciones 0.2s
- Responsive mobile-first
- Misma navbar que index.html en todos los módulos

CÓDIGO:
- Cada Vercel Function debe tener manejo de errores completo
- Siempre retornar mensajes de error en español
- Cache headers apropiados en cada endpoint
- CORS headers en todas las Functions
- Nunca loguear tokens ni credenciales
- Usar process.env.VARIABLE para todas las credenciales

SEGURIDAD:
- El .env.example documenta todas las variables pero con valores vacíos
- Nunca hardcodear tokens en el código
- Validar el método HTTP en cada Function (rechazar si no es el esperado)
- Lista blanca de endpoints permitidos en el proxy de Bsale

GIT:
- Commit al terminar cada fase
- Mensaje de commit descriptivo en español
- Push al final de la Fase 4

════════════════════════════════════════════════════════════
ORDEN DE EJECUCIÓN
════════════════════════════════════════════════════════════

1. Ejecutar Fase 1 completa (bloquea todo lo demás)
2. Cuando Fase 1 esté done: lanzar Fase 2 y Fase 3 EN PARALELO
   - Fase 2 corre sus 3 agentes (2A, 2B, 2C) en paralelo
   - Fase 3 corre sus 3 agentes (3A, 3B, 3C) en paralelo
3. Cuando AMBAS Fase 2 y Fase 3 estén done: ejecutar Fase 4
   - Fase 4 corre sus 4 agentes (4A, 4B, 4C, 4D) en paralelo
4. Al terminar todo: git push origin main

════════════════════════════════════════════════════════════
DEFINICIÓN DE "TERMINADO"
════════════════════════════════════════════════════════════

El proyecto está completo cuando:
- [ ] CLAUDE.md existe y documenta el proyecto
- [ ] .env.example tiene todas las variables documentadas
- [ ] vercel.json está configurado correctamente
- [ ] assets/style.css y assets/utils.js existen
- [ ] /api/bsale.js proxy funciona (Fase 1)
- [ ] /api/jumpseller.js proxy funciona (Fase 2)
- [ ] /api/sheets.js append funciona (Fase 2)
- [ ] carga-producto.html dispara a 3 sistemas (Fase 2)
- [ ] /api/ocr.js extrae datos de facturas (Fase 3)
- [ ] /api/drive.js sube archivos (Fase 3)
- [ ] facturas.html tiene flujo A y B (Fase 3)
- [ ] /api/sync.js compara y sincroniza stock (Fase 4)
- [ ] /api/gmail.js envía los 3 tipos de email (Fase 4)
- [ ] sync-stock.html muestra comparador (Fase 4)
- [ ] index.html tiene widget de sync (Fase 4)
- [ ] git push origin main ejecutado

Empieza ahora con la Fase 1. No esperes instrucciones adicionales.
```
