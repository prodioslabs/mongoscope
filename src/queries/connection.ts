import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { connectionStore, type AddConnectionInput } from '../connections'

export const connectionKeys = {
  all: ['connections'] as const,
  list: () => [...connectionKeys.all, 'list'] as const,
}

export function useConnectionsList() {
  return useQuery({
    queryKey: connectionKeys.list(),
    queryFn: () => connectionStore.list(),
  })
}

export function useAddConnection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AddConnectionInput) => connectionStore.add(input),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.list() })
    },
  })
}

export function useRemoveConnection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => connectionStore.remove(id),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: connectionKeys.list() })
    },
  })
}
