'use strict'

const assign = require('object-assign')
const { getOwnPropertyNames, preventExtensions, defineProperty } = Object
const { min } = Math

const TYPED_OBJECTS = {}

/**
 * exports
 */

const types = {
  uint8clamped: valueType(Uint8ClampedArray, 'uint8', 1),
  int8: valueType(Int8Array, 'int8', 1),
  uint8: valueType(Uint8Array, 'uint8', 1),
  int16: valueType(Int16Array, 'int16', 2),
  uint16: valueType(Uint16Array, 'uint16', 2),
  int32: valueType(Int32Array, 'int32', 4),
  uint32: valueType(Uint32Array, 'uint32', 4),
  float32: valueType(Float32Array, 'float32', 4),
  float64: valueType(Float64Array, 'float64', 8),
  object: referenceType('object'),
  string: referenceType('string'),
  any: referenceType('any'),
  StructType: StructType,
  ArrayType: ArrayType
}

module.exports = assign(() => assign(global, types), types)

function StructType(schema) {
  let props = getOwnPropertyNames(schema)
  let internals = {}
  let viewTypes = []
  let fieldOffsets = {}
  let fieldTypes = {}

  let size = 0
  let maxElemAlign = 0
  let opaque = false

  for (let k of props) {
    let T = schema[k]

    assert(T._clazz !== TYPED_OBJECTS, `property ${k}: unknown type`)
    assert(typeof T._size === 'undefined', `type ${T._name} is variable-length`)

    size = resize(size, T._alignment)

    let viewTypeIdx = viewTypes.indexOf(T._createView)
    if (viewTypeIdx < 0) {
      viewTypeIdx = viewTypes.length
      viewTypes.push(T._createView)
    }

    internals[k] = {
      viewTypeIdx: viewTypeIdx,
      offset: size / T._alignment,
      byteOffset: size,
      type: T
    }

    fieldOffsets[k] = size
    fieldTypes[k] = T

    if (T._alignment > maxElemAlign) {
      maxElemAlign = T._alignment
    }

    size += T._size
    opaque = opaque || T._opaque
  }

  size = resize(size, maxElemAlign)

  function structType(struct, offset, struct1) {
    let views = new Array(viewTypes.length)

    let storage
    if (struct instanceof ArrayBuffer) {
      assert(opaque, 'cannot create opaque type over ArrayBuffer')

      struct = new Storage(struct, false)
    }
    if (struct instanceof Storage) {
      storage = struct
      assert(opaque && !storage.opaque, 'cannot create opaque type over non-opaque storage')

      for (let i = 0; i < viewTypes.length; i++) {
        views[i] = viewTypes[i](storage, offset, size / viewTypes[i].BYTES_PER_ELEMENT)
      }
    } else {
      storage = new Storage(new ArrayBuffer(size), opaque)
      for (let j = 0; j < viewTypes.length; j++) {
        views[j] = viewTypes[j](storage)
      }
    }
    let opaqueInstance = opaque || storage.opaque

    for (let name of props) {
      let { viewTypeIdx, offset, type } = internals[name]
      let view = views[viewTypeIdx]

      defineProperty(this, name, {
        configurable: false,
        enumerable: true,
        get() {
          return type._getItem(view, offset)
        },
        set(value) {
          type._setItem(view, offset, value)
        }
      })
    }

    let structSrc = struct && !(struct instanceof Storage) ? struct : struct1

    if (structSrc) {
      for (let p of props) {
        this[p] = structSrc[p]
      }
    }

    this._opaque = opaqueInstance

    if (!opaqueInstance) {
      this._storage = {
        buffer: storage.arrayBuffer,
        byteOffset: offset ? offset : 0,
        byteLength: size
      }
    }

    preventExtensions(this)
  }

  structType._size = size
  structType._alignment = maxElemAlign
  structType._createView = structView(structType)
  structType._createView.BYTES_PER_ELEMENT = size
  structType._getItem = (view, offset) => view.getItem(offset)
  structType._setItem = (view, offset, value) => view.setItem(offset, value)
  structType._clazz = TYPED_OBJECTS
  structType._opaque = opaque

  setReadOnly(structType, 'variable', false)
  setReadOnly(structType, 'opaque', opaque)
  setReadOnly(structType, 'fieldTypes', fieldTypes)
  if (!opaque) {
    setReadOnly(structType, 'byteLength', size)
    setReadOnly(structType, 'byteAlignment', maxElemAlign)
    setReadOnly(structType, 'fieldOffsets', fieldOffsets)

    structType.storage = o => {
      assert(o._opaque, 'cannot access storage of opaque instance')
      return o._storage
    }
  }

  return structType
}

