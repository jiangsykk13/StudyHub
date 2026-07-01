param(
    [switch]$SkipInstall,
    [switch]$ForceInstall,
    [switch]$SkipMigrate,
    [switch]$SkipSeed,
    [switch]$NoDev
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RepoRoot

$script:DockerExecutable = $null
$script:PnpmExecutable = $null
$script:PnpmArgumentsPrefix = @()
$script:PnpmDisplay = "pnpm"

function Write-Step {
    param([string]$Message)

    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-RequiredCommand {
    param(
        [string]$Name,
        [string]$InstallHint
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        throw "$Name was not found. $InstallHint"
    }

    return $command.Source
}

function Invoke-NativeCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE`: $FilePath $($Arguments -join ' ')"
    }
}

function Get-ProjectPnpmVersion {
    $packageJsonPath = Join-Path $RepoRoot "package.json"
    $packageJson = Get-Content -Raw -Path $packageJsonPath | ConvertFrom-Json
    $packageManager = $packageJson.PSObject.Properties["packageManager"]

    if ($null -ne $packageManager -and $packageManager.Value -match "^pnpm@(.+)$") {
        return $Matches[1]
    }

    return "11.7.0"
}

function Invoke-Pnpm {
    param(
        [string[]]$Arguments
    )

    $baseArguments = $script:PnpmArgumentsPrefix
    Write-Host "Running: $script:PnpmDisplay $($Arguments -join ' ')" -ForegroundColor DarkGray
    & $script:PnpmExecutable @baseArguments @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed with exit code $LASTEXITCODE`: $script:PnpmDisplay $($Arguments -join ' ')"
    }
}

function Initialize-Pnpm {
    $projectPnpmVersion = Get-ProjectPnpmVersion
    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue

    if ($null -ne $pnpmCommand) {
        $script:PnpmExecutable = $pnpmCommand.Source
        $script:PnpmArgumentsPrefix = @()
        $script:PnpmDisplay = "pnpm"
    } else {
        $corepackCommand = Get-Command corepack -ErrorAction SilentlyContinue
        if ($null -eq $corepackCommand) {
            throw "pnpm was not found and Corepack is unavailable. Install Node.js 24+ or run npm install -g pnpm@$projectPnpmVersion."
        }

        $script:PnpmExecutable = $corepackCommand.Source
        $script:PnpmArgumentsPrefix = @("pnpm")
        $script:PnpmDisplay = "corepack pnpm"
        Write-Host "pnpm is not on PATH; using Corepack with pnpm@$projectPnpmVersion." -ForegroundColor Yellow
    }

    $baseArguments = $script:PnpmArgumentsPrefix
    & $script:PnpmExecutable @baseArguments "--version" | Out-Host
    if ($LASTEXITCODE -ne 0) {
        if ($script:PnpmDisplay -eq "corepack pnpm") {
            Write-Host "Preparing pnpm@$projectPnpmVersion through Corepack..." -ForegroundColor Yellow
            Invoke-NativeCommand -FilePath $script:PnpmExecutable -Arguments @("prepare", "pnpm@$projectPnpmVersion", "--activate")
            & $script:PnpmExecutable @baseArguments "--version" | Out-Host
        }

        if ($LASTEXITCODE -ne 0) {
            throw "Unable to start pnpm. Try running: corepack prepare pnpm@$projectPnpmVersion --activate"
        }
    }
}

function Assert-Node {
    $nodePath = Get-RequiredCommand -Name "node" -InstallHint "Install Node.js 24+ before starting StudyHub."
    $versionOutput = & $nodePath "-v"
    if ($LASTEXITCODE -ne 0 -or $versionOutput -notmatch "^v(\d+)\.") {
        throw "Unable to read Node.js version from '$nodePath'."
    }

    $majorVersion = [int]$Matches[1]
    if ($majorVersion -lt 24) {
        throw "Node.js 24+ is required. Current version: $versionOutput"
    }

    Write-Host "Node.js $versionOutput" -ForegroundColor DarkGray
}

function Assert-Docker {
    $script:DockerExecutable = Get-RequiredCommand -Name "docker" -InstallHint "Install and start Docker Desktop before starting StudyHub."

    & $script:DockerExecutable "info" "--format" "{{.ServerVersion}}" *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker is installed but the Docker Engine is not running. Start Docker Desktop and rerun this script."
    }

    & $script:DockerExecutable "compose" "version" *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose is unavailable. Install a Docker Desktop version that includes 'docker compose'."
    }
}

