export function useRouter() {
  return {
    push: () => undefined,
    replace: () => undefined,
    prefetch: async () => undefined,
    back: () => undefined,
    forward: () => undefined,
    refresh: () => undefined,
  };
}

export function useParams<T extends Record<string, string | string[] | undefined>>() {
  return {} as T;
}

export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}
