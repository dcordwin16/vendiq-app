$ErrorActionPreference = "Continue"
New-Item -ItemType Directory -Force -Path "C:\ProgramData\ZooMart" | Out-Null

# Write the Python script
$scriptContent = @'
import os, sys, time, datetime, re, glob, subprocess

BOT_TOKEN = "8699727397:AAF-V3n91EzRi3jkUTJMbXYcCBE6I_KaHDM"
CHAT_ID = "8452546363"
CACHE_DIR = r"C:\Users\binod\OneDrive\Documents\Verifone\Site Management Tools\Report Navigator\cache\AB123"

def tg(msg):
    import urllib.request, urllib.parse
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": CHAT_ID, "text": msg}).encode()
    try: urllib.request.urlopen(urllib.request.Request(url, data=data), timeout=15)
    except Exception as e: print(f"TG error: {e}")

def find_exe():
    for p in [
        r"C:\Program Files\Verifone\Site Management Tools\Report Navigator\ReportNavigator.exe",
        r"C:\Program Files (x86)\Verifone\Site Management Tools\Report Navigator\ReportNavigator.exe",
        r"C:\Verifone\Site Management Tools\Report Navigator\ReportNavigator.exe",
        r"C:\Program Files\Verifone\ReportNavigator.exe",
    ]:
        if os.path.exists(p): return p
    for root,dirs,files in os.walk("C:\\"):
        for f in files:
            if f.lower()=="reportnavigator.exe": return os.path.join(root,f)
        dirs[:] = [d for d in dirs if d not in ["Windows","$Recycle.Bin","System Volume Information","Program Files\Microsoft","Program Files (x86)\Microsoft"]]
    return None

def parse_summary(path):
    txt = open(path, encoding="utf-8", errors="ignore").read()
    txt_clean = re.sub(r"<[^>]+>", " ", txt)
    nums = {}
    for label,key in [("Net Sales","net_sales"),("Credit","credit"),("Debit","debit"),("Cash","cash")]:
        m = re.search(rf"{re.escape(label)}[\s\S]{0,60}?\$([ \d,]+\.\d{2})", txt_clean)
        if m: nums[key] = m.group(1).strip()
    m = re.search(r"(\d+)\s+Transactions?", txt_clean, re.IGNORECASE)
    if m: nums["txns"] = m.group(1)
    return nums

def parse_depts(path):
    txt = re.sub(r"<[^>]+>"," ",open(path,encoding="utf-8",errors="ignore").read())
    lines = [l.strip() for l in txt.splitlines() if l.strip()]
    depts = []
    for i,line in enumerate(lines):
        if re.search(r"\$([ \d,]+\.\d{2})",line):
            amt = re.search(r"\$([ \d,]+\.\d{2})",line).group(0)
            name = lines[i-1] if i>0 else "Unknown"
            if 3 < len(name) < 40 and not any(x in name.lower() for x in ["total","grand","subtot"]):
                depts.append(f"  {name}: {amt}")
    return depts[:8]

