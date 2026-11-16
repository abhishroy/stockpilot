# StockPilot v0.1 🚀

An iPhone-first research prototype with timestamped provider quotes (when configured) and an educational investment scenario calculator.

## Run backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Open http://localhost:8000/docs. Without `TWELVE_DATA_API_KEY`, quotes are **illustrative fixtures**, not live market prices. To use provider quotes, export `TWELVE_DATA_API_KEY=...` before starting the server. Check provider permissions before sharing market quotes with other users.

## Run iPhone app

```bash
cd mobile
npm install
cp .env.example .env
# Edit EXPO_PUBLIC_API_URL to http://YOUR_MAC_LAN_IP:8000
npx expo start
```

Use Expo Go for initial development where supported, or build a development client with Xcode. Your iPhone and Mac should be on the same Wi-Fi network. The iOS simulator can use `http://localhost:8000`.

## Testing

```bash
cd backend
pytest -q
```

## Next milestones

- Provider-backed ticker search and validated exchange/currency mapping
- Historical price charts, fundamentals and sourced research
- Bear/base/bull models with backtesting and calibration
- User accounts, watchlists and alerts
- Secure hosted API, app signing, TestFlight and licensing/compliance review

**Safety:** Scenario outputs are user-controlled mathematical examples, not predictive investment advice. This project does not execute trades. Never put provider secrets into `EXPO_PUBLIC_*` variables.
