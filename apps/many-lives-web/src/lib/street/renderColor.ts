export function blendColor(base: number, mix: number, amount: number) {
  const clampedAmount = Math.max(0, Math.min(amount, 1));
  const red = Math.round(
    ((base >> 16) & 0xff) * (1 - clampedAmount) +
      ((mix >> 16) & 0xff) * clampedAmount,
  );
  const green = Math.round(
    ((base >> 8) & 0xff) * (1 - clampedAmount) +
      ((mix >> 8) & 0xff) * clampedAmount,
  );
  const blue = Math.round(
    (base & 0xff) * (1 - clampedAmount) + (mix & 0xff) * clampedAmount,
  );

  return (red << 16) | (green << 8) | blue;
}
