// QTc (Fridericia) gallery pattern — see ../gallery/index.js for the shape.
// Fridericia 1920: QTc = QT / RR^(1/3), RR = 60 / heart rate (seconds).
export const qtcFridericia = {
  id: 'qtc-fridericia',
  name: 'QTc (Fridericia)',
  description: 'QT interval corrected for heart rate: QT ÷ RR¹ᐟ³, in ms — steadier than Bazett at fast or slow rates.',
  itemTypes: ['integer', 'decimal', 'quantity'],
  slots: [
    { key: 'qt', label: 'QT interval item (ms)', transforms: [] },
    { key: 'hr', label: 'Heart rate item (bpm)', transforms: [] },
  ],
  template: '(%qt% / (60 / %hr%).power(1 / 3)).round(0)',
};
