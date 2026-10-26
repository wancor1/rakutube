param([string]$BrowserPath,[string]$SigningKey)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskManifest=Get-Content -LiteralPath (Join-Path $taskRoot 'manifest.json') -Raw | ConvertFrom-Json
$taskName='rakutube-'+$taskManifest.version
$taskOutput=Join-Path $taskRoot 'packages'
$taskStage=Join-Path $taskOutput $taskName
$taskIcons=@($taskManifest.icons.PSObject.Properties | ForEach-Object { $_.Value })
if($taskManifest.action.default_icon -is [string]){
  $taskIcons+=@($taskManifest.action.default_icon)
}elseif($taskManifest.action.default_icon){
  $taskIcons+=@($taskManifest.action.default_icon.PSObject.Properties | ForEach-Object { $_.Value })
}
$taskFiles=@('manifest.json','LICENSE','settings.js','settings.css',$taskManifest.action.default_popup)+$taskIcons+@($taskManifest.content_scripts | ForEach-Object { $_.js; $_.css }) | Sort-Object -Unique
if($taskManifest.background.service_worker){$taskFiles=@($taskFiles)+@($taskManifest.background.service_worker) | Sort-Object -Unique}
New-Item -ItemType Directory -Path $taskStage -Force | Out-Null
foreach($taskFile in $taskFiles){
  $taskSource=Join-Path $taskRoot $taskFile
  if(-not (Test-Path -LiteralPath $taskSource -PathType Leaf)){throw "Missing extension file: $taskFile"}
  Copy-Item -LiteralPath $taskSource -Destination (Join-Path $taskStage $taskFile)
}
$taskUnexpected=Get-ChildItem -LiteralPath $taskStage -Force | Where-Object { $_.Name -notin $taskFiles -or $_.PSIsContainer }
if($taskUnexpected){throw 'Unexpected files in package directory'}
$taskZip=Join-Path $taskOutput ($taskName+'.zip')
$taskPaths=@($taskFiles | ForEach-Object { Join-Path $taskStage $_ })
Compress-Archive -LiteralPath $taskPaths -DestinationPath $taskZip -Force
Write-Output $taskZip
if($BrowserPath){
  $taskArguments=@('--headless','--no-message-box','--no-first-run','--disable-background-networking',"--user-data-dir=$(Join-Path $taskOutput 'pack-profile')","--pack-extension=$taskStage")
  if($SigningKey){
    if(-not (Test-Path -LiteralPath $SigningKey -PathType Leaf)){throw 'Signing key is missing'}
    $taskArguments+="--pack-extension-key=$((Resolve-Path -LiteralPath $SigningKey).Path)"
  }
  $taskProcess=Start-Process -FilePath $BrowserPath -ArgumentList ($taskArguments | ForEach-Object { '"'+$_+'"' }) -WindowStyle Hidden -Wait -PassThru
  $taskCrx=Join-Path $taskOutput ($taskName+'.crx')
  if($taskProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $taskCrx)){throw 'CRX packaging failed'}
  Write-Output $taskCrx
}
