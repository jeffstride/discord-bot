import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const servicesDirectory = path.dirname(fileURLToPath(import.meta.url));
export const defaultDataDirectory = path.join(servicesDirectory, '..', 'data');
const activeSections = new Map();

export function discoverSectionFiles(dataDirectory = defaultDataDirectory) {
  if (!fs.existsSync(dataDirectory)) {
    return [];
  }

  return fs.readdirSync(dataDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.csv'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function getContextId(req) {
  return req.body.guild_id
    || req.body.guild?.id
    || req.body.member?.user?.id
    || req.body.user?.id;
}

export function getSectionPath(filename, dataDirectory = defaultDataDirectory) {
  if (!discoverSectionFiles(dataDirectory).includes(filename)) {
    throw new Error(`Unknown section file: ${filename}`);
  }

  return path.join(dataDirectory, filename);
}

export function setActiveSection(req, filename, dataDirectory = defaultDataDirectory) {
  getSectionPath(filename, dataDirectory);
  const contextId = getContextId(req);

  if (!contextId) {
    throw new Error('Unable to determine the Discord server');
  }

  activeSections.set(contextId, filename);
  return filename;
}

export function resolveActiveSection(req, dataDirectory = defaultDataDirectory) {
  const files = discoverSectionFiles(dataDirectory);

  if (files.length === 0) {
    return { status: 'missing', files };
  }

  if (files.length === 1) {
    return {
      status: 'selected',
      files,
      filename: files[0],
      path: path.join(dataDirectory, files[0]),
    };
  }

  const contextId = getContextId(req);
  const filename = activeSections.get(contextId);

  if (!filename || !files.includes(filename)) {
    if (contextId) {
      activeSections.delete(contextId);
    }
    return { status: 'required', files };
  }

  return {
    status: 'selected',
    files,
    filename,
    path: path.join(dataDirectory, filename),
  };
}

export function clearActiveSections() {
  activeSections.clear();
}
