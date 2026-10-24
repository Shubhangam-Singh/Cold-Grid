#!/usr/bin/env sh
cd "$(dirname "$0")"
if command -v ollama >/dev/null 2>&1; then
  echo "Ollama is on PATH. FROST uses llama3.2:3b only if that model is already pulled."
else
  echo "Ollama is not installed. FROST will answer from the rules engine."
fi
exec npx tsx copilot/server.ts
