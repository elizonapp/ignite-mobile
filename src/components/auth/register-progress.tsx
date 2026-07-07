type RegisterProgressProps = {
  step: number;
};

function barClass(index: number, step: number) {
  if (index < step) return "bg-(--primary)/50";
  if (index === step) return "bg-(--primary)";
  return "bg-(--border)";
}

export function RegisterProgress({ step }: RegisterProgressProps) {
  return (
    <div className="mb-6 flex items-center gap-2">
      {[0, 1, 2].map((index) => (
        <div key={index} className={`h-1.5 flex-1 rounded-full transition-colors ${barClass(index, step)}`} />
      ))}
    </div>
  );
}
