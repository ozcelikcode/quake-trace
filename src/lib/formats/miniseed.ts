/**
 * miniSEED 2.4 reader (SEED Reference Manual v2.4, IRIS/FDSN 2012: fixed header ch. 8, data
 * blockette 1000, Steim compression appendix B). Supports Steim1, Steim2, 16- and 32-bit
 * integers in big-endian records, which is what FDSN dataselect services return for
 * accelerometer channels. Checked against ObsPy's reader on a KOERI record.
 */

export interface MiniSeedTrace {
  network: string;
  station: string;
  location: string;
  channel: string;
  /** Start of the first sample, ms since the Unix epoch. */
  startMs: number;
  sampleRateHz: number;
  /** Counts; consecutive records merged, gaps filled with the last value. */
  samples: Int32Array;
}

interface RecordHeader {
  key: string;
  network: string;
  station: string;
  location: string;
  channel: string;
  startMs: number;
  sampleRateHz: number;
  sampleCount: number;
  dataOffset: number;
  encoding: number;
  length: number;
}

const ENCODING = { int16: 1, int32: 3, steim1: 10, steim2: 11 } as const;
const FRAME_BYTES = 64;
const ascii = new TextDecoder('ascii');

function text(view: DataView, offset: number, length: number): string {
  return ascii.decode(new Uint8Array(view.buffer, view.byteOffset + offset, length)).trim();
}

/** SEED sample rate factor and multiplier (fixed header fields 10 and 11). */
export function sampleRate(factor: number, multiplier: number): number {
  if (factor === 0 || multiplier === 0) return 0;
  const f = factor > 0 ? factor : -1 / factor;
  const m = multiplier > 0 ? multiplier : -1 / multiplier;
  return f * m;
}

function readHeader(view: DataView): RecordHeader {
  // BTIME: year, day of year, hour, minute, second, unused, 0.0001 s.
  const year = view.getUint16(20);
  const dayOfYear = view.getUint16(22);
  const startMs =
    Date.UTC(year, 0, dayOfYear, view.getUint8(24), view.getUint8(25), view.getUint8(26)) +
    view.getUint16(28) / 10;
  const activity = view.getUint8(36);
  const correctionMs = view.getInt32(40) / 10;
  // Field 16 is applied unless activity bit 1 says it already was.
  const corrected = activity & 0x02 ? startMs : startMs + correctionMs;
  const dataOffset = view.getUint16(44);
  let blockette = view.getUint16(46);
  let encoding = -1;
  let length = 0;
  while (blockette > 0 && blockette + 8 <= view.byteLength) {
    const type = view.getUint16(blockette);
    if (type === 1000) {
      encoding = view.getUint8(blockette + 4);
      if (view.getUint8(blockette + 5) !== 1) throw new RangeError('little-endian miniSEED');
      length = 2 ** view.getUint8(blockette + 6);
    }
    blockette = view.getUint16(blockette + 2);
  }
  if (encoding < 0) throw new RangeError('miniSEED record without blockette 1000');
  const network = text(view, 18, 2);
  const station = text(view, 8, 5);
  const location = text(view, 13, 2);
  const channel = text(view, 15, 3);
  return {
    key: `${network}.${station}.${location}.${channel}`,
    network,
    station,
    location,
    channel,
    startMs: corrected,
    sampleRateHz: sampleRate(view.getInt16(32), view.getInt16(34)),
    sampleCount: view.getUint16(30),
    dataOffset,
    encoding,
    length,
  };
}

/** Sign-extends the low `bits` bits of `value`. */
function signed(value: number, bits: number): number {
  const shift = 32 - bits;
  return (value << shift) >> shift;
}

/** Differences of one Steim frame word for its 2-bit control code (Steim1 or Steim2). */
function steimDifferences(word: number, code: number, steim2: boolean, out: number[]): void {
  if (code === 1) {
    for (let i = 3; i >= 0; i--) out.push(signed(word >>> (8 * i), 8));
    return;
  }
  if (!steim2) {
    if (code === 2) {
      out.push(signed(word >>> 16, 16), signed(word, 16));
    } else {
      out.push(word | 0);
    }
    return;
  }
  const dnib = word >>> 30;
  // [count, bits] per (code, dnib), SEED appendix B, Steim2.
  const layout =
    code === 2
      ? ({ 1: [1, 30], 2: [2, 15], 3: [3, 10] } as Record<number, [number, number]>)[dnib]
      : ({ 0: [5, 6], 1: [6, 5], 2: [7, 4] } as Record<number, [number, number]>)[dnib];
  if (!layout) throw new RangeError('invalid Steim2 nibble');
  const [count, bits] = layout;
  for (let i = count - 1; i >= 0; i--) out.push(signed(word >>> (bits * i), bits));
}

