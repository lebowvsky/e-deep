import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Combobox, type ComboboxOption } from '@/shared/ui/Combobox';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { DateInput } from '@/shared/ui/DateInput';
import { FormField } from '@/shared/ui/FormField';
import { NumberInput } from '@/shared/ui/NumberInput';
import { Overline } from '@/shared/ui/Overline';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Switch } from '@/shared/ui/Switch';
import { TagInput } from '@/shared/ui/TagInput';
import { Textarea } from '@/shared/ui/Textarea';
import { TextInput } from '@/shared/ui/TextInput';
import { TimeInput } from '@/shared/ui/TimeInput';
import styles from './FormPreview.module.scss';

const SITES: ComboboxOption[] = [
  {
    id: 'revellata',
    label: 'Pointe de la Revellata',
    description: 'Calvi · Corse',
    meta: '8 plongées',
  },
  {
    id: 'corbs',
    label: 'Revellata — Grotte aux Corbs',
    description: 'Calvi · Corse',
    meta: '1 plongée',
  },
  {
    id: 'bibliotheque',
    label: 'La Bibliothèque',
    description: 'Calvi · Corse',
    meta: '12 plongées',
  },
];

const DIVERS: ComboboxOption[] = [
  { id: 'elise', label: 'Élise Marchand', meta: '14 plongées' },
  { id: 'remi', label: 'Rémi Pascal', meta: '9 plongées' },
];

const GASES = [
  { value: 'air', label: 'Air' },
  { value: 'nitrox', label: 'Nitrox' },
] as const;

const SUITS = [
  { value: 'wet', label: 'Humide' },
  { value: 'semidry', label: 'Semi-étanche' },
  { value: 'dry', label: 'Étanche' },
] as const;

const MATERIALS = [
  { value: 'steel', label: 'Acier' },
  { value: 'alu', label: 'Alu' },
] as const;

const LONG_NOTE =
  'Mise à l’eau au tombant, remontée le long de la faille. Mérou brun sous la voûte, murènes.';

/** L'essentiel (dive-form.jsx · SecEssentiel): default, filled, warning and error fields. */
function EssentialPreview() {
  const [site, setSite] = useState('La Bibliothèque');
  const [chosen, setChosen] = useState<ComboboxOption | null>(SITES[2] ?? null);
  const [number, setNumber] = useState('128');
  const [duration, setDuration] = useState('44');
  const [depth, setDepth] = useState('41');

  return (
    <Card padding="lg" className={styles.card}>
      <Overline>Champs · L&apos;essentiel</Overline>
      {/* Grid: the mockup's field rows (site + number, date + times, duration + depth). */}
      <div className={styles.siteRow}>
        <FormField label="Site" required hint="Tes sites, ou un nouveau site créé à la volée.">
          <Combobox
            options={SITES}
            inputValue={site}
            onInputChange={(text) => {
              setSite(text);
              setChosen(null);
            }}
            onSelect={(option) => {
              setSite(option.label);
              setChosen(option);
            }}
            create={{
              label: (query) => `Créer le site « ${query} »`,
              description: 'Nom, région et position à préciser ensuite',
              onCreate: (query) => {
                setSite(query);
                setChosen(null);
              },
            }}
            groupLabel="Mes sites"
            icon="pin"
            optionIcon="pin"
            placeholder="Rechercher un site…"
            end={chosen && <span className={styles.region}>{chosen.description}</span>}
          />
        </FormField>
        <FormField label="N° de plongée" hint="Suit ton carnet.">
          <NumberInput value={number} onValueChange={setNumber} unit="#" />
        </FormField>
      </div>
      <div className={styles.timeRow}>
        <FormField label="Date" required>
          <DateInput defaultValue="2026-04-09" />
        </FormField>
        <FormField label="Immersion" required>
          <TimeInput defaultValue="10:05" />
        </FormField>
        <FormField label="Sortie" required>
          <TimeInput defaultValue="10:49" />
        </FormField>
      </div>
      <div className={styles.thirds}>
        <FormField label="Durée" hint="Calculée depuis les heures — modifiable.">
          <NumberInput
            value={duration}
            onValueChange={setDuration}
            icon="link"
            unit="min"
            unitLabel="minutes"
          />
        </FormField>
        <FormField
          label="Profondeur max"
          required
          warning="Au-delà de 40 m, limite d'un N2 encadré. Vérifie la valeur."
        >
          <NumberInput value={depth} onValueChange={setDepth} decimal unit="m" unitLabel="mètres" />
        </FormField>
      </div>
      <div className={styles.halves}>
        <FormField
          label="Site"
          required
          error="Choisis un site ou crée-en un nouveau pour enregistrer la plongée."
        >
          <TextInput icon="pin" placeholder="Rechercher un site…" />
        </FormField>
        <FormField label="Sortie" required error="La sortie doit être après l'immersion (10:05).">
          <TimeInput defaultValue="09:49" />
        </FormField>
      </div>
    </Card>
  );
}

