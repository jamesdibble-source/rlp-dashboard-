#!/usr/bin/env node
const assert = require('assert');
const { runPendingJobs, resolveWorkerConcurrency } = require('./queue-runner');

async function testBoundedConcurrency() {
  const jobs = Array.from({ length: 7 }, (_, i) => ({ id: i + 1 }));
  let active = 0;
  let peak = 0;
  const visited = [];

  await runPendingJobs(jobs, async (job) => {
    active += 1;
    peak = Math.max(peak, active);
    visited.push(job.id);
    await new Promise(resolve => setTimeout(resolve, 20));
    active -= 1;
  }, { concurrency: 3 });

  assert.strictEqual(visited.length, jobs.length, 'all jobs should run');
  assert(peak <= 3, `peak concurrency should be <= 3, got ${peak}`);
}

function testReaSafetyDefault() {
  assert.strictEqual(resolveWorkerConcurrency({}, ['domain']), 1);
  assert.strictEqual(resolveWorkerConcurrency({ concurrency: '4' }, ['domain']), 4);
  assert.strictEqual(resolveWorkerConcurrency({ concurrency: '4' }, ['domain', 'rea']), 1);
  assert.strictEqual(resolveWorkerConcurrency({ concurrency: '4', allowParallelRea: 'true' }, ['domain', 'rea']), 4);
}

async function main() {
  testReaSafetyDefault();
  await testBoundedConcurrency();
  console.log('queue-runner concurrency tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
