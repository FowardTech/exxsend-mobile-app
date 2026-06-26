const { withDangerousMod, withProjectBuildGradle, withAndroidManifest } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Sumsub's native SDKs (IdensicMobileSDK on iOS, the Android equivalent)
 * are not published to the standard public registries either platform's
 * build tooling checks by default — they're only resolvable through
 * Sumsub's own hosted repositories. This produced two separate, but
 * identically-caused, build failures:
 *   - iOS:     "Unable to find a specification for `IdensicMobileSDK`"
 *               (pod install couldn't find the spec — no custom source)
 *   - Android: gradle build failure resolving the SDK's Maven artifact
 *               (no custom Maven repository declared)
 *
 * A third, separate issue showed up once dependency resolution itself was
 * fixed: expo-dev-launcher and Sumsub's SDK both declare ML Kit's
 * com.google.mlkit.vision.DEPENDENCIES meta-data with different values
 * (barcode_ui vs face) in their own AndroidManifest.xml — Android's
 * manifest merger refuses to pick one automatically, since this app
 * genuinely needs both (QR scanning via the dev launcher, face liveness
 * via Sumsub), so the fix is to merge the values, not drop either.
 *
 * This project has no checked-in ios/ or android/ directories — Expo
 * regenerates both fresh on every prebuild/dev-client build — so neither
 * the Podfile nor build.gradle can just be hand-edited once. Both need to
 * be injected on every prebuild, which is what this plugin does for both
 * platforms.
 */

const SUMSUB_POD_SOURCE = "source 'https://github.com/SumSubstance/Specs.git'";
const CDN_POD_SOURCE = "source 'https://cdn.cocoapods.org/'";
const SUMSUB_MAVEN_URL = "https://maven.sumsub.com/repository/maven-public/";

function withSumsubPodfileSource(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfilePath, "utf-8");

      if (!contents.includes("SumSubstance/Specs")) {
        // Once any explicit `source` line exists in a Podfile, every pod's
        // source needs to be explicit — it stops falling back to the
        // default CDN implicitly — so both lines are needed together.
        contents = `${CDN_POD_SOURCE}\n${SUMSUB_POD_SOURCE}\n\n${contents}`;
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);
}

function withSumsubMavenRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== "groovy") {
      // Kotlin DSL (build.gradle.kts) project build files are uncommon in
      // current Expo/React Native projects but not impossible — bail
      // rather than risk corrupting syntax this plugin doesn't handle.
      console.warn(
        "[withSumsubMavenRepo] Project build.gradle is not Groovy — skipping automatic Maven repo injection. " +
        `Add manually: maven { url '${SUMSUB_MAVEN_URL}' } inside allprojects { repositories { ... } }.`
      );
      return config;
    }

    if (!config.modResults.contents.includes("maven.sumsub.com")) {
      const mavenBlock = `        maven { url '${SUMSUB_MAVEN_URL}' }\n`;
      // Insert right after the first `repositories {` inside `allprojects`
      // — matches the standard generated Expo project build.gradle shape,
      // which has exactly one such block at the root level.
      const marker = /allprojects\s*\{\s*repositories\s*\{/;
      if (marker.test(config.modResults.contents)) {
        config.modResults.contents = config.modResults.contents.replace(
          marker,
          (match) => `${match}\n${mavenBlock}`
        );
      } else {
        // Fallback: couldn't find the expected block shape — append a new
        // allprojects block rather than silently doing nothing.
        config.modResults.contents += `\nallprojects {\n    repositories {\n${mavenBlock}    }\n}\n`;
      }
    }

    return config;
  });
}

const MLKIT_VISION_DEPS_NAME = "com.google.mlkit.vision.DEPENDENCIES";

function withSumsubMlkitManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    // tools:replace requires the tools namespace to be declared on the
    // root <manifest> element — recent Expo-generated manifests already
    // have this, but add it defensively in case that ever changes.
    const manifestAttrs = config.modResults.manifest["$"] || {};
    if (!manifestAttrs["xmlns:tools"]) {
      manifestAttrs["xmlns:tools"] = "http://schemas.android.com/tools";
      config.modResults.manifest["$"] = manifestAttrs;
    }

    if (!application["meta-data"]) application["meta-data"] = [];

    const existing = application["meta-data"].find(
      (item) => item["$"]?.["android:name"] === MLKIT_VISION_DEPS_NAME
    );

    if (existing) {
      // Merge rather than overwrite, in case some other dependency (or a
      // future Expo SDK upgrade) also needs a value here.
      const current = String(existing["$"]["android:value"] || "");
      const values = new Set(current.split(",").map((v) => v.trim()).filter(Boolean));
      values.add("barcode_ui");
      values.add("face");
      existing["$"]["android:value"] = Array.from(values).join(",");
      existing["$"]["tools:replace"] = "android:value";
    } else {
      application["meta-data"].push({
        $: {
          "android:name": MLKIT_VISION_DEPS_NAME,
          "android:value": "barcode_ui,face",
          "tools:replace": "android:value",
        },
      });
    }

    return config;
  });
}

function withSumsubNativeDeps(config) {
  config = withSumsubPodfileSource(config);
  config = withSumsubMavenRepo(config);
  config = withSumsubMlkitManifestFix(config);
  return config;
}

module.exports = withSumsubNativeDeps;
