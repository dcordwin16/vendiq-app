$ErrorActionPreference = "Stop"
Write-Host "=== ZooMart Fix Script ===" -ForegroundColor Cyan

# -- 1. Write Python script UTF-8 no BOM --
$pyPath = "C:\ProgramData\ZooMart\zoomart_report.py"
$enc = New-Object System.Text.UTF8Encoding $false
$content = @'
import os, sys, time, datetime, re, subprocess, urllib.request, urllib.parse

BOT_TOKEN = "8699727397:AAF-V3n91EzRi3jkUTJMbXYcCBE6I_KaHDM"
CHAT_ID   = "8452546363"
EXE       = r"C:\Users\binod\AppData\Local\Programs\Verifone\Site Management Tools\Report Navigator\ReportNavigator.exe"
CACHE_DIR = r"C:\Users\binod\OneDrive\Documents\Verifone\Site Management Tools\Report Navigator\cache\AB123"

def tg(msg):
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": msg}).encode()
    try:
        urllib.request.urlopen(
            urllib.request.Request("https://api.telegram.org/bot" + BOT_TOKEN + "/sendMessage", data=data),
            timeout=15)
    except Exception as e:
        print("TG error: " + str(e))

def parse_summary(path):
    txt = re.sub(r"<[^>]+>", " ", open(path, encoding="utf-8", errors="ignore").read())
    nums = {}
    for label, key in [("Net Sales","net_sales"),("Credit","credit"),("Debit","debit"),("Cash","cash")]:
        m = re.search(label + r"[\s\S]{0,80}?\$([ \d,]+\.\d{2})", txt)
        if m: nums[key] = m.group(1).strip()
    m = re.search(r"(\d+)\s+Transactions?", txt, re.IGNORECASE)
    if m: nums["txns"] = m.group(1)
    return nums

def parse_depts(path):
    txt = re.sub(r"<[^>]+>", " ", open(path, encoding="utf-8", errors="ignore").read())
    lines = [l.strip() for l in txt.splitlines() if l.strip()]
    depts = []
    for i, line in enumerate(lines):
        m = re.search(r"\$([ \d,]+\.\d{2})", line)
        if m:
            name = lines[i-1] if i > 0 else ""
            if 3 < len(name) < 40 and not any(x in name.lower() for x in ["total","grand","subtot","tax"]):
                depts.append("  " + name + ": " + m.group(0))
    return depts[:8]

def find_htmls():
    summary, dept = None, None
    for root, dirs, files in os.walk(CACHE_DIR):
        for f in files:
            if not f.endswith(".html"): continue
            fp = os.path.join(root, f)
            if "summary" in f.lower(): summary = fp
            elif "dept" in f.lower() or "department" in f.lower(): dept = fp
    return summary, dept

