import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print("Navigating to index.html")
        await page.goto("http://localhost:8000/index.html")
        await page.wait_for_timeout(1000)
        await page.screenshot(path="tests/step1_home.png")
        
        print("Clicking Services")
        await page.click("a[data-page='services']")
        await page.wait_for_timeout(2000) # wait for transition
        await page.screenshot(path="tests/step2_services_navigated.png")
        
        print("Clicking Experience")
        await page.click("a[data-page='experience']")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="tests/step3_experience_navigated.png")

        print("Clicking Contact")
        await page.click("a[data-page='contact']")
        await page.wait_for_timeout(2000)
        await page.screenshot(path="tests/step4_contact_navigated.png")
        
        await browser.close()

asyncio.run(main())
