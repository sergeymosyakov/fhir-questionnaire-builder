$lines = [System.IO.File]::ReadAllLines("js\fhir\import.js", [System.Text.Encoding]::UTF8)
$start = -1; $end = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'function humanEnableWhen') { $start = $i - 1; break }
}
Write-Host "start index=$start (1-based line $($start+1))"
$depth = 0
for ($i = $start + 1; $i -lt $lines.Count; $i++) {
    foreach ($ch in $lines[$i].ToCharArray()) {
        if ($ch -eq '{') { $depth++ }
        if ($ch -eq '}') { $depth--; if ($depth -eq 0) { $end = $i; break } }
    }
    if ($end -ge 0) { break }
}
Write-Host "end index=$end (1-based line $($end+1))"
Write-Host "Function span: $($end - $start + 1) lines"
$lines[$start..$end] | ForEach-Object { Write-Host $_ }
