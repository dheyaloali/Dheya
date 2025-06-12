export function validateFile(file: File, options: { allowedTypes: string[], maxSize: number }) {
  if (!file) return { valid: false, message: "No file uploaded." };
  if (!options.allowedTypes.includes(file.type)) {
    return { valid: false, message: "Invalid file type." };
  }
  if (file.size > options.maxSize) {
    return { valid: false, message: "File is too large." };
  }
  return { valid: true };
} 