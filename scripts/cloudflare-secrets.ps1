param(
  [Parameter(Mandatory = $false)]
  [string]$WorkerName = "codeathon-ai-router"
)

$secretKeys = @(
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

Write-Host "Configuring Cloudflare Worker secrets for: $WorkerName" -ForegroundColor Cyan
Write-Host "Wrangler will prompt for each value. Paste values locally when prompted." -ForegroundColor Yellow

foreach ($key in $secretKeys) {
  Write-Host ""
  Write-Host "Setting secret: $key" -ForegroundColor Green
  wrangler secret put $key --name $WorkerName
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to set secret: $key"
    exit $LASTEXITCODE
  }
}

Write-Host ""
Write-Host "All secrets configured. You can verify with:" -ForegroundColor Cyan
Write-Host "wrangler secret list --name $WorkerName" -ForegroundColor White
