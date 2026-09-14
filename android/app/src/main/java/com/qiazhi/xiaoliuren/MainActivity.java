package com.qiazhi.xiaoliuren;

import android.webkit.ValueCallback;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

/*
 * 返回键语义（配合 app.js 的 window.__xlrBack）：
 *   1. JS 里有 Tab 历史栈 → 回退到上一个 Tab；
 *   2. 退无可退 → JS 弹「再按一次退出」提示并返回 true，仍拦截；
 *   3. 2 秒内按第二次 → JS 返回 false，这里放行 super.onBackPressed() 退出。
 * 不用 @capacitor/app 插件：本机 cap sync 会删光插件目录（见交接文档第六节），
 * 且本项目刻意保持零依赖，30 行原生代码比引入插件链路更稳。
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onBackPressed() {
        WebView wv = (bridge == null) ? null : bridge.getWebView();
        if (wv == null) {
            super.onBackPressed();
            return;
        }
        wv.evaluateJavascript(
            "(function(){return !!(window.__xlrBack && window.__xlrBack());})()",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String value) {
                    // JS 未拦截（返回 false / null）→ 交给系统退出
                    if (!"true".equals(value)) {
                        superBackPressed();
                    }
                }
            }
        );
    }

    private void superBackPressed() {
        super.onBackPressed();
    }
}
