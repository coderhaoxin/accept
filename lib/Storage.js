export default class Storage {
  constructor(arrayBuffer, isOpaque) {
    this.arrayBuffer = arrayBuffer
    this.opaque = isOpaque
    if (isOpaque) {
      this.opaqueBuffer = new Array(this.arrayBuffer.byteLength)
    }
  }
}
