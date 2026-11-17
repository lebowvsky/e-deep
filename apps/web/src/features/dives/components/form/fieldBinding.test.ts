import { describe, expect, it, vi } from 'vitest';
import { validValues } from '../../mocks/diveFormFixture';
import type { DiveFormActions } from '../../form/useDiveForm';
import { sameSectionProps, sectionReads, type SectionForm } from './fieldBinding';

const actions: DiveFormActions = {
  change: vi.fn(),
  blur: vi.fn(),
  addMember: vi.fn(),
  removeMember: vi.fn(),
  setMemberLevel: vi.fn(),
  addDecoStop: vi.fn(),
  removeDecoStop: vi.fn(),
  changeDecoStop: vi.fn(),
  resume: vi.fn(),
  reset: vi.fn(),
};

const form = (overrides: Partial<SectionForm> = {}): SectionForm => ({
  values: validValues(),
  errors: {},
  warnings: {},
  actions,
  ...overrides,
});

describe('sameSectionProps', () => {
  const isSame = sameSectionProps<{ form: SectionForm; canEditEvent: boolean }>(
    sectionReads('equipment'),
  );
  const props = { form: form(), canEditEvent: true };

  it('skips the render when only the fields of another section changed', () => {
    const typedElsewhere = form({
      values: { ...props.form.values, notes: 'Mérou' },
      errors: { maxDepthM: 'Indique la profondeur' },
    });
    expect(isSame(props, { ...props, form: typedElsewhere })).toBe(true);
  });

  it('renders again when a field of the section, its message or another prop changed', () => {
    const values = { ...props.form.values, weightKg: '6' };
    expect(isSame(props, { ...props, form: form({ values }) })).toBe(false);
    expect(isSame(props, { ...props, form: form({ warnings: { weightKg: 'x' } }) })).toBe(false);
    expect(isSame(props, { ...props, canEditEvent: false })).toBe(false);
    expect(isSame(props, { ...props, form: form({ actions: { ...actions } }) })).toBe(false);
  });

  it('compares the folded state by value, not by object', () => {
    const fold = (open: boolean) => ({
      open,
      onOpenChange: vi.fn(),
      summary: 'Rien',
      status: { status: 'empty' as const },
    });
    const isSameFolded = sameSectionProps<{ form: SectionForm; collapse: ReturnType<typeof fold> }>(
      sectionReads('notes'),
    );
    const collapse = fold(false);
    expect(
      isSameFolded(
        { form: props.form, collapse },
        { form: props.form, collapse: { ...collapse, status: { status: 'empty' } } },
      ),
    ).toBe(true);
    expect(
      isSameFolded({ form: props.form, collapse }, { form: props.form, collapse: fold(true) }),
    ).toBe(false);
  });
});

describe('sectionReads', () => {
  it('lists the fields of the section, then those it reads elsewhere', () => {
    expect(sectionReads('notes')).toEqual(['notes', 'species']);
    expect(sectionReads('team', ['date'])).toEqual(['team', 'date']);
  });
});
