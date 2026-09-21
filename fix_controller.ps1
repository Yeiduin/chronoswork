# =============================================================
# REPARACIÓN DE CONTROL EasySMX X20
# Problema: USB Devices Rate insertó el driver "hidusbf" como 
# filtro pero el archivo del driver no existe, bloqueando el control.
# =============================================================
# EJECUTAR COMO ADMINISTRADOR:
# 1. Clic derecho en PowerShell → "Ejecutar como administrador"
# 2. Ejecutar: powershell -ExecutionPolicy Bypass -File "C:\Users\yeidu\Documents\chronoswork\fix_controller.ps1"
# =============================================================

Write-Host "=== Reparacion de Control USB ===" -ForegroundColor Cyan
Write-Host ""

$errores = 0

# --- Dispositivo 1: EasySMX X20 (emulado como Xbox 360) ---
$dev1 = "HKLM:\SYSTEM\CurrentControlSet\Enum\USB\VID_045E&PID_028E\6&1592fd78&0&7"
try {
    $props1 = Get-ItemProperty $dev1 -ErrorAction Stop
    if ($props1.LowerFilters -contains 'hidusbf') {
        Remove-ItemProperty -Path $dev1 -Name "LowerFilters" -ErrorAction Stop
        Write-Host "[OK] Eliminado filtro 'hidusbf' del control EasySMX X20" -ForegroundColor Green
    } else {
        Write-Host "[INFO] El control EasySMX X20 ya no tiene el filtro 'hidusbf'" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERROR] No se pudo reparar EasySMX X20: $_" -ForegroundColor Red
    $errores++
}

# --- Dispositivo 2: Nintendo Switch Pro Controller ---
$dev2 = "HKLM:\SYSTEM\CurrentControlSet\Enum\USB\VID_057E&PID_2009\000000000001"
try {
    $props2 = Get-ItemProperty $dev2 -ErrorAction Stop
    if ($props2.LowerFilters -contains 'hidusbf') {
        Remove-ItemProperty -Path $dev2 -Name "LowerFilters" -ErrorAction Stop
        Write-Host "[OK] Eliminado filtro 'hidusbf' del Switch Pro Controller" -ForegroundColor Green
    } else {
        Write-Host "[INFO] El Switch Pro Controller ya no tiene el filtro 'hidusbf'" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[ERROR] No se pudo reparar Switch Pro Controller: $_" -ForegroundColor Red
    $errores++
}

# --- Limpieza: eliminar servicio huerfano de hidusbf si existe ---
$svcKey = "HKLM:\SYSTEM\CurrentControlSet\Services\hidusbf"
if (Test-Path $svcKey) {
    try {
        Remove-Item -Path $svcKey -Recurse -Force -ErrorAction Stop
        Write-Host "[OK] Eliminado servicio huerfano 'hidusbf'" -ForegroundColor Green
    } catch {
        Write-Host "[AVISO] No se pudo eliminar servicio 'hidusbf': $_" -ForegroundColor Yellow
    }
}

Write-Host ""
if ($errores -eq 0) {
    Write-Host "=== REPARACION COMPLETADA ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Instrucciones:" -ForegroundColor Cyan
    Write-Host "1. Desconecta el control USB"
    Write-Host "2. Espera 5 segundos"  
    Write-Host "3. Vuelve a conectar el control"
    Write-Host "4. Deberia encender normalmente"
    Write-Host ""
    Write-Host "Si no funciona, reinicia la PC y reconecta." -ForegroundColor Yellow
} else {
    Write-Host "=== HUBO ERRORES ===" -ForegroundColor Red
    Write-Host "Asegurate de ejecutar este script como Administrador." -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Presiona Enter para cerrar"
