import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.austamgood.wms',
  appName: 'AustamGood WMS',
  webDir: 'public',
  server: {
    // ใส่ URL Vercel ของคุณที่นี่
    url: 'https://austamgood-wms.vercel.app',
    cleartext: true
  }
};

export default config;
