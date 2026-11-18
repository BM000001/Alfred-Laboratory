import { fireEvent, screen, within } from '@testing-library/react';

export function create(label: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: label }));
}
