import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.elizon.ignite.mobile',
  appName: 'elizon',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    backgroundColor: '#09090b',
  },
  android: {
    backgroundColor: '#09090b',
  },
};

export default config;
