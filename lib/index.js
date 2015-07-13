import { assign } from './utils'
import ArrayType from './ArrayType'
import ReferenceType from './ReferenceType'
import StructType from './StructType'
import ValueType from './ValueType'

const types = {
  uint8clamped: new ValueType(Uint8ClampedArray, 'uint8', 1),
  int8: new ValueType(Int8Array, 'int8', 1),
  uint8: new ValueType(Uint8Array, 'uint8', 1),
  int16: new ValueType(Int16Array, 'int16', 2),
  uint16: new ValueType(Uint16Array, 'uint16', 2),
  int32: new ValueType(Int32Array, 'int32', 4),
  uint32: new ValueType(Uint32Array, 'uint32', 4),
  float32: new ValueType(Float32Array, 'float32', 4),
  float64: new ValueType(Float64Array, 'float64', 8),
  object: new ReferenceType('object'),
  string: new ReferenceType('string'),
  any: new ReferenceType('any'),
  StructType: StructType,
  ArrayType: ArrayType
}

module.exports = assign(() => assign(global, types), types)
