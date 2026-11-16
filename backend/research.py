"""Evidence-first research. No rating is issued without verified inputs."""
import hashlib
import json
import os
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree
from email.utils import parsedate_to_datetime
from datetime import timedelta

FMP = "https://financialmodelingprep.com/stable"
MODEL_VERSION = "research-0.2"

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

def fetch_news_rss(symbol):
    """Public Google News RSS search fallback; links and timestamps only, no article scraping."""
    queries = {
        "NVDA": 'NVIDIA OR "Jensen Huang" OR "Colette Kress"',
    }
    term = queries.get(symbol, f'"{symbol}" stock')
    url = "https://news.google.com/rss/search?" + urlencode({
        "q": term + " when:7d", "hl": "en-US", "gl": "US", "ceid": "US:en"
    })
    try:
        req = Request(url, headers={"User-Agent": "StockPilot/0.2 (research news headlines)"})
        with urlopen(req, timeout=8) as resp:
            body = resp.read(350000)
        root = ElementTree.fromstring(body)
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        results = []
        for item in root.findall("./channel/item"):
            title = (item.findtext("title") or "").strip()
            link = (item.findtext("link") or "").strip()
            date = (item.findtext("pubDate") or "").strip()
            source = item.find("source")
            publisher = (source.text or "").strip() if source is not None and source.text else "Google News indexed source"
            try:
                published = parsedate_to_datetime(date).astimezone(timezone.utc)
            except (TypeError, ValueError, OverflowError):
                continue
            if published < cutoff or published > datetime.now(timezone.utc) + timedelta(hours=1):
                continue
            parsed = urlparse(link)
            if parsed.scheme != "https" or not parsed.netloc or not title:
                continue
            results.append({"title": title[:250], "url": link, "publisher": publisher[:100],
                            "published_at": published.isoformat(), "impact": "Not independently assessed",
                            "source": "Google News RSS (discovery; publisher verification required)"})
            if len(results) >= 10:
                break
        return results, None
    except Exception:
        return [], "News RSS provider unavailable"

def number(value):
    """Reject missing, malformed and non-finite provider numbers."""
    import math
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError, OverflowError):
        return None

def company_analysis(symbol, financials, quote_data):
    """Descriptive financial ratios, not a price forecast or investment rating."""
    balance, balance_error = fetch_fmp("balance-sheet-statement", {"symbol": symbol, "limit": 1})
    profile, profile_error = fetch_fmp("profile", {"symbol": symbol})
    latest = balance[0] if balance and isinstance(balance[0], dict) else None
    company = profile[0] if profile and isinstance(profile[0], dict) else None
    if not latest and not company:
        return None, ["Valuation and debt data: " + (balance_error or profile_error or "Provider returned no data")]
    cash = number(latest.get("cashAndCashEquivalents")) if latest else None
    debt = number(latest.get("totalDebt")) if latest else None
    equity = number(latest.get("totalStockholdersEquity")) if latest else None
    market_cap = number(company.get("marketCap") or company.get("mktCap")) if company else None
    net_income = number(financials.get("net_income")) if financials else None
    # Ratios are meaningful only for positive denominators.
    pe = round(market_cap / net_income, 2) if market_cap is not None and net_income and net_income > 0 else None
    debt_to_equity = round(debt / equity, 2) if debt is not None and equity and equity > 0 else None
    net_debt = debt - cash if debt is not None and cash is not None else None
    metrics = {"market_cap": market_cap, "cash": cash, "total_debt": debt,
               "shareholder_equity": equity, "net_debt": net_debt,
               "market_cap_to_annual_net_income": pe, "debt_to_equity": debt_to_equity,
               "financial_statement_date": (financials or {}).get("filing_date"),
               "balance_sheet_date": latest.get("date") if latest else None,
               "profile_source": "FMP secondary aggregator" if company else None,
               "balance_source": "FMP secondary aggregator" if latest else None,
               "limitations": "Descriptive ratios only. Market capitalization and fiscal-year profit can be from different dates. No peer comparison, audited filing verification, or investment rating."}
    missing = []
    if pe is None: missing.append("Comparable valuation ratio (positive earnings and market capitalization required)")
    if debt_to_equity is None: missing.append("Debt-to-equity ratio (positive equity and debt data required)")
    missing.append("Independent verification of valuation and debt against issuer filings")
    return metrics, missing

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
    if not news:
        news, rss_error = fetch_news_rss(symbol)
        if not news:
            news_err = rss_error or news_err
    if news:
        evidence.append({"category": "news_headlines", "source": "FMP or Google News RSS (discovery, not verified)",
                         "as_of": now, "value": len(news),
                         "note": "Headlines are unverified context; no automated sentiment or causal impact inferred"})
    else:
        missing.append("Sourced recent news" + (": " + news_err if news_err else ""))
    analysis, analysis_missing = company_analysis(symbol, financials, quote_data)
    if analysis:
        evidence.append({"category": "financial_ratios", "source": "FMP (secondary aggregator)",
                         "as_of": analysis.get("balance_sheet_date"),
                         "value": analysis,
                         "note": "Descriptive financial figures, not a recommendation. Requires primary filing verification."})
    missing.extend(analysis_missing)
    missing.extend(["Validated historical predictive performance (backtest not implemented)",
                    "Verified sector-specific macroeconomic and geopolitical analysis (not implemented)"])
    # Deliberately do not manufacture a recommendation from incomplete evidence.
    payload = {"symbol": symbol, "model_version": MODEL_VERSION, "generated_at": now,
               "assessment": "INSUFFICIENT_EVIDENCE", "signal": None,
               "reason": "StockPilot has not validated enough independent evidence to issue an investment signal.",
               "evidence": evidence, "missing": missing, "financials": financials,
               "news": news, "analysis": analysis, "performance": {"status": "not_validated", "win_rate": None,
                                           "benchmark_excess_return": None},
               "disclaimer": "Research information only; not personalized investment advice. No forecast is guaranteed."}
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    payload["evidence_fingerprint"] = hashlib.sha256(canonical.encode()).hexdigest()
    payload["fingerprint_note"] = "Content fingerprint for checking a saved assessment; not a persistent or independently audited record."
    return payload
