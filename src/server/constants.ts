import { resolve as resolvePath } from 'node:path';
import { cwd } from 'node:process';
import { URL } from 'node:url';

import $package from '../../package.json';

const { name: APP_NAME } = $package;

// Import process env variables
const {
  DATABASE_PROTOCOL = 'mongodb',
  DATABASE_URL = 'localhost',
  DATABASE_USER,
  DATABASE_PASS,
  DATABASE_NAME,
  WEBSERVER_PORT: serverPort = '15632',
} = process.env;

// Lets generate the url
const urlObject = new URL('http://example.com');
const { searchParams } = urlObject;

urlObject.host = DATABASE_URL as string;
urlObject.pathname = DATABASE_NAME as string;

searchParams.set('appName', APP_NAME);

let _serverPort = 15632;
try {
  _serverPort = parseInt(serverPort, 10);
} catch (_ignored) {}

// Export needed entries
export const COMPLETE_DATABASE_URL = urlObject.toString().replace(/^[^:]+/g, DATABASE_PROTOCOL);

export const ASSETS_DIRECTORY = resolvePath(cwd(), 'src', 'assets');
export const WEBSERVER_PORT = _serverPort;

export { DATABASE_URL, DATABASE_USER, DATABASE_PASS, DATABASE_NAME, APP_NAME };
