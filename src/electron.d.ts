export {};

declare global {
  interface Window {
    electron?: {
      platform?: string;
    };
  }
}
