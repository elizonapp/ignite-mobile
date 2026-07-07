import { useEffect } from "react";

import { registerHostedFlowNavigate } from "../lib/hosted-flow";
import { useRouter } from "./Router";

export function HostedFlowBridge() {
  const { navigate } = useRouter();

  useEffect(() => {
    registerHostedFlowNavigate((url, options) => {
      navigate({ name: "hosted-flow", url, title: options?.title });
    });
    return () => registerHostedFlowNavigate(null);
  }, [navigate]);

  return null;
}
