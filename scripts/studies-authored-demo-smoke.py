import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.webkit.launch()
    for color,width in [('light',320),('dark',390),('light',1024)]:
        page=b.new_page(viewport={'width':width,'height':844},color_scheme=color)
        errors=[]
        page.on('pageerror',lambda e: errors.append(str(e)))
        page.goto(sys.argv[1])
        selector=page.get_by_label('Escolher prática')
        selector.wait_for(timeout=12000)
        assert selector.locator('option').count()==10
        for i in range(10):
            selector.select_option(str(i))
            for j in range(3):
                page.locator('fieldset button').first.click()
                assert page.get_by_role('status').inner_text()
                page.get_by_role('button', name='Revisar prática' if j==2 else 'Avançar um passo').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors,errors
        print(color,width,'30 passos OK',flush=True)
        page.close()
    b.close()
