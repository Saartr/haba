---
name: project-ios-plan
description: iOS build plan — EAS Build when Apple Developer Account is obtained
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

iOS build is a future goal. User does not currently have an Apple Developer Account ($99/year).

**Why:** App needs to ship on both iOS and Android eventually.

**How to apply:** When iOS comes up, recommend EAS Build (Expo's cloud CI). It builds IPA on Anthropic's Mac servers — no local Mac needed. Requires:
1. `npm install -g eas-cli`
2. `eas login`
3. `eas build:configure`
4. Apple Developer Account for device installs / TestFlight / App Store

Until then, all testing is Android-only via local Gradle builds.
