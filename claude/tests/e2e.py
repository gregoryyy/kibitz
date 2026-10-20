import asyncio, sys
from playwright.async_api import async_playwright
import os
SP=os.path.join(os.path.dirname(__file__), 'out'); os.makedirs(SP, exist_ok=True)
URL=os.environ.get('KIBITZ_URL','http://localhost:8765/_test.html')
CHROME=os.environ.get('CHROME_PATH')
async def sq(page, s, orient='white'):
    b = await page.locator('#board').bounding_box()
    f = 'abcdefgh'.index(s[0]); r = int(s[1])
    if orient=='white': x = b['x'] + (f+.5)*b['width']/8; y = b['y'] + (8-r+.5)*b['height']/8
    else: x = b['x'] + (7-f+.5)*b['width']/8; y = b['y'] + (r-1+.5)*b['height']/8
    return x,y
async def move(page, a, z):
    x,y = await sq(page,a); await page.mouse.click(x,y); await page.wait_for_timeout(120)
    x,y = await sq(page,z); await page.mouse.click(x,y)
async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(**({'executable_path': CHROME} if CHROME else {}))
        page = await br.new_page(viewport={'width':1360,'height':900})
        errs=[]
        page.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        page.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
        await page.goto(URL)
        await page.wait_for_function("document.querySelector('#engineDot').className.includes('ok') || document.querySelector('#engineText').textContent.includes('failed')", timeout=40000)
        print('engine:', await page.text_content('#engineText'))
        await move(page,'e2','e4')
        await page.wait_for_function("document.querySelectorAll('#moves button').length>=2", timeout=20000)
        print('moves:', await page.text_content('#moves'))
        await move(page,'d1','h5')  # early queen
        await page.wait_for_function("document.querySelectorAll('#moves button').length>=4", timeout=20000)
        await move(page,'h5','f7')  # likely blunder unless mate
        await page.wait_for_timeout(6000)
        print('moves:', await page.text_content('#moves'))
        print('flag:', (await page.text_content('#flagSlot')) or '(none)')
        await page.screenshot(path=SP+'/s1.png')
        # analysis mode + coach + reading tabs
        await page.click('[data-tab="reading"]'); await page.wait_for_timeout(300)
        await page.screenshot(path=SP+'/s2.png')
        # resign & review
        await page.click('#btnResign'); await page.click('#confirmSlot .btn.primary')
        await page.wait_for_timeout(500)
        await page.click('[data-tab="review"]'); await page.click('#btnReview')
        await page.wait_for_function("!document.querySelector('#reviewProgress') || document.querySelector('#reviewProgress').hidden", timeout=90000)
        await page.wait_for_timeout(500)
        await page.screenshot(path=SP+'/s3.png', full_page=True)
        await page.click('[data-tab="library"]'); await page.wait_for_timeout(300)
        await page.screenshot(path=SP+'/s4.png')
        # open example game, check reading similar positions
        await page.locator('#libList .game').filter(has_text='Opera').locator('button', has_text='Open').click()
        await page.wait_for_timeout(1500)
        await page.click('#btnFirst'); 
        for i in range(10): await page.click('#btnNext')
        await page.click('[data-tab="reading"]'); await page.wait_for_timeout(1500)
        await page.screenshot(path=SP+'/s5.png')
        # mobile + dark
        m = await br.new_page(viewport={'width':400,'height':860}, color_scheme='dark')
        m.on('pageerror', lambda e: errs.append('MPAGEERR '+str(e)))
        await m.goto(URL); await m.wait_for_timeout(4000)
        await m.screenshot(path=SP+'/m1.png', full_page=True)
        sw = await m.evaluate('document.documentElement.scrollWidth')
        print('mobile scrollWidth', sw)
        print('\n'.join(errs[:30]))
        await br.close()
asyncio.run(main())
