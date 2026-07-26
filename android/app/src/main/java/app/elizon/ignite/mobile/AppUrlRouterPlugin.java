package app.elizon.ignite.mobile;

import android.webkit.WebView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Installs a WebViewClient that captures elizon.app iframe navigations
 * and emits {@code elizonAppUrl} so the JS shell can open native routes.
 */
@CapacitorPlugin(name = "AppUrlRouter")
public class AppUrlRouterPlugin extends Plugin {

    @Override
    public void load() {
        getBridge().executeOnMainThread(() -> {
            ElizonAwareWebViewClient client = new ElizonAwareWebViewClient(getBridge(), this);
            getBridge().setWebViewClient(client);
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.setWebViewClient(client);
            }
        });
    }

    /** Called from {@link ElizonAwareWebViewClient} (notifyListeners is protected). */
    void emitElizonAppUrl(String url) {
        JSObject data = new JSObject();
        data.put("url", url);
        notifyListeners("elizonAppUrl", data);

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) {
            return;
        }
        String escaped = url
            .replace("\\", "\\\\")
            .replace("'", "\\'")
            .replace("\n", "")
            .replace("\r", "");
        String js =
            "(function(){try{window.dispatchEvent(new CustomEvent('elizon:app-url',{detail:{url:'"
                + escaped
                + "'}}));}catch(e){}})();";
        webView.evaluateJavascript(js, null);
    }
}
