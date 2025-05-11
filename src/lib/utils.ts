import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function for conditional class name generation
 * Combines clsx and tailwind-merge for cleaner className assignment
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
