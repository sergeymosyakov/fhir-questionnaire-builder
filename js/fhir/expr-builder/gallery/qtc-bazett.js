// QTc (Bazett) gallery pattern — see ../gallery/index.js for the shape.
// Bazett 1920: QTc = QT / sqrt(RR), RR = 60 / heart rate (seconds).
export const qtcBazett = {
  id: 'qtc-bazett',
  name: 'QTc (Bazett)',
  description: 'QT interval corrected for heart rate: QT ÷ √RR, in ms — over-corrects at fast heart rates.',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'qt', label: 'QT interval item (ms)', transforms: [] },
    { key: 'hr', label: 'Heart rate item (bpm)', transforms: [] },
  ],
  template: '(%qt% / (60 / %hr%).sqrt()).round(0)',
};
