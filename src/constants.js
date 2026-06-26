export const PHYSICS = Object.freeze({
  m:      0.0027,
  r:      0.02,
  rho:    1.2,
  Cd:     0.5,
  A:      Math.PI * 0.02 * 0.02,
  g:      9.81,
  e:      0.85,
  mu:     0.4,
  beta:   0.1,
  Sm: 0.0003,   // ← قوة ماغنوس أقوى تتناسب مع الطاولة والسرعات الأكبر
  tableH: 0.76,
  tableL: 5.5,
  tableW: 2.8,
  tableThickness: 0.08,   // ← جديد: سماكة سطح الطاولة (كانت 0.03 محلية بالملف القديم)
});