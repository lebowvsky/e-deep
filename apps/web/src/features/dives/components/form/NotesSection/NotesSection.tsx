import { memo } from 'react';
import { FormField } from '@/shared/ui/FormField';
import { TagInput } from '@/shared/ui/TagInput';
import { Textarea } from '@/shared/ui/Textarea';
import { fieldBinder, sameSectionProps, sectionReads, type SectionForm } from '../fieldBinding';
import { FormSection, type FormSectionCollapse } from '../FormSection';

export interface NotesSectionProps {
  form: SectionForm;
  canEditEvent: boolean;
  /** Phones: folded section (accordion). */
  collapse?: FormSectionCollapse | undefined;
  /** Species already entered, offered under the field. */
  species: readonly string[];
}

/** Section 6: free notes and the species seen, as tags. */
export const NotesSection = memo(
  function NotesSection({ form, canEditEvent, collapse, species }: NotesSectionProps) {
    const bind = fieldBinder(form, canEditEvent);
    const { change, blur } = form.actions;

    return (
      <FormSection section="notes" optional collapse={collapse}>
        <FormField {...bind('notes')}>
          <Textarea
            value={form.values.notes}
            onChange={(event) => change('notes', event.target.value)}
            onBlur={() => blur('notes')}
            placeholder="Ce que tu as vu, ressenti, ce que tu veux retenir…"
          />
        </FormField>
        <FormField
          {...bind('species', 'Entrée pour ajouter · suggestions depuis tes plongées précédentes')}
          label="Espèces observées"
        >
          <TagInput
            values={form.values.species}
            onValuesChange={(values) => change('species', values)}
            suggestions={species}
          />
        </FormField>
      </FormSection>
    );
  },
  sameSectionProps<NotesSectionProps>(sectionReads('notes')),
);