function ArrayType(elementType, length) {
  assert(elementType._clazz !== TYPED_OBJECTS, 'not a type')
  assert(typeof elementType._size === 'undefined', 'element type cannot be of variable length')

  let fixedLength = typeof length !== 'undefined'
  let opaque = elementType._opaque

  function arrayType(data, byteOffset, data1) {
    let view
    let viewLength
    byteOffset = byteOffset || 0
    let storage

    if (fixedLength) {
      viewLength = length
      if (data instanceof ArrayBuffer) {
        assert(opaque, 'cannot create a view of opaque type over an array buffer')
        data = new Storage(data, opaque)
      }
      if (data instanceof Storage) {
        assert(byteOffset % elementType._size !== 0, `ArrayBuffer size must be a multiple of ${elementType._size}`)
        storage = data
        view = elementType._createView(storage, byteOffset)
      } else {
        storage = new Storage(new ArrayBuffer(viewLength * elementType._size), opaque)
        view = elementType._createView(storage)
      }
    } else {
      viewLength = data
      storage = new Storage(new ArrayBuffer(viewLength * elementType._size), opaque)
      view = elementType._createView(storage, 0)
    }

    for (let i = 0; i < viewLength; i++) {
      let off = i * elementType._size / elementType._alignment
      defineProperty(this, i, {
        configurable: false,
        enumerable: true,
        get() {
          return elementType._getItem(view, off)
        },
        set(value) {
          elementType._setItem(view, off, value)
        }
      })
    }

    let opaqueInstance = opaque || storage.opaque
    this._opaque = opaqueInstance

    setMeta(this, 'length', viewLength)

    if (!opaqueInstance) {
      let byteLength = elementType._size * viewLength

      setMeta(this, 'byteOffset', byteOffset)
      setMeta(this, 'byteLength', byteLength)

      this._storage = {
        byteOffset,
        byteLength,
        buffer: storage.arrayBuffer
      }
    }

    let dataSrc = fixedLength && !(data instanceof Storage) && data || data1

    if (dataSrc) {
      for (let i = 0, length = min(viewLength, dataSrc.length); i < length; i++) {
        this[i] = dataSrc[i]
      }
    }

    preventExtensions(this)
  }

  if (fixedLength) {
    arrayType._size = length * elementType._size
  }
  arrayType._alignment = elementType._alignment
  arrayType._createView = structView(arrayType)
  arrayType._getItem = (view, offset) => view.getItem(offset)
  arrayType._setItem = (view, offset, value) => view.setItem(offset, value)
  arrayType._clazz = TYPED_OBJECTS
  arrayType._opaque = opaque

  setReadOnly(arrayType, 'variable', !fixedLength)
  setReadOnly(arrayType, 'elementType', elementType)
  setReadOnly(arrayType, 'opaque', opaque)
  if (!opaque) {
    if (fixedLength) {
      setReadOnly(arrayType, 'byteLength', arrayType._size)
    }
    setReadOnly(arrayType, 'byteAlignment', arrayType._alignment)

    arrayType.storage = o => {
      assert(o._opaque, 'cannot access storage of opaque instance')
      return o._storage
    }
  }

  return arrayType
}

/**
 * Storage
 */
class Storage {
  constructor(arrayBuffer, isOpaque) {
    this.arrayBuffer = arrayBuffer
    this.opaque = isOpaque
    if (isOpaque) {
      this.opaqueBuffer = new Array(this.arrayBuffer.byteLength)
    }
  }
}

class OpaqueView{
  constructor(storage) {
    this._storage = storage
  }
  getItem(index) {
    return this._storage.opaqueBuffer[index]
  }
  setItem(index, value) {
    this._storage.opaqueBuffer[index] = value
  }
}

function createOpaqueView(storage) {
  return new OpaqueView(storage)
}

createOpaqueView.BYTES_PER_ELEMENT = 1

/**
 * utils
 */

function assert(condition, message) {
  if (condition) {
    throw new TypeError(message)
  }
}

function resize(size, elemSize) {
  let i = size % elemSize
  return i === 0 ? size : size + elemSize - i
}

function setReadOnly(obj, key, value) {
  defineProperty(obj, key, {
    value: value,
    writable: false,
    configurable: false
  })
}

function setMeta(obj, name, value) {
  defineProperty(obj, name, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: value
  })
}

function valueType(TypedArray, name, size) {
  let type = {
    _size: size,
    _name: name,
    _opaque: false,
    _alignment: size,
    _clazz: TYPED_OBJECTS,
    _createView(s, byteOffset, length) {
      return new TypedArray(s.arrayBuffer, byteOffset, length)
    },
    _getItem(view, offset) {
      return view[offset]
    },
    _setItem(view, offset, value) {
      view[offset] = value
    }
  }

  type._createView.BYTES_PER_ELEMENT = TypedArray.BYTES_PER_ELEMENT

  setReadOnly(type, 'variable', false)
  setReadOnly(type, 'opaque', false)
  setReadOnly(type, 'byteLength', size)
  setReadOnly(type, 'byteAlignment', size)

  return type
}

function referenceType(name) {
  return {
    _size: 1,
    _name: name,
    _opaque: true,
    _alignment: 1,
    _clazz: TYPED_OBJECTS,
    _createView: createOpaqueView,

    _getItem(view, offset) {
      return view.getItem(offset)
    },

    _setItem(view, offset, value) {
      view.setItem(offset, value)
    }
  }
}

// emulate typed array for structs and arrays

class StructView {
  constructor(Type, storage, offset) {
    if (!offset) {
      offset = 0
    }
    this._storage = storage
    this._offset = offset
    this._Type = Type
  }

  getItem(index) {
    let T = this._Type
    return new T(this._storage, this._offset + index * T._alignment)
  }

  setItem(index, value) {
    let T = this._Type
    new T(this._storage, this._offset + index * T._alignment, value)
  }
}

function structView(Type) {
  return (storage, offset) => new StructView(Type, storage, offset)
}
