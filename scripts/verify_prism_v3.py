import asyncio
from playwright.async_api import async_playwright
import os

async def verify_prism_refinements():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()

        routes = [
            '/',
            '/journal',
            '/performance',
            '/analytics',
            '/calculator',
            '/settings'
        ]

        print("\n[Audit] Starting Prism Iteration 3 Verification...")

        for route in routes:
            url = f"http://localhost:3000{url}" if route.startswith('http') else f"http://localhost:3000{route}"
            print(f"\n[Testing] {url}")
            try:
                response = await page.goto(url, timeout=30000)
                if response.status != 200:
                    print(f"  - FAIL: Status {response.status}")
                    continue

                await page.wait_for_load_state('networkidle')

                # 1. Page Specific Success Markers
                if route == '/':
                    await page.wait_for_selector('text=Reset Layout', timeout=5000)
                    print("  - PASS: Dashboard controls present")
                
                if route == '/calculator':
                    await page.wait_for_selector('text=Vector Size Calculator', timeout=5000)
                    print("  - PASS: Risk Calculator operational")

                if route == '/performance':
                    await page.wait_for_selector('text=Performance Ledger', timeout=5000)
                    print("  - PASS: Performance page active")

                if route == '/journal':
                    # Test Modal
                    await page.click('text=New Record')
                    await page.wait_for_selector('text=Log Execution', timeout=5000)
                    print("  - PASS: Trade Entry Modal functional")

                # 2. Screenshot
                screenshot_path = f"/tmp/prism_v3_{route.replace('/', '') or 'root'}.png"
                await page.screenshot(path=screenshot_path)
                print(f"  - INFO: Captured {screenshot_path}")

            except Exception as e:
                print(f"  - ERROR: {str(e)}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_prism_refinements())
