export type StudyTopicStatus = 'pending' | 'completed';

export interface Discipline {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface StudyTopic {
  id: string;
  disciplineId: string;
  title: string;
  notes?: string;
  status: StudyTopicStatus;
  createdAt: string;
}

export type CreateDisciplineInput = Pick<Discipline, 'name'> & Partial<Pick<Discipline, 'description'>>;
export type UpdateDisciplineInput = Partial<Pick<Discipline, 'name' | 'description'>>;
export type CreateStudyTopicInput = Pick<StudyTopic, 'disciplineId' | 'title'> & Partial<Pick<StudyTopic, 'notes'>>;
export type UpdateStudyTopicInput = Partial<Pick<StudyTopic, 'title' | 'notes' | 'status'>>;
