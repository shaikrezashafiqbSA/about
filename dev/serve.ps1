# Minimal static file server for local preview.
# This project has no Node/Python toolchain, and render.html fetches the resume
# markdown at runtime -- which browsers block over file://. Run this from the
# project root, then open http://localhost:8000/ instead of double-clicking
# index.html.
#
#   powershell -ExecutionPolicy Bypass -File dev/serve.ps1
#
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [int]$Port = 8000
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root on http://localhost:$Port/"

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".md"   = "text/markdown; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".ico"  = "image/x-icon"
}

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
        if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
        $full = Join-Path $Root $rel

        # Keep the server confined to $Root.
        $rootFull = [System.IO.Path]::GetFullPath($Root)
        $reqFull = [System.IO.Path]::GetFullPath($full)
        if (-not $reqFull.StartsWith($rootFull)) {
            $ctx.Response.StatusCode = 403
            $ctx.Response.Close()
            continue
        }

        if (Test-Path $reqFull -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($reqFull)
            $ext = [System.IO.Path]::GetExtension($reqFull).ToLower()
            $ctx.Response.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" })
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "200 $rel"
        } else {
            $ctx.Response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
            $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
            Write-Host "404 $rel"
        }
        $ctx.Response.Close()
    } catch {
        Write-Host "ERR $_"
    }
}
