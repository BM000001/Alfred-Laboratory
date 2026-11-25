"""WebKit regression smoke test for deleting an Alfred Studies discipline."""

from pathlib import Path
import re
import subprocess
import time
from urllib.error import URLError
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:4173"
VIEWPORTS = [
    {"width": 320, "height": 568, "touch": True},
    {"width": 390, "height": 844, "touch": True},
    {"width": 768, "height": 1024, "touch": False},
]


SEED_DATABASE = r"""async () => {
  const database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('alfred', 13);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ['tasks', 'projects', 'appointments', 'disciplines', 'studyTopics',
        'studyFlashcards', 'studyQuestions', 'studyQuizAttempts', 'studyLearningProgress', 'files',
        'focusSessions', 'assistantMessages', 'memories', 'egressAudit', 'egressSettings',
        'calendarSyncStates', 'pendingGoogleCalendarOperations']) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the test database.'));
  });

  const seed = {
    disciplines: [
      { id: 'd1', name: 'Programação', createdAt: '2026-11-25T00:00:00.000Z' },
      { id: 'd2', name: 'Matemática', createdAt: '2026-11-25T00:00:00.000Z' },
    ],
    studyTopics: [
      { id: 't1', disciplineId: 'd1', title: 'Unidade de teste', status: 'pending', createdAt: '2026-11-25T00:00:00.000Z' },
      { id: 't2', disciplineId: 'd2', title: 'Unidade preservada', status: 'pending', createdAt: '2026-11-25T00:00:00.000Z' },
    ],
    studyFlashcards: [
      { id: 'c1', disciplineId: 'd1', front: 'Pergunta', back: 'Resposta', createdAt: '2026-11-25T00:00:00.000Z', nextReviewAt: '2026-11-25T00:00:00.000Z', intervalDays: 0, reviewCount: 0 },
      { id: 'c2', disciplineId: 'd2', front: 'Outra pergunta', back: 'Outra resposta', createdAt: '2026-11-25T00:00:00.000Z', nextReviewAt: '2026-11-25T00:00:00.000Z', intervalDays: 0, reviewCount: 0 },
    ],
    studyQuestions: [
      { id: 'q1', disciplineId: 'd1', prompt: 'Teste?', options: ['A', 'B'], correctOptionIndex: 0, difficulty: 'easy', createdAt: '2026-11-25T00:00:00.000Z' },
      { id: 'q2', disciplineId: 'd2', prompt: 'Preservar?', options: ['A', 'B'], correctOptionIndex: 0, difficulty: 'easy', createdAt: '2026-11-25T00:00:00.000Z' },
    ],
    studyQuizAttempts: [
      { id: 'a1', disciplineId: 'd1', startedAt: '2026-11-25T00:00:00.000Z', completedAt: '2026-11-25T00:01:00.000Z', totalQuestions: 1, correctAnswers: 1, answers: [] },
      { id: 'a2', disciplineId: 'd2', startedAt: '2026-11-25T00:00:00.000Z', completedAt: '2026-11-25T00:01:00.000Z', totalQuestions: 1, correctAnswers: 1, answers: [] },
    ],
    studyLearningProgress: [
      { id: 'd1:lesson:c1', disciplineId: 'd1', lessonId: 'lesson:c1', completedAt: '2026-11-25T00:00:00.000Z', context: 'technical' },
      { id: 'd2:lesson:c2', disciplineId: 'd2', lessonId: 'lesson:c2', completedAt: '2026-11-25T00:00:00.000Z', context: 'technical' },
    ],
    files: [
      { id: 'f1', name: 'original.txt', type: 'text/plain', size: 8, createdAt: '2026-11-25T00:00:00.000Z', disciplineId: 'd1', blob: new Blob(['original']) },
    ],
  };

  await new Promise((resolve, reject) => {
    const tx = database.transaction(Object.keys(seed), 'readwrite');
    let failedWrite = '';
    for (const [name, rows] of Object.entries(seed)) for (const row of rows) {
      const request = tx.objectStore(name).put(row);
      request.onerror = () => { failedWrite = `${name}/${row.id}: ${request.error?.name ?? 'unknown'} ${request.error?.message ?? ''}`; };
    }
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error ?? new Error(`Seed transaction failed: ${failedWrite || 'unknown request error'}`));
    tx.onabort = () => reject(tx.error ?? new Error(`Seed transaction aborted: ${failedWrite || 'unknown request error'}`));
  });
  database.close();
}"""


READ_DATABASE = r"""async () => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('alfred', 13);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    const names = ['disciplines', 'studyTopics', 'studyFlashcards', 'studyQuestions',
      'studyQuizAttempts', 'studyLearningProgress', 'files'];
    const tx = db.transaction(names, 'readonly');
    const result = {};
    await Promise.all(names.map(name => new Promise((resolve, reject) => {
      const request = tx.objectStore(name).getAll();
      request.onsuccess = () => { result[name] = request.result; resolve(); };
      request.onerror = () => reject(request.error);
    })));
    return result;
  } finally { db.close(); }
}"""


def wait_for_server(process: subprocess.Popen) -> None:
    deadline = time.time() + 60
    while time.time() < deadline:
        if process.poll() is not None:
            raise RuntimeError(f"Vite encerrou com código {process.returncode}.")
        try:
            with urlopen(URL, timeout=1):
                return
        except (URLError, TimeoutError):
            time.sleep(0.5)
    raise TimeoutError("Vite não ficou disponível em 60 segundos.")


def main() -> None:
    server = subprocess.Popen(
        ["npm", "run", "dev", "--", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    try:
        wait_for_server(server)
        with sync_playwright() as playwright:
            browser = playwright.webkit.launch()
            try:
                for viewport in VIEWPORTS:
                    context = browser.new_context(
                        viewport={"width": viewport["width"], "height": viewport["height"]},
                        has_touch=viewport["touch"],
                    )
                    page = context.new_page()
                    page.on("console", lambda message: print(f"Browser console ({viewport['width']}px): {message.text}") if message.type == "error" else None)
                    page.on("pageerror", lambda error: print(f"Browser error ({viewport['width']}px): {error}"))
                    page.goto(URL, wait_until="domcontentloaded")
                    page.evaluate(SEED_DATABASE)
                    page.get_by_role("button", name="Aprender", exact=True).click()
                    page.get_by_role("button", name=re.compile("Programação")).click()
                    page.locator('summary[aria-label="Gerenciar matéria"]').click()
                    page.once("dialog", lambda dialog: dialog.accept())
                    page.get_by_role("button", name="Excluir disciplina").click()
                    page.get_by_role("button", name=re.compile("Programação")).wait_for(state="detached")

                    data = page.evaluate(READ_DATABASE)
                    assert [row["id"] for row in data["disciplines"]] == ["d2"], viewport
                    for store in ["studyTopics", "studyFlashcards", "studyQuestions", "studyQuizAttempts", "studyLearningProgress"]:
                        assert all(row["disciplineId"] == "d2" for row in data[store]), (store, viewport)
                        assert len(data[store]) == 1, (store, viewport)
                    assert data["files"][0]["id"] == "f1", viewport
                    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), viewport
                    print(f"PASS WebKit {viewport['width']}x{viewport['height']}")
                    context.close()
            finally:
                browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server.kill()


if __name__ == "__main__":
    main()
