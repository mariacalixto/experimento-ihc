$ErrorActionPreference = "Stop"

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  Write-Error "cloudflared não está instalado ou não está no PATH. Instale o MSI Windows x64 pela documentação oficial: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/"
  exit 1
}

$listeners = @(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
if ($listeners.Count -eq 0) {
  Write-Error "Nenhum Next.js está escutando em 127.0.0.1:3000. Inicie 'npm run dev' no Terminal 1 e tente novamente."
  exit 1
}
if ($listeners | Where-Object { $_.LocalAddress -notin @("127.0.0.1", "::1") }) {
  Write-Error "A porta 3000 está escutando fora do loopback. Encerre o servidor antigo com Ctrl+C e reinicie usando 'npm run dev'; o túnel não foi iniciado."
  exit 1
}

Write-Host "Iniciando Quick Tunnel para http://127.0.0.1:3000. Copie a URL https://*.trycloudflare.com mostrada abaixo."
& $cloudflared.Source tunnel --url http://127.0.0.1:3000
exit $LASTEXITCODE
