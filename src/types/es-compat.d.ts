interface String {
  replaceAll(searchValue: unknown, replaceValue: string): string;
}

interface Error {
  cause?: unknown;
}