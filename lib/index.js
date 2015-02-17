'use strict';

/**
 * exports
 */
module.exports = function() {
  const types = {
    int8: valueType(Int8Array, 'int8', 1),
    uint8: valueType(Uint8Array, 'uint8', 1),
    uint8clamped: valueType(Uint8ClampedArray, 'uint8', 1),
    int16: valueType(Int16Array, 'int16', 2),
    uint16: valueType(Uint16Array, 'uint16', 2),
    int32: valueType(Int32Array, 'int32', 4),
    uint32: valueType(Uint32Array, 'uint32', 4),
    float32: valueType(Float32Array, 'float32', 4),
    float64: valueType(Float64Array, 'float64', 8),
    any: referenceType('any'),
    object: referenceType('object'),
    string: referenceType('string'),
    StructType: StructType,
    ArrayType: ArrayType
  };

  for (let type in types) {
    global[type] = types[type];
  }
};

// alias
const getOwnPropertyNames = Object.getOwnPropertyNames;
const preventExtensions = Object.preventExtensions;
const defineProperty = Object.defineProperty;
const min = Math.min;

// global
let TYPED_OBJECTS = {};

function StructType(schema) {
  let props = getOwnPropertyNames(schema);

  let internals = {};
  let viewTypes = [];
  let fieldOffsets = {};
  let fieldTypes = {};

  let size = 0;
  let maxElemAlign = 0;
  let opaque = false;

  for (let pName of props) {
    let pType = schema[pName];

    throwTypeError(pType._clazz !== TYPED_OBJECTS, 'property ' + pName + ': unknown type');
    throwTypeError(typeof pType._size === 'undefined', 'type ' + pType._name + ' is variable-length');

    size = resize(size, pType._alignment);

    let viewTypeIdx = viewTypes.indexOf(pType._createView);
    if (viewTypeIdx < 0) {
      viewTypeIdx = viewTypes.length;
      viewTypes.push(pType._createView);
    }

    internals[pName] = {
      viewTypeIdx: viewTypeIdx,
      offset: size / pType._alignment,
      byteOffset: size,
      type: pType
    };

    fieldOffsets[pName] = size;
    fieldTypes[pName] = pType;

    if (pType._alignment > maxElemAlign) {
      maxElemAlign = pType._alignment;
    }

    size += pType._size;
    opaque = opaque || pType._opaque;
  }

  size = resize(size, maxElemAlign);

  let structType = function(struct, offset, struct1) {
    let views = new Array(viewTypes.length);

    let storage;
    if (struct instanceof ArrayBuffer) {
      throwTypeError(opaque, 'cannot create opaque type over ArrayBuffer');

      struct = new Storage(struct, false);
    }
    if (struct instanceof Storage) {
      storage = struct;
      throwTypeError(opaque && !storage.opaque, 'cannot create opaque type over non-opaque storage');

      for (let i = 0; i < viewTypes.length; i++) {
        views[i] = viewTypes[i](storage, offset, size / viewTypes[i].BYTES_PER_ELEMENT);
      }
    } else {
      storage = new Storage(new ArrayBuffer(size), opaque);
      for (let j = 0; j < viewTypes.length; j++) {
        views[j] = viewTypes[j](storage);
      }
    }
    let opaqueInstance = opaque || storage.opaque;

    function set(obj, name) {
      let internalDescr = internals[name];
      let view = views[internalDescr.viewTypeIdx];
      let offset = internalDescr.offset;
      defineProperty(obj, name, {
        configurable: false,
        enumerable: true,
        get: function() {
          return internalDescr.type._getItem(view, offset);
        },
        set: function(value) {
          internalDescr.type._setItem(view, offset, value);
        }
      });
    }
    for (let p of props) {
      set(this, p);
    }
    if (!(struct instanceof Storage) && struct) {
      for (let p of props) {
        this[p] = struct[p];
      }
    } else if (struct1) {
      for (let p of props) {
        this[p] = struct1[p];
      }
    }

    this._opaque = opaqueInstance;
    if (!opaqueInstance) {
      this._storage = {
        buffer: storage.arrayBuffer,
        byteOffset: offset ? offset : 0,
        byteLength: size
      };
    }
    preventExtensions(this);
  };

  structType._size = size;
  structType._alignment = maxElemAlign;
  structType._createView = structView(structType);
  structType._createView.BYTES_PER_ELEMENT = size;
  structType._getItem = function(view, offset) {
    return view.getItem(offset);
  };
  structType._setItem = function(view, offset, value) {
    view.setItem(offset, value);
  };
  structType._clazz = TYPED_OBJECTS;
  structType._opaque = opaque;

  setReadOnly(structType, 'variable', false);
  setReadOnly(structType, 'opaque', opaque);
  setReadOnly(structType, 'fieldTypes', fieldTypes);
  if (!opaque) {
    setReadOnly(structType, 'byteLength', size);
    setReadOnly(structType, 'byteAlignment', maxElemAlign);
    setReadOnly(structType, 'fieldOffsets', fieldOffsets);

    structType.storage = function(o) {
      throwTypeError(o._opaque, 'cannot access storage of opaque instance');
      return o._storage;
    };
  }
  return structType;
}

