import { ClosingCta } from './_components/closing-cta'
import { FeaturesSection } from './_components/features-section'
import { Hero } from './_components/hero'
import { HomeProvider } from './_components/home-provider'
import { InstallSteps } from './_components/install-steps'
import { KeyboardSection } from './_components/keyboard-section'
import { SiteFooter } from './_components/site-footer'

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
