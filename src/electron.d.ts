export {};

declare global {
  interface Window {
    electron?: {
      openWindow: (url: string) => void;
      openExternal: (url: string) => void;
    };
  }
}
