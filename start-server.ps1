# NovaStream Fast Local Web Server
# Supports Next.js 15 App Server & Legacy Static .NET HttpListener fallback

param(
    [switch]$Static,
    [int]$Port = 3000
)

$Host.UI.RawUI.WindowTitle = "NovaStream 120Hz Next.js & WebRTC Server"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   NovaStream - 120Hz / 120 FPS Next.js + React Studio    " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $CurrentDir) { $CurrentDir = Get-Location }

# 1. Prefer Next.js Dev Server if npm is installed and -Static is not specified
if (-not $Static -and (Get-Command "npm.cmd" -ErrorAction SilentlyContinue)) {
    Write-Host "[+] Launching Next.js 15 dev server at http://localhost:$Port ..." -ForegroundColor Green
    Start-Process "http://localhost:$Port"
    Set-Location $CurrentDir
    & npm.cmd run dev
    exit $LASTEXITCODE
}

# 2. Legacy Fallback: Parse .env file and generate local runtime env-config.js
$EnvFile = Join-Path $CurrentDir ".env"
$EnvConfigJs = Join-Path $CurrentDir "env-config.js"

if (Test-Path $EnvFile) {
    try {
        $EnvData = @{}
        Get-Content $EnvFile | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
                $idx = $line.IndexOf("=")
                $key = $line.Substring(0, $idx).Trim()
                $val = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
                $EnvData[$key] = $val
            }
        }

        if ($EnvData.ContainsKey("FIREBASE_API_KEY") -and $EnvData["FIREBASE_API_KEY"]) {
            $meteredAppName = if ($EnvData.ContainsKey("METERED_APP_NAME")) { $EnvData["METERED_APP_NAME"] } else { "" }
            $meteredApiKey  = if ($EnvData.ContainsKey("METERED_API_KEY")) { $EnvData["METERED_API_KEY"] } else { "" }
            $turnServerUrl  = if ($EnvData.ContainsKey("TURN_SERVER_URL")) { $EnvData["TURN_SERVER_URL"] } else { "" }
            $turnUsername   = if ($EnvData.ContainsKey("TURN_USERNAME")) { $EnvData["TURN_USERNAME"] } else { "" }
            $turnCredential = if ($EnvData.ContainsKey("TURN_CREDENTIAL")) { $EnvData["TURN_CREDENTIAL"] } else { "" }

            $jsContent = @"
// Automatically generated from local .env - DO NOT COMMIT TO GIT
window.__FIREBASE_ENV__ = {
  apiKey: "$($EnvData['FIREBASE_API_KEY'])",
  authDomain: "$($EnvData['FIREBASE_AUTH_DOMAIN'])",
  projectId: "$($EnvData['FIREBASE_PROJECT_ID'])",
  storageBucket: "$($EnvData['FIREBASE_STORAGE_BUCKET'])",
  messagingSenderId: "$($EnvData['FIREBASE_MESSAGING_SENDER_ID'])",
  appId: "$($EnvData['FIREBASE_APP_ID'])",
  meteredAppName: "$meteredAppName",
  meteredApiKey: "$meteredApiKey",
  turnServerUrl: "$turnServerUrl",
  turnUsername: "$turnUsername",
  turnCredential: "$turnCredential"
};
"@
            Set-Content -Path $EnvConfigJs -Value $jsContent -Encoding UTF8
            Write-Host "[+] Loaded Firebase & Network credentials from .env into runtime" -ForegroundColor Green
        }
    } catch {
        Write-Host "[!] Notice: Could not parse .env file: $_" -ForegroundColor Yellow
    }
}

$Url = "http://localhost:$Port/"
$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add($Url)

try {
    $Listener.Start()
} catch {
    Write-Host "Port $Port is busy, trying port 3001..." -ForegroundColor Yellow
    $Port = 3001
    $Url = "http://localhost:$Port/"
    $Listener = New-Object System.Net.HttpListener
    $Listener.Prefixes.Add($Url)
    $Listener.Start()
}

Write-Host "[+] Static server running at: " -NoNewline -ForegroundColor Green
Write-Host "$Url" -ForegroundColor White
Write-Host "[+] Document root: $CurrentDir" -ForegroundColor Gray
Write-Host "[+] Press Ctrl+C in this window to stop the server.`n" -ForegroundColor Yellow

# Launch browser
Start-Process $Url

$MimeTypes = @{
    ".html" = "text/html; charset=utf-8";
    ".css"  = "text/css; charset=utf-8";
    ".js"   = "application/javascript; charset=utf-8";
    ".json" = "application/json; charset=utf-8";
    ".svg"  = "image/svg+xml";
    ".png"  = "image/png";
    ".jpg"  = "image/jpeg";
    ".ico"  = "image/x-icon";
    ".woff2"= "font/woff2"
}

try {
    while ($Listener.IsListening) {
        $Context = $Listener.GetContext()
        $Request = $Context.Request
        $Response = $Context.Response

        $LocalPath = $Request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($LocalPath)) {
            $LocalPath = "index.html"
        }

        # Prevent directory traversal
        $CleanLocalPath = $LocalPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $FilePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($CurrentDir, $CleanLocalPath))

        if ($FilePath.StartsWith($CurrentDir, [System.StringComparison]::OrdinalIgnoreCase) -and [System.IO.File]::Exists($FilePath)) {
            $Ext = [System.IO.Path]::GetExtension($FilePath).ToLower()
            $ContentType = if ($MimeTypes.ContainsKey($Ext)) { $MimeTypes[$Ext] } else { "application/octet-stream" }

            $Response.ContentType = $ContentType
            $Response.StatusCode = 200
            $Response.Headers.Add("Access-Control-Allow-Origin", "*")

            $Buffer = [System.IO.File]::ReadAllBytes($FilePath)
            $Response.ContentLength64 = $Buffer.Length
            $Response.OutputStream.Write($Buffer, 0, $Buffer.Length)
            $Response.OutputStream.Close()
        } else {
            $Response.StatusCode = 404
            $NotFoundMsg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $Response.OutputStream.Write($NotFoundMsg, 0, $NotFoundMsg.Length)
            $Response.OutputStream.Close()
        }
    }
} finally {
    $Listener.Stop()
    $Listener.Close()
    Write-Host "`n[!] Server stopped." -ForegroundColor Red
}
