// Minimal, self-contained little-endian NBT reader/writer (Bedrock flavour,
// as used by .mcstructure files). No dependencies.
//
// Reading returns plain JS values:
//   Byte/Short/Int -> number, Long -> bigint, Float/Double -> number,
//   String -> string, List -> array, Compound -> object,
//   ByteArray -> Int8Array, IntArray -> Int32Array, LongArray -> BigInt64Array.
// The tag type of every value is recoverable through `readNbt(buf, {typed: true})`,
// which returns {type, value} nodes instead (compound values are objects of nodes,
// list values are {type, elementType, value: node[]}).
//
// Writing takes typed nodes built with the helpers in `T` (e.g. T.int(3)).

export const TAG = Object.freeze({
  End: 0,
  Byte: 1,
  Short: 2,
  Int: 3,
  Long: 4,
  Float: 5,
  Double: 6,
  ByteArray: 7,
  String: 8,
  List: 9,
  Compound: 10,
  IntArray: 11,
  LongArray: 12,
});

class Reader {
  constructor(buf) {
    this.buf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    this.pos = 0;
  }
  need(n) {
    if (this.pos + n > this.buf.length) throw new Error(`NBT: unexpected end of data at ${this.pos} (+${n})`);
  }
  u8() {
    this.need(1);
    return this.buf.readUInt8(this.pos++);
  }
  i8() {
    this.need(1);
    return this.buf.readInt8(this.pos++);
  }
  i16() {
    this.need(2);
    const v = this.buf.readInt16LE(this.pos);
    this.pos += 2;
    return v;
  }
  u16() {
    this.need(2);
    const v = this.buf.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }
  i32() {
    this.need(4);
    const v = this.buf.readInt32LE(this.pos);
    this.pos += 4;
    return v;
  }
  i64() {
    this.need(8);
    const v = this.buf.readBigInt64LE(this.pos);
    this.pos += 8;
    return v;
  }
  f32() {
    this.need(4);
    const v = this.buf.readFloatLE(this.pos);
    this.pos += 4;
    return v;
  }
  f64() {
    this.need(8);
    const v = this.buf.readDoubleLE(this.pos);
    this.pos += 8;
    return v;
  }
  str() {
    const n = this.u16();
    this.need(n);
    const s = this.buf.toString("utf8", this.pos, this.pos + n);
    this.pos += n;
    return s;
  }
}

function readPayload(r, type, typed, depth) {
  if (depth > 512) throw new Error("NBT: nesting too deep");
  const wrap = (value) => (typed ? { type, value } : value);
  switch (type) {
    case TAG.Byte:
      return wrap(r.i8());
    case TAG.Short:
      return wrap(r.i16());
    case TAG.Int:
      return wrap(r.i32());
    case TAG.Long:
      return wrap(r.i64());
    case TAG.Float:
      return wrap(r.f32());
    case TAG.Double:
      return wrap(r.f64());
    case TAG.ByteArray: {
      const n = r.i32();
      if (n < 0) throw new Error("NBT: negative array length");
      r.need(n);
      const a = new Int8Array(n);
      for (let i = 0; i < n; i++) a[i] = r.buf.readInt8(r.pos + i);
      r.pos += n;
      return wrap(a);
    }
    case TAG.String:
      return wrap(r.str());
    case TAG.List: {
      const et = r.u8();
      const n = r.i32();
      if (n < 0) throw new Error("NBT: negative list length");
      if (n > 0 && et === TAG.End) throw new Error("NBT: list of End tags with non-zero length");
      const arr = [];
      for (let i = 0; i < n; i++) arr.push(readPayload(r, et, typed, depth + 1));
      return typed ? { type, elementType: et, value: arr } : arr;
    }
    case TAG.Compound: {
      const obj = {};
      for (;;) {
        const t = r.u8();
        if (t === TAG.End) break;
        const name = r.str();
        obj[name] = readPayload(r, t, typed, depth + 1);
      }
      return wrap(obj);
    }
    case TAG.IntArray: {
      const n = r.i32();
      if (n < 0) throw new Error("NBT: negative array length");
      const a = new Int32Array(n);
      for (let i = 0; i < n; i++) a[i] = r.i32();
      return wrap(a);
    }
    case TAG.LongArray: {
      const n = r.i32();
      if (n < 0) throw new Error("NBT: negative array length");
      const a = new BigInt64Array(n);
      for (let i = 0; i < n; i++) a[i] = r.i64();
      return wrap(a);
    }
    default:
      throw new Error(`NBT: unknown tag type ${type} at ${r.pos - 1}`);
  }
}

