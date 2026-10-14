/**
 * ช่วงความยาก (skillLevel 1–5) ของข้อ pretest ตามระดับประสบการณ์ (expForGoal 1–5) ที่ผู้เรียนเลือกใน branch
 * exp N → skillLevel N-1..N+1 (เช่น exp 2 → 1, 2, 3; exp 1 → 1, 2; exp 5 → 4, 5)
 * ถ้าในช่วงนั้นไม่มีข้อเลย จะขยายช่วงออกทีละ 1 จนเจอข้อ เพื่อไม่ให้หลุดไปสุ่มทั้งคลัง
 */
export class PretestDifficulty {
  static readonly MIN_LEVEL = 1;
  static readonly MAX_LEVEL = 5;
  static readonly SPREAD = 1;

  static filterByExp<T extends { skillLevel: number }>(
    exercises: T[],
    exp?: number | string | null,
  ): T[] {
    const n = Number(exp);
    if (exp === undefined || exp === null || exp === '' || Number.isNaN(n)) {
      return exercises;
    }
    const center = Math.min(this.MAX_LEVEL, Math.max(this.MIN_LEVEL, n));

    for (
      let spread = this.SPREAD;
      spread <= this.MAX_LEVEL - this.MIN_LEVEL;
      spread++
    ) {
      const inRange = exercises.filter(
        (ex) => Math.abs(ex.skillLevel - center) <= spread,
      );
      if (inRange.length > 0) return inRange;
    }
    return exercises;
  }
}
