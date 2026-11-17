import { useId, useState } from 'react';
import { formatDiveCount, formatInitials } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Chip } from '@/shared/ui/Chip';
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox';
import { FormField } from '@/shared/ui/FormField';
import { Icon } from '@/shared/ui/Icon';
import { IconButton } from '@/shared/ui/IconButton';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { avatarColorOf } from '../../../api/divesApi';
import { teamCount } from '../../../form/derived';
import { TEAM_LEVELS, type TeamMemberValue } from '../../../form/model';
import type { DiveFormDiverOption } from '../../../form/sources';
import type { DiveForm } from '../../../form/useDiveForm';
import { teamSizeLabel } from '../../../lib/labels';
import { fieldBinder } from '../fieldBinding';
import { FormSection, type FormSectionCollapse } from '../FormSection';
import styles from './PalanqueeSection.module.scss';

/** The diver filling the form: listed first, never removable. */
export interface PalanqueeSelf {
  firstName: string;
  lastName: string;
  /** Level code (`N2`), `null` when unknown. */
  level: string | null;
}

export interface PalanqueeSectionProps {
  form: DiveForm;
  canEditEvent: boolean;
  /** Phones: folded section (accordion). */
  collapse?: FormSectionCollapse | undefined;
  self: PalanqueeSelf;
  /** Divers already met, most frequent first. */
  divers: readonly DiveFormDiverOption[];
  /** « Fréquents » chips. */
  frequentDivers: readonly DiveFormDiverOption[];
}

type NewMember = Omit<TeamMemberValue, 'key'>;

const NO_LEVEL = '';
const LEVEL_OPTIONS: SelectOption<string>[] = [
  { value: NO_LEVEL, label: '—' },
  ...TEAM_LEVELS.map(({ code }) => ({ value: code, label: code })),
];

const fullName = (member: Pick<TeamMemberValue, 'firstName' | 'lastName'>) =>
  `${member.firstName} ${member.lastName}`.trim();

/** « Élise Marchand » → first name « Élise », last name « Marchand ». */
function memberFromName(name: string): NewMember {
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { id: null, firstName, lastName: rest.join(' '), level: NO_LEVEL };
}

function memberFromOption({ member }: DiveFormDiverOption): NewMember {
  return { id: member.id, firstName: member.firstName, lastName: member.lastName, level: NO_LEVEL };
}

/** Section 3: the dive team, the diver first, then the members with their level. */
export function PalanqueeSection({
  form,
  canEditEvent,
  collapse,
  self,
  divers,
  frequentDivers,
}: PalanqueeSectionProps) {
  const [query, setQuery] = useState('');
  const frequentLabelId = useId();
  const binding = fieldBinder(form, canEditEvent)('team');
  const { team } = form.values;
  const isInTeam = (id: string) => team.some((member) => member.id === id);
  const available = divers.filter(({ member }) => !isInTeam(member.id));
  const options: (ComboboxOption & { diver: DiveFormDiverOption })[] = available.map((diver) => ({
    id: diver.member.id,
    label: fullName(diver.member),
    meta: formatDiveCount(diver.count),
    diver,
  }));
  const frequent = frequentDivers.filter(({ member }) => !isInTeam(member.id));

  const add = (member: NewMember) => {
    form.addMember(member);
    setQuery('');
  };

  return (
    <FormSection
      section="team"
      optional
      collapse={collapse}
      aside={<span className={styles.count}>{teamSizeLabel(teamCount(form.values))}</span>}
    >
      <ul className={styles.list} aria-label="Membres de la palanquée">
        <li className={styles.member}>
          <Avatar
            initials={formatInitials(self.firstName, self.lastName)}
            tone="neutral"
            size="sm"
          />
          <span className={styles.name}>
            {fullName(self)}
            <span className={styles.self}> · toi</span>
          </span>
          {self.level !== null && <Badge>{self.level}</Badge>}
          <span className={styles.spacer} />
        </li>
        {team.map((member) => {
          const name = fullName(member);
          return (
            <li key={member.key} className={styles.member}>
              <Avatar
                initials={formatInitials(member.firstName, member.lastName)}
                color={avatarColorOf(member.id ?? member.key)}
                size="sm"
              />
              <span className={styles.name}>{name}</span>
              <Select
                variant="outlined"
                label={`Niveau de ${name}`}
                options={LEVEL_OPTIONS}
                value={member.level}
                onChange={(level) => form.setMemberLevel(member.key, level)}
                disabled={binding.locked}
              />
              <IconButton
                icon="close"
                iconSize="sm"
                label={`Retirer ${name}`}
                className={styles.remove}
                onClick={() => form.removeMember(member.key)}
                disabled={binding.locked}
              />
            </li>
          );
        })}
      </ul>
      <FormField label="Ajouter un plongeur" {...binding}>
        <Combobox
          options={options}
          inputValue={query}
          onInputChange={setQuery}
          onSelect={(option) => add(memberFromOption(option.diver))}
          create={{
            label: (name) => `Ajouter « ${name} »`,
            description: 'Nouveau plongeur, par son nom',
            onCreate: (name) => add(memberFromName(name)),
          }}
          groupLabel="Déjà rencontrés"
          icon="plus"
          optionIcon="users"
          placeholder="Nom d’un plongeur…"
        />
      </FormField>
      {frequent.length > 0 && !binding.locked && (
        <div className={styles.frequent}>
          <span className={styles.frequentLabel} id={frequentLabelId}>
            Fréquents :
          </span>
          <ul className={styles.chips} aria-labelledby={frequentLabelId}>
            {frequent.map((diver) => (
              <li key={diver.member.id}>
                <Chip
                  icon={<Icon name="plus" size="xs" />}
                  aria-label={`Ajouter ${fullName(diver.member)}`}
                  onClick={() => add(memberFromOption(diver))}
                >
                  {fullName(diver.member)}
                </Chip>
              </li>
            ))}
          </ul>
        </div>
      )}
    </FormSection>
  );
}