/**
 * Parse a little-endian NBT document (root tag must be a compound).
 * @param {Buffer|Uint8Array} buf
 * @param {{typed?: boolean}} [opts]
 * @returns {{name: string, value: any, bytesRead: number}}
 */
export function readNbt(buf, opts = {}) {
  const r = new Reader(buf);
  const t = r.u8();
  if (t !== TAG.Compound) throw new Error(`NBT: root tag must be a compound, got ${t}`);
  const name = r.str();
  const value = readPayload(r, t, !!opts.typed, 0);
  return { name, value, bytesRead: r.pos };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

/** Typed node constructors for the writer. */
export const T = Object.freeze({
  byte: (v) => ({ type: TAG.Byte, value: v }),
  short: (v) => ({ type: TAG.Short, value: v }),
  int: (v) => ({ type: TAG.Int, value: v }),
  long: (v) => ({ type: TAG.Long, value: BigInt(v) }),
  float: (v) => ({ type: TAG.Float, value: v }),
  double: (v) => ({ type: TAG.Double, value: v }),
  string: (v) => ({ type: TAG.String, value: String(v) }),
  list: (elementType, nodes) => ({ type: TAG.List, elementType, value: nodes }),
  compound: (obj) => ({ type: TAG.Compound, value: obj }),
  intArray: (arr) => ({ type: TAG.IntArray, value: Int32Array.from(arr) }),
  byteArray: (arr) => ({ type: TAG.ByteArray, value: Int8Array.from(arr) }),
});

class Writer {
  constructor() {
    this.chunks = [];
    this.size = 0;
  }
  push(b) {
    this.chunks.push(b);
    this.size += b.length;
  }
  u8(v) {
    const b = Buffer.alloc(1);
    b.writeUInt8(v & 0xff);
    this.push(b);
  }
  i8(v) {
    const b = Buffer.alloc(1);
    b.writeInt8(v);
    this.push(b);
  }
  i16(v) {
    const b = Buffer.alloc(2);
    b.writeInt16LE(v);
    this.push(b);
  }
  u16(v) {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(v);
    this.push(b);
  }
  i32(v) {
    const b = Buffer.alloc(4);
    b.writeInt32LE(v);
    this.push(b);
  }
  i64(v) {
    const b = Buffer.alloc(8);
    b.writeBigInt64LE(BigInt(v));
    this.push(b);
  }
  f32(v) {
    const b = Buffer.alloc(4);
    b.writeFloatLE(v);
    this.push(b);
  }
  f64(v) {
    const b = Buffer.alloc(8);
    b.writeDoubleLE(v);
    this.push(b);
  }
  str(s) {
    const b = Buffer.from(s, "utf8");
    if (b.length > 0xffff) throw new Error("NBT: string too long");
    this.u16(b.length);
    this.push(b);
  }
}

function writePayload(w, node) {
  const { type, value } = node;
  switch (type) {
    case TAG.Byte:
      return w.i8(value);
    case TAG.Short:
      return w.i16(value);
    case TAG.Int:
      return w.i32(value);
    case TAG.Long:
      return w.i64(value);
    case TAG.Float:
      return w.f32(value);
    case TAG.Double:
      return w.f64(value);
    case TAG.ByteArray:
      w.i32(value.length);
      for (const v of value) w.i8(v);
      return undefined;
    case TAG.String:
      return w.str(value);
    case TAG.List:
      w.u8(value.length ? node.elementType : node.elementType ?? TAG.End);
      w.i32(value.length);
      for (const el of value) {
        if (el.type !== node.elementType) throw new Error("NBT: list element type mismatch");
        writePayload(w, el);
      }
      return undefined;
    case TAG.Compound:
      for (const [k, child] of Object.entries(value)) {
        w.u8(child.type);
        w.str(k);
        writePayload(w, child);
      }
      w.u8(TAG.End);
      return undefined;
    case TAG.IntArray:
      w.i32(value.length);
      for (const v of value) w.i32(v);
      return undefined;
    case TAG.LongArray:
      w.i32(value.length);
      for (const v of value) w.i64(v);
      return undefined;
    default:
      throw new Error(`NBT: cannot write tag type ${type}`);
  }
}

/**
 * Serialize a typed compound node as a little-endian NBT document.
 * @param {{type: number, value: object}} root compound node (T.compound({...}))
 * @param {string} [name]
 * @returns {Buffer}
 */
export function writeNbt(root, name = "") {
  if (root.type !== TAG.Compound) throw new Error("NBT: root must be a compound");
  const w = new Writer();
  w.u8(TAG.Compound);
  w.str(name);
  writePayload(w, root);
  return Buffer.concat(w.chunks, w.size);
}

/**
 * Build a .mcstructure file (format_version 1) from a simple description.
 * Block states are typed from JS values: boolean -> Byte, integer -> Int, string -> String.
 * @param {{size: {x:number,y:number,z:number}, palette: {name: string, states?: Record<string, boolean|number|string>}[],
 *          indices: number[], water?: number[], origin?: {x:number,y:number,z:number}, version?: number,
 *          blockEntities?: Record<number, object>}} spec
 *   indices: palette index per cell (-1 = keep world block) in x-major, then y, then z-fastest order
 *   (index = (x * sizeY + y) * sizeZ + z), exactly as in the file format.
 * @returns {Buffer}
 */
export function buildMcstructure(spec) {
  const { size } = spec;
  const n = size.x * size.y * size.z;
  if (spec.indices.length !== n) throw new Error(`indices length ${spec.indices.length} != ${n}`);
  const water = spec.water ?? new Array(n).fill(-1);
  const version = spec.version ?? 18153475;
  const stateNode = (v) => (typeof v === "boolean" ? T.byte(v ? 1 : 0) : typeof v === "number" ? T.int(v) : T.string(v));
  const palette = spec.palette.map((p) =>
    T.compound({
      name: T.string(p.name),
      states: T.compound(Object.fromEntries(Object.entries(p.states ?? {}).map(([k, v]) => [k, stateNode(v)]))),
      version: T.int(version),
    }),
  );
  const posData = {};
  for (const [idx, nbtNode] of Object.entries(spec.blockEntities ?? {})) posData[idx] = T.compound({ block_entity_data: nbtNode });
  const origin = spec.origin ?? { x: 0, y: 0, z: 0 };
  const root = T.compound({
    format_version: T.int(1),
    size: T.list(TAG.Int, [T.int(size.x), T.int(size.y), T.int(size.z)]),
    structure: T.compound({
      block_indices: T.list(TAG.List, [
        T.list(TAG.Int, spec.indices.map((i) => T.int(i))),
        T.list(TAG.Int, water.map((i) => T.int(i))),
      ]),
      entities: T.list(TAG.Compound, []),
      palette: T.compound({
        default: T.compound({
          block_palette: T.list(TAG.Compound, palette),
          block_position_data: T.compound(posData),
        }),
      }),
    }),
    structure_world_origin: T.list(TAG.Int, [T.int(origin.x), T.int(origin.y), T.int(origin.z)]),
  });
  return writeNbt(root, "");
}
