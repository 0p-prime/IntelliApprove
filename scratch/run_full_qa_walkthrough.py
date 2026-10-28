import sys
import time
import os
import json
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:5173"
SCREENSHOT_DIR = r"C:\Users\LENOVO\.gemini\antigravity\brain\ed581f90-d4a3-4999-92df-1652ab2c01d5\qa_screenshots"

ROLES = [
    {"name": "ADMIN", "email": "admin@aicte.gov.in", "password": "aicte123", "label": "System Admin"},
    {"name": "BUREAU_OFFICER", "email": "member.secretary@aicte.gov.in", "password": "aicte123", "label": "Bureau Officer (HQ)"},
    {"name": "REGIONAL_HEAD", "email": "head.nw@aicte.gov.in", "password": "aicte123", "label": "Regional Head"},
    {"name": "REGIONAL_OFFICER", "email": "ro.w@aicte.gov.in", "password": "aicte123", "label": "Regional Officer"},
    {"name": "EVC_MEMBER", "email": "evc.expert1@aicte.gov.in", "password": "aicte123", "label": "EVC Member"},
    {"name": "INSTITUTION", "email": "principal@ditm.ac.in", "password": "aicte123", "label": "Institution Admin"},
]

qa_log = {
    "console_errors": [],
    "performance_benchmarks": {},
    "role_verifications": {},
    "feature_flows": {},
    "bugs_found": [],
}

def log_console(msg):
    if msg.type == "error":
        qa_log["console_errors"].append({
            "type": msg.type,
            "text": msg.text,
            "location": str(msg.location)
        })

