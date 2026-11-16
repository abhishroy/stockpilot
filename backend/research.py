"""Evidence-first research. No rating is issued without verified inputs."""
import hashlib
import json
import os
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

FMP = "https://financialmodelingprep.com/stable"
MODEL_VERSION = "research-0.1"

def fetch_fmp(path, params):
    key = os.getenv("FMP_API_KEY")
    if not key:
        return None, "FMP_API_KEY not configured"
    url = FMP + "/" + path + "?" + urlencode({**params, "apikey": key})
    try:
        req = Request(url, headers={"User-Agent": "StockPilot research/0.1"})
        with urlopen(req, timeout=10) as resp:
            result = json.load(resp)
        if not isinstance(result, list):
            return None, "Provider returned an unexpected response"
        return result, None
    except Exception:
        return None, "Financial data provider unavailable"

def safe_news(items, symbol):
    results = []
    for item in items:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "")
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc:
            continue
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        results.append({"title": title[:250], "url": url,
                        "publisher": str(item.get("site") or item.get("publisher") or "Publisher not provided")[:100],
                        "published_at": item.get("publishedDate") or item.get("published_at"),
                        "impact": "Not independently assessed"})
        if len(results) == 5:
            break
    return results

def research(symbol, quote_data):
    now = datetime.now(timezone.utc).isoformat()
    evidence = []
    missing = []
    if quote_data and not quote_data.get("is_demo"):
        evidence.append({"category": "market_quote", "source": "Twelve Data",
                         "as_of": quote_data.get("as_of"), "value": quote_data.get("price"),
                         "currency": quote_data.get("currency"),
                         "note": "Provider latest available; may be delayed"})
    else:
        missing.append("Verified market quote")
    income, err = fetch_fmp("income-statement", {"symbol": symbol, "limit": 2})
    financials = None
    if income and isinstance(income[0], dict):
        latest = income[0]
        financials = {"revenue": latest.get("revenue"), "net_income": latest.get("netIncome"),
                      "period": latest.get("period"), "fiscal_year": latest.get("fiscalYear"),
                      "filing_date": latest.get("fillingDate") or latest.get("filingDate"),
                      "reported_currency": latest.get("reportedCurrency")}
        if financials["revenue"] is not None and financials["net_income"] is not None:
            evidence.append({"category": "financial_statement", "source": "FMP (secondary aggregator)",
                             "as_of": financials["filing_date"], "value": financials,
                             "note": "Cross-check against issuer filings before treating as primary-source verified"})
        else:
            missing.append("Complete income statement")
    else:
        missing.append("Financial statements" + (": " + err if err else ""))
    news_data, news_err = fetch_fmp("stock-news", {"symbols": symbol, "limit": 5})
    news = safe_news(news_data or [], symbol)
    if news:
        evidence.append({"category": "news_headlines", "source": "FMP (aggregator)",
                         "as_of": now, "value": len(news),
                         "note": "Headlines are unverified context; no automated sentiment or causal impact inferred"})
    else:
        missing.append("Sourced recent news" + (": " + news_err if news_err else ""))
    missing.extend(["Verified valuation and debt analysis", "Validated historical predictive performance",
                    "Sector-specific macroeconomic and geopolitical analysis"])
    # Deliberately do not manufacture a recommendation from incomplete evidence.
    payload = {"symbol": symbol, "model_version": MODEL_VERSION, "generated_at": now,
               "assessment": "INSUFFICIENT_EVIDENCE", "signal": None,
               "reason": "StockPilot has not validated enough independent evidence to issue an investment signal.",
               "evidence": evidence, "missing": missing, "financials": financials,
               "news": news, "performance": {"status": "not_validated", "win_rate": None,
                                           "benchmark_excess_return": None},
               "disclaimer": "Research information only; not personalized investment advice. No forecast is guaranteed."}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    payload["evidence_fingerprint"] = hashlib.sha256(canonical.encode()).hexdigest()
    payload["fingerprint_note"] = "Content fingerprint for checking a saved assessment; not a persistent or independently audited record."
    return payload
