import { Control } from "react-hook-form"
import { z } from "zod"
import { equipmentSchema } from "@/hooks/use-admin-equipment"
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

interface SpecificationsFormProps {
  control: Control<z.infer<typeof equipmentSchema> & { id?: string }>
  isSubmitting: boolean
}

export function SpecificationsForm({ control, isSubmitting }: SpecificationsFormProps) {
  const currentYear = new Date().getFullYear()
  const years = Array.from(
    { length: 30 },
    (_, i) => currentYear - i
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="specifications.manufacturer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Manufacturer</FormLabel>
              <FormControl>
                <Input
                  placeholder="Manufacturer name"
                  disabled={isSubmitting}
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="specifications.serialNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Serial Number</FormLabel>
              <FormControl>
                <Input
                  placeholder="Serial number"
                  disabled={isSubmitting}
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField
          control={control}
          name="specifications.modelYear"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model Year</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={currentYear - 30}
                  max={currentYear}
                  placeholder={currentYear.toString()}
                  disabled={isSubmitting}
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => field.onChange(parseInt(e.target.value) || '')}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="specifications.weight"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Weight (kg)</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="e.g., 25.5 kg"
                  disabled={isSubmitting}
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="specifications.dimensions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dimensions (L x W x H)</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., 50 x 60 x 80 cm"
                  disabled={isSubmitting}
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="specifications.power"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Power Requirements</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., 110-240V, 50/60Hz, 300W"
                disabled={isSubmitting}
                {...field}
                value={field.value || ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
