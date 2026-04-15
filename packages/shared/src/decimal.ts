import Decimal from "decimal.js";

// Configure Decimal.js: 20 significant digits, ROUND_HALF_UP (commercial rounding)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/** Round a Decimal value to 2 decimal places using commercial (half-up) rounding. */
export function round2(value: Decimal | string | number): string {
  return new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

/** Compute line net, supporting both percentage and absolute discount.
 *  discountType = "pct": lineNet = qty * price * (1 - discount/100)
 *  discountType = "abs": lineNet = max(0, qty * price - discount)
 */
export function computeLineNet(
  quantity: string,
  unitPrice: string,
  discountPct: string,
  discountType: "pct" | "abs" = "pct"
): string {
  const qty = new Decimal(quantity);
  const price = new Decimal(unitPrice);
  const gross = qty.mul(price);
  if (discountType === "abs") {
    const absDiscount = new Decimal(discountPct);
    return round2(Decimal.max(0, gross.minus(absDiscount)));
  }
  const factor = new Decimal(1).minus(new Decimal(discountPct).div(100));
  return round2(gross.mul(factor));
}

/** Compute line tax: lineNet * taxRatePct / 100, rounded to 2dp. */
export function computeLineTax(lineNet: string, taxRatePct: string): string {
  return round2(new Decimal(lineNet).mul(new Decimal(taxRatePct)).div(100));
}

/** Compute line gross: lineNet + lineTax. */
export function computeLineGross(lineNet: string, lineTax: string): string {
  return round2(new Decimal(lineNet).plus(new Decimal(lineTax)));
}

/** Sum an array of string decimal values. */
export function sumStrings(values: string[]): string {
  return values
    .reduce((acc, v) => acc.plus(new Decimal(v)), new Decimal(0))
    .toFixed(2);
}

/** Format a decimal string as EUR currency string (e.g. "1.234,56 €"). */
export function formatEur(value: string, locale = "de-DE"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

/** Parse a localized number string back to a plain decimal string. */
export function parseDecimalInput(raw: string): string {
  // Replace German thousands separator (.) and decimal comma (,) with standard dot
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const d = new Decimal(normalized || "0");
  return d.toFixed(2);
}
