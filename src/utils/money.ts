import { AnalyticsDomainError } from "../contracts/events.js";

/**
 * Currency metadata for minor-unit formatting. Default minor digits is 2
 * (e.g. INR paise, USD cents, EUR cents). Zero-decimal currencies (e.g. JPY)
 * are supported explicitly.
 */
const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND"]);
const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

const CURRENCY_CODE_REGEX = /^[A-Z]{3}$/;

export class FinancialArithmeticError extends AnalyticsDomainError {
  public constructor(message: string) {
    super("FINANCIAL_ARITHMETIC_ERROR", message);
    this.name = "FinancialArithmeticError";
  }
}

export class CurrencyMismatchError extends AnalyticsDomainError {
  public readonly expectedCurrency: string;
  public readonly actualCurrency: string;

  public constructor(expectedCurrency: string, actualCurrency: string) {
    super(
      "CURRENCY_MISMATCH",
      `Currency mismatch: expected "${expectedCurrency}", received "${actualCurrency}". Mixed-currency arithmetic is prohibited.`,
    );
    this.name = "CurrencyMismatchError";
    this.expectedCurrency = expectedCurrency;
    this.actualCurrency = actualCurrency;
  }
}

export function assertValidCurrencyCode(currency: string): string {
  if (typeof currency !== "string" || !CURRENCY_CODE_REGEX.test(currency)) {
    throw new FinancialArithmeticError(
      `Invalid ISO-4217 currency code "${String(currency)}". Expected 3 uppercase ASCII letters (e.g. "INR").`,
    );
  }
  return currency;
}

export function getCurrencyMinorDecimals(currency: string): number {
  const valid = assertValidCurrencyCode(currency);
  if (ZERO_DECIMAL_CURRENCIES.has(valid)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(valid)) return 3;
  return 2;
}

export function assertSafeMinorUnits(
  amountMinor: number,
  fieldName: string = "amountMinor",
  allowNegative: boolean = false,
): number {
  if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor)) {
    throw new FinancialArithmeticError(
      `${fieldName} must be a safe integer representing minor currency units (received ${String(amountMinor)}).`,
    );
  }
  if (!allowNegative && amountMinor < 0) {
    throw new FinancialArithmeticError(
      `${fieldName} cannot be negative (received ${amountMinor}).`,
    );
  }
  return amountMinor;
}

export function addMinorUnits(a: number, b: number, allowNegative: boolean = false): number {
  const safeA = assertSafeMinorUnits(a, "leftOperand", allowNegative);
  const safeB = assertSafeMinorUnits(b, "rightOperand", allowNegative);
  const bigSum = BigInt(safeA) + BigInt(safeB);
  if (
    bigSum > BigInt(Number.MAX_SAFE_INTEGER) ||
    bigSum < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new FinancialArithmeticError(
      `Integer minor-unit overflow adding ${safeA} + ${safeB}.`,
    );
  }
  return Number(bigSum);
}

export function subtractMinorUnits(
  a: number,
  b: number,
  allowNegativeResult: boolean = true,
): number {
  const safeA = assertSafeMinorUnits(a, "leftOperand", true);
  const safeB = assertSafeMinorUnits(b, "rightOperand", true);
  const bigDiff = BigInt(safeA) - BigInt(safeB);
  if (
    bigDiff > BigInt(Number.MAX_SAFE_INTEGER) ||
    bigDiff < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new FinancialArithmeticError(
      `Integer minor-unit overflow subtracting ${safeA} - ${safeB}.`,
    );
  }
  const result = Number(bigDiff);
  if (!allowNegativeResult && result < 0) {
    throw new FinancialArithmeticError(
      `Minor-unit subtraction produced negative value ${result} where non-negative was required.`,
    );
  }
  return result;
}

/**
 * Computes an integer basis-points ratio (10,000 bps = 100.00%) using BigInt
 * half-up rounding without floating-point arithmetic. Returns null if denominator is 0.
 */
export function computeBasisPoints(numerator: number, denominator: number): number | null {
  const safeNum = assertSafeMinorUnits(numerator, "numerator", true);
  const safeDen = assertSafeMinorUnits(denominator, "denominator", false);
  if (safeDen === 0) {
    return null;
  }
  const scaled = BigInt(safeNum) * 10_000n;
  const den = BigInt(safeDen);
  const sign = scaled < 0n ? -1n : 1n;
  const absScaled = scaled < 0n ? -scaled : scaled;
  const rounded = (absScaled + den / 2n) / den;
  return Number(sign * rounded);
}

/**
 * Formats integer minor units as a decimal string without floating-point division.
 */
export function formatMinorUnits(amountMinor: number, currency: string): string {
  const safe = assertSafeMinorUnits(amountMinor, "amountMinor", true);
  const decimals = getCurrencyMinorDecimals(currency);
  const negative = safe < 0;
  const absBig = BigInt(safe < 0 ? -safe : safe);

  if (decimals === 0) {
    return `${negative ? "-" : ""}${absBig.toString()}`;
  }

  const divisor = 10n ** BigInt(decimals);
  const whole = absBig / divisor;
  const remainder = absBig % divisor;
  return `${negative ? "-" : ""}${whole.toString()}.${remainder
    .toString()
    .padStart(decimals, "0")}`;
}
