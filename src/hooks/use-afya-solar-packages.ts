import { useQuery } from "@tanstack/react-query"

export function useAfyaSolarPackages() {
  return useQuery({
    queryKey: ['afya-solar-packages'],
    queryFn: async () => {
      const response = await fetch('/api/afya-solar/packages')
      if (!response.ok) {
        throw new Error('Failed to fetch Afya Solar packages')
      }
      const result = await response.json()
      return result.packages || []
    },
    initialData: [],
  })
}
