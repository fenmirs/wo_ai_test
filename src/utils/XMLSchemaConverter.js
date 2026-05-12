const generateId = () => `xml_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const xmlToSchema = (xmlString, existingSchema = null) => {
  if (!xmlString || !xmlString.trim()) {
    return {
      id: generateId(),
      type: 'object',
      key: null,
      value: null,
      description: '',
      children: []
    };
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('[XMLSchemaConverter] XML parse error:', parseError.textContent);
      return null;
    }

    const root = doc.documentElement;
    if (!root) return null;

    let schema = elementToSchema(root);

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

const elementToSchema = (element) => {
  const node = {
    id: generateId(),
    type: 'object',
    key: element.tagName,
    value: null,
    description: '',
    children: []
  };

  const hasAttributes = element.attributes && element.attributes.length > 0;
  const hasChildElements = element.children && element.children.length > 0;
  const hasTextContent = element.textContent && element.textContent.trim().length > 0;

  if (hasAttributes) {
    for (const attr of element.attributes) {
      node.children.push({
        id: generateId(),
        type: 'string',
        key: `@${attr.name}`,
        value: attr.value,
        description: '',
        children: []
      });
    }
  }

  if (hasChildElements) {
    const childTagCounts = {};
    for (const child of element.children) {
      if (!childTagCounts[child.tagName]) childTagCounts[child.tagName] = 0;
      childTagCounts[child.tagName]++;
    }

    const grouped = {};
    for (const child of element.children) {
      const tag = child.tagName;
      if (childTagCounts[tag] > 1) {
        if (!grouped[tag]) grouped[tag] = [];
        grouped[tag].push(child);
      } else {
        if (!grouped[tag]) grouped[tag] = [];
        grouped[tag].push(child);
      }
    }

    for (const [tag, children] of Object.entries(grouped)) {
      if (children.length > 1) {
        const arrayNode = {
          id: generateId(),
          type: 'array',
          key: tag,
          value: null,
          description: '',
          children: children.map((child, idx) => ({
            ...elementToSchema(child),
            key: idx
          }))
        };
        node.children.push(arrayNode);
      } else {
        const childSchema = elementToSchema(children[0]);
        const onlyWhitespace = children[0].children.length === 0 &&
          children[0].textContent.trim().length === 0;
        if (onlyWhitespace) {
          node.children.push({
            id: generateId(),
            type: 'string',
            key: tag,
            value: '',
            description: '',
            children: []
          });
        } else {
          const singleChild = elementToSchema(children[0]);
          if (singleChild.type === 'object' && singleChild.children.length === 0 && !hasTextContent) {
            singleChild.type = 'string';
            singleChild.value = children[0].textContent || '';
          }
          node.children.push(singleChild);
        }
      }
    }
  } else if (hasTextContent) {
    node.children.push({
      id: generateId(),
      type: 'string',
      key: '#text',
      value: element.textContent.trim(),
      description: '',
      children: []
    });
  }

  return node;
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

const schemaToXml = (schema, pretty = true) => {
  if (!schema) return '';

  const indent = pretty ? '  ' : '';
  const newline = pretty ? '\n' : '';

  const buildXml = (node, depth) => {
    if (!node) return '';

    if (node.type === 'string' && node.key === '#text') {
      return escapeXml(String(node.value ?? ''));
    }

    if (node.type === 'string' || (node.type === 'number' || node.type === 'boolean')) {
      if (node.key && String(node.key).startsWith('@')) {
        return null;
      }
      const tagName = node.key;
      const val = escapeXml(String(node.value ?? ''));
      if (node.key === null || node.key === undefined) return val;
      const padding = indent.repeat(depth);
      return `${padding}<${tagName}>${val}</${tagName}>${newline}`;
    }

    if (node.type === 'array') {
      let result = '';
      if (node.children) {
        node.children.forEach(child => {
          result += buildXml({ ...child, key: node.key }, depth);
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

    const hasTextChild = childNodes.length === 1 &&
      childNodes[0].key === '#text';
    if (hasTextChild) {
      const padding = indent.repeat(depth);
      const text = escapeXml(String(childNodes[0].value ?? ''));
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

const escapeXml = (str) => {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
  cloneSchema,
  findNodeById,
  findParentNode,
  addChildNode,
  removeNode,
  updateNode,
  generateId
};

export default XMLSchemaConverter;
