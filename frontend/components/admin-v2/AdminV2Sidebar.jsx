import Link from 'next/link';

const navItems = [
  { key: 'dashboard', label: '대시보드', href: '/admin/v2#top' },
  { key: 'users', label: '사용자', href: '/admin/v2#users' },
  { key: 'imports', label: '가져오기', href: '/admin/v2#imports' },
  { key: 'operations', label: '운영', href: '/admin/v2#operations' },
];

export default function AdminV2Sidebar({ active }) {
  return null;
}