/** Équipement & gaz (dive-form.jsx · SecEquipement): segmented, locked and focused fields. */
function EquipmentPreview() {
  const [gas, setGas] = useState<(typeof GASES)[number]['value']>('air');
  const [material, setMaterial] = useState<(typeof MATERIALS)[number]['value']>('steel');
  const [suit, setSuit] = useState<(typeof SUITS)[number]['value']>('semidry');
  const [o2, setO2] = useState('21');
  const [tank, setTank] = useState('12');
  const [start, setStart] = useState('200');
  const [end, setEnd] = useState('');
  const [water, setWater] = useState('-1,5');
  const isAir = gas === 'air';

  return (
    <Card padding="lg" className={styles.card}>
      <Overline>Champs · Équipement & gaz</Overline>
      <div className={styles.gasRow}>
        <FormField label="Gaz">
          <SegmentedControl variant="field" options={GASES} value={gas} onChange={setGas} />
        </FormField>
        <FormField label="% O₂" hint={isAir ? 'Air = 21 %' : 'Nitrox : 22 à 40 %'} locked={isAir}>
          <NumberInput value={isAir ? '21' : o2} onValueChange={setO2} unit="%" />
        </FormField>
      </div>
      <div className={styles.halves}>
        <FormField label="Bloc">
          <NumberInput value={tank} onValueChange={setTank} unit="L" unitLabel="litres" />
        </FormField>
        <FormField label="Matériau">
          <SegmentedControl
            variant="field"
            options={MATERIALS}
            value={material}
            onChange={setMaterial}
          />
        </FormField>
      </div>
      <div className={styles.halves}>
        <FormField label="Pression début">
          <NumberInput value={start} onValueChange={setStart} unit="bar" />
        </FormField>
        <FormField label="Pression fin" hint="→ bar consommés calculés à l'enregistrement">
          <NumberInput value={end} onValueChange={setEnd} unit="bar" placeholder="—" />
        </FormField>
      </div>
      <FormField label="Type de combinaison">
        <SegmentedControl variant="field" options={SUITS} value={suit} onChange={setSuit} />
      </FormField>
      <div className={styles.halves}>
        <FormField label="Eau fond" hint="Décimal signé : −2 à 35 °C.">
          <NumberInput value={water} onValueChange={setWater} decimal signed unit="°C" />
        </FormField>
        <FormField label="Structure" hint="Désactivé">
          <TextInput defaultValue="Calvi Plongée" disabled />
        </FormField>
      </div>
      <FormField
        label="Mise à l'eau"
        locked
        hint="Partagé avec la palanquée — modifiable par la personne qui a créé la plongée"
      >
        <SegmentedControl
          variant="field"
          options={[
            { value: 'boat', label: 'Bateau' },
            { value: 'shore', label: 'Bord' },
          ]}
          value="boat"
          onChange={() => {}}
        />
      </FormField>
    </Card>
  );
}

/** Déroulé, palanquée and notes: switches, diver combobox, tags, textarea, exit dialog. */
function MorePreview() {
  const [safetyStop, setSafetyStop] = useState(true);
  const [deco, setDeco] = useState(false);
  const [diver, setDiver] = useState('');
  const [team, setTeam] = useState<string[]>(['Lucas Bernard']);
  const [species, setSpecies] = useState(['Mérou brun', 'Gorgones rouges']);
  const [notes, setNotes] = useState('');
  const [longNotes, setLongNotes] = useState(LONG_NOTE);
  const [confirming, setConfirming] = useState(false);

  const addDiver = (name: string) => {
    setTeam((current) => (current.includes(name) ? current : [...current, name]));
    setDiver('');
  };

  return (
    <Card padding="lg" className={styles.card}>
      <Overline>Interrupteurs · combobox · étiquettes · notes · dialogue</Overline>
      <div className={styles.switches}>
        <Switch
          checked={safetyStop}
          onCheckedChange={setSafetyStop}
          label="Palier de sécurité"
          hint="Fait pendant la remontée"
        />
        <Switch
          checked={deco}
          onCheckedChange={setDeco}
          label="Paliers de décompression"
          hint="Imposés par ton ordinateur ou tes tables"
        />
        <Switch
          checked={false}
          onCheckedChange={() => {}}
          label="Plongée successive"
          hint="Désactivé"
          disabled
        />
      </div>
      <FormField label="Ajouter un plongeur" hint={`Palanquée : ${team.join(', ')}`}>
        <Combobox
          options={DIVERS.filter((option) => !team.includes(option.label))}
          inputValue={diver}
          onInputChange={setDiver}
          onSelect={(option) => addDiver(option.label)}
          create={{
            label: (query) => `Ajouter « ${query} »`,
            description: 'Nouveau plongeur, par son nom',
            onCreate: addDiver,
          }}
          groupLabel="Déjà rencontrés"
          optionIcon="users"
          placeholder="Nom d'un plongeur…"
        />
      </FormField>
      <FormField
        label="Espèces observées"
        hint="Entrée pour ajouter · suggestions depuis tes plongées précédentes"
      >
        <TagInput
          values={species}
          onValuesChange={setSpecies}
          suggestions={['Mérou brun', 'Murène', 'Poulpe', 'Barracuda', 'Saupe']}
        />
      </FormField>
      <FormField label="Notes">
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ce que tu as vu, ressenti, ce que tu veux retenir…"
        />
      </FormField>
      <FormField label="Notes (compteur dès 40 caractères pour la démo)">
        <Textarea
          value={longNotes}
          counterFrom={40}
          onChange={(event) => setLongNotes(event.target.value)}
        />
      </FormField>
      <div>
        <Button onClick={() => setConfirming(true)}>Annuler la saisie…</Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Quitter sans enregistrer ?"
        description="Ton brouillon reste disponible sur cet appareil."
        cancelLabel="Rester"
        confirmLabel="Quitter"
        onCancel={() => setConfirming(false)}
        onConfirm={() => setConfirming(false)}
      />
    </Card>
  );
}

/** Form primitives of the dive form, in all their states. */
export function FormPreview() {
  return (
    <section className={styles.section} aria-labelledby="form-preview-title">
      <h2 id="form-preview-title" className={styles.title}>
        Formulaire
      </h2>
      <div className={styles.grid}>
        <EssentialPreview />
        <EquipmentPreview />
        <MorePreview />
      </div>
    </section>
  );
}
