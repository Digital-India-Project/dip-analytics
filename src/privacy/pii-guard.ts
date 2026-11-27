import { AnalyticsDomainError } from "../contracts/events.js";

export const MAX_EVENT_BYTES = 16 * 1024; // 16 KiB
export const MAX_OBJECT_DEPTH = 6;
export const MAX_STRING_VALUE_LENGTH = 512;

const PROTOTYPE_POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Normalized forbidden key names (lowercase, underscores stripped) that signal
 * PII, credentials, or sensitive uploaded documents.
 */
const FORBIDDEN_PII_KEYS = new Set([
  "email",
  "emailaddress",
  "useremail",
  "customeremail",
  "applicantemail",
  "phone",
  "phonenumber",
  "mobile",
  "mobilenumber",
  "telephone",
  "whatsapp",
  "aadhaar",
  "aadhaarnumber",
  "aadhar",
  "aadharnumber",
  "uidai",
  "pan",
  "pannumber",
  "pancard",
  "passport",
  "passportnumber",
  "ssn",
  "tin",
  "gstin",
  "dob",
  "dateofbirth",
  "birthdate",
  "fullname",
  "firstname",
  "lastname",
  "middlename",
  "customername",
  "applicantname",
  "personname",
  "fathername",
  "mothername",
  "address",
  "street",
  "streetaddress",
  "postalcode",
  "pincode",
  "zipcode",
  "ipaddress",
  "clientip",
  "remoteip",
  "useragent",
  "password",
  "passwd",
  "secret",
  "apikey",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "sessiontoken",
  "documenturl",
  "fileurl",
  "attachment",
  "attachments",
  "uploadedfile",
  "uploadeddoc",
  "kycdocument",
  "kycdoc",
  "filebase64",
  "documentbase64",
  "base64",
  "pdfdata",
  "bankaccount",
  "accountnumber",
  "ifsc",
  "cardnumber",
  "cvv",
  "upiid",
  "vpa",
]);

const EMAIL_VALUE_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PAN_VALUE_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
const AADHAAR_GROUPED_REGEX = /\b[2-9][0-9]{3}[\s-][0-9]{4}[\s-][0-9]{4}\b/;
const E164_OR_IN_PHONE_REGEX = /(?:\+91[\s-]?[6-9]\d{9}\b|\+[1-9]\d{7,14}\b)/;
const DATA_URI_OR_BASE64_DOC_REGEX = /^data:(?:application|image|text|audio|video)\//i;
const JWT_REGEX = /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;
const IPV4_REGEX =
  /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/;
const CARD_DIGITS_REGEX = /\b(?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12})\b/;

export interface PiiViolation {
  readonly path: string;
  readonly reason: string;
}

export class PrivacyViolationError extends AnalyticsDomainError {
  public readonly violations: readonly PiiViolation[];

  public constructor(violations: readonly PiiViolation[]) {
    const summary = violations.map((v) => `${v.path}: ${v.reason}`).join("; ");
    super("PRIVACY_VIOLATION", `Privacy/security policy violation: ${summary}`);
    this.name = "PrivacyViolationError";
    this.violations = violations;
  }
}

export class InputSizeLimitError extends AnalyticsDomainError {
  public constructor(message: string) {
    super("INPUT_SIZE_LIMIT_EXCEEDED", message);
    this.name = "InputSizeLimitError";
  }
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function inspectStringValue(value: string, path: string, violations: PiiViolation[]): void {
  if (value.length > MAX_STRING_VALUE_LENGTH) {
    violations.push({
      path,
      reason: `String length (${value.length}) exceeds maximum allowed (${MAX_STRING_VALUE_LENGTH}).`,
    });
    return;
  }

  if (EMAIL_VALUE_REGEX.test(value)) {
    violations.push({ path, reason: "Value matches an email address pattern (prohibited PII)." });
  } else if (PAN_VALUE_REGEX.test(value)) {
    violations.push({ path, reason: "Value matches a PAN identifier pattern (prohibited PII)." });
  } else if (AADHAAR_GROUPED_REGEX.test(value)) {
    violations.push({
      path,
      reason: "Value matches a grouped 12-digit national ID pattern (prohibited PII).",
    });
  } else if (E164_OR_IN_PHONE_REGEX.test(value)) {
    violations.push({ path, reason: "Value matches a phone number pattern (prohibited PII)." });
  } else if (DATA_URI_OR_BASE64_DOC_REGEX.test(value)) {
    violations.push({
      path,
      reason: "Value contains a data URI / embedded document payload (prohibited).",
    });
  } else if (JWT_REGEX.test(value)) {
    violations.push({ path, reason: "Value contains a bearer/JWT token (prohibited secret)." });
  } else if (CARD_DIGITS_REGEX.test(value)) {
    violations.push({ path, reason: "Value matches a payment card number pattern (prohibited)." });
  } else if (IPV4_REGEX.test(value)) {
    violations.push({ path, reason: "Value contains an IPv4 address (prohibited PII)." });
  }
}

export function scanForPrivacyViolations(
  value: unknown,
  path: string = "$",
  depth: number = 0,
): PiiViolation[] {
  const violations: PiiViolation[] = [];

  if (depth > MAX_OBJECT_DEPTH) {
    violations.push({
      path,
      reason: `Object nesting depth exceeds maximum allowed (${MAX_OBJECT_DEPTH}).`,
    });
    return violations;
  }

  if (value === null || value === undefined) {
    return violations;
  }

  if (typeof value === "string") {
    inspectStringValue(value, path, violations);
    return violations;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return violations;
  }

  if (typeof value !== "object") {
    violations.push({ path, reason: `Unsupported value type "${typeof value}".` });
    return violations;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      violations.push(...scanForPrivacyViolations(value[i], `${path}[${i}]`, depth + 1));
    }
    return violations;
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const childPath = `${path}.${key}`;
    if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
      violations.push({
        path: childPath,
        reason: `Forbidden prototype-pollution key "${key}".`,
      });
      continue;
    }

    const normalized = normalizeKey(key);
    if (FORBIDDEN_PII_KEYS.has(normalized)) {
      violations.push({
        path: childPath,
        reason: `Forbidden PII or document/credential field name "${key}".`,
      });
      continue;
    }

    violations.push(...scanForPrivacyViolations(record[key], childPath, depth + 1));
  }

  return violations;
}

export function assertNoPrivacyViolations(value: unknown, rootPath: string = "$"): void {
  const byteSize = Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
  if (byteSize > MAX_EVENT_BYTES) {
    throw new InputSizeLimitError(
      `Payload byte size (${byteSize} bytes) exceeds maximum allowed (${MAX_EVENT_BYTES} bytes).`,
    );
  }
  const violations = scanForPrivacyViolations(value, rootPath);
  if (violations.length > 0) {
    throw new PrivacyViolationError(violations);
  }
}

export function assertNoPrototypePollutionKeys(obj: Record<string, unknown>, path: string): void {
  for (const key of Object.getOwnPropertyNames(obj)) {
    if (PROTOTYPE_POLLUTION_KEYS.has(key)) {
      throw new PrivacyViolationError([
        { path: `${path}.${key}`, reason: `Forbidden prototype-pollution key "${key}".` },
      ]);
    }
  }
}
