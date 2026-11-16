from unittest.mock import patch
from research import research, safe_news

def test_no_signal_without_evidence():
    with patch("research.fetch_fmp", return_value=(None, "not configured")):
        result = research("NVDA", None)
    assert result["assessment"] == "INSUFFICIENT_EVIDENCE"
    assert result["signal"] is None
    assert result["performance"]["win_rate"] is None
    assert len(result["evidence_fingerprint"]) == 64

def test_quote_does_not_generate_rating():
    with patch("research.fetch_fmp", return_value=(None, "not configured")):
        result = research("TSLA", {"price": 100, "currency": "USD", "as_of": "2026-11-13", "is_demo": False})
    assert result["signal"] is None
    assert result["evidence"][0]["source"] == "Twelve Data"

def test_untrusted_news_links_filtered():
    items = [{"title": "Fake", "url": "javascript:alert(1)"}, {"title": "Valid", "url": "https://example.org/news"}]
    assert [x["title"] for x in safe_news(items, "NVDA")] == ["Valid"]
