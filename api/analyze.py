from http.server import BaseHTTPRequestHandler
import json
import csv
import io

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.send_header('Access-Control-Allow-Origin', '*')

        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body)

            csv_content = data.get('csv', '')
            action = data.get('action', 'analyze')

            reader = csv.DictReader(io.StringIO(csv_content))
            rows = list(reader)

            if action == 'analyze':
                result = self._analyze(rows, reader.fieldnames)
            elif action == 'map_jumpseller':
                result = self._map_to_jumpseller(rows)
            elif action == 'duplicates':
                result = self._find_duplicates(rows)
            else:
                result = {'error': 'Acción no válida. Usa: analyze, map_jumpseller, duplicates'}

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

    def _analyze(self, rows, fieldnames):
        """Analyze CSV and return summary statistics"""
        total = len(rows)
        empty_fields = {}

        for col in (fieldnames or []):
            empty_count = sum(1 for r in rows if not r.get(col, '').strip())
            if empty_count > 0:
                empty_fields[col] = {'empty': empty_count, 'pct': round(empty_count / total * 100, 1)}

        # Detect numeric columns
        numeric_cols = {}
        for col in (fieldnames or []):
            values = []
            for r in rows:
                val = r.get(col, '').strip().replace('.', '').replace(',', '.')
                try:
                    values.append(float(val))
                except:
                    pass
            if len(values) > total * 0.5:
                numeric_cols[col] = {
                    'min': min(values),
                    'max': max(values),
                    'avg': round(sum(values) / len(values), 2),
                    'sum': round(sum(values), 2),
                }

        return {
            'total_filas': total,
            'columnas': fieldnames,
            'campos_vacios': empty_fields,
            'columnas_numericas': numeric_cols,
        }

    def _map_to_jumpseller(self, rows):
        """Map CSV columns to Jumpseller format"""
        mapped = []
        col_map = {
            'name': ['nombre', 'name', 'producto', 'descripcion'],
            'sku': ['sku', 'codigo', 'code', 'cod'],
            'price': ['precio', 'price', 'precio_venta', 'pvp'],
            'categories': ['categoria', 'categories', 'clasificacion', 'tipo'],
            'brand': ['marca', 'brand'],
            'barcode': ['codigo_barra', 'barcode', 'ean', 'barra'],
            'stock': ['stock', 'cantidad', 'qty'],
            'description': ['descripcion_web', 'description', 'detalle'],
        }

        # Auto-detect column mapping
        detected = {}
        if rows:
            keys = [k.lower().strip() for k in rows[0].keys()]
            for target, aliases in col_map.items():
                for alias in aliases:
                    for k in rows[0].keys():
                        if alias in k.lower().strip():
                            detected[target] = k
                            break
                    if target in detected:
                        break

        for row in rows:
            mapped_row = {}
            for target, source in detected.items():
                mapped_row[target] = row.get(source, '')
            mapped.append(mapped_row)

        return {
            'column_mapping': detected,
            'total_rows': len(mapped),
            'sample': mapped[:5],
            'jumpseller_csv_ready': len(mapped) > 0
        }

    def _find_duplicates(self, rows):
        """Find duplicate SKUs"""
        sku_counts = {}
        for i, row in enumerate(rows):
            sku = ''
            for key in row:
                if 'sku' in key.lower() or 'codigo' in key.lower():
                    sku = row[key].strip()
                    break
            if sku:
                if sku not in sku_counts:
                    sku_counts[sku] = []
                sku_counts[sku].append(i + 2)  # +2 for header + 0-index

        duplicates = {k: v for k, v in sku_counts.items() if len(v) > 1}
        return {
            'total_skus': len(sku_counts),
            'duplicados': len(duplicates),
            'detalle': duplicates
        }