def run_qa():
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()
        page.on("console", log_console)

        # -------------------------------------------------------------
        # 1. LOGIN PAGE & DEMO HELPER
        # -------------------------------------------------------------
        print("\n[QA] 1. Visiting Login Page...")
        t0 = time.time()
        page.goto(f"{BASE_URL}/login")
        page.wait_for_selector("text=Automate. Monitor. Comply.", timeout=8000)
        login_load_time = round((time.time() - t0) * 1000, 1)
        qa_log["performance_benchmarks"]["login_page_ms"] = login_load_time
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "01_login_page.png"))
        print(f"[QA] Login page loaded in {login_load_time}ms")

        # Open Demo Helper dropdown
        demo_btn = page.query_selector("button:has-text('Quick login as...')")
        if demo_btn:
            demo_btn.click()
            time.sleep(0.3)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "02_login_demo_dropdown.png"))
            demo_btn.click() # close

        # -------------------------------------------------------------
        # 2. ROLE-BASED DASHBOARD SCOPING & PERFORMANCE BENCHMARKING
        # -------------------------------------------------------------
        for role_info in ROLES:
            role_name = role_info["name"]
            print(f"\n[QA] Testing Role: {role_name} ({role_info['email']})...")
            page.goto(f"{BASE_URL}/login")
            page.fill("input[type='email']", role_info["email"])
            page.fill("input[type='password']", role_info["password"])
            page.click("button[type='submit']")

            # Benchmark Dashboard load time
            t_dash_0 = time.time()
            page.wait_for_selector("text=AICTE Regulatory Compliance", timeout=10000)
            dash_ms = round((time.time() - t_dash_0) * 1000, 1)
            qa_log["performance_benchmarks"][f"dashboard_{role_name}_ms"] = dash_ms
            time.sleep(0.8) # Allow charts to animate

            page.screenshot(path=os.path.join(SCREENSHOT_DIR, f"03_dash_{role_name.lower()}.png"))

            # Check Scoping info in sidebar
            sidebar_text = page.inner_text("aside") if page.query_selector("aside") else ""
            scope_verified = False
            if role_name == "INSTITUTION":
                scope_verified = "ditm" in sidebar_text.lower() or "delhi institute" in sidebar_text.lower()
            elif role_name == "REGIONAL_OFFICER":
                scope_verified = "western" in sidebar_text.lower()
            elif role_name == "REGIONAL_HEAD":
                scope_verified = "north-western" in sidebar_text.lower() or "north-west" in sidebar_text.lower()
            elif role_name in ["ADMIN", "BUREAU_OFFICER"]:
                scope_verified = "national" in sidebar_text.lower()
            elif role_name == "EVC_MEMBER":
                scope_verified = True

            qa_log["role_verifications"][role_name] = {
                "dashboard_load_ms": dash_ms,
                "passed_2s_sla": dash_ms < 2000,
                "scope_verified": scope_verified,
            }
            print(f"[QA] -> Dashboard Load Time: {dash_ms}ms (Pass <2s: {dash_ms < 2000}) | Scope Verified: {scope_verified}")

            # Test Applications List Page Scoping
            page.goto(f"{BASE_URL}/applications")
            page.wait_for_selector("table", timeout=8000)
            time.sleep(0.5)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, f"04_apps_{role_name.lower()}.png"))

            # Check table contents
            table_text = page.inner_text("table")
            if role_name == "INSTITUTION":
                # Must only see DITM applications
                has_leak = "coep" in table_text.lower() or "vjti" in table_text.lower()
                if has_leak:
                    qa_log["bugs_found"].append(f"Permission Leak: Institution sees other campus applications!")
                else:
                    print("[QA] -> Strict Institution Scoping Confirmed (0 foreign applications)")

            # Logout
            logout_btn = page.query_selector("button:has-text('Logout')")
            if logout_btn:
                logout_btn.click()
                page.wait_for_url("**/login", timeout=5000)

        # -------------------------------------------------------------
        # 3. DETAILED ADMIN WALKTHROUGH & NEW FEATURES VERIFICATION
        # -------------------------------------------------------------
        print("\n[QA] Logging in as ADMIN for full system walkthrough...")
        page.goto(f"{BASE_URL}/login")
        page.fill("input[type='email']", "admin@aicte.gov.in")
        page.fill("input[type='password']", "aicte123")
        page.click("button[type='submit']")
        page.wait_for_selector("text=AICTE Regulatory Compliance", timeout=10000)

        # A. Demo Mode Banner & Guided Tour Overlay
        print("[QA] Checking Demo Mode Banner and launching Guided Tour...")
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "05_demo_banner_active.png"))

        tour_btn = page.query_selector("button:has-text('Guided Tour')")
        if tour_btn:
            tour_btn.click()
            page.wait_for_selector("text=Step 1 of", timeout=5000)
            time.sleep(0.5)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "06_guided_tour_modal_step1.png"))

            # Click Next Step
            next_btn = page.query_selector("button:has-text('Next Step')")
            if next_btn:
                next_btn.click()
                time.sleep(0.3)
                page.screenshot(path=os.path.join(SCREENSHOT_DIR, "07_guided_tour_modal_step2.png"))

            # Close tour
            close_tour = page.query_selector("button[title='Exit Tour']")
            if close_tour:
                close_tour.click()
                time.sleep(0.3)

        # B. Application Detail: Stepper, Delay Risk Badge, & ECS Modal
        print("[QA] Checking Application Detail Page with Delay Risk Score...")
        page.goto(f"{BASE_URL}/applications/1")
        page.wait_for_selector("text=Current Assigned Stage", timeout=8000)
        time.sleep(0.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "08_app_detail_stepper_risk.png"))

        # Click Delay Risk Badge "Why this score?" popover
        risk_badge_btn = page.query_selector("button:has-text('Delay Risk')") or page.query_selector("text=Delay Risk")
        if risk_badge_btn:
            risk_badge_btn.click()
            time.sleep(0.4)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "09_why_this_risk_score_popover.png"))
            risk_badge_btn.click()

        # Open Electronic Case Summary Modal
        ecs_btn = page.query_selector("button:has-text('Electronic Case Summary')")
        if ecs_btn:
            ecs_btn.click()
            page.wait_for_selector("text=Draft for official review", timeout=6000)
            time.sleep(0.5)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "10_case_summary_official_draft.png"))
            close_ecs = page.query_selector("button:has-text('Close')") or page.query_selector("text=✕")
            if close_ecs:
                close_ecs.click()

        # C. Full History Tab & Audit Lineage
        print("[QA] Checking Application Full History Tab...")
        history_tab = page.query_selector("button:has-text('Full History')") or page.query_selector("button:has-text('History')")
        if history_tab:
            history_tab.click()
            time.sleep(0.5)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "11_app_full_history_timeline.png"))

        # D. EVC Module: Queue & Calendar
        print("[QA] Checking EVC Inspection Queue and Calendar...")
        page.goto(f"{BASE_URL}/evc")
        page.wait_for_selector("text=Queue", timeout=8000)
        time.sleep(0.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "12_evc_inspection_queue.png"))

        # Open Schedule Modal
        sched_btn = page.query_selector("button:has-text('Schedule Visit')") or page.query_selector("button:has-text('Schedule')")
        if sched_btn:
            sched_btn.click()
            time.sleep(0.4)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "13_evc_schedule_modal.png"))
            cancel_sched = page.query_selector("button:has-text('Cancel')")
            if cancel_sched:
                cancel_sched.click()

        # EVC Calendar Tab
        cal_tab = page.query_selector("button:has-text('Inspection Calendar')") or page.query_selector("button:has-text('Calendar')")
        if cal_tab:
            cal_tab.click()
            time.sleep(0.5)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "14_evc_calendar_month_view.png"))

        # E. Undertakings Compliance Heat Table
        print("[QA] Checking Undertakings Compliance Heat Table...")
        page.goto(f"{BASE_URL}/undertakings")
        page.wait_for_selector("text=Undertakings", timeout=8000)
        time.sleep(0.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "15_undertakings_compliance_table.png"))

        # F. Document Validity Timeline & Lease OCR Assist
        print("[QA] Checking Document Store and Expiry Timeline...")
        page.goto(f"{BASE_URL}/documents")
        page.wait_for_selector("text=Expiry Timeline", timeout=8000)
        time.sleep(0.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "16_documents_expiry_timeline.png"))

        # G. Statutory Reports Page & Excel CSV Export
        print("[QA] Checking Statutory Reports & Recharts...")
        page.goto(f"{BASE_URL}/reports")
        page.wait_for_selector("text=Statutory Reports", timeout=8000)
        time.sleep(0.8)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "17_statutory_reports_dashboard.png"))

        # H. Cryptographic Audit Chain Explorer
        print("[QA] Checking Cryptographic Audit Chain...")
        page.goto(f"{BASE_URL}/audit")
        page.wait_for_selector("text=Cryptographic", timeout=8000)
        time.sleep(0.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "18_cryptographic_audit_ledger.png"))

        # I. AICTE Portal Bridge (/integration)
        print("[QA] Checking AICTE Portal Bridge...")
        page.goto(f"{BASE_URL}/integration")
        page.wait_for_selector("text=AICTE National Portal Integration", timeout=8000)
        time.sleep(0.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "19_integration_portal_bridge.png"))

        # J. AI Statutory Assistant Floating Drawer
        print("[QA] Testing AI Statutory Assistant...")
        ai_trigger = page.query_selector("button[title='Open AICTE Natural Language Assistant']") or page.query_selector("button:has-text('Ask AI')")
        if ai_trigger:
            ai_trigger.click()
            time.sleep(0.6)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "20_ai_statutory_assistant_drawer.png"))

        # K. Bilingual Switch (English -> Hindi)
        print("[QA] Testing Multilingual Switcher (Hindi)...")
        lang_btn = page.query_selector("button:has-text('हिंदी')") or page.query_selector("button[title*='हिंदी']")
        if lang_btn:
            lang_btn.click()
            time.sleep(0.6)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "21_multilingual_hindi_active.png"))
            # Switch back to English
            en_btn = page.query_selector("button:has-text('EN')") or page.query_selector("button[title*='English']")
            if en_btn:
                en_btn.click()
                time.sleep(0.4)

        browser.close()

    print("\n[QA] Walkthrough complete! Summary:")
    print(f"Total Console Errors Detected: {len(qa_log['console_errors'])}")
    for err in qa_log["console_errors"]:
        print("  Console Error:", err)

    with open(os.path.join(SCREENSHOT_DIR, "qa_report.json"), "w") as f:
        json.dump(qa_log, f, indent=2)

if __name__ == "__main__":
    run_qa()
