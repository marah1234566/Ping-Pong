export const PHYSICS = Object.freeze({
  m:      0.0027,
  r:      0.02,
  rho:    1.2,
  Cd:     0.47,
  A:      Math.PI * 0.02 * 0.02,
  g:      9.81,
  e:      0.85,
  mu:     0.4,
  beta:   0.1,
  Sm: 0.0003,   // ← قوة ماغنوس أقوى تتناسب مع الطاولة والسرعات الأكبر
  tableH: 1.0,
  tableL: 9.0,
  tableW: 5.2,
  tableThickness: 0.05,   // ← جديد: سماكة سطح الطاولة (كانت 0.03 محلية بالملف القديم)
});