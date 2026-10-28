import { describe, expect, it } from 'vitest'
import { activityFactor, ageFromBirthYear, calculateTarget, kcalFloor, macroTargets, mifflinStJeor } from './calc'

describe('mifflinStJeor', () => {
  it('men: 10w + 6.25h - 5a + 5', () => {
    expect(mifflinStJeor('m', 80, 180, 30)).toBe(1780)
  })
  it('women: 10w + 6.25h - 5a - 161', () => {
    expect(mifflinStJeor('w', 60, 165, 25)).toBeCloseTo(1345.25)
  })
  it('diverse sits between both', () => {
    const d = mifflinStJeor('d', 70, 170, 30)
    expect(d).toBeGreaterThan(mifflinStJeor('w', 70, 170, 30))
    expect(d).toBeLessThan(mifflinStJeor('m', 70, 170, 30))
  })
})

describe('activityFactor', () => {
  it('rises with training days', () => {
    const factors = [2, 3, 4, 5, 6].map(activityFactor)
    expect([...factors].sort()).toEqual(factors)
    expect(factors[0]).toBe(1.375)
    expect(factors[4]).toBe(1.725)
  })
})

describe('calculateTarget', () => {
  const base = { sex: 'm' as const, weightKg: 80, heightCm: 180, age: 30, daysPerWeek: 4 }

  it('muscle gain: TDEE + 300 kcal and 1.8 g protein/kg', () => {
    const t = calculateTarget({ ...base, goal: 'muskelaufbau' })
    expect(t.bmr).toBe(1780)
    expect(t.tdee).toBe(2759) // 1780 * 1.55
    expect(t.kcal).toBe(3060) // 3059 auf 10 gerundet
    expect(t.proteinG).toBe(144)
  })

  it('fat loss: TDEE - 400 kcal and 2.0 g protein/kg', () => {
    const t = calculateTarget({ ...base, goal: 'fett_verlieren' })
    expect(t.kcal).toBe(2360)
    expect(t.proteinG).toBe(160)
  })

  it('fitness: maintenance', () => {
    const t = calculateTarget({ ...base, goal: 'fitness' })
    expect(t.kcal).toBe(2760)
  })
})

describe('kcal floor', () => {
  it('never goes below 1200 kcal for women', () => {
    // BMR 10*45 + 6.25*150 - 5*60 - 161 = 926.5, TDEE 1274, minus 400 = 874
    const t = calculateTarget({ sex: 'w', weightKg: 45, heightCm: 150, age: 60, daysPerWeek: 2, goal: 'fett_verlieren' })
    expect(t.kcal).toBe(1200)
  })

  it('never goes below 1500 kcal for men and diverse', () => {
    const small = { weightKg: 50, heightCm: 155, age: 70, daysPerWeek: 2, goal: 'fett_verlieren' as const }
    expect(calculateTarget({ ...small, sex: 'm' }).kcal).toBe(1500)
    expect(calculateTarget({ ...small, sex: 'd' }).kcal).toBe(1500)
  })

  it('never goes below the basal metabolic rate', () => {
    // BMR 10*150 + 6.25*200 - 5*20 + 5 = 2655, TDEE 3650, minus 400 = 3250: no floor needed
    expect(calculateTarget({ sex: 'm', weightKg: 150, heightCm: 200, age: 20, daysPerWeek: 2, goal: 'fett_verlieren' }).kcal).toBe(3250)
    expect(kcalFloor('m', 2655)).toBe(2660)
    expect(kcalFloor('w', 1100)).toBe(1200)
  })
})

describe('ageFromBirthYear', () => {
  it('uses the current year', () => {
    expect(ageFromBirthYear(2009, new Date(2026, 9, 27))).toBe(17)
  })
})

describe('macroTargets', () => {
  it('fat is 25 % of kcal, carbs fill the rest after protein and fat', () => {
    // Fett 2400 * 0,25 / 9 = 66,7 -> 67 g; Rest 2400 - 160*4 - 67*9 = 1157 kcal -> 289 g
    expect(macroTargets(2400, 160)).toEqual({ proteinG: 160, fatG: 67, carbsG: 289 })
  })
  it('never returns negative carbs', () => {
    expect(macroTargets(1200, 300).carbsG).toBe(0)
  })
})
