class CurlParser {
  static parse(text) {
    const result = {
      method: 'GET',
      url: '',
      headers: [],
      params: [],
      body: null,
      bodyType: 'none'
    };

    let remaining = text.trim();
    if (!remaining) return result;

    // Normalize line continuations (backslash at end of line)
    remaining = remaining.replace(/\\\n/g, ' ').replace(/\\\r\n/g, ' ');

    // Remove leading "curl " if present
    remaining = remaining.replace(/^curl\s+/i, '');

    // Parse tokens respecting quotes
    const tokens = this._tokenize(remaining);

    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];

      if (token === '-X' || token === '--request') {
        i++;
        if (i < tokens.length) result.method = tokens[i].toUpperCase();
      } else if (token === '-H' || token === '--header') {
        i++;
        if (i < tokens.length) {
          const header = this._parseHeader(tokens[i]);
          if (header) result.headers.push(header);
        }
      } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary') {
        i++;
        if (i < tokens.length) {
          result.body = tokens[i];
          result.bodyType = 'raw';
        }
      } else if (token === '--data-urlencode') {
        i++;
        if (i < tokens.length) {
          const eqIdx = tokens[i].indexOf('=');
          if (eqIdx > 0) {
            const key = tokens[i].substring(0, eqIdx);
            const val = tokens[i].substring(eqIdx + 1);
            if (!result.body) result.body = {};
            if (typeof result.body === 'object') result.body[key] = val;
            result.bodyType = 'x-www-form-urlencoded';
          }
        }
      } else if (token === '-F' || token === '--form') {
        i++;
        if (i < tokens.length) {
          const eqIdx = tokens[i].indexOf('=');
          if (eqIdx > 0) {
            const key = tokens[i].substring(0, eqIdx);
            const val = tokens[i].substring(eqIdx + 1);
            if (!result.body) result.body = {};
            if (typeof result.body === 'object') result.body[key] = val;
            result.bodyType = 'form-data';
          }
        }
      } else if (token === '-u' || token === '--user') {
        // Basic auth - skip, user can handle manually
        i++;
      } else if (token.startsWith('-') || token.startsWith('--')) {
        // Skip unknown flags (like -k, --insecure, -L, --location, etc.)
        i++;
        // Some flags take a value, but we just skip to next
      } else if (!result.url) {
        // First non-flag argument is the URL
        result.url = token;
      }

      i++;
    }

    // Parse URL into base + params
    this._parseUrl(result);

    // If method is GET but we have body data, change to POST
    if (result.body && result.method === 'GET') {
      result.method = 'POST';
    }

    // Detect content-type from headers
    const ctHeader = result.headers.find(h => h.key.toLowerCase() === 'content-type');
    if (ctHeader) {
      const ct = ctHeader.value.toLowerCase();
      if (ct.includes('x-www-form-urlencoded')) result.bodyType = 'x-www-form-urlencoded';
      else if (ct.includes('form-data')) result.bodyType = 'form-data';
      else if (ct.includes('json')) result.bodyType = 'raw';
    }

    return result;
  }

  static _tokenize(text) {
    const tokens = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    let escape = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (escape) {
        current += ch;
        escape = false;
        continue;
      }

      if (ch === '\\' && (inSingle || inDouble)) {
        escape = true;
        continue;
      }

      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
        continue;
      }

      if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
        continue;
      }

      if (ch === ' ' && !inSingle && !inDouble) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      current += ch;
    }

    if (current) tokens.push(current);
    return tokens;
  }

  static _parseHeader(str) {
    const colonIdx = str.indexOf(':');
    if (colonIdx <= 0) return null;
    return {
      key: str.substring(0, colonIdx).trim(),
      value: str.substring(colonIdx + 1).trim(),
      type: 'string',
      description: '',
      enabled: true
    };
  }

  static _parseUrl(result) {
    if (!result.url) return;

    // Remove surrounding quotes if present
    let url = result.url.replace(/^['"]|['"]$/g, '');

    const qIdx = url.indexOf('?');
    if (qIdx >= 0) {
      const queryString = url.substring(qIdx + 1);
      url = url.substring(0, qIdx);

      // Parse query string
      queryString.split('&').forEach(pair => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          result.params.push({
            key: decodeURIComponent(pair.substring(0, eqIdx)),
            default: decodeURIComponent(pair.substring(eqIdx + 1)),
            type: 'string',
            description: '',
            enabled: true
          });
        } else if (pair) {
          result.params.push({
            key: decodeURIComponent(pair),
            default: '',
            type: 'string',
            description: '',
            enabled: true
          });
        }
      });
    }

    result.url = url;
  }
}

export default CurlParser;
