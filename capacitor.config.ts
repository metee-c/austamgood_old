import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.austamgood.wms',
  appName: 'AustamGood WMS',
  webDir: 'out',
  server: {
    // ใส่ URL Vercel ของคุณที่นี่
    url: 'https://your-app.vercel.app',
    cleartext: true
  }
};

export default config;
