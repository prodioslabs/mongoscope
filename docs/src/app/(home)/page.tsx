import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1">
      <h1 className="text-2xl font-bold mb-4">MongoScope</h1>
      <p className="mb-2 text-fd-muted-foreground">
        Terminal UI for inspecting MongoDB slow queries, live operations, replication, indexes, and
        logs.
      </p>
      <p>
        Open{' '}
        <Link href="/docs" className="font-medium underline">
          /docs
        </Link>{' '}
        for the full reference.
      </p>
    </div>
  )
}
