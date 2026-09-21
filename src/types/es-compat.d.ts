interface String {
  replaceAll(searchValue: string | RegExp, replaceValue: string): string;
}

interface Error {
  cause?: unknown;
}