function ArrayType(elementType, length) {
  throwTypeError(elementType._clazz !== TYPED_OBJECTS, 'not a type');
  throwTypeError(typeof elementType._size === 'undefined', 'element type cannot be of variable length');

  let fixedLength = typeof length !== 'undefined';
  let opaque = elementType._opaque;

  let arrayType = function(data, byteOffset, data1) {
    let self = this;
    let view;
    let viewLength;
    byteOffset = byteOffset || 0;
    let storage;

    if (fixedLength) {
      viewLength = length;
      if (data instanceof ArrayBuffer) {
        throwTypeError(opaque, 'cannot create a view of opaque type over an array buffer');
        data = new Storage(data, opaque);
      }
      if (data instanceof Storage) {
        throwTypeError(byteOffset % elementType._size !== 0, 'ArrayBuffer size must be a multiple of ' + elementType._size);
        storage = data;
        view = elementType._createView(storage, byteOffset, viewLength);
      } else {
        storage = new Storage(new ArrayBuffer(viewLength * elementType._size), opaque);
        view = elementType._createView(storage);
      }
    } else {
      viewLength = data;
      storage = new Storage(new ArrayBuffer(viewLength * elementType._size), opaque);
      view = elementType._createView(storage, 0, viewLength);
    }

    function set(index) {
      let off = index * elementType._size / elementType._alignment;
      defineProperty(self, index, {
        configurable: false,
        enumerable: true,
        get: function() {
          return elementType._getItem(view, off);
        },
        set: function(value) {
          elementType._setItem(view, off, value);
        }
      });
    }
    for (let i = 0; i < viewLength; i++) {
      set(i);
    }
    let opaqueInstance = opaque || storage.opaque;
    self._opaque = opaqueInstance;
    defineProperty(self, 'length', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: viewLength
    });

    if (!opaqueInstance) {
      defineProperty(self, 'byteOffset', {
        configurable: false,
        enumerable: false,
        writable: false,
        value: byteOffset
      });
      defineProperty(self, 'byteLength', {
        configurable: false,
        enumerable: false,
        writeable: false,
        value: elementType._size * viewLength
      });
      if (!opaqueInstance) {
        self._storage = {
          byteOffset: byteOffset,
          byteLength: self.byteLength,
          buffer: storage.arrayBuffer
        };
      }
    }

    if (fixedLength && !(data instanceof Storage) && data) {
      for (let x = 0; x < min(viewLength, data.length); x++) {
        self[x] = data[x];
      }
    } else if (data1) {
      for (let y = 0; y < min(viewLength, data1.length); y++) {
        self[y] = data1[y];
      }
    }
    preventExtensions(self);
  };

  if (fixedLength) {
    arrayType._size = length * elementType._size;
  }
  arrayType._alignment = elementType._alignment;
  arrayType._createView = structView(arrayType);
  arrayType._getItem = function(view, offset) {
    return view.getItem(offset);
  };
  arrayType._setItem = function(view, offset, value) {
    view.setItem(offset, value);
  };
  arrayType._clazz = TYPED_OBJECTS;
  arrayType._opaque = opaque;

  setReadOnly(arrayType, 'variable', !fixedLength);
  setReadOnly(arrayType, 'elementType', elementType);
  setReadOnly(arrayType, 'opaque', opaque);
  if (!opaque) {
    if (fixedLength) {
      setReadOnly(arrayType, 'byteLength', arrayType._size);
    }
    setReadOnly(arrayType, 'byteAlignment', arrayType._alignment);

    arrayType.storage = function(o) {
      throwTypeError(o._opaque, 'cannot access storage of opaque instance');
      return o._storage;
    };
  }

  return arrayType;
}

