import { Button } from './Button';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function HomeSkeleton() {
  return (
    <div className="space-y-4 px-5 pt-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

export function ErrorState({ onRetry, message = 'Что-то пошло не так. Попробуйте ещё раз.' }: { onRetry: () => void; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center gap-4 screen-enter">
      <p className="text-sali-gray-300 text-[15px]">{message}</p>
      <Button onClick={onRetry} fullWidth={false} className="px-8">Повторить</Button>
    </div>
  );
}
