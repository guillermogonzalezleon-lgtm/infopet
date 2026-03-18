from http.server import BaseHTTPRequestHandler
import json
import os
import csv
import io
import time
import urllib.request
import urllib.parse

class handler(BaseHTTPRequestHandler):
    """Endpoint Python consolidado: reportes CSV + análisis de datos"""

    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        action = params.get('action', ['info'])[0]

        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')

        if action == 'info':
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'service': 'InfoPet Python API',
                'endpoints': {
                    'GET ?action=info': 'Esta info',
                    'GET ?action=report&type=stock': 'Descarga CSV de stock',
                    'GET ?action=report&type=products': 'Descarga CSV de productos',
                    'POST ?action=analyze': 'Analiza CSV enviado en body',
                    'POST ?action=duplicates': 'Busca SKUs duplicados en CSV',
                }
            }).encode())

        elif action == 'report':
            report_type = params.get('type', ['stock'])[0]
            try:
                csv_content = self._generate_report(report_type)
                fname = f'infopet_{report_type}_{time.strftime("%Y-%m-%d")}.csv'
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.send_header('Content-Disposition', f'attachment; filename="{fname}"')
                self.end_headers()
                self.wfile.write(csv_content.encode('utf-8-sig'))
            except Exception as e:
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        else:
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Acción no válida'}).encode())

    def do_POST(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()

        try:
            params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            action = params.get('action', ['analyze'])[0]
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)
            csv_content = data.get('csv', '')

            reader = csv.DictReader(io.StringIO(csv_content))
            rows = list(reader)

            if action == 'analyze':
                result = self._analyze(rows, reader.fieldnames)
            elif action == 'duplicates':
                result = self._find_duplicates(rows)
            elif action == 'map_jumpseller':
                result = self._map_to_jumpseller(rows)
            else:
                result = {'error': 'Acción no válida'}

            self.wfile.write(json.dumps(result, ensure_ascii=False).encode())
        except Exception as e:
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def _bsale(self, path):
        token = os.environ.get('BSALE_TOKEN', '')
        req = urllib.request.Request(
            f'https://api.bsale.cl/v1{path}',
            headers={'access_token': token}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())

    def _generate_report(self, report_type):
        output = io.StringIO()
        writer = csv.writer(output)

        if report_type == 'stock':
            writer.writerow(['ID', 'Variante ID', 'Cantidad', 'Disponible', 'Estado'])
            offset = 0
            while True:
                data = self._bsale(f'/stocks.json?limit=50&offset={offset}')
                items = data.get('items', [])
                if not items:
                    break
                for s in items:
                    qty = s.get('quantity', 0)
                    status = 'Sin stock' if qty == 0 else 'Bajo' if qty <= 5 else 'OK'
                    writer.writerow([
                        s.get('id', ''),
                        s.get('variant', {}).get('id', ''),
                        qty,
                        s.get('quantityAvailable', 0),
                        status
                    ])
                if len(items) < 50:
                    break
                offset += 50
                time.sleep(1.5)

        elif report_type == 'products':
            writer.writerow(['ID', 'Nombre', 'Clasificación', 'Control Stock'])
            offset = 0
            while True:
                data = self._bsale(f'/products.json?limit=50&offset={offset}&state=0')
                items = data.get('items', [])
                if not items:
                    break
                for p in items:
                    writer.writerow([
                        p.get('id', ''),
                        p.get('name', ''),
                        p.get('classification', ''),
                        p.get('stockControl', '')
                    ])
                if len(items) < 50:
                    break
                offset += 50
                time.sleep(1.5)

        return output.getvalue()

    def _analyze(self, rows, fieldnames):
        total = len(rows)
        if total == 0:
            return {'error': 'CSV vacío'}

        empty_fields = {}
        for col in (fieldnames or []):
            empty_count = sum(1 for r in rows if not r.get(col, '').strip())
            if empty_count > 0:
                empty_fields[col] = {'vacios': empty_count, 'pct': round(empty_count / total * 100, 1)}

        numeric_cols = {}
        for col in (fieldnames or []):
            values = []
            for r in rows:
                val = r.get(col, '').strip().replace('.', '').replace(',', '.')
                try:
                    values.append(float(val))
                except:
                    pass
            if len(values) > total * 0.3:
                numeric_cols[col] = {
                    'min': min(values),
                    'max': max(values),
                    'promedio': round(sum(values) / len(values), 2),
                    'suma': round(sum(values), 2),
                }

        return {
            'total_filas': total,
            'columnas': fieldnames,
            'campos_vacios': empty_fields,
            'columnas_numericas': numeric_cols,
        }

    def _find_duplicates(self, rows):
        sku_counts = {}
        for i, row in enumerate(rows):
            sku = ''
            for key in row:
                if 'sku' in key.lower() or 'codigo' in key.lower() or 'code' in key.lower():
                    sku = row[key].strip()
                    break
            if sku:
                if sku not in sku_counts:
                    sku_counts[sku] = []
                sku_counts[sku].append(i + 2)

        duplicates = {k: v for k, v in sku_counts.items() if len(v) > 1}
        return {
            'total_skus': len(sku_counts),
            'duplicados': len(duplicates),
            'detalle': duplicates
        }

    def _map_to_jumpseller(self, rows):
        col_map = {
            'Name': ['nombre', 'name', 'producto'],
            'SKU': ['sku', 'codigo', 'code'],
            'Price': ['precio', 'price', 'precio_venta'],
            'Categories': ['categoria', 'categories', 'clasificacion'],
            'Brand': ['marca', 'brand'],
            'Barcode': ['codigo_barra', 'barcode', 'ean'],
            'Stock': ['stock', 'cantidad'],
        }

        detected = {}
        if rows:
            for target, aliases in col_map.items():
                for alias in aliases:
                    for k in rows[0].keys():
                        if alias in k.lower().strip():
                            detected[target] = k
                            break
                    if target in detected:
                        break

        mapped = []
        for row in rows:
            m = {}
            for target, source in detected.items():
                m[target] = row.get(source, '')
            mapped.append(m)

        return {
            'mapeo_columnas': detected,
            'total_filas': len(mapped),
            'muestra': mapped[:5],
        }
