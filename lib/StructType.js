import { assert, TYPED_OBJECTS, setReadOnly } from './utils'
import structView from './structView'
import Storage from './Storage'

function resize(size, elemSize) {
  let i = size % elemSize
  return i === 0 ? size : size + elemSize - i
}

export default function StructType(schema) {
  let props = Object.getOwnPropertyNames(schema)
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

      Object.defineProperty(this, name, {
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

    Object.preventExtensions(this)
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