function Ensure-LocalEnv {
    $envPath = Join-Path $RepoRoot ".env"
    $examplePath = Join-Path $RepoRoot ".env.example"

    if (Test-Path -LiteralPath $envPath) {
        Write-Host ".env already exists; leaving it unchanged." -ForegroundColor DarkGray
        return
    }

    if (-not (Test-Path -LiteralPath $examplePath)) {
        throw ".env.example is missing; cannot create a local .env file."
    }

    Copy-Item -LiteralPath $examplePath -Destination $envPath
    Write-Host "Created .env from .env.example. Replace the development secrets before any shared deployment." -ForegroundColor Yellow
}

function Wait-ForPostgres {
    Write-Step "Waiting for PostgreSQL"

    for ($attempt = 1; $attempt -le 30; $attempt++) {
        & $script:DockerExecutable "compose" "exec" "-T" "postgres" "sh" "-c" 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "PostgreSQL is ready." -ForegroundColor DarkGray
            return
        }

        Start-Sleep -Seconds 2
    }

    throw "PostgreSQL did not become ready within 60 seconds."
}

function Wait-ForMinioInit {
    Write-Step "Waiting for MinIO bucket initialization"

    $containerId = (& $script:DockerExecutable "compose" "ps" "-a" "-q" "minio-init").Trim()
    if ([string]::IsNullOrWhiteSpace($containerId)) {
        Write-Host "No minio-init container was found; continuing after Docker Compose startup." -ForegroundColor Yellow
        return
    }

    for ($attempt = 1; $attempt -le 30; $attempt++) {
        $status = (& $script:DockerExecutable "inspect" "--format" "{{.State.Status}}" $containerId).Trim()
        if ($LASTEXITCODE -ne 0) {
            Start-Sleep -Seconds 2
            continue
        }

        if ($status -eq "exited") {
            $exitCode = (& $script:DockerExecutable "inspect" "--format" "{{.State.ExitCode}}" $containerId).Trim()
            if ($exitCode -eq "0") {
                Write-Host "MinIO bucket initialization completed." -ForegroundColor DarkGray
                return
            }

            & $script:DockerExecutable "compose" "logs" "--no-color" "minio-init"
            throw "MinIO bucket initialization failed with exit code $exitCode."
        }

        Start-Sleep -Seconds 2
    }

    throw "MinIO bucket initialization did not finish within 60 seconds."
}

try {
    Write-Step "Checking local prerequisites"
    Assert-Node
    Initialize-Pnpm
    Assert-Docker

    Write-Step "Preparing environment"
    Ensure-LocalEnv

    if (-not $SkipInstall) {
        if ($ForceInstall -or -not (Test-Path -LiteralPath (Join-Path $RepoRoot "node_modules"))) {
            Write-Step "Installing dependencies"
            Invoke-Pnpm -Arguments @("install")
        } else {
            Write-Step "Skipping dependency install"
            Write-Host "node_modules already exists. Rerun with -ForceInstall to reinstall." -ForegroundColor DarkGray
        }
    }

    Write-Step "Starting PostgreSQL and MinIO"
    Invoke-Pnpm -Arguments @("infra:up")
    Wait-ForPostgres
    Wait-ForMinioInit

    if (-not $SkipMigrate) {
        Write-Step "Applying database migrations"
        Invoke-Pnpm -Arguments @("db:migrate")
    }

    if (-not $SkipSeed) {
        Write-Step "Seeding development data"
        Invoke-Pnpm -Arguments @("db:seed")
    }

    if ($NoDev) {
        Write-Step "Local setup completed"
        Write-Host "Skipped pnpm dev because -NoDev was provided."
        exit 0
    }

    Write-Step "Starting StudyHub development servers"
    Write-Host "Web: http://localhost:3000"
    Write-Host "API: http://localhost:4000/api"
    Write-Host "OpenAPI: http://localhost:4000/api/docs"
    Write-Host "Press Ctrl+C to stop the dev servers."
    Invoke-Pnpm -Arguments @("dev")
} catch {
    Write-Host ""
    Write-Error $_.Exception.Message
    exit 1
}
