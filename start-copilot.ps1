# Start FROST on 127.0.0.1:8787. Rules answers work without Ollama.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (Get-Command ollama -ErrorAction SilentlyContinue) {
  Write-Host "Ollama is on PATH. FROST uses llama3.2:3b only if that model is already pulled."
} else {
  Write-Host "Ollama is not installed. FROST will answer from the rules engine."
}
npx tsx copilot/server.ts
