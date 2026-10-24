# FROST architecture

```
Browser map (localhost:3000)
  Copilot panel
    local rules: insights, rupee cards, confirm → Zustand
    POST /api/copilot/v2/*   (same origin, localhost only)
        │
        ▼
Next route
  token stays on the server
  if 127.0.0.1:8787 is up → sidecar
  else → rules engine + in-process journal
        │
        ▼
Sidecar 127.0.0.1:8787
  SQLite or JSONL audit
  Ollama 127.0.0.1:11434 only when that process and the configured model exist
```

The spoilage math stays in `lib/engine/spoilage.ts`. `withMeasuredCargo` copies the probed truck's last temperature so `analyzeFleet` can run unchanged and still see the cart.

Confirm moves:

- Sell now writes `sellMarks` and does not move the truck.
- Hold calls `applyHubHold` with the hub id on the card.
- Kitchen divert calls `applyKitchenDivert`.

`update_threshold` and `request_reanchor` are audit records. They do not edit `produce.ts` and they do not send a transaction.

Search over the four SOP templates is keyword overlap. There is no vector database. The corpus is small and the citations are the template titles.

The model path asks Ollama once, checks every number and `SHP-n` id against the tool facts, retries once, then returns the rules answer with mode `degraded`. If Ollama is absent the mode stays `rules`. That is not labelled as a model.
