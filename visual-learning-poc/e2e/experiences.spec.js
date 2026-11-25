import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

await mkdir('evidence', { recursive: true });

test('edita e reordena valores, prevê e avança/retrocede', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entenda a ordenação fazendo' })).toBeVisible();
  await page.locator('#vectorInput').fill('3, 1, 2');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await page.getByRole('button', { name: 'Mover para direita a posição 0' }).click();
  await expect(page.locator('#arrayStatus')).toContainText('1, 3, 2');
  await expect(page.locator('#predictionPrompt')).toContainText('1 e 3');
  await page.getByRole('button', { name: 'Fica igual' }).click();
  await expect(page.locator('#predictionFeedback')).toContainText('Boa previsão');
  await page.getByRole('button', { name: 'Ver resultado e avançar' }).click();
  await expect(page.locator('#predictionPrompt')).toContainText('3 e 2');
  await page.getByRole('button', { name: 'Voltar passo' }).click();
  await expect(page.locator('#predictionPrompt')).toContainText('1 e 3');
  await page.screenshot({ path: 'evidence/aula-webkit-390x844.png' });
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(391);
});

test('Blockly mostra código e executa o interpretador limitado', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Programar com blocos/ }).click();
  await expect(page.locator('#blocklyWorkspace .blocklySvg')).toBeVisible();
  await expect(page.locator('#generatedCode')).toContainText('for (let passagem');
  await page.getByRole('button', { name: 'Executar com segurança' }).click();
  await expect(page.locator('#runResult')).toContainText('Vetor final: 1, 2, 3, 4');
  await expect(page.locator('.execution-step')).toContainText('vetor[i]');
  await expect(page.locator('.execution-step')).toContainText('trocou');
  await page.getByRole('button', { name: 'Próximo passo' }).click();
  await expect(page.locator('.execution-step')).toContainText('Passo 2 de');
  await page.locator('#codeLanguage').selectOption('py');
  await expect(page.locator('#generatedCode')).toContainText('for passagem in range');
  await page.screenshot({ path: 'evidence/blockly-webkit-390x844.png' });
});

test('história tem seis quadros e explica resposta incorreta/correta', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /História ilustrada/ }).click();
  await expect(page.locator('.comic-panel')).toHaveCount(6);
  await page.getByRole('button', { name: 'Manter como está' }).click();
  await expect(page.locator('#comicFeedback')).toContainText('Reveja a regra');
  await page.getByRole('button', { name: 'Trocar os cartões' }).click();
  await expect(page.locator('#comicFeedback')).toContainText('Correto');
  await expect(page.locator('#learningProgress')).toContainText('Resposta registrada');
  await page.reload();
  await page.getByRole('button', { name: /História ilustrada/ }).click();
  await page.getByRole('button', { name: 'Manter como está' }).click();
  await expect(page.locator('#learningProgress')).toContainText('Resposta registrada');
  await page.screenshot({ path: 'evidence/historia-webkit-390x844.png' });
});

test('layout e toque funcionam em largura estreita e tablet', async ({ page }) => {
  await page.goto('/');
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('heading', { name: 'Entenda a ordenação fazendo' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
  }
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Vai trocar' }).tap();
  await expect(page.locator('#predictionFeedback')).toContainText('Boa previsão');
});

test('interactive controls expose names and work with keyboard focus', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Experiências de aprendizagem' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Voltar passo' })).toBeDisabled();
  await page.getByRole('button', { name: /Programar com blocos/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#blocklyWorkspace .blocklySvg')).toBeVisible();
});

test('concept map expands by touch and explains linked topics', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Mapa conceitual/ }).tap();
  await expect(page.getByRole('navigation', { name: 'Mapa de conceitos' })).toBeVisible();
  await page.locator('summary', { hasText: 'Comparar vizinhos' }).tap();
  await expect(page.locator('.concept-map-detail')).toContainText('Compare dois valores vizinhos');
  await expect(page.locator('.concept-map-detail')).toContainText('pode levar a: Trocar fora de ordem');
});

test('shell e Blockly abrem depois de cachear; app continua disponível offline', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Programar com blocos/ }).click();
  await expect(page.locator('#blocklyWorkspace .blocklySvg')).toBeVisible();
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) throw new Error('Service Worker indisponível');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Entenda a ordenação fazendo' })).toBeVisible();
  await page.getByRole('button', { name: /Programar com blocos/ }).click();
  await expect(page.locator('#blocklyWorkspace .blocklySvg')).toBeVisible();
  await expect(page.locator('#generatedCode')).toContainText('for (let passagem');
});