/**
 * Storage
 */
function Storage(arrayBuffer, isOpaque) {
  this.arrayBuffer = arrayBuffer;
  this.opaque = isOpaque;
  if (isOpaque) {
    this.opaqueBuffer = new Array(this.arrayBuffer.byteLength);
  }
}

/**
 * OpaqueView
 */
function OpaqueView(storage) {
  this._storage = storage;
}

OpaqueView.prototype.getItem = function(index) {
  return this._storage.opaqueBuffer[index];
};

OpaqueView.prototype.setItem = function(index, value) {
  this._storage.opaqueBuffer[index] = value;
};

function createOpaqueView(storage) {
  return new OpaqueView(storage);
}

createOpaqueView.BYTES_PER_ELEMENT = 1;

/**
 * utils
 */
function throwTypeError(condition, message) {
  if (condition) throw new TypeError(message);
}

function resize(size, elemSize) {
  let i = size % elemSize;
  return i === 0 ? size : size + elemSize - i;
}

function setReadOnly(obj, key, value) {
  defineProperty(obj, key, {
    value: value,
    writable: false,
    configurable: false
  });
}

function valueType(TypedArray, name, size) {
  let type = {};
  type._size = size;
  type._createView = function(s, byteOffset, length) {
    return new TypedArray(s.arrayBuffer, byteOffset, length);
  };
  type._createView.BYTES_PER_ELEMENT = TypedArray.BYTES_PER_ELEMENT;
  type._getItem = function(view, offset) {
    return view[offset];
  };
  type._setItem = function(view, offset, value) {
    view[offset] = value;
  };
  type._name = name;
  type._alignment = size;
  type._clazz = TYPED_OBJECTS;
  type._size = size;
  type._opaque = false;

  setReadOnly(type, 'variable', false);
  setReadOnly(type, 'opaque', false);
  setReadOnly(type, 'byteLength', size);
  setReadOnly(type, 'byteAlignment', size);

  return type;
}

function referenceType(name) {
  let type = {};
  type._size = 1;
  type._createView = createOpaqueView;
  type._getItem = function(view, offset) {
    return view.getItem(offset);
  };
  type._setItem = function(view, offset, value) {
    view.setItem(offset, value);
  };
  type._name = name;
  type._alignment = 1;
  type._clazz = TYPED_OBJECTS;
  type._size = 1;
  type._opaque = true;
  return type;
}

// emulate typed array for structs and arrays
function structView(Type) {
  function Result(storage, offset, length) {
    if (!offset) {
      offset = 0;
      length = storage.arrayBuffer.byteLength / Type._alignment;
    }
    this._storage = storage;
    this._offset = offset;
  }

  Result.prototype.getItem = function(index) {
    return new Type(this._storage, this._offset + index * Type._alignment);
  };

  Result.prototype.setItem = function(index, value) {
    new Type(this._storage, this._offset + index * Type._alignment, value);
  };

  return function(storage, offset, length) {
    return new Result(storage, offset, length);
  };
}
