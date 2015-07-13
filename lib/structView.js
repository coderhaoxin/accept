// emulate typed array for structs and arrays

class BaseStructView {
  constructor(storage, offset = 0) {
    this._storage = storage
    this._offset = offset
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

export default function structView(Type) {
  class StructView extends BaseStructView {}
  StructView.prototype._Type = Type
  return (storage, offset) => new StructView(storage, offset)
}
