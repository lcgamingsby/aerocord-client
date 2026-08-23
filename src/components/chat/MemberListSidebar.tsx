import React from 'react';
import { ServerMember, Role, User } from '../../types';
import { ShieldCheck, Crown } from 'lucide-react';

interface MemberListSidebarProps {
  members: ServerMember[];
  roles: Role[];
  ownerId?: string;
  onlineUsers: Map<string, { status: string; customStatus?: string }>;
  onViewProfile?: (user: User, member?: ServerMember) => void;
}

export const MemberListSidebar: React.FC<MemberListSidebarProps> = ({
  members,
  roles,
  ownerId,
  onlineUsers,
  onViewProfile
}) => {
  const getRoleForMember = (m: ServerMember): Role | undefined => {
    return roles.find(r => m.roleIds.includes(r.id));
  };

  const adminMembers = members.filter(m => {
    const role = getRoleForMember(m);
    return m.userId === ownerId || role?.permissions.administrator || role?.name.toLowerCase().includes('admin');
  });

  const regularMembers = members.filter(m => !adminMembers.includes(m));

  const renderMemberRow = (member: ServerMember) => {
    const user = member.user;
    if (!user) return null;

    const presence = onlineUsers.get(user.id);
    const status = presence?.status || user.status || 'offline';
    const customStatus = presence?.customStatus || user.customStatus;
    const isOwner = user.id === ownerId;
    const role = getRoleForMember(member);

    const statusColors: { [key: string]: string } = {
      online: 'bg-emerald-500',
      idle: 'bg-amber-500',
      dnd: 'bg-rose-500',
      offline: 'bg-slate-500'
    };

    return (
      <div
        key={member.userId}
        onClick={() => onViewProfile && onViewProfile(user, member)}
        className="group flex items-center px-2 py-1.5 rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer"
      >
        <div className="relative mr-2.5 flex-shrink-0">
          <img
            src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`}
            alt={user.username}
            className="w-7 h-7 rounded-lg object-cover"
          />
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#11131a] ${
              statusColors[status] || statusColors.offline
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1">
            <span
              className="font-semibold text-xs truncate"
              style={{ color: role?.color || '#e2e8f0' }}
            >
              {member.nickname || user.username}
            </span>
            {isOwner && (
              <span title="Server Owner" className="flex-shrink-0 flex items-center">
                <Crown size={12} className="text-amber-400" />
              </span>
            )}
            {!isOwner && role?.permissions.administrator && (
              <span title="Admin" className="flex-shrink-0 flex items-center">
                <ShieldCheck size={12} className="text-indigo-400" />
              </span>
            )}
          </div>
          {customStatus && (
            <div className="text-[10px] text-slate-400 truncate">{customStatus}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-56 lg:w-60 bg-[#11131a] border-l border-white/5 flex flex-col h-full select-none overflow-y-auto p-3 flex-shrink-0 animate-in slide-in-from-right-4 duration-150">
      {adminMembers.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
            Admin — {adminMembers.length}
          </div>
          <div className="space-y-0.5">{adminMembers.map(renderMemberRow)}</div>
        </div>
      )}

      <div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
          Members — {regularMembers.length}
        </div>
        <div className="space-y-0.5">{regularMembers.map(renderMemberRow)}</div>
      </div>
    </div>
  );
};
