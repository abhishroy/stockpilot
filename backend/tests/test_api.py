from fastapi.testclient import TestClient
from main import app
client = TestClient(app)
def test_health(): assert client.get('/health').json()['status'] == 'ok'
def test_demo_is_labeled(): assert client.get('/quote/NVDA').json()['is_demo'] is True
def test_scenario():
    result = client.get('/scenario', params={'price':163,'units':10,'annual_return':20,'months':12}).json()
    assert result['initial_value'] == 1630
    assert result['future_value'] == 1956
def test_bad_symbol(): assert client.get('/quote/INVALID!').status_code == 400
