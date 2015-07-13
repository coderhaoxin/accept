import { assert, TYPED_OBJECTS, setReadOnly, setMeta } from './utils'
import structView from './structView'
import Storage from './Storage'

export default function ArrayType(elementType, length) {
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
      Object.defineProperty(this, i, {
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
      for (let i = 0, length = Math.min(viewLength, dataSrc.length); i < length; i++) {
        this[i] = dataSrc[i]
      }
    }

    Object.preventExtensions(this)
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