def find_htmls():
    yest = (datetime.date.today()-datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    cutoff = time.time()-3600
    summary,dept = None,None
    for root,dirs,files in os.walk(CACHE_DIR):
        for f in files:
            if not f.endswith(".html"): continue
            fp = os.path.join(root,f)
            fl = f.lower()
            if "summary" in fl: summary=fp
            elif "dept" in fl or "department" in fl: dept=fp
    return summary,dept

if __name__=="__main__":
    yest = datetime.date.today()-datetime.timedelta(days=1)
    yest_str = yest.strftime("%m/%d/%Y")
    yest_iso = yest.strftime("%Y-%m-%d")

    exe = find_exe()
    if not exe:
        tg(f"Zoo Mart ERROR: ReportNavigator.exe not found on store PC")
        sys.exit(1)

    # Kill existing
    subprocess.run(["taskkill","/f","/im","ReportNavigator.exe"],capture_output=True)
    time.sleep(1)

    try:
        import pyautogui as pg
        import pygetwindow as gw
        pg.FAILSAFE = False
        pg.PAUSE = 0.3

        subprocess.Popen([exe])
        time.sleep(12)

        # Handle login dialog if present
        for title in gw.getAllTitles():
            if any(x in title.lower() for x in ["login","sign in","logon","commander"]):
                win = gw.getWindowsWithTitle(title)[0]
                win.activate(); time.sleep(1)
                pg.hotkey("ctrl","a"); pg.typewrite("MANAGER",interval=0.05)
                pg.press("tab")
                pg.hotkey("ctrl","a"); pg.typewrite("ZOOMART9",interval=0.05)
                pg.press("enter")
                time.sleep(6)
                break

        # Bring Report Navigator to front
        for title in gw.getAllTitles():
            if any(x in title.lower() for x in ["report navigator","verifone","navigator"]):
                win = gw.getWindowsWithTitle(title)[0]
                win.activate(); time.sleep(1)
                break

        W,H = pg.size()

        # Period Type dropdown - click it (typically top-left area of form)
        pg.click(W//2-100, H//2-150); time.sleep(1)

        # Look for Period Type combo and select "Period 2 Example Day"
        # Use keyboard: click dropdown area and type
        pg.hotkey("ctrl","home"); time.sleep(0.5)
        # Tab through to find Period Type field
        for _ in range(3): pg.press("tab"); time.sleep(0.2)
        pg.hotkey("alt","down"); time.sleep(0.5)
        # Type to search
        pg.typewrite("Period 2",interval=0.04); time.sleep(0.3)
        pg.press("enter"); time.sleep(0.5)

        # Period date field - next tab stop
        pg.press("tab"); time.sleep(0.3)
        pg.hotkey("ctrl","a")
        pg.typewrite(yest_str,interval=0.04); time.sleep(0.3)
        pg.press("tab"); time.sleep(0.3)

        # Find Summary in list
        found_summary = pg.locateOnScreen(r"C:\ProgramData\ZooMart\summary_ref.png",confidence=0.6) if os.path.exists(r"C:\ProgramData\ZooMart\summary_ref.png") else None
        if found_summary:
            pg.click(found_summary); time.sleep(0.3)
        else:
            # Click in report list area and search
            pg.click(W//4, H//2); time.sleep(0.3)
            pg.hotkey("ctrl","home"); time.sleep(0.2)
            # Type S to jump to Summary
            pg.typewrite("s",interval=0.1); time.sleep(0.3)

        # Click Add button
        pg.hotkey("alt","a"); time.sleep(0.4)

        # Find Department
        pg.click(W//4, H//2+30); time.sleep(0.3)
        pg.typewrite("d",interval=0.1); time.sleep(0.3)
        # Search for "Department" in list
        for _ in range(20):
            pg.hotkey("ctrl","c")
            import pyperclip
            sel = pyperclip.paste()
            if "dept" in sel.lower(): break
            pg.press("down"); time.sleep(0.15)
        pg.hotkey("alt","a"); time.sleep(0.4)

        # Click Process button (Alt+P or find it)
        pg.hotkey("alt","p"); time.sleep(0.5)
        # If that didnt work try Enter on a focused Process button
        # Look for Process button by text
        proc_btn = pg.locateOnScreen(r"C:\ProgramData\ZooMart\process_ref.png",confidence=0.6) if os.path.exists(r"C:\ProgramData\ZooMart\process_ref.png") else None
        if proc_btn:
            pg.click(proc_btn)
        else:
            # Try clicking bottom-right area where Process usually is
            pg.click(W-200, H-100); time.sleep(0.5)

        time.sleep(35)  # Wait for report generation

    except Exception as e:
        tg(f"Zoo Mart pyautogui error: {e}")

    # Read HTML files
    summary_path, dept_path = find_htmls()

    if not summary_path:
        all_html = []
        for root,_,files in os.walk(CACHE_DIR):
            for f in files:
                if f.endswith(".html"): all_html.append(os.path.join(root,f))
        tg(f"Zoo Mart: No summary HTML for {yest_iso}\nFiles: {chr(10).join(all_html[-5:]) if all_html else 'NONE'}")
        sys.exit(1)

    s = parse_summary(summary_path)
    d = parse_depts(dept_path) if dept_path else []

    msg = (f"\U0001f3ea ZOO MART \u2014 {yest_iso}\n"
           f"==============================\n"
           f"\U0001f4b0 Net Sales: ${s.get('net_sales','?')}\n"
           f"\U0001f4ca {s.get('txns','?')} transactions\n"
           f"\U0001f4b3 Credit: ${s.get('credit','?')}\n"
           f"\U0001f4b3 Debit: ${s.get('debit','?')}\n"
           f"\U0001f4b5 Cash: ${s.get('cash','?')}\n"
           + (f"\n\U0001f3f7\ufe0f Departments:\n" + "\n".join(d) if d else ""))

    tg(msg)
    print("Done.")

'@
Set-Content -Path "C:\ProgramData\ZooMart\zoomart_report.py" -Value $scriptContent -Encoding UTF8

# Download and install Python 3.11 silently
$pyExe = "$env:TEMP\python-3.11.9.exe"
Write-Host "Downloading Python 3.11..."
(New-Object Net.WebClient).DownloadFile("https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe", $pyExe)
Write-Host "Installing Python..."
Start-Process -FilePath $pyExe -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0" -Wait

# Install packages
Write-Host "Installing packages..."
& "C:\Program Files\Python311\Scripts\pip.exe" install pyautogui pygetwindow pillow requests --quiet 2>&1

# Create batch launcher
Set-Content -Path "C:\ProgramData\ZooMart\run.bat" -Value "@echo off`r`n`"C:\Program Files\Python311\python.exe`" C:\ProgramData\ZooMart\zoomart_report.py >> C:\ProgramData\ZooMart\log.txt 2>&1" -Encoding ASCII

# Register scheduled task
$action = New-ScheduledTaskAction -Execute "C:\ProgramData\ZooMart\run.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At "4:29AM"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 15) -RunOnlyIfNetworkAvailable $true -StartWhenAvailable $true
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "ZooMartReportNavigator" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

# Find Report Navigator exe
Write-Host "Searching for ReportNavigator.exe..."
$exe = Get-ChildItem -Path "C:\" -Filter "ReportNavigator.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if ($exe) { Write-Host "FOUND: $exe" } else { Write-Host "NOT FOUND - will search at runtime" }

Write-Host ""
Write-Host "=== INSTALL COMPLETE ==="
Write-Host "Script: C:\ProgramData\ZooMart\zoomart_report.py"
Write-Host "Task:   ZooMartReportNavigator (runs 4:29 AM daily)"
Write-Host "Log:    C:\ProgramData\ZooMart\log.txt"
Write-Host ""
Write-Host "Running script NOW to find Report Navigator and read today's cache..."
& "C:\Program Files\Python311\python.exe" -c "
import os, sys
sys.path.insert(0,'C:\\ProgramData\\ZooMart')
exec(open('C:\\ProgramData\\ZooMart\\zoomart_report.py').read().split('if __name__')[0])
exe = find_exe()
print('Report Navigator:', exe if exe else 'NOT FOUND')
# List cache HTML files
import glob
cache = r'C:\\Users\\binod\\OneDrive\\Documents\\Verifone\\Site Management Tools\\Report Navigator\\cache\\AB123'
htmls = []
for root,_,files in os.walk(cache):
    for f in files:
        if f.endswith('.html'): htmls.append(os.path.join(root,f))
print('HTML files in cache:')
for h in sorted(htmls)[-10:]: print(' ', h)
"