function decodeSteim(view: DataView, header: RecordHeader, steim2: boolean): Int32Array {
  const samples = new Int32Array(header.sampleCount);
  const differences: number[] = [];
  let first = 0;
  let last = 0;
  const end = header.length || view.byteLength;
  for (let frame = header.dataOffset; frame + FRAME_BYTES <= end; frame += FRAME_BYTES) {
    const controls = view.getUint32(frame);
    for (let w = 1; w < 16; w++) {
      const code = (controls >>> (2 * (15 - w))) & 0x3;
      const word = view.getUint32(frame + 4 * w);
      // The first frame carries the forward (X0) and reverse (Xn) integration constants.
      if (frame === header.dataOffset && w === 1) first = word | 0;
      else if (frame === header.dataOffset && w === 2) last = word | 0;
      else if (code !== 0) steimDifferences(word, code, steim2, differences);
    }
    if (differences.length >= header.sampleCount) break;
  }
  // The first difference refers to the previous record; X0 is the first sample.
  let value = first;
  for (let i = 0; i < header.sampleCount; i++) {
    if (i > 0) value += differences[i] ?? 0;
    samples[i] = value;
  }
  if (header.sampleCount > 0 && value !== last) {
    throw new RangeError(`Steim integrity check failed for ${header.key}`);
  }
  return samples;
}

function decodeRecord(view: DataView, header: RecordHeader): Int32Array {
  switch (header.encoding) {
    case ENCODING.steim1:
      return decodeSteim(view, header, false);
    case ENCODING.steim2:
      return decodeSteim(view, header, true);
    case ENCODING.int32:
      return Int32Array.from({ length: header.sampleCount }, (_, i) =>
        view.getInt32(header.dataOffset + 4 * i),
      );
    case ENCODING.int16:
      return Int32Array.from({ length: header.sampleCount }, (_, i) =>
        view.getInt16(header.dataOffset + 2 * i),
      );
    default:
      throw new RangeError(`unsupported miniSEED encoding ${String(header.encoding)}`);
  }
}

/** Decodes every record and merges them per channel in time order. */
export function readMiniSeed(buffer: ArrayBuffer): MiniSeedTrace[] {
  const records: { header: RecordHeader; samples: Int32Array }[] = [];
  let offset = 0;
  while (offset + 64 <= buffer.byteLength) {
    const header = readHeader(new DataView(buffer, offset));
    const length = header.length;
    if (length <= 0) throw new RangeError('miniSEED record length unknown');
    if (header.sampleCount > 0 && header.sampleRateHz > 0) {
      records.push({ header, samples: decodeRecord(new DataView(buffer, offset, length), header) });
    }
    offset += length;
  }

  const byChannel = new Map<string, typeof records>();
  for (const record of records) {
    const list = byChannel.get(record.header.key) ?? [];
    list.push(record);
    byChannel.set(record.header.key, list);
  }
  return [...byChannel.values()].map((list) => {
    list.sort((a, b) => a.header.startMs - b.header.startMs);
    const first = list[0];
    if (!first) throw new RangeError('empty channel');
    const rate = first.header.sampleRateHz;
    const periodMs = 1000 / rate;
    const lastRecord = list.at(-1) ?? first;
    const total =
      Math.round((lastRecord.header.startMs - first.header.startMs) / periodMs) +
      lastRecord.samples.length;
    const samples = new Int32Array(total);
    let filled = 0;
    for (const { header, samples: chunk } of list) {
      const at = Math.round((header.startMs - first.header.startMs) / periodMs);
      // Hold the last value across a gap; overlapping samples are overwritten.
      samples.fill(filled > 0 ? (samples[filled - 1] ?? 0) : 0, filled, Math.max(filled, at));
      samples.set(chunk.subarray(0, Math.max(0, total - at)), at);
      filled = Math.max(filled, at + chunk.length);
    }
    const { network, station, location, channel } = first.header;
    return {
      network,
      station,
      location,
      channel,
      startMs: first.header.startMs,
      sampleRateHz: rate,
      samples,
    };
  });
}
