package app.elizon.ignite.mobile;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Intercepts iframe document navigations to elizon.app before X-Frame-Options
 * can produce ERR_BLOCKED_BY_RESPONSE, and notifies JS to route in-app.
 */
public class ElizonAwareWebViewClient extends BridgeWebViewClient {
    private final AppUrlRouterPlugin routerPlugin;

    public ElizonAwareWebViewClient(Bridge bridge, AppUrlRouterPlugin routerPlugin) {
        super(bridge);
        this.routerPlugin = routerPlugin;
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        if (shouldCaptureElizonFrameNavigation(request)) {
            final String url = request.getUrl().toString();
            view.post(() -> {
                if (routerPlugin != null) {
                    routerPlugin.emitElizonAppUrl(url);
                }
            });
            return new WebResourceResponse(
                "text/html",
                "UTF-8",
                new ByteArrayInputStream(
                    "<!doctype html><title>elizon</title><body></body>".getBytes(StandardCharsets.UTF_8)
                )
            );
        }
        return super.shouldInterceptRequest(view, request);
    }

    static boolean shouldCaptureElizonFrameNavigation(WebResourceRequest request) {
        if (request == null || request.isForMainFrame()) {
            return false;
        }
        Uri uri = request.getUrl();
        if (uri == null) {
            return false;
        }
        String host = uri.getHost();
        if (host == null) {
            return false;
        }
        String h = host.toLowerCase();
        if (!h.equals("elizon.app") && !h.equals("www.elizon.app")) {
            return false;
        }
        String path = uri.getPath();
        if (path != null && path.startsWith("/api")) {
            return false;
        }

        Map<String, String> headers = request.getRequestHeaders();
        if (headers != null) {
            String dest = headers.get("Sec-Fetch-Dest");
            if (dest != null) {
                return "iframe".equalsIgnoreCase(dest) || "document".equalsIgnoreCase(dest);
            }
            String accept = headers.get("Accept");
            if (accept != null && accept.toLowerCase().contains("text/html")) {
                return true;
            }
        }
        return false;
    }
}