if __name__ == "__main__":
    yest     = datetime.date.today() - datetime.timedelta(days=1)
    yest_str = yest.strftime("%m/%d/%Y")
    yest_iso = yest.strftime("%Y-%m-%d")

    # Kill any existing instance
    subprocess.run(["taskkill", "/f", "/im", "ReportNavigator.exe"], capture_output=True)
    time.sleep(1)

    try:
        import pyautogui as pg
        import pygetwindow as gw
        import pyperclip
        pg.FAILSAFE = False
        pg.PAUSE = 0.4

        # Launch
        subprocess.Popen([EXE])
        time.sleep(10)

        # -- Handle "Select Site" dialog if it appears --
        for title in gw.getAllTitles():
            if "select" in title.lower() and "site" in title.lower():
                gw.getWindowsWithTitle(title)[0].activate()
                time.sleep(0.5)
                pg.press("enter")
                time.sleep(3)
                break

        # -- Login dialog: Tab past Site IP, paste MANAGER, Tab, paste ZOOMART9, Enter --
        login_done = False
        for _ in range(15):
            for title in gw.getAllTitles():
                if any(x in title.lower() for x in ["login","report navigator","verifone"]):
                    gw.getWindowsWithTitle(title)[0].activate()
                    time.sleep(0.8)
                    pg.press("tab")
                    time.sleep(0.3)
                    pyperclip.copy("MANAGER")
                    pg.hotkey("ctrl","a"); pg.hotkey("ctrl","v")
                    pg.press("tab")
                    time.sleep(0.3)
                    pyperclip.copy("ZOOMART9")
                    pg.hotkey("ctrl","a"); pg.hotkey("ctrl","v")
                    pg.press("enter")
                    time.sleep(7)
                    login_done = True
                    break
            if login_done: break
            time.sleep(1)

        if not login_done:
            tg("Zoo Mart: login dialog never appeared")
            sys.exit(1)

        # -- Navigate: Session menu -> Reports -> View Reports --
        # Bring main window to front
        time.sleep(2)
        for title in gw.getAllTitles():
            if any(x in title.lower() for x in ["report navigator","verifone"]):
                gw.getWindowsWithTitle(title)[0].activate()
                time.sleep(1)
                break

        W, H = pg.size()
        pg.click(W//2, H//2)
        time.sleep(0.5)

        # Click "Session" menu (first item in menu bar, ~top-left of window)
        # Find window position to click relative to it
        wins = [w for w in gw.getAllWindows() if any(x in w.title.lower() for x in ["report navigator","verifone"])]
        if wins:
            win = wins[0]
            win.activate()
            time.sleep(0.5)
            # Menu bar items start ~8px from left edge, ~30px from top
            menu_y = win.top + 30
            # Session is first menu item
            pg.click(win.left + 40, menu_y)
            time.sleep(0.8)
            # Reports should be in the dropdown — press R or use arrow keys
            pg.press("r")
            time.sleep(0.8)
            # View Reports submenu — press V or Enter
            pg.press("v")
            time.sleep(1.5)
        else:
            tg("Zoo Mart: could not find main window after login")
            sys.exit(1)

        # -- Now on View Reports screen --
        # Select Period Type dropdown: click it and choose "Period 2 Example Day"
        time.sleep(1)
        # Period Type dropdown is typically top portion of the form
        # Click it by position relative to window
        if wins:
            win = wins[0]
            win.activate()
            time.sleep(0.5)
            # Approximate position: upper-left of content area
            pg.click(win.left + 180, win.top + 90)
            time.sleep(0.5)
            pg.hotkey("ctrl","a")
            pyperclip.copy("Period 2 Example Day")
            pg.hotkey("ctrl","v")
            time.sleep(0.3)
            pg.press("enter")
            time.sleep(0.5)

            # Period dropdown (date): next field
            pg.press("tab")
            time.sleep(0.3)
            pyperclip.copy(yest_str)
            pg.hotkey("ctrl","a"); pg.hotkey("ctrl","v")
            time.sleep(0.3)
            pg.press("tab")
            time.sleep(0.5)

            # Report list — click Summary, then Add
            # List is left panel, roughly 1/4 width
            pg.click(win.left + int(win.width * 0.2), win.top + int(win.height * 0.5))
            time.sleep(0.3)
            pg.hotkey("ctrl","home")
            time.sleep(0.2)
            pg.press("s")
            time.sleep(0.3)
            # Add button
            pg.hotkey("alt","a")
            time.sleep(0.5)

            # Click Department in list, Add
            pg.click(win.left + int(win.width * 0.2), win.top + int(win.height * 0.5))
            time.sleep(0.3)
            pg.press("d")
            time.sleep(0.3)
            pg.hotkey("alt","a")
            time.sleep(0.5)

            # Process button
            pg.hotkey("alt","p")
            time.sleep(0.5)
            # Fallback: click bottom-right of window
            pg.click(win.left + win.width - 100, win.top + win.height - 50)
            time.sleep(35)

    except Exception as e:
        tg("Zoo Mart automation error: " + str(e))
        sys.exit(1)

    # -- Read HTML files --
    summary_path, dept_path = find_htmls()

    if not summary_path:
        all_html = []
        for root, _, files in os.walk(CACHE_DIR):
            for f in files:
                if f.endswith(".html"): all_html.append(os.path.join(root, f))
        tg("Zoo Mart: no summary HTML for " + yest_iso + "\nCache has: " + (str(all_html[-5:]) if all_html else "nothing"))
        sys.exit(1)

    s = parse_summary(summary_path)
    d = parse_depts(dept_path) if dept_path else []

    dept_block = ("\n\U0001f3f7 Departments:\n" + "\n".join(d)) if d else ""
    msg = (
        "\U0001f3ea ZOO MART - " + yest_iso + "\n" +
        "=" * 28 + "\n" +
        "\U0001f4b0 Net Sales: $" + s.get("net_sales","?") + "\n" +
        "\U0001f4ca " + s.get("txns","?") + " transactions\n" +
        "\U0001f4b3 Credit: $" + s.get("credit","?") + "\n" +
        "\U0001f4b3 Debit:  $" + s.get("debit","?") + "\n" +
        "\U0001f4b5 Cash:   $" + s.get("cash","?") +
        dept_block
    )
    tg(msg)
    print("Done - report sent to Telegram")
'@
[IO.File]::WriteAllText($pyPath, $content, $enc)
Write-Host "Script written (UTF-8 no BOM)" -ForegroundColor Green

# Verify no BOM
$bytes = [IO.File]::ReadAllBytes($pyPath)
if ($bytes[0] -eq 0xEF) { Write-Host "WARNING: BOM present!" -ForegroundColor Red }
else { Write-Host "Encoding OK" -ForegroundColor Green }

# -- 2. Batch launcher --
$batPath = "C:\ProgramData\ZooMart\run.bat"
$batEnc = New-Object System.Text.UTF8Encoding $false
[IO.File]::WriteAllText($batPath, "@echo off`r`n`"C:\Program Files\Python311\python.exe`" C:\ProgramData\ZooMart\zoomart_report.py >> C:\ProgramData\ZooMart\log.txt 2>&1`r`n", $batEnc)

# -- 3. Scheduled task (PS 3/4/5 compatible) --
Write-Host "Registering scheduled task..." -ForegroundColor Cyan
Unregister-ScheduledTask -TaskName "ZooMartReportNavigator" -Confirm:$false -ErrorAction SilentlyContinue
$action    = New-ScheduledTaskAction -Execute $batPath
$trigger   = New-ScheduledTaskTrigger -Daily -At "04:29"
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "ZooMartReportNavigator" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Scheduled task registered: 4:29 AM daily" -ForegroundColor Green

# -- 4. Install pyperclip --
Write-Host "Installing pyperclip..." -ForegroundColor Cyan
& "C:\Program Files\Python311\python.exe" -m pip install pyperclip --quiet

# -- 5. Syntax check --
Write-Host "Syntax check..." -ForegroundColor Cyan
& "C:\Program Files\Python311\python.exe" -m py_compile $pyPath
if ($LASTEXITCODE -eq 0) { Write-Host "Syntax OK" -ForegroundColor Green }
else { Write-Host "SYNTAX ERROR" -ForegroundColor Red; exit 1 }

# -- 6. Run NOW --
Write-Host ""
Write-Host "=== RUNNING NOW ===" -ForegroundColor Yellow
& "C:\Program Files\Python311\python.exe" $pyPath

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "Task: ZooMartReportNavigator at 4:29 AM daily"
Write-Host "Log:  C:\ProgramData\ZooMart\log.txt"
