import type { AdminSubmission } from '../services/api';

export const statusLabels: Record<AdminSubmission['status'], string> = {
  pending: '待受理', processing: '处理中', resolved: '已解决', rejected: '已驳回',
};
export const statusClasses: Record<AdminSubmission['status'], string> = {
  pending: 'bg-[#FFF4D6] text-[#7A4B00] border-[#7A4B00]',
  processing: 'bg-[#EAF3FB] text-[#004E98] border-[#004E98]',
  resolved: 'bg-[#E7F5F1] text-[#176B57] border-[#176B57]',
  rejected: 'bg-[#FAF0F0] text-[#B51F1F] border-[#B51F1F]',
};
