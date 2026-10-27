import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { LoadingState } from '../components/States'
import { AuthPage } from '../features/auth/AuthPage'
import { LandingPage } from '../features/home/LandingPage'
import { NotFoundPage } from '../features/home/NotFoundPage'
import { AppLayout } from './AppLayout'
import { RequireAuth, RequireOnboarded, RequireNotOnboarded } from './guards'

// Seiten hinter dem Login werden erst bei Bedarf geladen.
const TodayPage = lazy(() => import('../features/home/TodayPage').then((m) => ({ default: m.TodayPage })))
const NutritionPage = lazy(() => import('../features/nutrition/NutritionPage').then((m) => ({ default: m.NutritionPage })))
const OnboardingPage = lazy(() => import('../features/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const PlanPage = lazy(() => import('../features/plan/PlanPage').then((m) => ({ default: m.PlanPage })))
const ProfilePage = lazy(() => import('../features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const ProgressPage = lazy(() => import('../features/progress/ProgressPage').then((m) => ({ default: m.ProgressPage })))
const WorkoutPage = lazy(() => import('../features/workout/WorkoutPage').then((m) => ({ default: m.WorkoutPage })))

export function App() {
  return (
    <Suspense fallback={<LoadingState />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/anmelden" element={<AuthPage mode="login" />} />
      <Route path="/registrieren" element={<AuthPage mode="register" />} />
      <Route element={<RequireAuth />}>
        <Route element={<RequireNotOnboarded />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>
        <Route element={<RequireOnboarded />}>
          <Route path="/training/:dayId" element={<WorkoutPage />} />
          <Route element={<AppLayout />}>
            <Route path="/heute" element={<TodayPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/ernaehrung" element={<NutritionPage />} />
            <Route path="/fortschritt" element={<ProgressPage />} />
            <Route path="/profil" element={<ProfilePage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/start" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  )
}
