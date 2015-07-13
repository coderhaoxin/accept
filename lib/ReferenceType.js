import { TYPED_OBJECTS } from './utils'

class OpaqueView {
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

const createOpaqueView = storage => new OpaqueView(storage)
createOpaqueView.BYTES_PER_ELEMENT = 1

export default class ReferenceType {
  constructor(name) {
    this._name = name
  }

  _getItem(view, offset) {
    return view.getItem(offset)
  }

  _setItem(view, offset, value) {
    view.setItem(offset, value)
  }
}

const proto = ReferenceType.prototype

proto._size = proto._alignment = 1
proto._opaque = true
proto._clazz = TYPED_OBJECTS
proto._createView = createOpaqueView
