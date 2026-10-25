/**
 * Formats a financial amount in integer or decimal into the configured currency.
 * Uses 'INR ' prefix with locale formatting so it displays crisply across all platforms
 * without missing unicode glyph boxes.
 */
export function formatCurrency(amount: number | string | undefined | null, currency = 'INR'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : (amount ?? 0);
  return `${currency} ${num.toLocaleString('en-IN')}`;
}
