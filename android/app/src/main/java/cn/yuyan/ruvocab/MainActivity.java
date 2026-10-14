package cn.yuyan.ruvocab;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // WebView 默认要求"用户手势"才允许播放媒体，程序化的自动朗读会被静默拦截。
    // 这里显式放开：App 内所有发音都由用户操作触发，放开后播放更稳定。
    if (bridge != null && bridge.getWebView() != null) {
      try {
        bridge.getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
      } catch (Exception ignored) {
      }
    }
  }
}
