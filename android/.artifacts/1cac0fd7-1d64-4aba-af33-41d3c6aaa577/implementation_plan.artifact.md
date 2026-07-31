# Fix KSP `unexpected jvm signature V` Error

The build is failing with `[ksp] java.lang.IllegalStateException: unexpected jvm signature V`. This is a known issue in KSP2 (the new KSP backend) when processing `suspend` functions that return `Unit`, which is common in Room DAOs.

## Proposed Changes

### 1. Disable KSP2 (Workaround)
The quickest fix is to disable the KSP2 backend and fallback to KSP1. This is done by adding a property to `gradle.properties`.

#### [MODIFY] [gradle.properties](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/gradle.properties)
Add `ksp.useKSP2=false`.

### 2. Update Room Version (Alternative Fix)
If disabling KSP2 is not preferred, updating Room to a version that supports KSP2's JVM signatures (like 2.8.4) should also resolve the issue.

#### [MODIFY] [app/build.gradle.kts](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/build.gradle.kts)
Update `roomVersion` from `2.6.1` to `2.8.4`.

## Verification Plan

### Automated Tests
- Run `./gradlew :app:kspReleaseKotlin` to verify the KSP processing finishes successfully.
- Run a full build: `./gradlew assembleDebug`.

### Manual Verification
- None required as this is a build-time fix.
