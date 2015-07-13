import { TYPED_OBJECTS, setReadOnly } from './utils'

export default class ValueType {
  constructor(TypedArray, name, size) {
    this._size = this._alignment = size
    this._name = name
    this._createView = (s, byteOffset, length) => {
      return new TypedArray(s.arrayBuffer, byteOffset, length)
    }
    this._createView.BYTES_PER_ELEMENT = TypedArray.BYTES_PER_ELEMENT

    setReadOnly(this, 'byteLength', size)
    setReadOnly(this, 'byteAlignment', size)
  }

  _getItem(view, offset) {
    return view[offset]
  }

  _setItem(view, offset, value) {
    view[offset] = value
  }
}

const proto = ValueType.prototype

proto._opaque = false
proto._clazz = TYPED_OBJECTS
setReadOnly(proto, 'variable', false)
setReadOnly(proto, 'opaque', false)
