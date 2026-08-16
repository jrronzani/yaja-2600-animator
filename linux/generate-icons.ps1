param(
  [Parameter(Mandatory = $true)]
  [string]$SourceLogo,
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

Add-Type -AssemblyName System.Drawing

function New-PngBytes([System.Drawing.Image]$Source, [int]$Size) {
  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.DrawImage($Source, 0, 0, $Size, $Size)
      $stream = New-Object System.IO.MemoryStream
      try {
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        # Keep the PNG byte array intact when PowerShell writes function output.
        return ,$stream.ToArray()
      } finally { $stream.Dispose() }
    } finally { $graphics.Dispose() }
  } finally { $bitmap.Dispose() }
}

function Write-UInt32BE([System.IO.BinaryWriter]$Writer, [uint32]$Value) {
  $bytes = [System.BitConverter]::GetBytes($Value)
  if ([System.BitConverter]::IsLittleEndian) { [System.Array]::Reverse($bytes) }
  $Writer.Write($bytes)
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$source = [System.Drawing.Image]::FromFile($SourceLogo)
try {
  $sizes = @(16, 32, 48, 64, 128, 256, 512)
  $pngs = @{}
  foreach ($size in $sizes) { $pngs[$size] = New-PngBytes $source $size }

  [System.IO.File]::WriteAllBytes((Join-Path $OutputDirectory 'icon.png'), $pngs[512])

  $icoSizes = @(16, 32, 48, 64, 128, 256)
  $icoPath = Join-Path $OutputDirectory 'icon.ico'
  $icoStream = [System.IO.File]::Create($icoPath)
  try {
    $writer = New-Object System.IO.BinaryWriter $icoStream
    try {
      $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$icoSizes.Count)
      $offset = 6 + (16 * $icoSizes.Count)
      foreach ($size in $icoSizes) {
        $dimension = if ($size -eq 256) { 0 } else { $size }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
        $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$pngs[$size].Length); $writer.Write([uint32]$offset)
        $offset += $pngs[$size].Length
      }
      foreach ($size in $icoSizes) { $writer.Write($pngs[$size]) }
    } finally { $writer.Dispose() }
  } finally { $icoStream.Dispose() }

  $icnsChunks = @(
    @{ Type = 'icp4'; Size = 16 }, @{ Type = 'icp5'; Size = 32 }, @{ Type = 'icp6'; Size = 64 },
    @{ Type = 'ic07'; Size = 128 }, @{ Type = 'ic08'; Size = 256 }, @{ Type = 'ic09'; Size = 512 }
  )
  $icnsPath = Join-Path $OutputDirectory 'icon.icns'
  $icnsPayloadLength = [int64]0
  foreach ($chunk in $icnsChunks) { $icnsPayloadLength += 8 + $pngs[$chunk.Size].Length }
  $icnsLength = 8 + $icnsPayloadLength
  $icnsStream = [System.IO.File]::Create($icnsPath)
  try {
    $writer = New-Object System.IO.BinaryWriter $icnsStream
    try {
      $writer.Write([System.Text.Encoding]::ASCII.GetBytes('icns'))
      Write-UInt32BE $writer ([uint32]$icnsLength)
      foreach ($chunk in $icnsChunks) {
        $data = $pngs[$chunk.Size]
        $writer.Write([System.Text.Encoding]::ASCII.GetBytes($chunk.Type))
        Write-UInt32BE $writer ([uint32](8 + $data.Length))
        $writer.Write($data)
      }
    } finally { $writer.Dispose() }
  } finally { $icnsStream.Dispose() }
} finally { $source.Dispose() }
