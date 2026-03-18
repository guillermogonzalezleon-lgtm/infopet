from http.server import BaseHTTPRequestHandler
import json
import os
import csv
import io
import time
import urllib.request
import urllib.parse

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        params = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        report_type = params.get('type', ['stock'])[0]

        self.send_header('Access-Control-Allow-Origin', '*')

        token = os.environ.get('BSALE_TOKEN', '')

        try:
            if report_type == 'stock':
                # Generate stock report CSV
                data = self._fetch_stocks(token)
                csv_content = self._generate_stock_csv(data)

                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.send_header('Content-Disposition', f'attachment; filename="infopet_stock_{time.strftime("%Y-%m-%d")}.csv"')
                self.end_headers()
                self.wfile.write(csv_content.encode('utf-8-sig'))

            elif report_type == 'products':
                # Generate products report
                data = self._fetch_products(token)
                csv_content = self._generate_products_csv(data)

                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.send_header('Content-Disposition', f'attachment; filename="infopet_productos_{time.strftime("%Y-%m-%d")}.csv"')
                self.end_headers()
                self.wfile.write(csv_content.encode('utf-8-sig'))

            elif report_type == 'diff':
                # Generate Bsale vs Jumpseller diff report
                diff_data = self._generate_diff()
                csv_content = self._generate_diff_csv(diff_data)

                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.send_header('Content-Disposition', f'attachment; filename="infopet_diferencias_{time.strftime("%Y-%m-%d")}.csv"')
                self.end_headers()
                self.wfile.write(csv_content.encode('utf-8-sig'))

            else:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    'error': 'Tipo de reporte no válido',
                    'tipos_disponibles': ['stock', 'products', 'diff']
                }).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.end_headers()

    def _bsale(self, path):
        token = os.environ.get('BSALE_TOKEN', '')
        req = urllib.request.Request(
            f'https://api.bsale.cl/v1{path}',
            headers={'access_token': token}
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())

    def _jumpseller(self, path):
        login = os.environ.get('JUMPSELLER_LOGIN', '')
        token = os.environ.get('JUMPSELLER_AUTH_TOKEN', '')
        sep = '&' if '?' in path else '?'
        req = urllib.request.Request(
            f'https://api.jumpseller.com/v1{path}{sep}login={login}&authtoken={token}'
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())

    def _fetch_stocks(self, token):
        stocks = []
        offset = 0
        while True:
            data = self._bsale(f'/stocks.json?limit=50&offset={offset}')
            items = data.get('items', [])
            if not items:
                break
            stocks.extend(items)
            if len(items) < 50:
                break
            offset += 50
            time.sleep(1)
        return stocks

    def _fetch_products(self, token):
        products = []
        offset = 0
        while True:
            data = self._bsale(f'/products.json?limit=50&offset={offset}&state=0')
            items = data.get('items', [])
            if not items:
                break
            products.extend(items)
            if len(items) < 50:
                break
            offset += 50
            time.sleep(1)
        return products

    def _generate_stock_csv(self, stocks):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'Variante ID', 'Cantidad', 'Disponible', 'Reservado', 'Estado'])
        for s in stocks:
            qty = s.get('quantity', 0)
            status = 'Sin stock' if qty == 0 else 'Bajo' if qty <= 5 else 'OK'
            writer.writerow([
                s.get('id', ''),
                s.get('variant', {}).get('id', ''),
                qty,
                s.get('quantityAvailable', 0),
                s.get('quantityReserved', 0),
                status
            ])
        return output.getvalue()

    def _generate_products_csv(self, products):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'Nombre', 'Clasificación', 'Control Stock'])
        for p in products:
            writer.writerow([
                p.get('id', ''),
                p.get('name', ''),
                p.get('classification', ''),
                p.get('stockControl', '')
            ])
        return output.getvalue()

    def _generate_diff(self):
        # Get Jumpseller products
        js_products = []
        page = 1
        while page <= 5:  # Limit pages to avoid timeout
            data = self._jumpseller(f'/products.json?limit=50&page={page}')
            if not data:
                break
            for p in data:
                prod = p.get('product', p)
                js_products.append({
                    'name': prod.get('name', ''),
                    'sku': prod.get('sku', ''),
                    'stock': prod.get('stock', 0),
                    'price': prod.get('price', 0),
                })
            if len(data) < 50:
                break
            page += 1
            time.sleep(0.5)
        return js_products

    def _generate_diff_csv(self, products):
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Nombre', 'SKU', 'Stock Jumpseller', 'Precio', 'Estado'])
        for p in products:
            stock = p.get('stock', 0) or 0
            status = 'Sin stock' if stock == 0 else 'Bajo' if stock <= 5 else 'OK'
            writer.writerow([
                p.get('name', ''),
                p.get('sku', ''),
                stock,
                p.get('price', 0),
                status
            ])
        return output.getvalue()
