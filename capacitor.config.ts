import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.elizon.ignite.mobile',
  appName: 'elizon',
  webDir: 'dist',
  ios: {
    // CSS safe-area handles insets; 'always' makes the WebView itself scroll
    // and breaks sticky/fixed shell chrome (header + bottom nav).
    contentInset: 'never',
    backgroundColor: '#09090b',
  },
  android: {
    backgroundColor: '#09090b',
  },
  plugins: {
    // Native HTTP bypasses Android WebView CORS (Origin: https://localhost).
    CapacitorHttp: {
      enabled: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
