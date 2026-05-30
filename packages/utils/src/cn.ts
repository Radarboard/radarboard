import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: ["w-2xs", "w-xs", "w-sm", "w-base", "w-md", "w-lg", "w-xl", "w-2xl", "w-3xl"],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
