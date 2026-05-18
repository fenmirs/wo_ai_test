export function sanitizeHeaderName(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/^[^A-Za-z0-9\-_]+|[^A-Za-z0-9\-_]+$/g, '');
}

export function validateHeaderName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Header name is empty' };
  }
  if (!/^[A-Za-z0-9\-_]+$/.test(name)) {
    return {
      valid: false,
      error: `Header name "${name}" contains invalid characters. Only A-Z, a-z, 0-9, -, _ are allowed.`
    };
  }
  return { valid: true };
}

export function validateHeaderValue(value) {
  if (typeof value !== 'string') return { valid: true, warnings: [] };
  const errors = [];
  const warnings = [];

  if (/[\r\n]/.test(value)) {
    errors.push('Header value must not contain CR (\\r) or LF (\\n) characters');
  }
  if (/\0/.test(value)) {
    errors.push('Header value must not contain null character (\\0)');
  }

  if (errors.length > 0) {
    return { valid: false, error: errors.join('; ') };
  }

  const controlChars = value.match(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g);
  if (controlChars) {
    warnings.push(`Contains ${controlChars.length} control character(s) which will be removed`);
  }

  if (/[^\x20-\x7e\t]/.test(value)) {
    warnings.push('Contains non-ASCII characters. Consider using RFC 8187 encoding or Base64');
  }

  return { valid: true, warnings: warnings.length > 0 ? warnings : [] };
}

export function sanitizeParamValue(value) {
  if (typeof value !== 'string') return value;
  if (/^%[0-9a-fA-F]{2}/.test(value)) return value;
  return encodeURIComponent(value);
}

export function sanitizeParams(params) {
  if (!params || typeof params !== 'object') return params;
  const sanitized = {};
  for (const [key, value] of Object.entries(params)) {
    sanitized[key] = sanitizeParamValue(value);
  }
  return sanitized;
}

export function validateRequest({ headers } = {}) {
  const errors = [];
  const warnings = [];

  if (headers && typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) {
      const nameResult = validateHeaderName(key);
      if (!nameResult.valid) {
        errors.push(`Header name error: ${nameResult.error}`);
      }

      const valueResult = validateHeaderValue(value);
      if (!valueResult.valid) {
        errors.push(`Header "${key}" value error: ${valueResult.error}`);
      }
      if (valueResult.warnings && valueResult.warnings.length > 0) {
        warnings.push(`Header "${key}": ${valueResult.warnings.join('; ')}`);
      }
    }
  }

  return { errors, warnings };
}
