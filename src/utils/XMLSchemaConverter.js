import { XMLParser, XMLValidator } from 'fast-xml-parser';

const generateId = () => `xml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: false,
};

const createEmptySchema = () => ({
  id: generateId(),
  type: 'object',
  key: null,
  value: null,
  description: '',
  children: []
});

const hasMixedContent = (xmlString) => {
  if (!xmlString || !xmlString.trim()) return false;
  try {
    const parser = new XMLParser({
      ...parserOptions,
      preserveOrder: true,
    });
    const result = parser.parse(xmlString);
    return checkMixedContent(Object.values(result));
  } catch (e) {
    return false;
  }
};

const checkMixedContent = (arr) => {
  if (!Array.isArray(arr)) return false;
  const hasNonWhitespaceText = arr.some(item => {
    if ('#text' in item) return item['#text'].trim().length > 0;
    return false;
  });
  const hasElements = arr.some(item => {
    const keys = Object.keys(item);
    return keys.length > 0 && keys[0] !== '#text';
  });
  if (hasNonWhitespaceText && hasElements) return true;
  for (const item of arr) {
    const entryKey = Object.keys(item)[0];
    if (entryKey === '#text') continue;
    if (checkMixedContent(item[entryKey])) return true;
  }
  return false;
};

const xmlToSchema = (xmlString, existingSchema = null) => {
  if (!xmlString || !xmlString.trim()) {
    return createEmptySchema();
  }

  try {
    const parser = new XMLParser(parserOptions);
    const result = parser.parse(xmlString);

    const keys = Object.keys(result);
    if (keys.length === 0) return createEmptySchema();

    const rootKey = keys.find(k => !k.startsWith('?')) || keys[0];
    const rootValue = result[rootKey];

    const schema = buildSchemaFromValue(rootValue, rootKey);

    if (existingSchema && typeof existingSchema === 'object') {
      const descriptionMap = buildDescriptionMap(existingSchema);
      applyDescriptions(schema, descriptionMap);
    }

    return schema;
  } catch (e) {
    console.error('[XMLSchemaConverter] Parse error:', e);
    return null;
  }
};

const buildSchemaFromValue = (value, key) => {
  if (typeof value === 'string') {
    return {
      id: generateId(),
      type: 'string',
      key,
      value,
      description: '',
      children: []
    };
  }

  if (Array.isArray(value)) {
    const children = value.map((item, idx) => {
      const itemSchema = buildSchemaFromValue(item, idx);
      itemSchema._originalKey = key;
      return itemSchema;
    });
    return {
      id: generateId(),
      type: 'array',
      key,
      value: null,
      description: '',
      children
    };
  }

  if (typeof value === 'object' && value !== null) {
    const children = [];

    for (const [propKey, propValue] of Object.entries(value)) {
      if (propKey === '#text') {
        children.push({
          id: generateId(),
          type: 'string',
          key: '#text',
          value: String(propValue ?? ''),
          description: '',
          children: []
        });
      } else if (propKey.startsWith('@_')) {
        const attrName = '@' + propKey.substring(2);
        children.push({
          id: generateId(),
          type: 'string',
          key: attrName,
          value: String(propValue ?? ''),
          description: '',
          children: []
        });
      } else {
        const childSchema = buildSchemaFromValue(propValue, propKey);
        children.push(childSchema);
      }
    }

    return {
      id: generateId(),
      type: 'object',
      key,
      value: null,
      description: '',
      children
    };
  }

  return {
    id: generateId(),
    type: 'string',
    key,
    value: String(value ?? ''),
    description: '',
    children: []
  };
};

const buildDescriptionMap = (schema, map = {}) => {
  if (!schema) return map;
  if (schema.key !== undefined && schema.key !== null && schema.description) {
    const path = getNodePath(schema);
    map[path] = schema.description;
  }
  if (schema.children) {
    schema.children.forEach(child => buildDescriptionMap(child, map));
  }
  return map;
};

const getNodePath = (node, parentPath = '') => {
  if (node.key === null || node.key === undefined) return parentPath;
  const key = String(node.key);
  if (key.startsWith('@')) {
    return parentPath ? `${parentPath}/${key}` : key;
  }
  if (parentPath) return `${parentPath}/${key}`;
  return key;
};

const applyDescriptions = (schema, descriptionMap) => {
  if (!schema) return;
  const path = getNodePath(schema);
  if (descriptionMap[path]) {
    schema.description = descriptionMap[path];
  }
  if (schema.children) {
    schema.children.forEach(child => applyDescriptions(child, descriptionMap));
  }
};

const escapeXml = (str) => {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const schemaToXml = (schema, pretty = true) => {
  if (!schema) return '';

  const indent = pretty ? '  ' : '';
  const newline = pretty ? '\n' : '';

  const buildXml = (node, depth) => {
    if (!node) return '';

    if (node.type === 'string' && node.key === '#text') {
      return escapeXml(String(node.value ?? ''));
    }

    if (node.type === 'string' || node.type === 'number' || node.type === 'boolean') {
      if (node.key && String(node.key).startsWith('@')) {
        return null;
      }
      const tagName = node.key;
      if (tagName === null || tagName === undefined) {
        return escapeXml(String(node.value ?? ''));
      }
      const val = escapeXml(String(node.value ?? ''));
      const padding = indent.repeat(depth);
      return `${padding}<${tagName}>${val}</${tagName}>${newline}`;
    }

    if (node.type === 'array') {
      let result = '';
      const tagName = node._originalKey || node.key;
      if (node.children) {
        node.children.forEach(child => {
          result += buildXml({ ...child, key: tagName }, depth);
        });
      }
      return result;
    }

    const tagName = node.key;
    if (tagName === null || tagName === undefined) {
      let result = '';
      if (node.children) {
        node.children.forEach(child => {
          result += buildXml(child, depth);
        });
      }
      return result;
    }

    const attrs = [];
    const childNodes = [];

    if (node.children) {
      node.children.forEach(child => {
        if (child.key && String(child.key).startsWith('@')) {
          const attrName = String(child.key).substring(1);
          attrs.push({ name: attrName, value: String(child.value ?? '') });
        } else {
          childNodes.push(child);
        }
      });
    }

    const attrStr = attrs.length > 0
      ? ' ' + attrs.map(a => `${a.name}="${escapeXml(a.value)}"`).join(' ')
      : '';

    if (childNodes.length === 0) {
      const padding = indent.repeat(depth);
      return `${padding}<${tagName}${attrStr}/>${newline}`;
    }

    const textChildren = childNodes.filter(c => c.key === '#text');
    const elemChildren = childNodes.filter(c => c.key !== '#text');

    if (elemChildren.length === 0 && textChildren.length > 0) {
      const padding = indent.repeat(depth);
      const text = textChildren.map(c => escapeXml(String(c.value ?? ''))).join('');
      return `${padding}<${tagName}${attrStr}>${text}</${tagName}>${newline}`;
    }

    const padding = indent.repeat(depth);
    let result = `${padding}<${tagName}${attrStr}>${newline}`;
    childNodes.forEach(child => {
      result += buildXml(child, depth + 1);
    });
    result += `${padding}</${tagName}>${newline}`;
    return result;
  };

  let xml = buildXml(schema, 0);
  if (pretty) {
    xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
  }
  return xml;
};

const validateXml = (xmlString) => {
  if (!xmlString || !xmlString.trim()) return null;
  const result = XMLValidator.validate(xmlString);
  if (result === true) return null;
  return result.err;
};

const cloneSchema = (schema) => {
  if (!schema) return null;
  return JSON.parse(JSON.stringify(schema));
};

const findNodeById = (schema, nodeId) => {
  if (!schema || !nodeId) return null;
  if (schema.id === nodeId) return schema;
  if (schema.children) {
    for (const child of schema.children) {
      const found = findNodeById(child, nodeId);
      if (found) return found;
    }
  }
  return null;
};

const findParentNode = (schema, nodeId, parent = null) => {
  if (!schema) return null;
  if (schema.id === nodeId) return parent;
  if (schema.children) {
    for (const child of schema.children) {
      const found = findParentNode(child, nodeId, schema);
      if (found) return found;
    }
  }
  return null;
};

const addChildNode = (schema, parentId, newNode) => {
  const parent = findNodeById(schema, parentId);
  if (!parent) return schema;
  const cloned = cloneSchema(schema);
  const clonedParent = findNodeById(cloned, parentId);
  if (clonedParent) {
    if (!clonedParent.children) clonedParent.children = [];
    clonedParent.children.push({ ...newNode, id: generateId() });
  }
  return cloned;
};

const removeNode = (schema, nodeId) => {
  const parent = findParentNode(schema, nodeId);
  if (!parent) return schema;
  const cloned = cloneSchema(schema);
  const clonedParent = findNodeById(cloned, parent.id);
  if (clonedParent && clonedParent.children) {
    clonedParent.children = clonedParent.children.filter(c => c.id !== nodeId);
  }
  return cloned;
};

const updateNode = (schema, nodeId, updates) => {
  const cloned = cloneSchema(schema);
  const node = findNodeById(cloned, nodeId);
  if (node) Object.assign(node, updates);
  return cloned;
};

const XMLSchemaConverter = {
  xmlToSchema,
  schemaToXml,
  validateXml,
  hasMixedContent,
  cloneSchema,
  findNodeById,
  findParentNode,
  addChildNode,
  removeNode,
  updateNode,
  generateId
};

export default XMLSchemaConverter;
