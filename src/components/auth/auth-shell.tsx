import { AuthBrandPanel } from "./auth-brand-panel";

type AuthShellProps = {
  children: React.ReactNode;
  variant?: "login" | "register";
};

export function AuthShell({ children, variant = "login" }: AuthShellProps) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:min-h-[calc(100dvh-4.5rem)] lg:flex-row lg:items-stretch lg:gap-10 xl:gap-14">
      <aside className="hidden shrink-0 lg:flex lg:w-[42%] xl:w-[44%]">
        <div className="flex h-full min-h-full w-full flex-col rounded-surface border border-(--border) bg-(--bg-card)/80">
          <AuthBrandPanel variant={variant} />
        </div>
      </aside>

      <div className="flex flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:px-0 lg:py-12">
        <div className="mb-8 lg:hidden">
          <AuthBrandPanel compact variant={variant} />
        </div>
        <div className="mx-auto w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
