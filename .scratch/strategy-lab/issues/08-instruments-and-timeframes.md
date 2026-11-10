# 08: Instruments and timeframes

**What to build:** Users can test on about ten liquid USDT pairs and on 1d, 4h and 1h Timeframes. Data stays fresh without manual work. The market data source stays behind a small interface so other markets can be added later.

**Blocked by:** 01

**Status:** done

- [x] Fixed list of ~10 USDT pairs; 1d, 4h and 1h klines for each downloaded from Binance public endpoints and cached as parquet
- [x] Data refreshes once a day without a restart
- [x] Endpoint lists available Instruments and Timeframes; the editor's Instrument and Timeframe blocks use it
- [x] Market data is reached only through an interface that a future market (GPW, US stocks) can implement
- [x] Preview stays responsive on 1h data (if ticket 03 is done, measure and record the duration)
- [x] API seam tests: an unknown Instrument or Timeframe is rejected; a 4h fixture backtests correctly

## Comments

The backend downloads all instruments and timeframes in a background thread on startup; per-key locks prevent double downloads.
