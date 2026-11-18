import { expect, it } from 'vitest';
import { fileRepository, studyTopicRepository } from '../../storage/repositories';
import { attachStudyMaterial } from './attachStudyMaterial';

it('serializa vínculos concorrentes da mesma unidade e recupera a unidade quando o original foi removido', async () => {
  const createdAt = new Date().toISOString();
  const unit = { id: 'unit', disciplineId: 'discipline', title: 'Unidade', status: 'pending' as const, createdAt };
  await studyTopicRepository.save(unit);
  for (const id of ['first', 'second', 'foreign']) {
    await fileRepository.save({ id, name: id, size: 1, type: 'text/plain', createdAt,
      disciplineId: id === 'foreign' ? 'other' : 'discipline', blob: new Blob(['a']) });
  }
  await expect(attachStudyMaterial(unit.id, unit.disciplineId, 'foreign')).rejects.toThrow(/mesma disciplina/);
  const results = await Promise.allSettled([
    attachStudyMaterial(unit.id, unit.disciplineId, 'first'),
    attachStudyMaterial(unit.id, unit.disciplineId, 'second'),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
  const linked = (await studyTopicRepository.getById(unit.id))?.sourceFileId;
  expect(linked).toMatch(/^(first|second)$/);
  expect(await attachStudyMaterial(unit.id, unit.disciplineId, linked!)).toMatchObject({ sourceFileId: linked });
  await fileRepository.delete(linked!);
  const replacement = linked === 'first' ? 'second' : 'first';
  expect(await attachStudyMaterial(unit.id, unit.disciplineId, replacement)).toMatchObject({ sourceFileId: replacement });
});
