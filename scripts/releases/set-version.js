/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

'use strict';

/*::
import type {PackageJson} from '../shared/monorepoUtils';
*/

const {
  getPackages,
  getWorkspaceRoot,
  updatePackageJson,
} = require('../shared/monorepoUtils');
const {updateReactNativeArtifacts} = require('./set-rn-artifacts-version');
const {parseArgs} = require('util');

const config = {
  allowPositionals: true,
  options: {
    skipReactNativeVersion: {
      type: 'boolean',
    },
    help: {type: 'boolean'},
  },
};

async function main() {
  const {
    positionals: [version],
    values: {help, skipReactNativeVersion},
    /* $FlowFixMe[incompatible-call] Natural Inference rollout. See
     * https://fburl.com/workplace/6291gfvu */
  } = parseArgs(config);

  if (help) {
    console.log(`
  Usage: node ./scripts/releases/set-version.js <version> [OPTIONS]

  Bump the version of all packages.

  - Updates package.json metadata for all workspaces and the project root.
  - Updates relevant native files in the react-native package.

  If --skipReactNativeVersion is passed, the react-native package version will
  be left unmodified as "1000.0.0" (special static version on main), and native
  files will not be touched.

  Options:
    --skipReactNativeVersion  Don't update the version of the react-native
        package (default: false).
    `);
    return;
  }

  if (version == null) {
    throw new Error('Missing version argument');
  }

  await setVersion(version, skipReactNativeVersion);
}

async function setVersion(
  version /*: string */,
  skipReactNativeVersion /*: boolean */ = false,
) /*: Promise<void> */ {
  const packages = await getPackages({
    includePrivate: true,
    includeReactNative: true,
  });
  const newPackageVersions = Object.fromEntries(
    Object.entries(packages).map(([packageName, {packageJson}]) => {
      let packageVersion = version;
      if (packageName === 'react-native' && skipReactNativeVersion) {
        packageVersion = '1000.0.0';
      } else if (packageJson.private === true) {
        packageVersion = packageJson.version ?? '0.0.0';
      }
      return [packageName, packageVersion];
    }),
  );

  const packagesToUpdate = [
    await getWorkspaceRoot(),
    ...Object.values(packages),
  ];

  // Update all workspace packages
  await Promise.all(
    packagesToUpdate.map(pkg => updatePackageJson(pkg, newPackageVersions)),
  );

  // Update generated files in packages/react-native/
  if (!skipReactNativeVersion) {
    await updateReactNativeArtifacts(version);
  }
}

module.exports = {
  setVersion,
};

if (require.main === module) {
  void main();
}
