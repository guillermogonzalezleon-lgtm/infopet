# Infopet — Instrucciones para Claude Code

## Contexto
Tienda de mascotas en Viña del Mar. Panel de gestión digital.
Cuenta Bsale: INFOPET SPA · Casa Matriz
Email Google: infopetrenaca@gmail.com

## Stack
- HTML + CSS + JS vanilla → Vercel (no usar frameworks)
- Vercel Functions en /api → proxies seguros para APIs externas
- GitHub → deploy automático en cada push a main

## APIs integradas
- Bsale: /api/bsale?endpoint=X → proxy a api.bsale.cl/v1
- Jumpseller: /api/jumpseller?endpoint=X → proxy a api.jumpseller.com/v1
- Google Sheets: /api/sheets → append a Carga Maestra
- Google Drive: /api/drive → upload archivos
- OCR facturas: /api/ocr → Claude Vision API
- Gmail: /api/gmail → notificaciones automáticas

## Variables de entorno (nunca hardcodear)
Ver .env.example para la lista completa.

## Diseño
- Fuentes: Syne (headings) + DM Sans (body) + DM Mono (código)
- Paleta: --bg #F7F6F2, --surface #FFFFFF, --accent #2D6A4F
- Importar desde assets/style.css
- Mismo navbar en todos los HTML

## Reglas
- Nunca loguear credenciales
- Siempre CORS en Functions
- Mensajes de error en español
- Commit al terminar cada fase
- Idioma: español
