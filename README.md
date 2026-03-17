# Infopet — Transformacion Digital

> Consultoria de transformacion digital para **Infopet**, tienda de productos para mascotas.
> 6 herramientas sin integracion → 1 panel centralizado con APIs conectadas.

---

## Tabla de Contenidos

- [Ecosistema Mapeado](#-ecosistema-mapeado)
- [Problemas Detectados](#-problemas-detectados-antesd espues)
- [Stack Tecnico](#-stack-tecnico)
- [Estructura del Repositorio](#-estructura-del-repositorio)
- [Instalacion](#-instalacion)
- [Variables de Entorno](#-variables-de-entorno)
- [Modulos](#-modulos)
  - [stock-dashboard](#stock-dashboard)
  - [jumpseller-bulk](#jumpseller-bulk)
  - [api/bsale.js](#apibsalejs)
  - [api/ocr.js](#apiocrjs)
- [APIs Integradas](#-apis-integradas)
- [Roadmap](#-roadmap)
- [ROI Estimado](#-roi-estimado)
- [Archivos Entregados](#-archivos-entregados)

---

## Ecosistema Mapeado

6 herramientas activas operando en silos. El flujo de datos entre ellas es 100% manual.

| # | Herramienta | Categoria | Funcion | API | Estado |
|---|-------------|-----------|---------|-----|--------|
| 1 | **Bsale** | ERP / POS | Ventas fisicas, facturacion electronica, inventario, punto de venta, clientes y reportes | REST | La mas importante del ecosistema |
| 2 | **Jumpseller** | E-commerce | Tienda online (infopet.jumpseller.com). 910 productos cargados uno a uno. Importacion CSV nativa | REST | Sin sync de stock con Bsale |
| 3 | **Mercado Pago** | Pagos | Cobro online via Jumpseller + cobro fisico con lector en tienda. Doble canal sin reporte unificado | REST | Ingresos web y fisicos se revisan por separado |
| 4 | **Excel / Google Sheets** | Analisis / Datos | "Carga Maestra Actualizada 2025": fuente de verdad manual para productos (Clasificacion, Tipo, Nombre, Variante, Marca, Codigo Barra, SKU, Precios) | Sheets API | Actualizacion manual |
| 5 | **Google Drive** | Archivos / Docs | Repositorio de archivos compartidos. Facturas de proveedores, reportes y documentos varios | REST | Sin estructura definida |
| 6 | **Gmail** | Comunicacion | Comunicacion con clientes y proveedores. Confirmaciones de pedidos y seguimiento manual | API | Sin automatizaciones activas |

---

## Problemas Detectados (Antes/Despues)

Levantados directamente en la tienda con evidencia fotografica y observacion del flujo de trabajo real.

| # | Problema | Impacto | Antes | Despues | Mejora |
|---|----------|---------|-------|---------|--------|
| 1 | **Triple ingreso de productos** (Carga Maestra → Bsale → Jumpseller) | 50% del tiempo del gerente | 20 min por producto, ingreso manual en 3 sistemas | 2 min por producto, 1 formulario → 3 sistemas simultaneos | **-90%** tiempo |
| 2 | **Facturas de proveedor sin digitalizar** (80% digital no descargable, 20% papel) | 5h perdidas/semana | 25 min por factura fisica: leer, transcribir, ingresar en 3 sistemas | Foto desde celular → OCR → formulario pre-llenado → confirmar | **-85%** tiempo |
| 3 | **Stock fisico desincronizado del stock web** (Bsale y Jumpseller no se comunican) | Riesgo diario de sobreventa | Venta en tienda no descuenta stock en Jumpseller. Precios pueden diferir | Webhook Bsale → Vercel → actualiza Jumpseller. Dashboard comparativo | **0** sobreventas |
| 4 | **Sin visibilidad de stock critico para compras** (no existe sistema que indique que comprar) | $M en quiebres de stock | Decision de compra basada en memoria o revision manual | Dashboard semaforo + orden de compra en 1 clic | **1 clic** para OC |
| 5 | **Datos en Excel sin conexion en tiempo real** (reportes actualizados manualmente) | 3h semanales | Exportar Bsale → pegar en Excel → subir a Drive cada vez | Dashboard en vivo conectado a Bsale API, sin exportar | **0h** reportes |

---

## Stack Tecnico

```
Arquitectura sin servidor propio
HTML · CSS · JS vanilla → Vercel → APIs externas
Mismo stack de voy-app-3. Cero infraestructura a mantener.
```

### Diagrama de flujo de datos

```
                          ┌─────────────────┐
                          │   GitHub Repo    │
                          │  (CI/CD: push    │
                          │   = deploy)      │
                          └────────┬─────────┘
                                   │ auto-deploy
                                   ▼
┌──────────┐  API REST   ┌─────────────────┐   API REST   ┌─────────────┐
│          │◄────────────►│                 │◄────────────►│             │
│  Bsale   │             │  Vercel          │             │  Jumpseller  │
│  (POS)   │  ──────────►│  Functions       │◄──────────  │  (E-comm)    │
│          │  Webhook     │  (Proxy seguro)  │  CSV export │             │
└──────────┘             │                 │             └─────────────┘
                          │  ┌───────────┐  │
                          │  │ Infopet   │  │
                          │  │ App       │  │
                          │  │ HTML/CSS  │  │
                          │  │ JS vanilla│  │
                          │  └───────────┘  │
                          └──┬──────────┬───┘
                             │          │
                    ┌────────▼──┐  ┌────▼────────┐
                    │ Google    │  │   Gmail      │
                    │ Sheets    │  │   API        │
                    │ (Carga    │  │ (Alertas,    │
                    │ Maestra)  │  │  OC, confirm)│
                    └───────────┘  └─────────────┘
```

### Tecnologias

| Componente | Tecnologia |
|------------|------------|
| Frontend | HTML · CSS · JS vanilla |
| Deploy | Vercel (deploy automatico desde GitHub) |
| Repositorio | GitHub (CI/CD · `git push` = deploy) |
| ERP/POS | Bsale REST API |
| E-commerce | Jumpseller REST API |
| Datos | Google Drive + Sheets API |
| OCR | Claude Vision API (facturas fisicas) |
| Webhooks | Make / Zapier |

---

## Estructura del Repositorio

```
infopet/
├── index.html                  # Dashboard principal
├── stock-dashboard.html        # Dashboard semaforo de compras
├── jumpseller-bulk.html        # App carga masiva CSV Jumpseller
├── propuesta.html              # Propuesta de transformacion digital
├── README.md                   # Este archivo
│
├── api/
│   ├── bsale.js                # Proxy Vercel → Bsale API (todos los endpoints)
│   └── ocr.js                  # Claude Vision API para OCR de facturas
│
├── css/
│   └── styles.css              # Estilos compartidos
│
├── js/
│   ├── app.js                  # Logica principal del dashboard
│   ├── stock.js                # Logica del dashboard de stock/compras
│   ├── jumpseller-bulk.js      # Logica de carga masiva Jumpseller
│   └── utils.js                # Utilidades compartidas
│
├── vercel.json                 # Configuracion Vercel (rewrites, env)
├── package.json                # Metadata del proyecto
└── .env                        # Variables de entorno (NO commitear)
```

---

## Instalacion

### Requisitos previos

- [Node.js](https://nodejs.org/) >= 18
- [Vercel CLI](https://vercel.com/cli): `npm i -g vercel`
- Cuenta en [Vercel](https://vercel.com)
- Credenciales API de Bsale y Jumpseller

### Paso a paso

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/infopet.git
cd infopet

# 2. Instalar dependencias (si aplica)
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con las credenciales reales (ver seccion Variables de Entorno)

# 4. Desarrollo local
vercel dev

# 5. Deploy a produccion
vercel --prod
```

---

## Variables de Entorno

| Variable | Descripcion | Donde obtenerla |
|----------|-------------|-----------------|
| `BSALE_TOKEN` | Token de acceso API Bsale | Panel Bsale → Configuracion → API → Generar token |
| `JUMPSELLER_LOGIN` | Email de la cuenta Jumpseller | Email de login en jumpseller.com |
| `JUMPSELLER_AUTH_TOKEN` | Token de autenticacion API | Jumpseller → Admin → Apps → API credentials |
| `GOOGLE_SHEETS_ID` | ID de la hoja de Carga Maestra | URL de la hoja: `docs.google.com/spreadsheets/d/{ID}/edit` |
| `GOOGLE_SERVICE_ACCOUNT` | JSON de service account Google | Google Cloud Console → IAM → Service Accounts → Crear clave JSON |
| `ANTHROPIC_API_KEY` | API key de Claude (para OCR) | console.anthropic.com → API Keys |
| `GMAIL_CLIENT_ID` | Client ID para Gmail API | Google Cloud Console → APIs → OAuth 2.0 Credentials |
| `GMAIL_CLIENT_SECRET` | Client Secret para Gmail API | Google Cloud Console → APIs → OAuth 2.0 Credentials |

### Configurar en Vercel

```bash
# Agregar cada variable
vercel env add BSALE_TOKEN
vercel env add JUMPSELLER_LOGIN
vercel env add JUMPSELLER_AUTH_TOKEN
# ... etc
```

---

## Modulos

### stock-dashboard

**Archivo:** `stock-dashboard.html`

Dashboard de stock con semaforo de urgencia de compras. Conectado a Bsale API.

| Estado | Condicion | Accion |
|--------|-----------|--------|
| 🔴 Urgente | Stock = 0 o < 50% del minimo | Orden de compra sugerida, entrega en 3 dias |
| 🟡 Posible | Stock entre 50% y 120% del minimo | Planificar para esta semana, entrega en 7 dias |
| 🟢 Full | Stock sobre el nivel ideal | Sin accion requerida |

**Como conectar a Bsale real:**

1. Configurar `BSALE_TOKEN` en las variables de entorno de Vercel
2. El proxy `api/bsale.js` redirige las peticiones a `https://api.bsale.cl/v1/`
3. El dashboard llama a `/api/bsale?endpoint=stocks.json` para obtener stock en tiempo real
4. Los umbrales de semaforo se configuran por producto (stock minimo, stock ideal)
5. El generador de orden de compra calcula: `cantidad_a_pedir = stock_ideal - stock_actual`
6. Exporta la OC a CSV listo para enviar al proveedor

---

### jumpseller-bulk

**Archivo:** `jumpseller-bulk.html`

App HTML standalone que genera el CSV en el formato exacto de importacion de Jumpseller. Corre 100% en el navegador.

**Mapeo de columnas de la Carga Maestra:**

| Columna Carga Maestra | Columna Jumpseller CSV | Notas |
|------------------------|------------------------|-------|
| Nombre | `Name` | Nombre del producto |
| SKU | `SKU` | Codigo unico |
| Precio | `Price` | Precio de venta |
| Clasificacion | `Categories` | Categoria en Jumpseller |
| Marca | `Brand` | Marca del producto |
| Codigo Barra | `Barcode` | EAN/UPC |
| Variante | `Option1 Value` | Talla, peso, etc. |
| — | `Stock` | Se rellena segun Bsale |
| — | `Status` | `available` por defecto |
| — | `Description` | Descripcion web del producto |

**Flujo:**

1. **Conectar API** — Login + Auth Token de Jumpseller (credenciales nunca salen del navegador)
2. **Subir Carga Maestra** — Arrastra el CSV de Google Sheets. Auto-detecta columnas
3. **Precheck** — Tabla editable con estado OK / Warning / Error. Filtros y busqueda
4. **Exportar CSV** — CSV con las columnas exactas de Jumpseller, listo para importar

---

### api/bsale.js

Vercel Serverless Function que actua como proxy seguro hacia la API de Bsale. El token nunca se expone al frontend.

**Endpoints disponibles:**

| Metodo | Ruta | Bsale API | Descripcion |
|--------|------|-----------|-------------|
| GET | `/api/bsale?endpoint=products.json` | `GET /v1/products.json` | Listar productos |
| GET | `/api/bsale?endpoint=products/{id}.json` | `GET /v1/products/{id}.json` | Detalle de producto |
| GET | `/api/bsale?endpoint=stocks.json` | `GET /v1/stocks.json` | Consultar stock |
| GET | `/api/bsale?endpoint=price_lists.json` | `GET /v1/price_lists.json` | Listas de precios |
| GET | `/api/bsale?endpoint=documents.json` | `GET /v1/documents.json` | Documentos (facturas) |
| GET | `/api/bsale?endpoint=product_types.json` | `GET /v1/product_types.json` | Categorias |
| POST | `/api/bsale?endpoint=products.json` | `POST /v1/products.json` | Crear producto |
| PUT | `/api/bsale?endpoint=products/{id}.json` | `PUT /v1/products/{id}.json` | Actualizar producto |
| PUT | `/api/bsale?endpoint=stocks.json` | `PUT /v1/stocks.json` | Actualizar stock |

**Ejemplo de uso desde el frontend:**

```javascript
const res = await fetch('/api/bsale?endpoint=products.json&limit=50&offset=0');
const data = await res.json();
// data.items → array de productos
```

---

### api/ocr.js

Vercel Serverless Function que recibe una imagen de factura y devuelve datos estructurados usando Claude Vision API.

**Request:**

```javascript
POST /api/ocr
Content-Type: multipart/form-data

// Body: imagen de la factura (JPG, PNG, PDF)
```

**Estructura del JSON que devuelve:**

```json
{
  "success": true,
  "data": {
    "proveedor": {
      "nombre": "Distribuidora PetFood Ltda.",
      "rut": "76.123.456-7",
      "direccion": "Av. Los Leones 1234, Providencia"
    },
    "factura": {
      "numero": "F-00012345",
      "fecha": "2026-03-15",
      "tipo": "Factura Electronica"
    },
    "lineas": [
      {
        "codigo": "SKU-001",
        "descripcion": "Royal Canin Medium Adult 15kg",
        "cantidad": 10,
        "precio_unitario": 45990,
        "total": 459900
      }
    ],
    "totales": {
      "neto": 459900,
      "iva": 87381,
      "total": 547281
    }
  },
  "confidence": 0.94
}
```

---

## APIs Integradas

### Bsale API

| Dato | Valor |
|------|-------|
| **Base URL** | `https://api.bsale.cl/v1/` |
| **Autenticacion** | Header `access_token: {BSALE_TOKEN}` |
| **Documentacion** | [api.bsale.cl](https://api.bsale.cl) |
| **Endpoints clave** | `products.json`, `stocks.json`, `documents.json`, `price_lists.json`, `product_types.json` |
| **Rate limit** | 120 requests/min |

### Jumpseller API

| Dato | Valor |
|------|-------|
| **Base URL** | `https://api.jumpseller.com/v1/` |
| **Autenticacion** | Query params `login={EMAIL}&authtoken={TOKEN}` |
| **Documentacion** | [jumpseller.com/support/api](https://jumpseller.com/support/api) |
| **Endpoints clave** | `products.json`, `categories.json`, `orders.json` |
| **Rate limit** | 120 requests/min |

### Google Sheets API

| Dato | Valor |
|------|-------|
| **Base URL** | `https://sheets.googleapis.com/v4/spreadsheets/` |
| **Autenticacion** | Service Account (OAuth2 JWT) |
| **Documentacion** | [developers.google.com/sheets/api](https://developers.google.com/sheets/api) |
| **Operacion principal** | `append` — agregar filas a la Carga Maestra |

### Gmail API

| Dato | Valor |
|------|-------|
| **Base URL** | `https://gmail.googleapis.com/gmail/v1/` |
| **Autenticacion** | OAuth 2.0 |
| **Documentacion** | [developers.google.com/gmail/api](https://developers.google.com/gmail/api) |
| **Uso** | Confirmaciones de pedido, alertas de stock critico, ordenes de compra automaticas |

### Claude Vision API (OCR)

| Dato | Valor |
|------|-------|
| **Base URL** | `https://api.anthropic.com/v1/messages` |
| **Autenticacion** | Header `x-api-key: {ANTHROPIC_API_KEY}` |
| **Modelo** | `claude-sonnet-4-20250514` |
| **Uso** | Extraccion OCR de facturas fisicas (foto → JSON estructurado) |

---

## Roadmap

8 semanas. 5 soluciones. Implementacion incremental — cada fase entrega valor inmediato.

**Leyenda:** ✅ Completado · 🔧 En desarrollo · ⬜ Pendiente

### Fase 1 — Fundaciones (Semanas 1–2)

| Tarea | Estado |
|-------|--------|
| Repositorio GitHub configurado | ✅ |
| Deploy en Vercel conectado | ✅ |
| Proxy Bsale API funcionando | ✅ |
| Dashboard principal (`index.html`) | ✅ |
| Credenciales API Jumpseller obtenidas | ✅ |
| Variables de entorno configuradas | ✅ |

### Fase 2 — Carga de productos (Semanas 3–4)

| Tarea | Estado |
|-------|--------|
| Formulario carga unica funcionando | ✅ |
| Precheck Dashboard (tabla editable OK/Warning/Error) | ✅ |
| POST a Bsale + Jumpseller simultaneo | 🔧 |
| Append a Google Sheets (Carga Maestra) | 🔧 |
| App CSV Jumpseller con precheck | ✅ |
| Mapeo automatico de columnas | ✅ |
| Capacitacion al equipo | ⬜ |

### Fase 3 — OCR facturas + Dashboard compras (Semanas 5–6)

| Tarea | Estado |
|-------|--------|
| Claude Vision API para facturas fisicas | 🔧 |
| Flujo factura digital desde Bsale API | 🔧 |
| Archivado en Drive con nombre estructurado (`FACTURA_RUT_FECHA.jpg`) | 🔧 |
| Dashboard semaforo stock | ✅ |
| Generador de orden de compra | ✅ |
| Exportar OC a CSV para proveedores | ✅ |

### Fase 4 — Sync stock + Gmail (Semanas 7–8)

| Tarea | Estado |
|-------|--------|
| Webhook Bsale → actualiza Jumpseller stock | ⬜ |
| Comparador stock fisico vs web | 🔧 |
| Alertas automaticas de desincronizacion | ⬜ |
| Gmail: confirmaciones pedidos automaticas | 🔧 |
| Gmail: alerta stock critico semanal | 🔧 |
| Documentacion + entrega final | ⬜ |

---

## ROI Estimado

| Metrica | Antes | Despues | Ahorro |
|---------|-------|---------|--------|
| **Tiempo carga de productos** | 20 min/producto × 3 sistemas | 2 min/producto × 1 formulario | **20h semanales** recuperadas |
| **Procesamiento facturas** | 25 min/factura fisica manual | Foto → OCR → confirmar (3 min) | **5h semanales** recuperadas |
| **Riesgo sobreventa online** | Sin control (stock desincronizado) | Sync automatico Bsale ↔ Jumpseller | **0 sobreventas** |
| **Decisiones de compra** | Memoria + revision manual | Dashboard semaforo + OC en 1 clic | **Reduccion de quiebres de stock** |
| **Preparacion de reportes** | Exportar → Excel → Drive (3h/semana) | Dashboard en vivo, sin exportar | **3h semanales** recuperadas |
| **Total horas recuperadas** | ~28h/semana en tareas manuales | ~5h/semana con automatizacion | **~23h/semana** para el negocio |

---

## Archivos Entregados

| Archivo | Descripcion | Estado |
|---------|-------------|--------|
| `index.html` | Dashboard principal — ventas en vivo, metricas, indicadores | ✅ Entregado |
| `stock-dashboard.html` | Dashboard semaforo de stock y compras urgentes | ✅ Entregado |
| `jumpseller-bulk.html` | App de carga masiva CSV para Jumpseller con precheck | ✅ Entregado |
| `propuesta.html` | Propuesta de transformacion digital (este documento en formato web) | ✅ Entregado |
| `api/bsale.js` | Proxy seguro Vercel → Bsale API | ✅ Entregado |
| `api/ocr.js` | Serverless function Claude Vision OCR para facturas | 🔧 En desarrollo |
| `vercel.json` | Configuracion de deploy y rewrites | ✅ Entregado |
| `css/styles.css` | Estilos compartidos del panel | ✅ Entregado |
| `js/app.js` | Logica principal del dashboard | ✅ Entregado |
| `js/stock.js` | Logica del dashboard de compras | ✅ Entregado |
| `js/jumpseller-bulk.js` | Logica de carga masiva Jumpseller | ✅ Entregado |
| `README.md` | Documentacion del proyecto | ✅ Entregado |

---

> **Infopet** · Propuesta de transformacion digital · Marzo 2026
> Stack: HTML · CSS · JS · Vercel · GitHub · Bsale API · Jumpseller API
