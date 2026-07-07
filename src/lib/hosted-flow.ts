type HostedFlowNavigate = (url: string, options?: { title?: string }) => void;

let navigateToHostedFlow: HostedFlowNavigate | null = null;

export function registerHostedFlowNavigate(handler: HostedFlowNavigate | null) {
  navigateToHostedFlow = handler;
}

/** Opens a URL inside the app (iframe / same webview) — never a new window or system browser. */
export function openHostedFlow(url: string, options?: { title?: string }) {
  if (navigateToHostedFlow) {
    navigateToHostedFlow(url, options);
    return;
  }
  window.location.assign(url);
}
