import type { LucideIcon } from "lucide-react";
import {
  UserPlus,
  TrendingUp,
  CircleDollarSign,
  Cpu,
  Megaphone,
  UserCog,
  ClipboardList,
  Scale,
  Handshake,
  Award,
  Calendar,
  Target,
  CircleDot,
} from "lucide-react";

export const SIGNAL_CATEGORY_LABEL: Record<string, string> = {
  HIRING: "Contratação",
  EXPANSION: "Expansão",
  FUNDING: "Investimento",
  TECHNOLOGY: "Tecnologia",
  MARKETING: "Marketing",
  LEADERSHIP_CHANGE: "Mudança de liderança",
  PROCUREMENT: "Licitação/Edital",
  REGULATORY: "Regulatório",
  PARTNERSHIP: "Parceria",
  AWARD: "Premiação",
  EVENT: "Evento",
  ICP_MATCH: "Fit de ICP",
  OTHER: "Outro",
};

export const SIGNAL_CATEGORY_ICON: Record<string, LucideIcon> = {
  HIRING: UserPlus,
  EXPANSION: TrendingUp,
  FUNDING: CircleDollarSign,
  TECHNOLOGY: Cpu,
  MARKETING: Megaphone,
  LEADERSHIP_CHANGE: UserCog,
  PROCUREMENT: ClipboardList,
  REGULATORY: Scale,
  PARTNERSHIP: Handshake,
  AWARD: Award,
  EVENT: Calendar,
  ICP_MATCH: Target,
  OTHER: CircleDot,
};

export const SIGNAL_CATEGORIES = Object.keys(SIGNAL_CATEGORY_LABEL);
