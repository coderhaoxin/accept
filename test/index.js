'use strict';

const assert = require('assert')
require('../lib')()

describe('## typed objects', function() {
  describe('# basic', function() {
    it('StructType - uint8', function() {
      let Point = new StructType({
        x: uint8,
        y: uint8
      })

      assert(Point.variable === false)
      assert(Point.opaque === false)
      assert(Point.byteLength === 2)
      assert(Point.byteAlignment === 1)
      assert(Point.fieldOffsets.x === 0)
      assert(Point.fieldOffsets.y === 1)
      assert(Point.fieldTypes.x === uint8)
      assert(Point.fieldTypes.y === uint8)

      let p1 = new Point({
        x: 1,
        y: 1
      })
      assert(p1.x === 1)
      assert(p1.y === 1)
    })

    it('StructType - uint8, uint32', function() {
      let S = new StructType({
        x: uint8,
        y: uint32
      })
      let s = new S({
        x: 255,
        y: 1024
      })

      assert(S.variable === false)
      assert(S.opaque === false)
      assert(S.byteLength === 8)
      assert(S.byteAlignment === 4)
      assert(S.fieldOffsets.x === 0)
      assert(S.fieldOffsets.y === 4)
      assert(S.fieldTypes.x === uint8)
      assert(S.fieldTypes.y === uint32)

      assert(s.x === 255)
      assert(s.y === 1024)
    })

    it('StructType - uint8, uint32', function() {
      let S = new StructType({
        x: uint32,
        y: uint8
      })

      assert(S.variable === false)
      assert(S.opaque === false)
      assert(S.byteLength === 8)
      assert(S.byteAlignment === 4)
      assert(S.fieldOffsets.x === 0)
      assert(S.fieldOffsets.y === 4)
      assert(S.fieldTypes.x === uint32)
      assert(S.fieldTypes.y === uint8)

      let s = new S({
        x: 1024,
        y: 255
      })
      assert(s.x === 1024)
      assert(s.y === 255)
    })

    it('StructType - uint8, int8, uint8clamped, uint16, uint32, int32, float32, float64', function() {
      let S = new StructType({
        u8: uint8,
        i8: int8,
        u8c: uint8clamped,
        u16: uint16,
        i16: int16,
        u32: uint32,
        i32: int32,
        f32: float32,
        f64: float64
      })

      assert(S.variable === false)
      assert(S.opaque === false)
      assert(S.byteLength === 32)
      assert(S.byteAlignment === 8)

      assert(S.fieldOffsets.u8 === 0)
      assert(S.fieldOffsets.i8 === 1)
      assert(S.fieldOffsets.u8c === 2)
      assert(S.fieldOffsets.u16 === 4)
      assert(S.fieldOffsets.i16 === 6)
      assert(S.fieldOffsets.u32 === 8)
      assert(S.fieldOffsets.i32 === 12)
      assert(S.fieldOffsets.f32 === 16)
      assert(S.fieldOffsets.f64 === 24)

      assert(S.fieldTypes.u8 === uint8)
      assert(S.fieldTypes.i8 === int8)
      assert(S.fieldTypes.u8c === uint8clamped)
      assert(S.fieldTypes.u16 === uint16)
      assert(S.fieldTypes.i16 === int16)
      assert(S.fieldTypes.u32 === uint32)
      assert(S.fieldTypes.i32 === int32)
      assert(S.fieldTypes.f32 === float32)
      assert(S.fieldTypes.f64 === float64)

      let s1 = new S({
        u8: 255,
        i8: 127,
        u8c: 1024,
        u16: 0xFFFF,
        i16: 0x7FFF,
        u32: 0xFFFFFFFF,
        i32: 0x7FFFFFFF,
        f32: 1.5,
        f64: 1.5
      })
      assert(s1.u8 === 255)
      assert(s1.i8 === 127)
      assert(s1.u8c === 255)
      assert(s1.u16 === 0xFFFF)
      assert(s1.i16 === 0x7FFF)
      assert(s1.u32 === 0xFFFFFFFF)
      assert(s1.i32 === 0x7FFFFFFF)
      assert(s1.f32 === 1.5)
      assert(s1.f64 === 1.5)

      let s2 = new S()
      assert(s2.u8 === 0)
      assert(s2.i8 === 0)
      assert(s2.u8c === 0)
      assert(s2.u16 === 0)
      assert(s2.i16 === 0)
      assert(s2.u32 === 0)
      assert(s2.i32 === 0)
      assert(s2.f32 === 0)
      assert(s2.f64 === 0)
    })

    it('StructType, TypedArray', function() {
      let S = new StructType({
        x: uint8,
        y: uint16,
        z: uint32
      })
      let buffer = new ArrayBuffer(1024)
      let u8a = new Uint8Array(buffer)
      let s = new S(buffer, 100)
      s.x = 1
      s.y = 2
      s.z = 3
      assert(u8a[100] === 1)
      assert(u8a[102] === 2)
      assert(u8a[104] === 3)
    })

    it('StructType - nest', function() {
      let S = new StructType({
        x: uint8
      })
      let S1 = new StructType({
        s: S
      })
      let s1 = new S1({
        s: {
          x: 1
        }
      })
      assert(s1.s.x === 1)
      s1.s.x = 2
      assert(s1.s.x === 2)
      let s = new S({
        x: 42
      })
      s1.s = s
      assert(s1.s.x === 42)
      s1.s.x = 27
      s = s1.s
      assert(s.x === 27)
    })

    it('StructType - nest', function() {
      let S = new StructType({
        x: uint8,
        y: uint32
      })
      let S1 = new StructType({
        z: uint16,
        s: S
      })

      assert(S1.variable === false)
      assert(S1.opaque === false)
      assert(S1.byteLength === 12)
      assert(S1.byteAlignment === 4)

      assert(S1.fieldOffsets.z === 0)
      assert(S1.fieldOffsets.s === 4)

      assert(S1.fieldTypes.z === uint16)
      assert(S1.fieldTypes.s === S)

      let s1 = new S1({
        z: 3,
        s: {
          x: 1,
          y: 2
        }
      })
      assert(S.storage(s1.s).byteOffset === 4)
      assert(S.storage(s1.s).byteLength === 8)
      assert(s1.s.x === 1 && s1.s.y === 2 && s1.z === 3)
      s1.s.x = 2
      assert(s1.s.x === 2 && s1.s.y === 2 && s1.z === 3)
      let s = new S({
        x: 42,
        y: 1024
      })
      s1.s = s
      assert(s1.s.x === 42 && s1.s.y === 1024)
      s1.s.x = 27
      s = s1.s
      assert(s.x === 27 && s.y === 1024)
    })

    it('StructType - nest', function() {
      let u8a = new Uint8Array(1024)
      let S = new StructType({
        x: uint8,
        y: uint32
      })
      let S1 = new StructType({
        z: uint16,
        s: S
      })
      let s1 = new S1(u8a.buffer, 100)
      s1.s = new S({
        x: 1,
        y: 2
      })
      assert(s1.s.x == 1 && s1.s.y == 2)
      s1.z = 3
      assert(u8a[100] === 3)
      assert(u8a[104] === 1)
      assert(u8a[108] === 2)
    })

    it('ArrayType', function() {
      let A = new ArrayType(uint8, 10)

      assert(A.variable === false)
      assert(A.opaque === false)
      assert(A.byteLength === 10)
      assert(A.byteAlignment === 1)
      assert(A.elementType === uint8)

      let a = new A()
      let i
      assert(a.length === 10)
      assert(a.byteLength === 10)
      assert(a.byteOffset === 0)
      for (i = 0; i < 10; i++) {
        a[i] = i
      }
      for (i = 0; i < 10; i++) {
        assert(a[i] === i)
      }
      let a1 = new A([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
      assert(a1.length === 10)
      for (i = 0; i < 10; i++) {
        assert(a1[i] === 10 - i)
      }
    })

    it('ArrayType', function() {
      let A = new ArrayType(uint16, 10)

      assert(A.variable === false)
      assert(A.opaque === false)
      assert(A.byteLength === 20)
      assert(A.byteAlignment === 2)
      assert(A.elementType === uint16)

      let a = new A()
      let i
      assert(a.length === 10)
      for (i = 0; i < 10; i++) {
        a[i] = i
      }
      for (i = 0; i < 10; i++) {
        assert(a[i] === i)
      }
      let a1 = new A([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
      assert(a1.length === 10)
      for (i = 0; i < 10; i++) {
        assert(a1[i] === 10 - i)
      }
    })

    it('StructType, ArrayType', function() {
      let S = new StructType({
        x: uint8,
        y: uint32
      })
      let initializer = []
      let i
      for (i = 0; i < 10; i++) {
        initializer.push(new S({
          x: 2 * i,
          y: 2 * i + 1
        }))
      }
      let A = new ArrayType(S, 10)

      assert(A.variable === false)
      assert(A.opaque === false)
      assert(A.byteLength === 80)
      assert(A.byteAlignment === 4)
      assert(A.elementType === S)

      let a = new A(initializer)
      assert(a.length === 10)
      for (i = 0; i < 10; i++) {
        assert(a[i].x === 2 * i)
        assert(a[i].y === 2 * i + 1)
      }

      let a1 = new A()
      for (i = 0; i < 10; i++) {
        a1[i] = initializer[i]
      }
      assert(a1.length === 10)
      for (i = 0; i < 10; i++) {
        assert(a1[i].x === 2 * i)
        assert(a1[i].y === 2 * i + 1)
      }

    })

    it('StructType, ArrayType', function() {
      let S = new StructType({
        x: uint8
      })
      let A = new ArrayType(S, 1)
      let a = new A([{
        x: 10
      }])
      assert(a[0].x === 10)

      let uint32Array = new ArrayType(uint32)

      assert(uint32Array.variable === true)
      assert(uint32Array.opaque === false)
      assert(uint32Array.byteAlignment === 4)
      assert(uint32Array.byteLength === undefined)
      assert(uint32Array.elementType === uint32)

      let u32a = new uint32Array(10)
      assert(u32a.length === 10)
      u32a[0] = 11
      u32a[7] = 56
      assert(u32a[0] === 11)
      assert(u32a[7] === 56)
    })

    it('StructType, ArrayType', function() {
      let A = new ArrayType(uint8, 3)
      let S = new StructType({
        left: A,
        right: A
      })
      let s = new S({
        left: [1, 2, 3],
        right: [257, 258, 259]
      })

      assert(A.storage(s.left).buffer === A.storage(s.right).buffer)
      assert(A.storage(s.left).byteOffset === 0)
      assert(A.storage(s.right).byteOffset === 3)
      assert(A.storage(s.left).byteLength === 3)
      assert(A.storage(s.right).byteLength === 3)

      assert(s.left.length == 3)
      assert(s.right.length == 3)
      assert(s.right.byteOffset === 3)
      assert(s.right.byteLength === 3)
      for (let i = 0; i < 3; i++) {
        assert(s.left[i] === s.right[i])
      }
    })

    it('StructType, ArrayType', function() {
      let A = new ArrayType(uint8, 3)
      let S = new StructType({
        z: uint32,
        left: A
      })
      let s = new S({
        left: [1, 2, 3]
      })
      assert(s.left.length == 3)
      for (let i = 0; i < 3; i++) {
        assert(s.left[i] === i + 1)
      }
    })

    it('StructType', function() {
      let S = new StructType({
        x: uint8,
        o: object
      })
      let o = {}
      let s = new S({
        x: 5,
        o: o
      })
      assert(s.x === 5)
      assert(s.o === o)
      assert(S.storage === undefined)

      assert(S.variable === false)
      assert(S.opaque === true)
      assert(S.byteLength === undefined)
      assert(S.byteAlignment === undefined)
      assert(S.fieldOffsets === undefined)
      assert(S.fieldTypes.x === uint8)
      assert(S.fieldTypes.o === object)
    })

    it('StructType', function() {
      let S = new StructType({
        x: uint8,
        o: object
      })
      let S1 = new StructType({
        s: S,
        x: uint32
      })
      let o = {}
      let s1 = new S1({
        s: {
          x: 5,
          o: o
        },
        x: 1024
      })
      assert(s1.x === 1024)
      assert(s1.s.o === o)
      assert(s1.s.x === 5)
      assert(S1.storage === undefined)
    })

    it('StructType', function() {
      let S = new StructType({
        x: uint8,
        y: uint32
      })
      let S1 = new StructType({
        s: S,
        o: object
      })
      let o = {}
      let s1 = new S1({
        s: {
          x: 5,
          y: 1024
        },
        o: o
      })
      assert(s1.s.x === 5)
      assert(s1.s.y === 1024)
      assert(s1.o === o)
      assert(S.storage !== undefined)
      assert(S1.storage === undefined)
      assert.throws(function() {
        S.storage(s1.s)
      }, TypeError)
    })

    it('ArrayType', function() {
      let A = new ArrayType(object, 100)
      assert(A.variable === false)
      assert(A.opaque === true)
      assert(A.storage === undefined)
      assert(A.byteLength === undefined)
      assert(A.byteOffset === undefined)
      let o = {}
      let a = new A()
      let i
      for (i = 0; i < 100; i++) {
        a[i] = o
      }
      assert(a.length === 100)
      assert(a.byteLength === undefined)
      assert(a.byteOffset === undefined)
      for (i = 0; i < 100; i++) {
        assert(a[i] === o)
      }
    })
  })
})
