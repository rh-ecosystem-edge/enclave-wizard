import { useRef } from "react";

let nextRowKey = 0;

/**
 * React keys for rows that are added and removed by position.
 * The keys are not written to the saved configuration.
 * Call removeAt in the same event that deletes a row.
 */
export function useRowKeys(length: number): {
  keys: string[];
  removeAt: (index: number) => void;
} {
  const keysRef = useRef<string[]>([]);

  const removeAt = (index: number) => {
    keysRef.current = keysRef.current.filter((_, i) => i !== index);
  };

  let keys = keysRef.current;
  if (keys.length < length) {
    keys = keys.slice();
    while (keys.length < length) {
      keys.push(`row-${nextRowKey++}`);
    }
    keysRef.current = keys;
  } else if (keys.length > length) {
    keys = keys.slice(0, length);
    keysRef.current = keys;
  }

  return { keys, removeAt };
}
