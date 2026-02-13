param(
  [Parameter(Mandatory = $false)]
  [string]$WorkerName = "codeathon-ai-router"
)

$required = @(
  "GROQ_API_KEY",
  "GEMINI_API_KEY",
  "MISTRAL_API_KEY",
  "COHERE_API_KEY",
  "CODESTRAL_API_KEY",
  "NVIDIA_NIM_API_KEY",
  "CEREBRAS_API_KEY",
  "HUGGINGFACE_API_KEY",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_ACCOUNT_ID",
  "OLLAMA_API_KEY",
  "OPENCODE_API_KEY"
)

Write-Host "Checking Worker secrets for: $WorkerName" -ForegroundColor Cyan

$raw = wrangler secret list --name $WorkerName
if ($LASTEXITCODE -ne 0) {
  Write-Error "Failed to list secrets for Worker: $WorkerName"
  exit $LASTEXITCODE
}

$parsed = @()
try {
  $parsed = $raw | ConvertFrom-Json
} catch {
  Write-Error "Unable to parse Wrangler JSON output."
  exit 1
}

$found = @()
foreach ($item in $parsed) {
  if ($item -and $item.name) {
    $found += [string]$item.name
  }
}

$missing = @()
foreach ($key in $required) {
  if ($found -notcontains $key) {
    $missing += $key
  }
}

Write-Host "Found secrets: $($found.Count)" -ForegroundColor Green
if ($found.Count -gt 0) {
  $found | Sort-Object | ForEach-Object { Write-Host " - $_" }
}

Write-Host ""
Write-Host "Missing secrets: $($missing.Count)" -ForegroundColor Yellow
if ($missing.Count -gt 0) {
  $missing | Sort-Object | ForEach-Object { Write-Host " - $_" }
  Write-Host ""
  Write-Host "Set missing secrets with:" -ForegroundColor Cyan
  Write-Host "npm run worker:secret:setup" -ForegroundColor White
} else {
  Write-Host "All required secrets are configured." -ForegroundColor Green
}
