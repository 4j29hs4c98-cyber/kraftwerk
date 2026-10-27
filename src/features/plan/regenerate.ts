import { toTrainingProfile, type ProfileRow } from '../profile/types'
import { savePlan } from './api'
import { generatePlan } from './generator'
import { fromGenerated } from './planModel'

export async function regeneratePlan(profile: ProfileRow): Promise<void> {
  const training = toTrainingProfile(profile)
  if (!training) throw new Error('Trainingsdaten im Profil sind unvollständig.')
  await savePlan(fromGenerated(generatePlan(training)))
}
