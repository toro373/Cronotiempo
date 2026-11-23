param(
  [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 8000 })
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$baseUrl = "http://127.0.0.1:$Port/"
$contentTypes = @{
  ".css" = "text/css; charset=utf-8"
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".xml" = "application/xml; charset=utf-8"
}
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($baseUrl)

try {
  $listener.Start()
  Write-Host "Cronotempo disponible en $baseUrl"
  Write-Host "Servidor local unicamente; pulsa Ctrl+C para detenerlo."
  Start-Process $baseUrl

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $response = $context.Response

    if ($context.Request.HttpMethod -ne "GET" -and $context.Request.HttpMethod -ne "HEAD") {
      $response.StatusCode = 405
      $response.Headers.Add("Allow", "GET, HEAD")
      $response.Close()
      continue
    }

    $relativePath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = "index.html"
    }
    $relativePath = $relativePath.Replace("/", [System.IO.Path]::DirectorySeparatorChar)
    $filePath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relativePath))
    if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      $response.StatusCode = 403
      $response.Close()
      continue
    }
    if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
      $response.StatusCode = 404
      $response.Close()
      continue
    }

    $extension = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
    if ($contentTypes.ContainsKey($extension)) {
      $response.ContentType = $contentTypes[$extension]
    } else {
      $response.ContentType = "application/octet-stream"
    }
    $response.Headers.Add("X-Content-Type-Options", "nosniff")

    if ($context.Request.HttpMethod -eq "HEAD") {
      $response.StatusCode = 200
      $response.Close()
      continue
    }

    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $response.StatusCode = 200
    $response.ContentLength64 = $bytes.Length
    $response.OutputStream.Write($bytes, 0, $bytes.Length)
    $response.Close()
  }
} catch [System.Net.HttpListenerException] {
  Write-Error "No se pudo iniciar o mantener el servidor en el puerto $Port. Comprueba si el puerto esta ocupado. $($_.Exception.Message)"
  exit 1
} finally {
  if ($listener.IsListening) {
    $listener.Stop()
  }
  $listener.Close()
}
