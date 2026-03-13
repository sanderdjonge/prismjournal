import asyncio
from playwright.async_api import async_playwright
import os

async def verify_prism_ui():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()

        routes = [
            '/',
            '/journal',
            '/analytics',
            '/settings'
        ]

        print("\n[Playwright Verification] Starting UI Audit...")

        for route in routes:
            url = f"http://localhost:3000{route}"
            print(f"\n[Testing] {url}")
            try:
                response = await page.goto(url, timeout=30000)
                if response.status != 200:
                    print(f"  - FAIL: Server returned status {response.status}")
                    continue

                # Wait for content
                await page.wait_for_load_state('networkidle')

                # 1. Branding Check
                try:
                    branding = await page.wait_for_selector('text=PRISM', timeout=5000)
                    print("  - PASS: Found 'PRISM' identifier in TopNav")
                except:
                    print("  - FAIL: Branding 'PRISM' not found")

                # 2. Navigation Check (TopNav links)
                try:
                    await page.wait_for_selector('text=Dashboard', timeout=5000)
                    await page.wait_for_selector('text=Journal', timeout=5000)
                    print("  - PASS: TopNav links detected")
                except:
                    print("  - FAIL: TopNav links missing")

                # 3. Component Specific Checks
                if route == '/':
                    try:
                        await page.wait_for_selector('text=Equity Curve Chart', timeout=5000)
                        print("  - PASS: Equity Chart rendered")
                    except:
                        print("  - FAIL: Equity Chart missing")
                
                if route == '/journal':
                    try:
                        await page.wait_for_selector('text=The Vault', timeout=5000)
                        print("  - PASS: Journal 'Vault' header detected")
                    except:
                        print("  - FAIL: Journal header missing")

                # 4. Screenshot
                screenshot_path = f"/tmp/verify_prism_{route.replace('/', '') or 'root'}.png"
                await page.screenshot(path=screenshot_path)
                print(f"  - INFO: Visual proof saved to {screenshot_path}")

            except Exception as e:
                print(f"  - ERROR: {str(e)}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_prism_ui())
