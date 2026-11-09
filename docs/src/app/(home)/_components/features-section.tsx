import { ExportDemo } from './export-demo'
import { FeatureDemosProvider } from './feature-demos-context'
import { IndexesDemo } from './indexes-demo'
import { LiveOpsDemo } from './live-ops-demo'
import { LogsDemo } from './logs-demo'
import { ReplicationDemo } from './replication-demo'
import { HomeSection, SectionHeading } from './section'
import { SlowQueriesDemo } from './slow-queries-demo'

export function FeaturesSection() {
  return (
    <HomeSection id="features" labelledBy="features-heading">
      <SectionHeading
        id="features-heading"
        eyebrow="What you get"
        title="Five views. One keystroke apart."
        description="Every card below is a working demo. Click the controls, or hover a card and use the same keys as the app."
      />
      <FeatureDemosProvider>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          <SlowQueriesDemo className="md:col-span-2" />
          <LiveOpsDemo />
          <ReplicationDemo />
          <IndexesDemo />
          <ExportDemo />
          <LogsDemo className="md:col-span-2 xl:col-span-3" />
        </div>
      </FeatureDemosProvider>
    </HomeSection>
  )
}
