# Walkthrough - Permanent Fix for KSP JVM Signature Error

I have implemented the permanent fix for the `unexpected jvm signature V` error by updating the Room library and re-enabling KSP2.

## Changes

### Dependency Updates
Updated the Room library to version **2.8.4**, which includes the necessary fixes for KSP2 compatibility when processing Kotlin `suspend` functions.

#### [app/build.gradle.kts](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/app/build.gradle.kts)
```diff
- val roomVersion = "2.6.1"
+ val roomVersion = "2.8.4"
```

### Build Configuration
Re-enabled the KSP2 backend by commenting out the `ksp.useKSP2=false` property in `gradle.properties`. KSP2 is the modern, high-performance backend for KSP.

#### [gradle.properties](file:///C:/Users/metat/Downloads/primestack%20Protocol/android/gradle.properties)
```diff
- ksp.useKSP2=false
+ # ksp.useKSP2=false
```

## Verification Results

### Automated Tests
I verified the build with KSP2 enabled:
- Command: `./gradlew :app:kspReleaseKotlin`
- Result: **Build finished successfully.**

The project is now using the latest stable Room version and the optimized KSP2 backend.
