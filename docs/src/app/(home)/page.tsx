import dynamic from 'next/dynamic'
import { Hero } from './_components/hero'
import { HomeProvider } from './_components/home-provider'
import { SiteFooter } from './_components/site-footer'

// Below-fold demos are client-heavy; keep them out of the initial home chunk so LCP/TBT
// are dominated by the hero + TUI preview instead of every feature card.
const FeaturesSection = dynamic(() =>
  import('./_components/features-section').then((module) => module.FeaturesSection),
)
const InstallSteps = dynamic(() =>
  import('./_components/install-steps').then((module) => module.InstallSteps),
)
const KeyboardSection = dynamic(() =>
  import('./_components/keyboard-section').then((module) => module.KeyboardSection),
)
const ClosingCta = dynamic(() =>
  import('./_components/closing-cta').then((module) => module.ClosingCta),
)

export default function HomePage() {
  return (
    <HomeProvider>
      <Hero />
      <FeaturesSection />
      <InstallSteps />
      <KeyboardSection />
      <ClosingCta />
      <SiteFooter />
    </HomeProvider>
  )
}
