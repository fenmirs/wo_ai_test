const generateId = () => `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const detectType = (value) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') {
    if (value.startsWith('{{ref:') || value.includes('{{ref:')) return 'string';
  }
  return typeof value;
};

const jsonToSchema = (jsonString, existingSchema = null) => {
  try {
    const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    
    if (existingSchema && typeof existingSchema === 'object') {
      const descriptionMap = buildDescriptionMap(existingSchema);
      return buildSchemaWithDescriptions(parsed, descriptionMap, null);
    }
    
    return buildSchema(parsed, null);
  } catch (e) {
    console.error('[JSONSchemaConverter] JSON parse error:', e);
    return null;
  }
};

const buildDescriptionMap = (schema, map = {}) => {
  if (!schema) return map;
  
  if (schema.key !== undefined && schema.key !== null) {
    const path = getNodePath(schema);
    if (schema.description) {
      map[path] = schema.description;
    }
  }
  
  if (schema.children && schema.children.length > 0) {
    schema.children.forEach(child => buildDescriptionMap(child, map));
  }
  
  return map;
};

const getNodePath = (node, parentPath = '') => {
  if (node.key === null || node.key === undefined) {
    return parentPath;
  }
  if (Array.isArray(node.key)) {
    return `${parentPath}[${node.key}]`;
  }
  return parentPath ? `${parentPath}.${node.key}` : String(node.key);
};

const buildSchemaWithDescriptions = (value, descriptionMap, key, parentPath = '') => {
  const currentPath = getNodePath({ key }, parentPath);
  const type = detectType(value);
  const node = {
    id: generateId(),
    type,
    key,
    value: null,
    description: descriptionMap[currentPath] || '',
    children: []
  };

  if (type === 'object') {
    const entries = Object.entries(value);
    node.children = entries.map(([k, v]) => 
      buildSchemaWithDescriptions(v, descriptionMap, k, currentPath)
    );
  } else if (type === 'array') {
    node.children = value.map((item, index) => 
      buildSchemaWithDescriptions(item, descriptionMap, index, currentPath)
    );
  } else {
    node.value = value;
  }

  return node;
};

const buildSchema = (value, key) => {
  const type = detectType(value);
  const node = {
    id: generateId(),
    type,
    key,
    value: null,
    description: '',
    children: []
  };

  if (type === 'object') {
    const entries = Object.entries(value);
    node.children = entries.map(([k, v]) => buildSchema(v, k));
  } else if (type === 'array') {
    node.children = value.map((item, index) => buildSchema(item, index));
  } else {
    node.value = value;
  }

  return node;
};

const schemaToJson = (schema, pretty = true) => {
  if (!schema) return '';
  
  const value = schemaToValue(schema);
  
  try {
    return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  } catch (e) {
    console.error('[JSONSchemaConverter] Schema to JSON error:', e);
    return '';
  }
};

const schemaToValue = (node) => {
  if (!node) return undefined;

  switch (node.type) {
    case 'object': {
      const obj = {};
      if (node.children) {
        node.children.forEach(child => {
          if (child.key !== null && child.key !== undefined) {
            const val = schemaToValue(child);
            if (val !== undefined) {
              obj[child.key] = val;
            }
          }
        });
      }
      return obj;
    }
    
    case 'array': {
      if (node.children) {
        return node.children.map(child => schemaToValue(child));
      }
      return [];
    }
    
    case 'string':
      return node.value === undefined ? '' : node.value;
    
    case 'number':
      return Number(node.value) || 0;
    
    case 'boolean':
      return node.value === true;
    
    case 'null':
      return null;
    
    default:
      return node.value;
  }
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
    if (!clonedParent.children) {
      clonedParent.children = [];
    }
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
  
  if (node) {
    Object.assign(node, updates);
  }
  
  return cloned;
};

const JSONSchemaConverter = {
  jsonToSchema,
  schemaToJson,
  schemaToValue,
  cloneSchema,
  findNodeById,
  findParentNode,
  addChildNode,
  removeNode,
  updateNode,
  generateId,
  detectType
};

export default JSONSchemaConverter;
