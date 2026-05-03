interface FlatLike {
  number: string;
  floor: { number: number; wing: { name: string } };
}

/** Format a flat's display label depending on whether the society uses wings. */
export function flatLabel(flat: FlatLike, hasWings: boolean): string {
  if (hasWings) {
    return `Wing ${flat.floor.wing.name} · F${flat.floor.number} · ${flat.number}`;
  }
  return `Floor ${flat.floor.number} · Flat ${flat.number}`;
}

/** Longer form used in dropdown options. */
export function flatOptionLabel(flat: FlatLike, hasWings: boolean): string {
  if (hasWings) {
    return `Wing ${flat.floor.wing.name} · Floor ${flat.floor.number} · Flat ${flat.number}`;
  }
  return `Floor ${flat.floor.number} · Flat ${flat.number}`;
}
