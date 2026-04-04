const path = require('path');

function slugifyTarget(target = {}) {
  return `${String(target.state || '').toLowerCase()}-${String(target.suburb || '').toLowerCase().replace(/\s+/g, '-')}-${String(target.postcode || '')}`;
}

function buildLivePaths(target = {}, args = {}) {
  const slug = slugifyTarget(target);
  const runStamp = args.runStamp || new Date().toISOString().replace(/[:.]/g, '-');
  const liveRoot = path.resolve(args.liveRoot || './tmp/openlot-live-runs');
  const runDir = path.join(liveRoot, `${slug}-${runStamp}`);

  const browserExportFile = path.resolve(args.browserExportFile || path.join(runDir, 'openlot-browser-export.json'));
  const rawDir = path.resolve(args.rawDir || path.join(runDir, 'raw'));
  const payloadDir = path.resolve(args.payloadDir || path.join(runDir, 'payloads'));
  const manifest = path.resolve(args.manifest || path.join(payloadDir, 'manifest.json'));
  const snapshotOutDir = path.resolve(args.snapshotOutDir || path.join(runDir, 'snapshots'));
  const workDir = path.resolve(args.workDir || path.join(runDir, 'work'));

  return {
    slug,
    runStamp,
    liveRoot,
    runDir,
    browserExportFile,
    rawDir,
    payloadDir,
    manifest,
    snapshotOutDir,
    workDir,
  };
}

module.exports = { slugifyTarget, buildLivePaths };
