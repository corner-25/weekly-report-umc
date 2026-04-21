import {
  Activity, Stethoscope, HeartPulse, ShieldPlus, Pill, Briefcase, Users, Scale,
  Package, BadgeCheck, TrendingUp, Wallet, Megaphone, GraduationCap, HandHeart,
  Laptop, Building, Building2, MapPin, Hospital, Microscope, Syringe, Baby,
  Brain, Ear, Eye, Bone, Wind, Droplets, Soup, UserCog, FlaskConical, Scissors,
  type LucideIcon,
} from 'lucide-react';

export type DeptPalette = 'rose' | 'blue' | 'amber' | 'emerald' | 'violet' | 'slate';

export interface DeptVisual {
  icon: LucideIcon;
  palette: DeptPalette;
}

export const PALETTE_STYLES: Record<DeptPalette, { bg: string; text: string; ring: string; bar: string }> = {
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    ring: 'ring-rose-100',    bar: 'bg-rose-400' },
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-100',    bar: 'bg-blue-400' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-100',   bar: 'bg-amber-400' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100', bar: 'bg-emerald-400' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  ring: 'ring-violet-100',  bar: 'bg-violet-400' },
  slate:   { bg: 'bg-slate-100',  text: 'text-slate-600',   ring: 'ring-slate-200',   bar: 'bg-slate-300' },
};

// Ordered rules — first match wins. Match against lowercased, normalized dept name.
const RULES: Array<{ test: RegExp; visual: DeptVisual }> = [
  // === Phòng chức năng (blue / admin) ===
  { test: /kế hoạch tổng hợp|kht/i,             visual: { icon: Activity,      palette: 'rose' } },
  { test: /điều dưỡng/i,                         visual: { icon: HeartPulse,    palette: 'rose' } },
  { test: /bảo hiểm y tế|bhyt/i,                 visual: { icon: ShieldPlus,    palette: 'rose' } },
  { test: /khoa học.*đào tạo|đào tạo/i,          visual: { icon: GraduationCap, palette: 'violet' } },
  { test: /công tác xã hội|ctxh/i,               visual: { icon: HandHeart,     palette: 'violet' } },
  { test: /truyền thông/i,                       visual: { icon: Megaphone,     palette: 'violet' } },
  { test: /công nghệ thông tin|cntt/i,           visual: { icon: Laptop,        palette: 'violet' } },
  { test: /hành chính/i,                         visual: { icon: Briefcase,     palette: 'blue' } },
  { test: /tổ chức cán bộ|tccb|pháp chế/i,       visual: { icon: Users,         palette: 'blue' } },
  { test: /quản trị tòa nhà|quản trị toà nhà/i,  visual: { icon: Building,      palette: 'amber' } },
  { test: /vật tư.*thiết bị|vttb/i,              visual: { icon: Package,       palette: 'amber' } },
  { test: /quản lý chất lượng|qlcl/i,            visual: { icon: BadgeCheck,    palette: 'amber' } },
  { test: /tài chính kế toán|tckt/i,             visual: { icon: Wallet,        palette: 'emerald' } },
  { test: /đấu thầu/i,                           visual: { icon: TrendingUp,    palette: 'emerald' } },

  // === Đơn vị / Trung tâm / Cơ sở ===
  { test: /trung tâm.*phẫu thuật|nội soi.*phẫu thuật/i, visual: { icon: Scissors, palette: 'rose' } },
  { test: /trung tâm/i,                          visual: { icon: Hospital,      palette: 'violet' } },
  { test: /đơn vị/i,                             visual: { icon: Hospital,      palette: 'violet' } },
  { test: /cơ sở/i,                              visual: { icon: MapPin,        palette: 'slate' } },
  { test: /trạm y tế/i,                          visual: { icon: Hospital,      palette: 'rose' } },
  { test: /thư ký.*phó giám đốc/i,               visual: { icon: UserCog,       palette: 'slate' } },

  // === Khoa lâm sàng — specific ===
  { test: /cấp cứu/i,                            visual: { icon: Activity,      palette: 'rose' } },
  { test: /gây mê|hồi sức/i,                     visual: { icon: Syringe,       palette: 'rose' } },
  { test: /phụ sản|sản phụ|sơ sinh/i,            visual: { icon: Baby,          palette: 'rose' } },
  { test: /thần kinh|não/i,                      visual: { icon: Brain,         palette: 'rose' } },
  { test: /tai mũi họng/i,                       visual: { icon: Ear,           palette: 'rose' } },
  { test: /mắt/i,                                visual: { icon: Eye,           palette: 'rose' } },
  { test: /chấn thương chỉnh hình|cơ xương khớp|lồng ngực|phẫu thuật/i, visual: { icon: Bone, palette: 'rose' } },
  { test: /hô hấp/i,                             visual: { icon: Wind,          palette: 'rose' } },
  { test: /thận|tiết niệu|niệu/i,                visual: { icon: Droplets,      palette: 'rose' } },
  { test: /dinh dưỡng|tiết chế/i,                visual: { icon: Soup,          palette: 'rose' } },
  { test: /xét nghiệm|vi sinh|giải phẫu bệnh/i,  visual: { icon: FlaskConical,  palette: 'rose' } },
  { test: /chẩn đoán hình ảnh|thăm dò/i,         visual: { icon: Microscope,    palette: 'rose' } },
  { test: /dược/i,                               visual: { icon: Pill,          palette: 'rose' } },
  { test: /kiểm soát nhiễm khuẩn/i,              visual: { icon: ShieldPlus,    palette: 'rose' } },
  { test: /pháp y|pháp lý/i,                     visual: { icon: Scale,         palette: 'blue' } },

  // === Fallback by prefix ===
  { test: /^khoa\b/i,                            visual: { icon: Stethoscope,   palette: 'rose' } },
  { test: /^phòng\b/i,                           visual: { icon: Briefcase,     palette: 'blue' } },
];

const DEFAULT_VISUAL: DeptVisual = { icon: Building2, palette: 'slate' };

export function getDeptVisual(name: string): DeptVisual {
  for (const rule of RULES) {
    if (rule.test.test(name)) return rule.visual;
  }
  return DEFAULT_VISUAL;
}
