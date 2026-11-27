import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregatePaymentMetrics, aggregateRevenueAndRefunds } from "../../src/aggregations/index.js";
import {
  addMinorUnits,
  computeBasisPoints,
  CurrencyMismatchError,
  FinancialArithmeticError,
  formatMinorUnits,
  subtractMinorUnits,
} from "../../src/utils/money.js";
import { makeAuthorizedQuery, makeEvent } from "../helpers/synthetic-fixtures.js";

describe("Financial Arithmetic, Revenue, Refunds & Currency Safety", () => {
  it("performs exact integer minor-unit arithmetic without floating-point drift", () => {
    // Classic 0.1 + 0.2 !== 0.3 avoided via minor units (10 + 20 === 30)
    assert.equal(addMinorUnits(10, 20), 30);
    assert.equal(subtractMinorUnits(1000, 250), 750);
    assert.equal(formatMinorUnits(123456, "INR"), "1234.56");
    assert.equal(formatMinorUnits(-505, "USD"), "-5.05");
    assert.equal(formatMinorUnits(1500, "JPY"), "1500");
    assert.equal(computeBasisPoints(1, 3), 3333);

    assert.throws(() => addMinorUnits(10.5, 20), FinancialArithmeticError);
    assert.throws(() => addMinorUnits(-5, 10, false), FinancialArithmeticError);
  });

  it("separates multi-currency revenue streams and enforces strictCurrency when requested", () => {
    const query = makeAuthorizedQuery("tenant_alpha");
    const events = [
      makeEvent("payment.succeeded", {
        currency: "INR",
        amountMinor: 100_000,
        feeMinor: 2_000,
        netAmountMinor: 98_000,
        paymentMethodCategory: "upi",
      }),
      makeEvent("payment.refunded", {
        currency: "INR",
        refundAmountMinor: 20_000,
        originalAmountMinor: 100_000,
        reasonCategory: "customer_request",
        partial: true,
      }),
      makeEvent("payment.succeeded", {
        currency: "USD",
        amountMinor: 5_000,
        feeMinor: 200,
        netAmountMinor: 4_800,
        paymentMethodCategory: "card",
      }),
    ];

    const multi = aggregateRevenueAndRefunds(events, query);
    assert.equal(multi.multiCurrencyDetected, true);
    assert.equal(multi.byCurrency.length, 2);

    const inr = multi.byCurrency.find((c) => c.currency === "INR");
    assert.ok(inr);
    assert.equal(inr.grossRevenueMinor, 100_000);
    assert.equal(inr.totalFeesMinor, 2_000);
    assert.equal(inr.totalRefundedMinor, 20_000);
    assert.equal(inr.netRevenueAfterRefundsMinor, 78_000);
    assert.equal(inr.refundRateBps, 2000);
    assert.equal(inr.formattedNetRevenueAfterRefunds, "780.00");

    assert.throws(
      () => aggregateRevenueAndRefunds(events, query, { strictCurrency: "INR" }),
      CurrencyMismatchError,
    );
  });

  it("computes payment success/failure rates and failure category breakdown", () => {
    const query = makeAuthorizedQuery("tenant_alpha");
    const events = [
      makeEvent("payment.initiated", {
        currency: "INR",
        amountMinor: 10_000,
        paymentMethodCategory: "upi",
      }),
      makeEvent("payment.succeeded", {
        currency: "INR",
        amountMinor: 10_000,
        paymentMethodCategory: "upi",
        settlementDurationMs: 900,
      }),
      makeEvent("payment.initiated", {
        currency: "INR",
        amountMinor: 10_000,
        paymentMethodCategory: "card",
      }),
      makeEvent("payment.failed", {
        currency: "INR",
        amountMinor: 10_000,
        failureCategory: "gateway_timeout",
        paymentMethodCategory: "card",
        retryable: true,
      }),
    ];

    const pm = aggregatePaymentMetrics(events, query);
    assert.equal(pm.initiatedCount, 2);
    assert.equal(pm.terminalAttemptsCount, 2);
    assert.equal(pm.successRateBps, 5000);
    assert.equal(pm.failureRateBps, 5000);
    assert.equal(pm.retryableFailedCount, 1);
    assert.equal(pm.succeededVolumeByCurrencyMinor["INR"], 10_000);
    assert.equal(pm.failedVolumeByCurrencyMinor["INR"], 10_000);
  });
});
