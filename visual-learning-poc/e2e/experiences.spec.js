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
  await page.screenshot({ path: 'evidence/historia-webkit-390x844.png' });
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