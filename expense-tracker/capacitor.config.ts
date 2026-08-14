import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jared.expensetracker',
  appName: 'Expense Tracker',
  webDir: 'public',
  server: {
    url: 'https://my-expenses-theta-three.vercel.app',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;