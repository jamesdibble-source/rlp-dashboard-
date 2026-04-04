# OpenLot browser execution ladder

This is the current progression from planning to a browser-tool-shaped execution contract.

## Layers

1. `openlot-browser-tool-live-runner.js`
   - Produces the human-readable OpenLot browser sequence plus save/ingest commands.

2. `openlot-browser-act-plan.js`
   - Converts the live sequence into snapshot-then-act semantics.

3. `openlot-browser-a2ui-plan.js`
   - Converts that plan into JSONL records.

4. `openlot-browser-a2ui-runner.js`
   - Adapts the JSONL/bundle into dry-run, bundle, thin-executor, or live OpenClaw CLI execution.

5. `openlot-browser-tool-contract-runner.js`
   - New concrete layer.
   - Compiles the prepared plan into **exact browser tool call objects** with nested `request` payloads for `browser.act`.
   - Can also `--mode simulate` to replay the contract locally against fixture snapshots/evaluate output.

6. `openlot-browser-live-to-ingest.js`
   - New end-to-end bridge.
   - Runs the live plan through `openlot-browser-a2ui-runner.js --adapter openclaw-cli-executor` and then immediately invokes the one-command ingest helper.
   - Also supports `--skipBrowser` so an already-saved live export can be pushed through the same wrapper without rebuilding the browser half.

## Why the contract runner exists

The thin executor proves labels can be resolved into refs, but it still outputs a generic bundle.
The contract runner narrows that into the shape a real browser-tool caller would issue:

- `open`
- `snapshot`
- `act` with `request.kind=click|select|type|evaluate`
- resolved `ref` values injected into act requests
- metadata showing which snapshot resolved each label and what candidates were considered

That makes it easier to:

- hand off to a future direct browser-tool loop
- diff exact tool-call payloads between runs
- simulate the run without a real browser session
- audit failures back to the snapshot-resolution stage

## Example

```bash
# Build the earlier layers first
node engine/openlot-browser-tool-live-runner.js --suburb Tarneit --state VIC --postcode 3029 > tmp/live.json
node engine/openlot-browser-act-plan.js --input tmp/live.json --output tmp/act.json
node engine/openlot-browser-a2ui-plan.js --input tmp/act.json --output tmp/plan.jsonl

# Compile exact browser-tool-shaped calls
node engine/openlot-browser-tool-contract-runner.js \
  --input tmp/plan.jsonl \
  --snapshotFile tmp/fixtures/openlot-snapshots.json \
  --evaluateResultFile tmp/fixtures/openlot-evaluate.json \
  --output tmp/openlot-browser-contract.json

# Or simulate it and persist the extractor fixture into the requested output file
node engine/openlot-browser-tool-contract-runner.js \
  --mode simulate \
  --input tmp/plan.jsonl \
  --snapshotFile tmp/fixtures/openlot-snapshots.json \
  --evaluateResultFile tmp/fixtures/openlot-evaluate.json \
  --output tmp/openlot-browser-contract-simulated.json
```

## Output shape

Each compiled entry looks like:

```json
{
  "step": 4,
  "call": {
    "action": "act",
    "target": "host",
    "request": {
      "kind": "select",
      "ref": "e24",
      "values": ["$5M"]
    }
  },
  "meta": {
    "resolveLabel": "Max Price",
    "resolvedRef": "e24",
    "snapshotIndex": 3
  }
}
```

That is intentionally close to the real browser tool contract while still being safe to compile and simulate offline.

## End-to-end live -> ingest wrapper

If the goal is not just to execute the browser sequence but to land the result straight into the ingest path, use:

```bash
node engine/openlot-browser-live-to-ingest.js \
  --suburb Tarneit \
  --state VIC \
  --postcode 3029 \
  --mode test
```

That wrapper creates the intermediate plan artifacts, runs the live CLI executor, then feeds the saved extractor JSON straight into `ingest-openlot-browser-tool-export.js` and returns one combined summary.
