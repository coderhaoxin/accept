export { default as assign } from 'object-assign'

export const TYPED_OBJECTS = {}

export function assert(condition, message) {
  if (condition) {
    throw new TypeError(message)
  }
}

export function setReadOnly(obj, key, value) {
  Object.defineProperty(obj, key, {
    value: value,
    writable: false,
    configurable: false
  })
}

export function setMeta(obj, name, value) {
  Object.defineProperty(obj, name, {
    configurable: false,
    enumerable: false,
    writable: false,
    value: value
  })
}
