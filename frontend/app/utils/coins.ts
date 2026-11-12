// The logo for each instrument's base coin, from public/brand-icons; a coin without one gets its letters.
const COIN_ICONS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binance',
  SOL: 'solana',
  XRP: 'xrp',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  LINK: 'chainlink',
  LTC: 'litecoin',
}

/** "BTCUSDT" -> "BTC". */
export function baseCoin(symbol: string): string {
  return symbol.replace(/USDT$/, '')
}

export function coinIcon(symbol: string): string | undefined {
  return COIN_ICONS[baseCoin(symbol)]
}
