from http.server import BaseHTTPRequestHandler
import json
import base64
import re
import os
import urllib.request

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.send_header('Access-Control-Allow-Origin', '*')

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            image_b64 = data.get('image', '')
            media_type = data.get('mediaType', 'image/jpeg')

            # Try Claude API if key exists
            api_key = os.environ.get('ANTHROPIC_API_KEY', '')
            if api_key:
                result = self._ocr_claude(image_b64, media_type, api_key)
            else:
                result = {
                    'error': 'OCR no disponible',
                    'message': 'Para usar OCR automático, carga créditos en Claude API o usa el modo manual: sube la foto a Claude Chat y copia los datos.',
                    'manual_prompt': 'Analiza esta factura chilena y extrae: RUT proveedor, número factura, fecha, nombre proveedor, lista de productos (nombre, cantidad, precio unitario), subtotal, IVA, total. Responde en JSON.'
                }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _ocr_claude(self, image_b64, media_type, api_key):
        """Use Claude Vision API for OCR"""
        payload = json.dumps({
            'model': 'claude-sonnet-4-20250514',
            'max_tokens': 2000,
            'messages': [{
                'role': 'user',
                'content': [
                    {
                        'type': 'image',
                        'source': {
                            'type': 'base64',
                            'media_type': media_type,
                            'data': image_b64
                        }
                    },
                    {
                        'type': 'text',
                        'text': 'Analiza esta factura chilena y extrae los datos en JSON exacto con esta estructura: {"rut_proveedor":"","numero_factura":"","fecha":"YYYY-MM-DD","proveedor_nombre":"","productos":[{"nombre":"","cantidad":0,"precio_unitario":0}],"subtotal":0,"iva":0,"total":0}. Responde SOLO con JSON válido.'
                    }
                ]
            }]
        }).encode()

        req = urllib.request.Request(
            'https://api.anthropic.com/v1/messages',
            data=payload,
            headers={
                'Content-Type': 'application/json',
                'x-api-key': api_key,
                'anthropic-version': '2023-06-01'
            }
        )

        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            text = result.get('content', [{}])[0].get('text', '{}')
            # Try to parse as JSON
            try:
                return json.loads(text)
            except:
                return {'raw_text': text, 'parse_error': True}
