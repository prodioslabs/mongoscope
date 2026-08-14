import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { queryClient } from '../lib/query-client'

type QueryProviderProps = {
  children?: ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
