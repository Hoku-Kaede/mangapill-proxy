import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mangadex.reader',
  appName: 'MangaDex Reader',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
