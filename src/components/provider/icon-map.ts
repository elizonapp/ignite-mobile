import {
  ArrowUpCircle,
  Download,
  Pause,
  Play,
  RefreshCcw,
  Square,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * ActionBinding.icon carries a HeroIcon name (the schema is shared with the
 * web dashboard). Map the ones provider modules emit to the lucide icons the
 * mobile app already ships with.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  PlayIcon: Play,
  StopIcon: Square,
  ArrowPathIcon: RefreshCcw,
  PauseIcon: Pause,
  TrashIcon: Trash2,
  BoltIcon: Zap,
  CommandLineIcon: Terminal,
  ArrowDownTrayIcon: Download,
  ArrowUpCircleIcon: ArrowUpCircle,
};

export function resolveActionIcon(name: string): LucideIcon {
  return ICON_MAP[name] ?? Zap;
}
