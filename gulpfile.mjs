import fs from 'fs-extra';
import gulp from 'gulp';
import sass from 'gulp-dart-sass';
import sourcemaps from 'gulp-sourcemaps';
import path from 'node:path';
import buffer from 'vinyl-buffer';
import source from 'vinyl-source-stream';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import rollupStream from '@rollup/stream';

import rollupConfig from './rollup.config.mjs';

/********************/
/*  CONFIGURATION   */
/********************/

const name = 'foundryvtt-buff-wizard';
const sourceDirectory = './src';
const distDirectory = './dist';
const stylesDirectory = `${sourceDirectory}/styles`;
const stylesExtension = 'scss';
const sourceFileExtension = 'ts';
const staticFiles = ['assets', 'fonts', 'lang', 'packs', 'templates', 'module.json'];

/********************/
/*      BUILD       */
/********************/

let cache;

/**
 * Build the distributable JavaScript code
 */
function buildCode() {
  return rollupStream({ ...rollupConfig(), cache })
    .on('bundle', (bundle) => {
      cache = bundle;
    })
    .pipe(source(`${name}.js`))
    .pipe(buffer())
    .pipe(sourcemaps.init({ loadMaps: true }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(`${distDirectory}/module`));
}

/**
 * Build style sheets
 */
function buildStyles() {
  return gulp
    .src(`${stylesDirectory}/${name}.${stylesExtension}`)
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest(`${distDirectory}/styles`));
}

/**
 * Copy static files
 */
async function copyFiles() {
  for (const file of staticFiles) {
    if (fs.existsSync(`${sourceDirectory}/${file}`)) {
      await fs.copy(`${sourceDirectory}/${file}`, `${distDirectory}/${file}`);
    }
  }
}

/**
 * Watch for changes for each build step
 */
export function watch() {
  gulp.watch(`${sourceDirectory}/**/*.${sourceFileExtension}`, { ignoreInitial: false }, buildCode);
  gulp.watch(`${stylesDirectory}/**/*.${stylesExtension}`, { ignoreInitial: false }, buildStyles);
  gulp.watch(
    staticFiles.map((file) => `${sourceDirectory}/${file}`),
    { ignoreInitial: false },
    copyFiles,
  );
}

export const build = gulp.series(clean, gulp.parallel(buildCode, buildStyles, copyFiles));

/********************/
/*      CLEAN       */
/********************/

/**
 * Remove built files from `dist` folder while ignoring source files
 */
export async function clean() {
  const files = [...staticFiles, 'module'];

  if (fs.existsSync(`${stylesDirectory}/${name}.${stylesExtension}`)) {
    files.push('styles');
  }

  console.log(' ', 'Files to clean:');
  console.log('   ', files.join('\n    '));

  for (const filePath of files) {
    await fs.remove(`${distDirectory}/${filePath}`);
  }
}

/********************/
/*       LINK       */
/********************/

/**
 * Get the data path of Foundry VTT based on what is configured in `foundryconfig.json`
 */
function getDataPath() {
  const config = fs.readJSONSync('foundryconfig.json');

  if (config?.dataPath) {
    if (!fs.existsSync(path.resolve(config.dataPath))) {
      throw new Error('User Data path invalid, no Data directory found');
    }

    return path.resolve(config.dataPath);
  } else {
    throw new Error('No User Data path defined in foundryconfig.json');
  }
}

/**
 * Link build to User Data folder
 */
export async function link() {
  let destinationDirectory;
  if (fs.existsSync(path.resolve(sourceDirectory, 'module.json'))) {
    destinationDirectory = 'modules';
  } else {
    throw new Error('Could not find module.json');
  }

  const linkDirectory = path.resolve(getDataPath(), 'Data', destinationDirectory, name);

  const argv = yargs(hideBin(process.argv)).option('clean', {
    alias: 'c',
    type: 'boolean',
    default: false,
  }).argv;
  const clean = argv.c;

  if (clean) {
    console.log(`Removing build in ${linkDirectory}.`);

    await fs.remove(linkDirectory);
  } else if (!fs.existsSync(linkDirectory)) {
    console.log(`Linking dist to ${linkDirectory}.`);
    await fs.ensureDir(path.resolve(linkDirectory, '..'));
    await fs.symlink(path.resolve(distDirectory), linkDirectory);
  }
}
