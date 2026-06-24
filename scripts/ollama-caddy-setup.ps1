<#
.SYNOPSIS
  Sets up an HTTPS reverse proxy (Caddy + Cloudflare DNS) in front of a local Ollama on Windows,
  so an HTTPS dashboard (e.g. https://dash.example.com) can reach Ollama without mixed-content errors.

.DESCRIPTION
  - Downloads Caddy for Windows WITH the caddy-dns/cloudflare plugin (required for the DNS-01 cert challenge).
  - Verifies the plugin is present.
  - Writes C:\caddy\Caddyfile (only if one doesn't already exist; pass -CloudflareToken to generate it).
  - Sets OLLAMA_ORIGINS=* (machine-wide) so Ollama accepts the dashboard's browser requests.
  - Opens inbound TCP 443 (and 80) in Windows Firewall.
  - Registers Caddy as a scheduled task that runs as SYSTEM at startup (survives reboots).
  - Issues the cert and tests https://<Domain>/api/tags.

.NOTES
  Run from an ELEVATED PowerShell (Administrator):
    powershell -ExecutionPolicy Bypass -File .\ollama-caddy-setup.ps1 -CloudflareToken "YOUR_CF_TOKEN"

  If you already created C:\caddy\Caddyfile (with your token inside), you can omit -CloudflareToken.
#>

#Requires -RunAsAdministrator
param(
  [string]$CloudflareToken = "",
  [string]$Domain          = "ollama.example.com",
  [string]$CaddyDir        = "C:\caddy",
  [int]   $OllamaPort      = 11434,
  [ValidateSet("amd64","arm64")][string]$Arch = "amd64"
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Info($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    $m" -ForegroundColor Yellow }

$caddyExe   = Join-Path $CaddyDir "caddy.exe"
$caddyfile  = Join-Path $CaddyDir "Caddyfile"

# 1. Folder ----------------------------------------------------------------
Info "Creating $CaddyDir"
New-Item -ItemType Directory -Force -Path $CaddyDir | Out-Null

# 2. Download Caddy WITH the Cloudflare DNS plugin -------------------------
Info "Downloading Caddy ($Arch) with the cloudflare DNS plugin"
$dl = "https://caddyserver.com/api/download?os=windows&arch=$Arch&p=github.com%2Fcaddy-dns%2Fcloudflare"
Invoke-WebRequest -Uri $dl -OutFile $caddyExe
Ok "Saved $caddyExe"

# 3. Verify the plugin is baked in ----------------------------------------
Info "Verifying the cloudflare plugin is present"
# Join to a single string — `-notmatch` on a multi-line array misbehaves (returns non-matching lines).
$modules = (& $caddyExe list-modules 2>$null) -join "`n"
if ($modules -notmatch "dns\.providers\.cloudflare") {
  throw "The downloaded Caddy does NOT include dns.providers.cloudflare. Aborting."
}
Ok "dns.providers.cloudflare found"

# 4. Caddyfile -------------------------------------------------------------
if (Test-Path $caddyfile) {
  Ok "Using existing Caddyfile at $caddyfile (left unchanged)"
} elseif ($CloudflareToken -ne "") {
  Info "Writing $caddyfile"
  @"
$Domain {
    tls {
        dns cloudflare $CloudflareToken
    }
    reverse_proxy 127.0.0.1:$OllamaPort
}
"@ | Set-Content -Path $caddyfile -Encoding ASCII
  Ok "Caddyfile created"
} else {
  throw "No Caddyfile at $caddyfile and no -CloudflareToken given. Provide one or place your Caddyfile there."
}

# 5. Ollama CORS -----------------------------------------------------------
Info "Setting OLLAMA_ORIGINS=* (machine-wide)"
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "Machine")
Warn "Restart Ollama (quit from the tray and relaunch) so it picks up OLLAMA_ORIGINS."

# 6. Firewall --------------------------------------------------------------
Info "Opening inbound TCP 443 and 80 in Windows Firewall"
foreach ($p in 443,80) {
  $name = "Caddy TCP $p"
  Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
  New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $p -Action Allow | Out-Null
}
Ok "Firewall rules added"

# 7. Auto-start service (scheduled task running as SYSTEM at boot) ---------
Info "Registering Caddy to run at startup (SYSTEM)"
$action  = New-ScheduledTaskAction -Execute $caddyExe -Argument "run --config `"$caddyfile`"" -WorkingDirectory $CaddyDir
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
             -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "Caddy" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName "Caddy"
Ok "Caddy scheduled task installed and started"

# 8. Test ------------------------------------------------------------------
Info "Waiting for Caddy to obtain the certificate and serve (up to ~90s)"
$testUrl = "https://$Domain/api/tags"
$success = $false
for ($i = 1; $i -le 18; $i++) {
  Start-Sleep -Seconds 5
  try {
    $r = Invoke-WebRequest -Uri $testUrl -UseBasicParsing -TimeoutSec 10
    if ($r.StatusCode -eq 200) { $success = $true; break }
  } catch { }
  Write-Host "    ...still waiting ($($i*5)s)" -ForegroundColor DarkGray
}

Write-Host ""
if ($success) {
  Ok "SUCCESS: $testUrl responded 200 over HTTPS with a valid cert."
  Write-Host ""
  Write-Host "Next: set the dashboard's Ollama URL to  https://$Domain" -ForegroundColor Cyan
} else {
  Warn "Could not confirm $testUrl yet. Check the Caddy task and logs:"
  Warn "  Get-ScheduledTask -TaskName Caddy ; & '$caddyExe' run --config '$caddyfile'   (run in foreground to see errors)"
  Warn "Common causes: Cloudflare token scope (needs Zone:DNS:Edit on example.com), DNS record not added, or Ollama not running."
}
