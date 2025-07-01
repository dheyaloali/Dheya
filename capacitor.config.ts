import { CapacitorConfig } from '@capacitor/cli';
import 'dotenv/config';

const config: CapacitorConfig = {
  appId: 'com.employeemanagement.app',
  appName: 'Employee Management',
  webDir: 'out',
  server: {
    // Use the network IP address
    url: process.env.CAPACITOR_SERVER_URL || 'http://localhost:3000',
    cleartext: true,
    androidScheme: 'https'
  },
  // Configure plugins
  plugins: {
    // Configure geolocation permissions
    Geolocation: {
      permissions: {
        ios: {
          whenInUse: true,
          always: true,
        },
        android: {
          fine: true,
          coarse: true,
        }
      }
    },
    // Configure notification permissions
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    // Configure camera permissions
    Camera: {
      permissions: {
        ios: {
          whenInUse: true,
        },
        android: {
          camera: true,
        }
      }
    },
    SplashScreen: {
      launchAutoHide: false,
      showSpinner: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#1a73e8",
    },
    CapacitorHttp: {
      enabled: true,
    },
    CapacitorCookies: {
      enabled: true,
    },
  },
  // Configure Android specific settings
  android: {
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      releaseType: "AAB",
    },
    backgroundColor: "#ffffff",
  },
  // Configure iOS specific settings
  ios: {
    contentInset: "always",
    scheme: "App",
    backgroundColor: "#ffffff",
  },
};

export default config;
