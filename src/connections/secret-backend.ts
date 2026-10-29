/** Low-level backend — injectable for tests; never logs secret values. */
export type SecretBackend = {
  get(options: { service: string; name: string }): Promise<string | null>
  set(options: { service: string; name: string; value: string }): Promise<void>
  delete(options: { service: string; name: string }): Promise<boolean>
}
