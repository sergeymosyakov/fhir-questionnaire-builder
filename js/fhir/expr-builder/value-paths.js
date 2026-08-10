// Maps a builder item type to the QuestionnaireResponse answer value accessor —
// the string that follows `.answer.` in a FHIRPath item reference. This is the
// core value-add: the user never types `.valueDecimal` / `.valueCoding.code`.

const VALUE_FIELD = {
  text: 'valueString',
  string: 'valueString',
  integer: 'valueInteger',
  decimal: 'valueDecimal',
  boolean: 'valueBoolean',
  checkbox: 'valueBoolean',
  date: 'valueDate',
  dateTime: 'valueDateTime',
  time: 'valueTime',
  url: 'valueUri',
  attachment: 'valueAttachment',
  quantity: 'valueQuantity',
  select: 'valueCoding',
  radio: 'valueCoding',
  'open-choice': 'valueCoding',
  checklist: 'valueCoding',
  reference: 'valueReference',
};

// Leaf appended after the value field for a comparable scalar.
const VALUE_LEAF = {
  valueQuantity: 'value',
  valueCoding: 'code',
  valueReference: 'reference',
};

export function valueField(itemType) {
  return VALUE_FIELD[itemType] || null;
}

// `display` has no answer; everything else does.
export function hasAnswer(itemType) {
  return VALUE_FIELD[itemType] != null;
}

// Accessor after `.answer.`; leaf=true drills to the comparable scalar.
export function valueAccessor(itemType, { leaf = true } = {}) {
  const field = VALUE_FIELD[itemType];
  if (!field) return null;
  const sub = leaf ? VALUE_LEAF[field] : null;
  return sub ? `${field}.${sub}` : field;
}
