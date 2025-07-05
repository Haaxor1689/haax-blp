export const isEqual = (a: unknown, b: unknown) => {
  // Strict equality check
  if (a === b) return true;

  // Check for null/undefined
  if (a == null || b == null) return a === b;

  // Check if both are objects
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  // Handle arrays
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Handle objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!isEqual(a[key as never], b[key as never])) return false;
  }

  return true;
};
