import os
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlencode
from urllib.request import urlopen
import json
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from research import research as build_research

app = FastAPI(title='StockPilot API', version='0.1.0')
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('CORS_ORIGINS','http://localhost:8081,https://abhishroy.github.io').split(','), allow_methods=['GET'], allow_headers=['*'])

DEMO = {'NVDA': 163.0, 'AAPL': 200.0, 'MSFT': 400.0, 'ASML': 900.0}

@app.get('/health')
def health(): return {'status': 'ok', 'version': '0.1.0'}

@app.get('/quote/{symbol}')
def quote(symbol: str):
    symbol = symbol.strip().upper()
    if not symbol.isalnum() or len(symbol) > 12: raise HTTPException(400, 'Invalid ticker')
    key = os.getenv('TWELVE_DATA_API_KEY')
    if key:
        url = 'https://api.twelvedata.com/quote?' + urlencode({'symbol': symbol, 'apikey': key})
        try:
            with urlopen(url, timeout=8) as response: data = json.load(response)
            if data.get('status') == 'error' or 'close' not in data: raise ValueError(data.get('message','Quote unavailable'))
            return {'symbol': symbol, 'price': float(data['close']), 'currency': data.get('currency','USD'), 'exchange': data.get('exchange'), 'as_of': data.get('datetime'), 'source': 'Twelve Data', 'is_demo': False, 'quote_type': 'provider latest available; may be delayed'}
        except Exception as exc:
            raise HTTPException(502, f'Market data unavailable: {exc}')
    if symbol not in DEMO: raise HTTPException(404, 'Ticker unavailable in demo. Configure TWELVE_DATA_API_KEY.')
    return {'symbol': symbol, 'price': DEMO[symbol], 'currency': 'USD', 'exchange': 'DEMO', 'as_of': None, 'source': 'Illustrative fixture', 'is_demo': True, 'quote_type': 'NOT LIVE'}

@app.get('/search')
def search(q: str = Query(min_length=1, max_length=80)):
    """Company-name or symbol lookup. A private company is never assigned another company's ticker."""
    term = q.strip()
    if not term:
        raise HTTPException(400, 'Search term required')
    if 'spacex' in term.lower() or 'space exploration technologies' in term.lower():
        return {'results': [{'name': 'SpaceX', 'symbol': None, 'exchange': None, 'currency': None, 'is_public': False, 'message': 'SpaceX is privately held; there is no publicly traded SpaceX stock ticker.'}]}
    key = os.getenv('TWELVE_DATA_API_KEY')
    if key:
        url = 'https://api.twelvedata.com/symbol_search?' + urlencode({'symbol': term, 'apikey': key, 'outputsize': 15})
        try:
            with urlopen(url, timeout=8) as response:
                data = json.load(response)
            if data.get('status') == 'error':
                raise ValueError(data.get('message', 'Search unavailable'))
            items = data.get('data', [])
            if not isinstance(items, list):
                raise ValueError('Unexpected provider response')
            return {'results': [{'name': item.get('instrument_name') or item.get('name') or item.get('symbol'), 'symbol': item.get('symbol'), 'exchange': item.get('exchange'), 'currency': item.get('currency'), 'is_public': True} for item in items if item.get('symbol')]}
        except Exception as exc:
            raise HTTPException(502, f'Company search unavailable: {exc}')
    demo_names = {'NVDA':'NVIDIA Corporation', 'AAPL':'Apple Inc.', 'MSFT':'Microsoft Corporation', 'ASML':'ASML Holding N.V.', 'TSLA':'Tesla, Inc.'}
    return {'results': [{'name': name, 'symbol': symbol, 'exchange': 'DEMO', 'currency': 'USD', 'is_public': True, 'is_demo': True} for symbol,name in demo_names.items() if term.lower() in name.lower() or term.lower() in symbol.lower()]}

@app.get('/scenario')
def scenario(price: float = Query(gt=0), units: int = Query(ge=1, le=100000), annual_return: float = Query(ge=-99, le=300), months: int = Query(ge=1, le=120)):
    future_price = price * (1 + annual_return / 100) ** (months / 12)
    return {'initial_value': round(price * units, 2), 'future_value': round(future_price * units, 2), 'gain_loss': round((future_price - price) * units, 2), 'future_price': round(future_price, 2), 'months': months, 'units': units, 'assumption_annual_return_pct': annual_return, 'disclaimer': 'Hypothetical scenario, not a forecast. Excludes fees, taxes, dividends and FX.'}

@app.get('/research/{symbol}')
def research_endpoint(symbol: str):
    symbol = symbol.strip().upper()
    if not symbol.isalnum() or len(symbol) > 12:
        raise HTTPException(400, 'Invalid ticker')
    try:
        q = quote(symbol)
    except HTTPException:
        q = None
    return build_research(symbol, q)
