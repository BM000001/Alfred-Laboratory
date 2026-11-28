export interface BubbleTrace {
  initial: number[];
  sorted: number[];
  actions: Array<{
    swapped: boolean;
    before: number[];
    explanation: string;
    leftIndex: number;
    rightIndex: number;
  }>;
}

export function createBubbleTrace(input: number[]): BubbleTrace;
export const comicPanels: readonly { title: string; text: string; stage: string }[];

export interface SortingPlan {
  vector: number[];
  passes: number;
  operation: 'compare-adjacent-and-swap-if-out-of-order';
}
export function makeCode(plan: SortingPlan, language: 'js' | 'py'): string;
export function runRestrictedPlan(plan: SortingPlan):
  | { ok: false; error: string }
  | { ok: true; final: number[]; sorted: boolean; actions: BubbleTrace['actions'] };
