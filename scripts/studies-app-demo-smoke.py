"""Verify the deployed demo using a clean, disposable WebKit profile."""
import re
import sys
from playwright.sync_api import sync_playwright

with sync_playwright() as playwright:
    browser = playwright.webkit.launch()
    page = browser.new_page(viewport={"width":390,"height":844})
    api = []
    page.on("request", lambda request: api.append(request.url) if "/api/studies/" in request.url else None)
    page.goto(sys.argv[1])
    page.get_by_role("button", name="Abrir com exemplos de programação").click()
    page.get_by_role("button", name="Aprender", exact=True).click()
    page.get_by_role("button", name=re.compile("Programação · demonstração")).click()
    for building in ("Biblioteca", "Campo de Alvos", "Baú de Flashcards", "Laboratório", "Castelo"):
        page.get_by_role("button", name=re.compile("^" + building)).first.click()
        page.get_by_role("button", name="Voltar à trilha").click()
    counts = page.evaluate("""async () => {
      const db = await new Promise((res,rej) => { const r=indexedDB.open('alfred-studies-demo');
        r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
      try { return await Promise.all(['studyQuestions','studyFlashcards','files'].map(key=>new Promise((res,rej)=>{
        const r=db.transaction(key).objectStore(key).count(); r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error); }))); }
      finally {db.close();}
    }""")
    assert counts == [30,10,1], counts
    page.reload()
    page.get_by_role("button", name="Abrir dados locais desta prévia").click()
    page.get_by_role("button", name="Aprender", exact=True).click()
    page.get_by_role("button", name=re.compile("Programação · demonstração")).wait_for()
    assert not api, api
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
    print("WebKit 390px: cinco construções, 30 questões, 10 cartões, 1 material, recarga e zero chamadas à IA.")
    browser.close()
