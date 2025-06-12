export function sanitizeInput(input: string) {
  return input.replace(/[<>]/g, "").trim();
} 