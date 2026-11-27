import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PrivacyViolationError, TenantBoundaryViolationError } from "../../src/privacy/index.js";
import {
  exportAggregateReportToJson,
  exportAggregateRowsToCsv,
  ExportSecurityError,
  paginateRows,
  ReportFilterError,
  sanitizeCsvCellValue,
} from "../../src/reporting/index.js";
import { makeAuthContext } from "../helpers/synthetic-fixtures.js";

describe("Reporting Filters, Pagination, CSV Formula Injection & Export Safeguards", () => {
  it("neutralizes OWASP spreadsheet formula injection vectors in CSV cells", () => {
    assert.equal(sanitizeCsvCellValue("=CMD|' /C calc'!A0"), "'=CMD|' /C calc'!A0");
    assert.equal(sanitizeCsvCellValue("+1+1"), "'+1+1");
    assert.equal(sanitizeCsvCellValue("-100"), "'-100");
    assert.equal(sanitizeCsvCellValue("@SUM(1+1)*cmd"), "'@SUM(1+1)*cmd");
    assert.equal(sanitizeCsvCellValue("\t=1+1"), "'\t=1+1");
    assert.equal(sanitizeCsvCellValue("  =HYPERLINK(\"http://evil\")"), "\"'  =HYPERLINK(\"\"http://evil\"\")\"");
    assert.equal(sanitizeCsvCellValue("SVC_PASSPORT, v1"), "\"SVC_PASSPORT, v1\"");
  });

  it("exports paginated aggregate rows to CSV and blocks raw identifiers or PII", () => {
    const auth = makeAuthContext("tenant_alpha");
    const rows = [
      { serviceCode: "=EVIL_SVC", submittedCount: 10, currency: "INR" },
      { serviceCode: "SVC_2", submittedCount: 25, currency: "INR" },
      { serviceCode: "SVC_3", submittedCount: 5, currency: "INR" },
    ];

    const csvOut = exportAggregateRowsToCsv(rows, auth, {
      columns: ["serviceCode", "submittedCount", "currency"],
      pagination: { page: 1, pageSize: 2 },
    });

    assert.equal(csvOut.rowCount, 2);
    assert.equal(csvOut.totalRows, 3);
    assert.equal(csvOut.hasNextPage, true);
    assert.ok(csvOut.csv.includes("'=EVIL_SVC,10,INR"));

    assert.throws(
      () =>
        exportAggregateRowsToCsv(
          [{ eventId: "evt_1", count: 1 }],
          auth,
          { columns: ["eventId", "count"] },
        ),
      ExportSecurityError,
    );

    assert.throws(
      () =>
        exportAggregateRowsToCsv(
          [{ serviceCode: "user@example.org", count: 1 }],
          auth,
          { columns: ["serviceCode", "count"] },
        ),
      PrivacyViolationError,
    );
  });

  it("enforces tenant boundary on JSON export and rejects invalid pagination", () => {
    const auth = makeAuthContext("tenant_alpha");
    const exported = exportAggregateReportToJson(
      { tenantId: "tenant_alpha", submittedCount: 42 },
      auth,
    );
    assert.equal(exported.aggregateOnly, true);
    assert.equal(exported.tenantId, "tenant_alpha");

    assert.throws(
      () => exportAggregateReportToJson({ tenantId: "tenant_beta", submittedCount: 1 }, auth),
      TenantBoundaryViolationError,
    );

    assert.throws(() => paginateRows([], { page: 0 }), ReportFilterError);
    assert.throws(() => paginateRows([], { pageSize: 5000 }), ReportFilterError);
  });
});
