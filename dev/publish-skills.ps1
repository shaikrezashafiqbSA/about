# Builds the public skill tree file from the private master.
#
# content/private/my-skills-tree.md is the single source of truth: edit only that.
# It is gitignored, so it never reaches GitHub. This script copies it to
# content/my-skills-tree.md with private material stripped out, and that copy is
# what GitHub Pages serves. Never hand-edit the public copy; re-run this instead.
#
#   powershell -ExecutionPolicy Bypass -File dev/publish-skills.ps1
#
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [string]$Source = "content/private/my-skills-tree.md",
    [string]$Out = "content/my-skills-tree.md"
)

# Whole sections (heading and everything under it) that stay private.
$dropSections = @("Usage rules", "Tailored Resume Structure", "Positioning assets")
# Identity block rows that stay private.
$dropRows = @("Phone", "Email", "CSP")
# EU and note fields that stay private, matched on the label before any "(qualifier)".
$dropFields = @("Interview notes", "Tailoring note", "Claim boundary", "Timeline caution",
                "PMP interview line", "Why the PMP rule exists")

$src = [System.IO.Path]::Combine($Root, $Source)
$dst = [System.IO.Path]::Combine($Root, $Out)
if (-not (Test-Path $src)) { Write-Error "Private master not found: $src"; exit 1 }

$utf8 = New-Object System.Text.UTF8Encoding($false)
$lines = [System.IO.File]::ReadAllText($src, $utf8) -split "`n"

$kept = New-Object System.Collections.Generic.List[string]
$kept.Add("<!-- Generated from $Source by dev/publish-skills.ps1. Edit the private master, not this file. -->")
$kept.Add("")
$skipLevel = 0
$h3 = ""
$dropped = 0

foreach ($line in $lines) {
    $bare = $line.TrimEnd("`r")
    if ($bare -match '^(#{1,6}) \**(.+?)\**\s*$') {
        $level = $Matches[1].Length
        $text = $Matches[2].Trim()
        if ($skipLevel -and $level -le $skipLevel) { $skipLevel = 0 }
        if ($level -eq 3) { $h3 = $text } elseif ($level -lt 3) { $h3 = "" }
        if (-not $skipLevel -and $dropSections -contains $text) { $skipLevel = $level }
    }
    if ($skipLevel) { $dropped++; continue }
    if ($h3 -eq "Identity block" -and $bare -match '^\|\s*([^|]+?)\s*\|' -and $dropRows -contains $Matches[1]) { $dropped++; continue }
    if ($bare -match '^\* \*\*([^:*(]+?)(?: \([^)]*\))?:\*\*' -and $dropFields -contains $Matches[1].Trim()) { $dropped++; continue }
    $kept.Add($line)
}

$text = $kept -join "`n"

# Last line of defence: refuse to publish anything that looks like contact details.
if ($text -match '[\w.+-]+@[\w-]+\.[\w.]+' -or $text -match '\+65\s*\d') {
    Write-Error "Public copy still contains an email address or phone number. Not written."
    exit 1
}

[System.IO.File]::WriteAllText($dst, $text, $utf8)
Write-Host "Wrote $Out ($dropped private lines removed)."
