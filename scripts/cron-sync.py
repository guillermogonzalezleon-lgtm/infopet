from http.server import BaseHTTPRequestHandler
import json
import os
import time
import urllib.request
import urllib.error


def bsale_fetch(path):
    """Fetch from Bsale API with token"""
    token = os.environ.get('BSALE_TOKEN', '')
    url = f'https://api.bsale.cl/v1{path}'
    req = urllib.request.Request(url, headers={'access_token': token})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        if e.code == 429:
            time.sleep(2)
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read())
        raise


def jumpseller_fetch(path):
    """Fetch from Jumpseller API"""
    login = os.environ.get('JUMPSELLER_LOGIN', '')
    token = os.environ.get('JUMPSELLER_AUTH_TOKEN', '')
    sep = '&' if '?' in path else '?'
    url = f'https://api.jumpseller.com/v1{path}{sep}login={login}&authtoken={token}'
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            result = self._sync()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Cache-Control', 's-maxage=900, stale-while-revalidate=1800')
            self.end_headers()
            self.wfile.write(json.dumps(result, ensure_ascii=False).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def _sync(self):
        # 1. Get Bsale products count
        bsale_data = bsale_fetch('/products.json?limit=1&state=0')
        bsale_count = bsale_data.get('count', 0)
        time.sleep(1)

        # 2. Get Bsale products with stock info (paginated, slow)
        all_products = []
        offset = 0
        limit = 50
        while offset < min(bsale_count, 500):
            page = bsale_fetch(f'/products.json?limit={limit}&offset={offset}&state=0')
            items = page.get('items', [])
            if not items:
                break
            for p in items:
                all_products.append({
                    'id': p.get('id'),
                    'name': p.get('name', ''),
                    'classification': p.get('classification', 0),
                    'stockControl': p.get('stockControl', 0),
                })
            offset += limit
            time.sleep(1.5)

        # 3. Get stocks (paginated)
        all_stocks = []
        offset = 0
        while True:
            stock_data = bsale_fetch(f'/stocks.json?limit=50&offset={offset}')
            items = stock_data.get('items', [])
            if not items:
                break
            for s in items:
                all_stocks.append({
                    'id': s.get('id'),
                    'variantId': s.get('variant', {}).get('id'),
                    'quantity': s.get('quantity', 0),
                    'quantityAvailable': s.get('quantityAvailable', 0),
                })
            if len(items) < 50:
                break
            offset += 50
            time.sleep(1.5)

        # 4. Get Jumpseller count
        js_count = jumpseller_fetch('/products/count.json')

        # 5. Get Jumpseller products (paginated)
        js_products = []
        page = 1
        while True:
            data = jumpseller_fetch(f'/products.json?limit=50&page={page}')
            if not data:
                break
            for p in data:
                prod = p.get('product', p)
                js_products.append({
                    'id': prod.get('id'),
                    'name': prod.get('name', ''),
                    'sku': prod.get('sku', ''),
                    'stock': prod.get('stock', 0),
                    'price': prod.get('price', 0),
                })
            if len(data) < 50:
                break
            page += 1
            time.sleep(0.5)

        # 6. Calculate summaries
        stock_with = len([s for s in all_stocks if s['quantity'] > 0])
        stock_zero = len([s for s in all_stocks if s['quantity'] == 0])
        stock_low = len([s for s in all_stocks if 0 < s['quantity'] <= 5])

        return {
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'bsale': {
                'total_products': bsale_count,
                'products_with_stock': stock_with,
                'products_zero_stock': stock_zero,
                'products_low_stock': stock_low,
                'total_stock_entries': len(all_stocks),
                'products': all_products[:100],
                'stocks': all_stocks,
            },
            'jumpseller': {
                'total_products': js_count.get('count', 0),
                'products': js_products[:100],
            },
            'summary': {
                'bsale_total': bsale_count,
                'bsale_with_stock': stock_with,
                'jumpseller_total': js_count.get('count', 0),
                'stock_critico': stock_zero,
                'stock_bajo': stock_low,
            }
        }
