import { DataError } from './errors';
import type { Section } from './manifest';

const constructors = {
  float32: Float32Array,
  uint32: Uint32Array,
  uint16: Uint16Array,
  uint8: Uint8Array,
} as const;

type SectionType = Section['type'];
export type SectionArray = InstanceType<(typeof constructors)[SectionType]>;

/**
 * Views the named sections of a sectioned binary file (roads.bin, cells.bin) without copying.
 * The pipeline orders sections from widest to narrowest type, so every view is aligned.
 */
export function readSections(buffer: ArrayBuffer, sections: Section[]): Map<string, SectionArray> {
  const views = new Map<string, SectionArray>();
  for (const section of sections) {
    const Constructor = constructors[section.type];
    const byteLength = section.length * Constructor.BYTES_PER_ELEMENT;
    if (section.byteOffset % Constructor.BYTES_PER_ELEMENT !== 0) {
      throw new DataError(`section ${section.name} is not aligned`);
    }
    if (section.byteOffset + byteLength > buffer.byteLength) {
      throw new DataError(`section ${section.name} exceeds the file`);
    }
    views.set(section.name, new Constructor(buffer, section.byteOffset, section.length));
  }
  return views;
}

export function requireSection<T extends SectionArray>(
  views: Map<string, SectionArray>,
  name: string,
  type: new (...args: never[]) => T,
): T {
  const view = views.get(name);
  if (!(view instanceof type)) throw new DataError(`section ${name} is missing or mistyped`);
  return view;
}
