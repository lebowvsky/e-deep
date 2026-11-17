import { FormField } from '@/shared/ui/FormField';
import { TagInput } from '@/shared/ui/TagInput';
import { Textarea } from '@/shared/ui/Textarea';
import type { DiveForm } from '../../../form/useDiveForm';
import { fieldBinder } from '../fieldBinding';
import { FormSection } from '../FormSection';

export interface NotesSectionProps {
  form: DiveForm;
  canEditEvent: boolean;
  /** Species already entered, offered under the field. */
  species: readonly string[];
}

/** Section 6: free notes and the species seen, as tags. */
export function NotesSection({ form, canEditEvent, species }: NotesSectionProps) {
  const bind = fieldBinder(form, canEditEvent);

  return (
    <FormSection section="notes" optional>
      <FormField label="Notes" {...bind('notes')}>
        <Textarea
          value={form.values.notes}
          onChange={(event) => form.change('notes', event.target.value)}
          onBlur={() => form.blur('notes')}
          placeholder="Ce que tu as vu, ressenti, ce que tu veux retenir…"
        />
      </FormField>
      <FormField
        label="Espèces observées"
        {...bind('species', 'Entrée pour ajouter · suggestions depuis tes plongées précédentes')}
      >
        <TagInput
          values={form.values.species}
          onValuesChange={(values) => form.change('species', values)}
          suggestions={species}
        />
      </FormField>
    </FormSection>
  );
}
