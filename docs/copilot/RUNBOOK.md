# FROST runbook

## Run the map

From `coldgrid/`:

```
npm run dev
```

Open `http://localhost:3000`. The Copilot chip is on the map. Advice works with the sidecar stopped. The header reads `FROST · rules`.

## Run the sidecar

From `coldgrid/`:

```
.\start-copilot.ps1
```

From the ChillChain folder, `.\start-copilot.ps1` does the same. The process listens on `127.0.0.1:8787`. Health:

```
Invoke-RestMethod http://127.0.0.1:8787/health -Headers @{ "x-coldgrid-token" = "coldgrid-local" }
```

Set `COLDGRID_COPILOT_TOKEN` in the shell if you change it. Do not prefix it with `NEXT_PUBLIC_`.

## Model

Ollama is optional. This PC does not have it. After you install it:

```
ollama pull llama3.2:3b
```

Restart the sidecar. The pill changes to `FROST · local ✓ llama3.2:3b` only when that tag is actually loaded. To point at another local server, change `ollama` and `model` in `copilot.config.yaml`. Temperature is capped at 0.3. The bind address stays `127.0.0.1`.

Do not pull a 7B or larger model while free RAM is about 7 GB.

## When something fails

- Cart and copilot both "offline": port 8765 is the bridge, 8787 is FROST. They are different processes.
- Audit says unavailable: the Next server did not answer. The map move still runs. Start `npm run dev`.
- Ledger answers "not anchored": `NEXT_PUBLIC_ENABLE_CHAIN` is off, or no RPC snapshot was marked anchored. That sentence is correct.
- A draft with a number the tools did not produce is dropped. The rules sentence remains.

## Tests

```
npx tsc --noEmit
npm test
node eval/run.mjs
```
