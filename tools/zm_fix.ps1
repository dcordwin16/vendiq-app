$ErrorActionPreference = "Stop"
Write-Host "=== ZooMart Fix Script ===" -ForegroundColor Cyan

# -- 1. Write Python script with UTF-8 NO BOM --
$pyPath = "C:\ProgramData\ZooMart\zoomart_report.py"
$enc = New-Object System.Text.UTF8Encoding $false   # $false = no BOM
$content = @'
import os, sys, time, datetime, re, glob, subprocess

BOT_TOKEN = "8699727397:AAF-V3n91EzRi3jkUTJMbXYcCBE6I_KaHDM"
CHAT_ID   = "8452546363"
CACHE_DIR = r"C:\Users\binod\OneDrive\Documents\Verifone\Site Management Tools\Report Navigator\cache\AB123"

def tg(msg):
    import urllib.request, urllib.parse
    url = "https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage"
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": msg}).encode()
    try:
        urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=15)
    except Exception as e:
        print("TG error: " + str(e))

def find_exe():
    candidates = [
        r"C:\Program Files\Verifone\Site Management Tools\Report Navigator\ReportNavigator.exe",
        r"C:\Program Files (x86)\Verifone\Site Management Tools\Report Navigator\ReportNavigator.exe",
        r"C:\Verifone\Site Management Tools\Report Navigator\ReportNavigator.exe",
        r"C:\Program Files\Verifone\ReportNavigator.exe",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    skip = {"Windows","$Recycle.Bin","System Volume Information"}
    for root, dirs, files in os.walk("C:\\"):
        for f in files:
            if f.lower() == "reportnavigator.exe":
                return os.path.join(root, f)
        dirs[:] = [d for d in dirs if d not in skip]
    return None

def parse_summary(path):
    txt = open(path, encoding="utf-8", errors="ignore").read()
    txt_clean = re.sub(r"<[^>]+>", " ", txt)
    nums = {}
    for label, key in [("Net Sales","net_sales"),("Credit","credit"),("Debit","debit"),("Cash","cash")]:
        m = re.search(label + r"[\s\S]{0,80}?\$([ \d,]+\.\d{2})", txt_clean)
        if m:
            nums[key] = m.group(1).strip()
    m = re.search(r"(\d+)\s+Transactions?", txt_clean, re.IGNORECASE)
    if m:
        nums["txns"] = m.group(1)
    return nums

def parse_depts(path):
    txt = re.sub(r"<[^>]+>", " ", open(path, encoding="utf-8", errors="ignore").read())
    lines = [l.strip() for l in txt.splitlines() if l.strip()]
    depts = []
    for i, line in enumerate(lines):
        m = re.search(r"\$([ \d,]+\.\d{2})", line)
        if m:
            amt = m.group(0)
            name = lines[i-1] if i > 0 else "Unknown"
            if 3 < len(name) < 40 and not any(x in name.lower() for x in ["total","grand","subtot"]):
                depts.append("  " + name + ": " + amt)
    return depts[:8]

def find_htmls():
    summary, dept = None, None
    for root, dirs, files in os.walk(CACHE_DIR):
        for f in files:
            if not f.endswith(".html"):
                continue
            fp = os.path.join(root, f)
            fl = f.lower()
            if "summary" in fl:
                summary = fp
            elif "dept" in fl or "department" in fl:
                dept = fp
    return summary, dept

if __name__ == "__main__":
    yest     = datetime.date.today() - datetime.timedelta(days=1)
    yest_str = yest.strftime("%m/%d/%Y")
    yest_iso = yest.strftime("%Y-%m-%d")

    exe = find_exe()
    if not exe:
        tg("Zoo Mart ERROR: ReportNavigator.exe not found on store PC")
        sys.exit(1)

    subprocess.run(["taskkill","/f","/im","ReportNavigator.exe"], capture_output=True)
    time.sleep(1)

    try:
        import pyautogui as pg
        import pygetwindow as gw
        pg.FAILSAFE = False
        pg.PAUSE    = 0.3

        subprocess.Popen([exe])
        time.sleep(10)

        # Step 1: Handle "Select Site" dialog IF it appears (sometimes shows, sometimes not)
        for title in gw.getAllTitles():
            if "select" in title.lower() and "site" in title.lower():
                w = gw.getWindowsWithTitle(title)[0]
                w.activate()
                time.sleep(0.5)
                pg.press("enter")  # AB123 already selected, just OK
                time.sleep(3)
                break

        # Step 2: Login dialog — primary flow, always appears
        # Wait up to 10s for it to appear
        login_done = False
        for attempt in range(10):
            for title in gw.getAllTitles():
                tl = title.lower()
                if any(x in tl for x in ["login","sign in","logon","commander","report navigator"]):
                    w = gw.getWindowsWithTitle(title)[0]
                    w.activate()
                    time.sleep(0.8)
                    # Click username field (first field) and type
                    pg.hotkey("ctrl","a")
                    pg.typewrite("MANAGER", interval=0.05)
                    pg.press("tab")
                    time.sleep(0.3)
                    pg.hotkey("ctrl","a")
                    pg.typewrite("ZOOMART9", interval=0.05)
                    pg.press("enter")
                    time.sleep(6)
                    login_done = True
                    break
            if login_done:
                break
            time.sleep(1)

        # Bring Report Navigator to front
        for title in gw.getAllTitles():
            if any(x in title.lower() for x in ["report navigator","verifone","navigator"]):
                w = gw.getWindowsWithTitle(title)[0]
                w.activate()
                time.sleep(1)
                break

        W, H = pg.size()

        # Click Period Type dropdown area
        pg.click(W//2 - 100, H//2 - 150)
        time.sleep(1)
        pg.hotkey("ctrl","home")
        time.sleep(0.5)
        for _ in range(3):
            pg.press("tab")
            time.sleep(0.2)
        pg.hotkey("alt","down")
        time.sleep(0.5)
        pg.typewrite("Period 2", interval=0.04)
        time.sleep(0.3)
        pg.press("enter")
        time.sleep(0.5)

        # Period date
        pg.press("tab")
        time.sleep(0.3)
        pg.hotkey("ctrl","a")
        pg.typewrite(yest_str, interval=0.04)
        time.sleep(0.3)
        pg.press("tab")
        time.sleep(0.3)

        # Click Summary in report list, Add
        pg.click(W//4, H//2)
        time.sleep(0.3)
        pg.hotkey("ctrl","home")
        time.sleep(0.2)
        pg.typewrite("s", interval=0.1)
        time.sleep(0.3)
        pg.hotkey("alt","a")
        time.sleep(0.4)

        # Click Department, Add
        pg.click(W//4, H//2 + 30)
        time.sleep(0.3)
        pg.typewrite("d", interval=0.1)
        time.sleep(0.3)
        pg.hotkey("alt","a")
        time.sleep(0.4)

        # Process
        pg.hotkey("alt","p")
        time.sleep(0.5)
        pg.click(W - 200, H - 100)
        time.sleep(35)

    except Exception as e:
        tg("Zoo Mart pyautogui error: " + str(e))

    summary_path, dept_path = find_htmls()

    if not summary_path:
        all_html = []
        for root, _, files in os.walk(CACHE_DIR):
            for f in files:
                if f.endswith(".html"):
                    all_html.append(os.path.join(root, f))
        tg("Zoo Mart: No summary HTML for " + yest_iso + "\nFiles: " + (str(all_html[-5:]) if all_html else "NONE"))
        sys.exit(1)

    s = parse_summary(summary_path)
    d = parse_depts(dept_path) if dept_path else []

    dept_block = ("\n\U0001f3f7 Departments:\n" + "\n".join(d)) if d else ""
    msg = (
        "\U0001f3ea ZOO MART - " + yest_iso + "\n" +
        "=" * 30 + "\n" +
        "\U0001f4b0 Net Sales: $" + s.get("net_sales","?") + "\n" +
        "\U0001f4ca " + s.get("txns","?") + " transactions\n" +
        "\U0001f4b3 Credit: $" + s.get("credit","?") + "\n" +
        "\U0001f4b3 Debit:  $" + s.get("debit","?") + "\n" +
        "\U0001f4b5 Cash:   $" + s.get("cash","?") + dept_block
    )
    tg(msg)
    print("Done.")

'@
[IO.File]::WriteAllText($pyPath, $content, $enc)
Write-Host "Script written (UTF-8 no BOM): $pyPath" -ForegroundColor Green

# -- 2. Verify no BOM --
$bytes = [IO.File]::ReadAllBytes($pyPath)
if ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Write-Host "WARNING: BOM still present!" -ForegroundColor Red
} else {
    Write-Host "Encoding OK - no BOM" -ForegroundColor Green
}

# -- 3. Write batch launcher --
$batPath = "C:\ProgramData\ZooMart\run.bat"
$batEnc  = New-Object System.Text.UTF8Encoding $false
[IO.File]::WriteAllText($batPath, "@echo off`r`n`"C:\Program Files\Python311\python.exe`" C:\ProgramData\ZooMart\zoomart_report.py >> C:\ProgramData\ZooMart\log.txt 2>&1`r`n", $batEnc)

# -- 4. Register scheduled task (compatible with PS 3/4/5) --
Write-Host "Registering scheduled task..." -ForegroundColor Cyan

# Remove old task if exists
Unregister-ScheduledTask -TaskName "ZooMartReportNavigator" -Confirm:$false -ErrorAction SilentlyContinue

$action    = New-ScheduledTaskAction -Execute $batPath
$trigger   = New-ScheduledTaskTrigger -Daily -At "04:29"
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName "ZooMartReportNavigator" `
    -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal -Force | Out-Null

Write-Host "Scheduled task registered: 4:29 AM daily as SYSTEM" -ForegroundColor Green

# -- 5. Quick syntax check --
Write-Host "Checking Python syntax..." -ForegroundColor Cyan
& "C:\Program Files\Python311\python.exe" -m py_compile $pyPath
if ($LASTEXITCODE -eq 0) {
    Write-Host "Python syntax OK" -ForegroundColor Green
} else {
    Write-Host "Syntax error in script!" -ForegroundColor Red
    exit 1
}

# -- 6. Run it NOW --
Write-Host "" 
Write-Host "=== RUNNING SCRIPT NOW ===" -ForegroundColor Yellow
Write-Host "(Will find ReportNavigator, list cache HTML files, send test to Telegram)"
& "C:\Program Files\Python311\python.exe" $pyPath
Write-Host ""
Write-Host "=== ALL DONE ===" -ForegroundColor Green
Write-Host "Task: ZooMartReportNavigator fires at 4:29 AM daily"
Write-Host "Log:  C:\ProgramData\ZooMart\log.txt"
