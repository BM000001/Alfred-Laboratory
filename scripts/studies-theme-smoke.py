"""Exercise the nine main views in both themes on a running local production build."""
import sys
from playwright.sync_api import sync_playwright

PRIMARY = {"Hoje": "inicio", "Aprender": "estudos", "Organização": "organizacao",
           "Alfred": "assistente", "Projetos": "projetos"}
SECONDARY = {"Notas": "notas", "Arquivos": "arquivos", "Central de IA": "ia",
             "Configurações": "configuracoes"}

with sync_playwright() as playwright:
    browser = playwright.webkit.launch()
    for width in (320, 390, 1280):
        for theme in ("light", "dark"):
            page = browser.new_page(viewport={"width": width, "height": 844}, color_scheme=theme)
            page.goto(sys.argv[1])
            page.wait_for_function("theme => document.documentElement.dataset.theme === theme", arg=theme)
            for label, slug in {**PRIMARY, **SECONDARY}.items():
                if label in SECONDARY:
                    page.get_by_role("button", name="Mais", exact=True).click()
                    controls = page.get_by_role("dialog")
                else:
                    controls = page.get_by_role("navigation", name="Navegação principal")
                controls.get_by_role("button", name=label, exact=True).click()
                page.locator(f"main.page-{slug}").wait_for()
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), (width, theme, slug)
            print(width, theme, "9 telas verificadas", flush=True)
            page.close()
    browser.close()
