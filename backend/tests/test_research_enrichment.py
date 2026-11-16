"""Deterministic checks for financial-ratio calculations and missing evidence."""
import research

def test_ratios_with_valid_provider_data(monkeypatch):
    def fake_fetch(path, params):
        if path == "balance-sheet-statement":
            return [{"cashAndCashEquivalents": 20, "totalDebt": 50,
                     "totalStockholdersEquity": 100, "date": "2026-01-01"}], None
        if path == "profile":
            return [{"marketCap": 1000}], None
        return [], None
    monkeypatch.setattr(research, "fetch_fmp", fake_fetch)
    metrics, missing = research.company_analysis("TEST", {"net_income": 100, "filing_date": "2026-02-01"}, None)
    assert metrics["market_cap_to_annual_net_income"] == 10
    assert metrics["debt_to_equity"] == 0.5
    assert metrics["net_debt"] == 30
    assert any("Independent verification" in item for item in missing)

def test_missing_financials_do_not_generate_ratios(monkeypatch):
    monkeypatch.setattr(research, "fetch_fmp", lambda path, params: ([], "No provider data"))
    metrics, missing = research.company_analysis("TEST", None, None)
    assert metrics is None
    assert missing

def test_negative_earnings_do_not_generate_pe(monkeypatch):
    monkeypatch.setattr(research, "fetch_fmp", lambda path, params:
                        ([{"marketCap": 1000}], None) if path == "profile" else ([], None))
    metrics, missing = research.company_analysis("TEST", {"net_income": -50}, None)
    assert metrics["market_cap_to_annual_net_income"] is None
    assert any("valuation ratio" in item for item in missing)

def test_no_unverified_recommendation(monkeypatch):
    monkeypatch.setattr(research, "fetch_fmp", lambda path, params: ([], "No provider data"))
    payload = research.research("TEST", None)
    assert payload["signal"] is None
    assert payload["assessment"] == "INSUFFICIENT_EVIDENCE"
    assert payload["performance"]["status"] == "not_validated"
