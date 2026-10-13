import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to conditionally join and merge Tailwind CSS class names.
 * Ensures conflicting Tailwind classes (e.g. `px-2` vs `px-4`) are correctly resolved.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
