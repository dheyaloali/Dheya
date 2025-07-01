# Firebase Push Notifications Setup

This guide explains how to set up Firebase Cloud Messaging (FCM) for push notifications in the Employee Management System.

## Prerequisites

1. A Firebase project (create one at [Firebase Console](https://console.firebase.google.com/))
2. The Android app already set up in your Firebase project

## Setup Steps

### 1. Firebase Configuration

1. Place your `google-services.json` file in the `android/app/` directory
2. Make sure Firebase dependencies are added to your Gradle files:
   - In `android/build.gradle`:
     ```gradle
     buildscript {
         dependencies {
             classpath 'com.google.gms:google-services:4.4.2'
         }
     }
     ```
   - In `android/app/build.gradle`:
     ```gradle
     dependencies {
         implementation platform('com.google.firebase:firebase-bom:33.1.0')
         implementation 'com.google.firebase:firebase-messaging'
     }
     
     // At the bottom of the file
     apply plugin: 'com.google.gms.google-services'
     ```

### 2. Web Push Configuration

1. In Firebase Console, go to Project Settings > Cloud Messaging
2. Under "Web configuration", generate a new Web Push certificate
3. The system will use this certificate automatically for Web Push notifications

### 3. Server-Side Setup

1. Generate a Firebase Admin SDK service account key:
   - Go to Firebase Console > Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file securely

2. Set up environment variables in your `.env` file:
   ```
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=your-client-email@your-project-id.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----\n"
   ```

3. Apply the database schema changes:
   ```bash
   npx prisma db push
   ```

### 4. Using Push Notifications

The system now includes these utilities for sending push notifications:

1. `sendPushNotificationToUser(userId, title, body, data)` - Send to a specific user
2. `sendPushNotificationToUsers(userIds, title, body, data)` - Send to multiple users
3. `sendPushNotificationByCity(city, title, body, data)` - Send to all employees in a city

Example usage:

```typescript
import { createNotificationWithPush } from '@/lib/notifications';

// Create a notification and send push notification
await createNotificationWithPush({
  userId: "user-id-here",
  type: "new_assignment",
  message: "You have been assigned a new task",
  actionUrl: "/employee/tasks",
  actionLabel: "View Task",
  sendPush: true
});
```

### 5. Testing Push Notifications

1. Build and run the Android app:
   ```bash
   pnpm run build:capacitor
   pnpm run open:android
   ```

2. Log in to the app to register the device token
3. Send a test notification from the admin panel or using the API

## Troubleshooting

- **Missing device tokens**: Ensure users have logged in on their mobile devices
- **Notification not showing**: Check Firebase Console > Cloud Messaging for delivery reports
- **Initialization errors**: Verify your service account credentials are correct

## Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Capacitor Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications) 