# ADHD Life Agent - APK Build Package v3

This version adds the extra life-assistant features requested:

## New features

- 15-minute accountability check-ins: "What are you doing right now?"
- Check-ins pause when Sleeping Mode is on.
- Natural language sleep command: "I am sleeping until 7:00 am".
- Wake alarm command: "Wake me at 7:00 am".
- Distraction list: add things you should not be doing, such as social media, YouTube, random browsing.
- Relationship/life tasks: includes Relationship category, for example "Talk with my wife today for 20 minutes".
- Manual check-in buttons: assigned task, distracted, planned break, sleeping.
- Check-in history log.
- Local notification scheduling through Capacitor Local Notifications.

## Build APK

```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

In Android Studio:

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Important Android note

The app includes Local Notifications. For very reliable exact alarms every 15 minutes while the app is fully closed, Android may require extra native alarm/background permissions depending on Android version and battery optimisation settings. The current package schedules notifications and runs check-ins while the app is open; a production version should add a small native Android background service/exact alarm implementation.

## AI note

This version uses an on-device rule-based assistant for privacy and offline use. A future production version can connect to an AI backend for richer conversation, but API keys should never be stored directly inside the APK.
