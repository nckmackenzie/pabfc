import { CustomDropdownContent } from '@/components/ui/custom-dropdown-content'
import { CustomDropdownTrigger } from '@/components/ui/custom-dropdown-trigger'
import { DropdownMenu } from '@/components/ui/dropdown-menu'

export function DatatableActions({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <DropdownMenu>
        <CustomDropdownTrigger />
        <CustomDropdownContent>{children}</CustomDropdownContent>
      </DropdownMenu>
    </div>
  )
}
